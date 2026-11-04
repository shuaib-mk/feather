import { median, getCycleStatistics, getPrediction, type PeriodRecord } from "../../client/src/lib/periodEngine";
import { isOwnDataQuestion, LAST_CYCLE_PATTERNS, DAYS_UNTIL_PATTERNS, GUARANTEE_PATTERNS, SYMPTOM_HISTORY_PATTERNS } from "./intent";

/** Guardrail v2, Item 3: answers about the user's OWN logged data.
 * Pure and deterministic: no model call. Only logged numbers are stated
 * (counts, median, range, period length, predicted range) - never a verdict.
 * Must stay free of the banned words: safe, guaranteed, clear window,
 * normal, abnormal, healthy, unhealthy, fertile, ovulating, ovulation window.
 */
export const OVERLAP_DISCLAIMER_TEXT =
  "Estimates based on your logged cycles. Cycles vary, so this is not a guarantee and not contraception or medical advice.";
export const NOT_ENOUGH_DATA_MESSAGE =
  "Not enough data yet. Log at least 2 more periods and I can show your numbers.";
export const VERDICT_TAIL =
  "Whether that is typical for you is a question for a doctor. I can only log and plan.";

export interface OwnDataContext {
  periods?: Array<{ startDate: string; endDate?: string | null }>;
  logs?: Array<{ logDate: string; symptoms?: string[] | null; kind?: string | null }>;
  cycleStats?: { avgPeriodLength?: number; nextPeriodEarliest?: string | null; nextPeriodLatest?: string | null };
  /** Today (YYYY-MM-DD); needed for "days until" and history answers. */
  currentDate?: string;
  /** Symptoms the same message is about ("I have headaches. Have I had this before?"). */
  focusSymptoms?: string[];
}

/** Group 9: the ONE statistics source. Same records, same eligibility rule and
 * same recent window as the Stats page and the prediction engine. */
