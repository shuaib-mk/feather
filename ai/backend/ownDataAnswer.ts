import { median } from "../../client/src/lib/periodEngine";
import { isOwnDataQuestion } from "./intent";

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
  cycleStats?: { avgPeriodLength?: number; nextPeriodEarliest?: string | null; nextPeriodLatest?: string | null };
}
export interface OwnDataResult { kind: "own_data_answer"; message: string; usedLiveModel: false }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function label(key: string): string {
  const m = parseInt(key.slice(5, 7), 10), d = parseInt(key.slice(8, 10), 10);
  return MONTHS[(m || 1) - 1] + " " + d;
}
function addDaysKey(key: string, days: number): string {
  const dt = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) + days * 86400000);
  const p = (n: number) => String(n).padStart(2, "0");
  return dt.getUTCFullYear() + "-" + p(dt.getUTCMonth() + 1) + "-" + p(dt.getUTCDate());
}
export function computeOwnDataStats(ctx: OwnDataContext): { completedCycles: number; medianDays: number | null; minDays: number | null; maxDays: number | null; avgPeriodDays: number | null; lastStart: string | null } {
  const starts = [...new Set((ctx.periods || []).map((p) => p.startDate).filter(Boolean))].sort();
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const diff = Math.round((Date.parse(starts[i]) - Date.parse(starts[i - 1])) / 86400000);
    if (diff > 0) lengths.push(diff);
  }
  let avgPeriodDays: number | null = ctx.cycleStats?.avgPeriodLength ?? null;
  if (avgPeriodDays == null) {
    const durs = (ctx.periods || []).filter((p) => p.endDate && p.endDate >= p.startDate)
      .map((p) => Math.round((Date.parse(p.endDate!) - Date.parse(p.startDate)) / 86400000) + 1);
    avgPeriodDays = durs.length ? Math.round((durs.reduce((a, b) => a + b, 0) / durs.length) * 10) / 10 : null;
  }
  return {
    completedCycles: lengths.length,
    medianDays: lengths.length ? median(lengths) : null,
    minDays: lengths.length ? Math.min(...lengths) : null,
    maxDays: lengths.length ? Math.max(...lengths) : null,
    avgPeriodDays,
    lastStart: starts.length ? starts[starts.length - 1] : null,
  };
}
export function buildOwnDataAnswer(text: string, ctx: OwnDataContext): OwnDataResult | null {
  if (!isOwnDataQuestion(text)) return null;
  const s = computeOwnDataStats(ctx);
  if (s.completedCycles < 2 || s.medianDays == null) {
    return { kind: "own_data_answer", message: NOT_ENOUGH_DATA_MESSAGE, usedLiveModel: false };
  }
  const stats = "From your " + s.completedCycles + " logged cycles: median " + s.medianDays + " days (range " + s.minDays + " to " + s.maxDays + " days)." +
    (s.avgPeriodDays != null ? " Periods last about " + s.avgPeriodDays + " days." : "");
  if (/\bwhen\s+is\s+my\s+next\s+period\b|\bmy\s+next\s+period\b/i.test(text) && s.lastStart) {
    const earliest = ctx.cycleStats?.nextPeriodEarliest || addDaysKey(s.lastStart, s.minDays!);
    const latest = ctx.cycleStats?.nextPeriodLatest || addDaysKey(s.lastStart, s.maxDays!);
    return { kind: "own_data_answer", message: "Your next period is estimated between " + label(earliest) + " and " + label(latest) + ". " + OVERLAP_DISCLAIMER_TEXT, usedLiveModel: false };
  }
  if (/\bis\s+\d+\s*days?\s+normal\s+for\s+me\b|\bis\s+my\s+cycle\s+regular\b/i.test(text)) {
    return { kind: "own_data_answer", message: stats + " " + VERDICT_TAIL, usedLiveModel: false };
  }
  return { kind: "own_data_answer", message: stats, usedLiveModel: false };
}