function engineRecords(ctx: OwnDataContext): PeriodRecord[] {
  const starts = [...new Set((ctx.periods || []).map((p) => p.startDate).filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  return starts.map((s, i) => {
    const p = (ctx.periods || []).find((x) => x.startDate === s);
    return { id: "own-" + i, startDate: s, ...(p && p.endDate && p.endDate >= s ? { endDate: p.endDate } : {}), confirmed: true, source: "manual" } as PeriodRecord;
  });
}

/** Base predicted window, identical to the Dashboard's: the client's engine
 * result when sent, otherwise getPrediction on the same records. */
export function ownPredictedWindow(ctx: OwnDataContext): { earliest: string; latest: string } | null {
  if (ctx.cycleStats?.nextPeriodEarliest && ctx.cycleStats?.nextPeriodLatest) return { earliest: ctx.cycleStats.nextPeriodEarliest, latest: ctx.cycleStats.nextPeriodLatest };
  const recs = engineRecords(ctx);
  if (!recs.length) return null;
  const today = ctx.currentDate || recs[recs.length - 1].startDate;
  const pred = getPrediction(recs, today);
  return pred.earliestStart && pred.latestStart ? { earliest: pred.earliestStart, latest: pred.latestStart } : null;
}

const SYMPTOM_WORDS: Array<[string, RegExp]> = [
  ["cramps", /\bcramps?\b/i], ["headache", /\bheadaches?\b/i], ["backache", /\bback\s*aches?\b|\bback\s+pain\b/i],
  ["bloating", /\bbloat(?:ing|ed)?\b/i], ["breast_tenderness", /\b(?:breast\s+tenderness|tender\s+breasts?|sore\s+breasts?)\b/i],
  ["acne", /\bacne\b|\bpimples?\b/i], ["fatigue", /\bfatigue\b|\btired(?:ness)?\b/i], ["cravings", /\bcravings?\b/i],
  ["nausea", /\bnause(?:a|ous)\b/i], ["mood_swings", /\bmood\s+swings?\b/i], ["anxiety", /\banxi(?:ety|ous)\b/i],
  ["insomnia", /\binsomnia\b|\bcan'?t\s+sleep\b/i], ["dizziness", /\bdizz(?:y|iness)\b/i], ["appetite_change", /\bappetite\b/i],
];
export function symptomsIn(text: string): string[] {
  return SYMPTOM_WORDS.filter(([, re]) => re.test(text)).map(([k]) => k);
}
const symLabel = (s: string) => s.replace(/_/g, " ");
export interface OwnDataResult { kind: "own_data_answer"; message: string; usedLiveModel: false }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NUM: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_FULL: Record<string, string> = {
  january: "January", february: "February", march: "March", april: "April", may: "May", june: "June",
  july: "July", august: "August", september: "September", october: "October", november: "November", december: "December",
  jan: "January", feb: "February", mar: "March", apr: "April", jun: "June", jul: "July", aug: "August",
  sep: "September", sept: "September", oct: "October", nov: "November", dec: "December",
};
function label(key: string): string {
  const m = parseInt(key.slice(5, 7), 10), d = parseInt(key.slice(8, 10), 10);
  return MONTHS[(m || 1) - 1] + " " + d;
}
function addDaysKey(key: string, days: number): string {
  const dt = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) + days * 86400000);
  const p = (n: number) => String(n).padStart(2, "0");
  return dt.getUTCFullYear() + "-" + p(dt.getUTCMonth() + 1) + "-" + p(dt.getUTCDate());
}
export function computeOwnDataStats(ctx: OwnDataContext): { completedCycles: number; medianDays: number | null; minDays: number | null; maxDays: number | null; avgPeriodDays: number | null; lastStart: string | null; excludedCycles: number } {
  const starts = [...new Set((ctx.periods || []).map((p) => p.startDate).filter(Boolean))].sort();
  // Group 9: same eligibility rule and recent window as the engine.
  const engine = getCycleStatistics(engineRecords(ctx));
  let avgPeriodDays: number | null = ctx.cycleStats?.avgPeriodLength ?? null;
  if (avgPeriodDays == null) {
    const durs = (ctx.periods || []).filter((p) => p.endDate && p.endDate >= p.startDate)
      .map((p) => Math.round((Date.parse(p.endDate!) - Date.parse(p.startDate)) / 86400000) + 1);
    avgPeriodDays = durs.length ? Math.round((durs.reduce((a, b) => a + b, 0) / durs.length) * 10) / 10 : null;
  }
  return {
    completedCycles: engine.eligibleCycleCount,
    medianDays: engine.medianCycleLength,
    minDays: engine.shortestCycle,
    maxDays: engine.longestCycle,
    avgPeriodDays,
    lastStart: starts.length ? starts[starts.length - 1] : null,
    excludedCycles: engine.excludedForEstimationCount,
  };
}

/** Group 8: deterministic answers that do not need two completed cycles. */
function buildGroup8Answer(text: string, ctx: OwnDataContext, s: ReturnType<typeof computeOwnDataStats>): string | null {
  const today = ctx.currentDate || null;
  const starts = [...new Set((ctx.periods || []).map((p) => p.startDate).filter(Boolean))].sort();
  if (LAST_CYCLE_PATTERNS.some((p) => p.test(text))) {
    if (starts.length < 2) return "You need at least two logged period starts for a completed cycle. " + (starts.length === 1 ? "So far one start is logged (" + label(starts[0]) + ")." : "No periods are logged yet.");
    const a = starts[starts.length - 2], b = starts[starts.length - 1];
    const days = Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
    const outside = days < 15 || days > 90;
    return "Your last completed cycle was " + days + " days (" + label(a) + " to " + label(b) + ")." + (outside ? " It is outside 15 to 90 days, so it is left out of your estimates." : "");
  }
  if (GUARANTEE_PATTERNS.some((p) => p.test(text))) {
    return "No — it's an estimate, not a guarantee. " + OVERLAP_DISCLAIMER_TEXT;
  }
  if (DAYS_UNTIL_PATTERNS.some((p) => p.test(text))) {
    const w = ownPredictedWindow(ctx);
    if (!w || !today) return "Not enough data yet to estimate your next period. Log your period starts and I can count the days.";
    const d1 = Math.round((Date.parse(w.earliest) - Date.parse(today)) / 86400000);
    const d2 = Math.round((Date.parse(w.latest) - Date.parse(today)) / 86400000);
    const win = label(w.earliest) + " to " + label(w.latest);
    if (d2 < 0) return "Your estimated window (" + win + ") has passed without a logged start. " + OVERLAP_DISCLAIMER_TEXT;
    if (d1 <= 0) return "You're inside your estimated window now (" + win + "). " + OVERLAP_DISCLAIMER_TEXT;
    return "About " + d1 + " to " + d2 + " days from today (estimated window " + win + "). " + OVERLAP_DISCLAIMER_TEXT;
  }
  if (SYMPTOM_HISTORY_PATTERNS.some((p) => p.test(text))) {
    const wanted = Array.from(new Set([...symptomsIn(text), ...(ctx.focusSymptoms || [])]));
    if (wanted.length === 0) return "Which symptom should I look up? For example: 'did I have cramps last cycle?'";
    const logs = (ctx.logs || []).filter((l) => l && l.logDate && (!today || l.logDate < today));
    const lastCycleOnly = /\blast\s+(?:cycle|period|month)\b/i.test(text);
    let from: string | null = null, to: string | null = null;
    if (lastCycleOnly) {
      const past = starts.filter((d) => !today || d <= today);
      if (past.length < 2) return "I can't tell which days were your last cycle yet — at least two period starts are needed.";
      from = past[past.length - 2]; to = past[past.length - 1];
    }
    const parts = wanted.map((sym) => {
      const hits = logs.filter((l) => (l.symptoms || []).includes(sym) && (!from || (l.logDate >= from! && l.logDate < to!))).map((l) => l.logDate).sort().reverse();
      if (hits.length === 0) return "no record of " + symLabel(sym) + (lastCycleOnly ? " in your last cycle" : " in your earlier logs");
      return symLabel(sym) + " on " + hits.slice(0, 3).map(label).join(", ") + (hits.length > 3 ? " and " + (hits.length - 3) + " more" : "");
    });
    const msg = parts.join("; ");
    return "From your logs: " + msg.charAt(0) + msg.slice(1) + ".";
  }
  return null;
}
export function buildOwnDataAnswer(text: string, ctx: OwnDataContext): OwnDataResult | null {
  if (!isOwnDataQuestion(text)) return null;
  const s = computeOwnDataStats(ctx);
  if (/\bwhen\s+did\s+my\s+last\s+period\s+start\b|\bwhen\s+was\s+my\s+last\s+period\b|\bwhen\s+my\s+last\s+period\s+(?:was|started)\b|\blast\s+period\s+start\b/i.test(text)) {
    if (!s.lastStart) return { kind: "own_data_answer", message: "You have not logged any periods yet. Log your first period to get started.", usedLiveModel: false };
    return { kind: "own_data_answer", message: "Your last logged period started " + label(s.lastStart) + ".", usedLiveModel: false };
  }
  const monthQ = text.toLowerCase().match(/\bdid\s+i\s+log\s+anything\s+in\s+([a-z]+)\b/);
  if (monthQ && MONTH_NUM[monthQ[1]]) {
    const m = MONTH_NUM[monthQ[1]];
    const monthDates = [...new Set([...(ctx.periods || []).map((p) => p.startDate), ...(ctx.logs || []).map((l) => l.logDate)])].filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && +d.slice(5, 7) === m).sort().map((d) => label(d));
    const monthName = MONTH_FULL[monthQ[1]];
    if (monthDates.length === 0) return { kind: "own_data_answer", message: "Nothing logged in " + monthName + ".", usedLiveModel: false };
    return { kind: "own_data_answer", message: "Logged in " + monthName + ": " + monthDates.join(", ") + ".", usedLiveModel: false };
  }
  const g8 = buildGroup8Answer(text, ctx, s);
  if (g8) return { kind: "own_data_answer", message: g8, usedLiveModel: false };
  if (s.completedCycles < 2 || s.medianDays == null) {
    return { kind: "own_data_answer", message: NOT_ENOUGH_DATA_MESSAGE, usedLiveModel: false };
  }
  const stats = "From your " + s.completedCycles + " logged cycles: median " + s.medianDays + " days (range " + s.minDays + " to " + s.maxDays + " days)." +
    (s.excludedCycles > 0 ? " " + s.excludedCycles + " unusual cycle" + (s.excludedCycles === 1 ? " is" : "s are") + " left out of the estimate." : "") +
    (s.avgPeriodDays != null ? " Periods last about " + s.avgPeriodDays + " days." : "");
  if (/\bwhen\s+is\s+my\s+next\s+period\b|\bmy\s+next\s+period\b/i.test(text) && s.lastStart) {
    // Group 9: the same base window as the Dashboard (engine prediction).
    const w = ownPredictedWindow(ctx);
    const earliest = w ? w.earliest : addDaysKey(s.lastStart, s.minDays!);
    const latest = w ? w.latest : addDaysKey(s.lastStart, s.maxDays!);
    return { kind: "own_data_answer", message: "Your next period estimated window is between " + label(earliest) + " and " + label(latest) + ". " + OVERLAP_DISCLAIMER_TEXT, usedLiveModel: false };
  }
  if (/\bis\s+\d+\s*days?\s+normal\s+for\s+me\b|\bis\s+my\s+cycle\s+regular\b/i.test(text)) {
    return { kind: "own_data_answer", message: stats + " " + VERDICT_TAIL, usedLiveModel: false };
  }
  return { kind: "own_data_answer", message: stats, usedLiveModel: false };
}
