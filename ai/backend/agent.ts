// Muse Spark Agent with tool calling loop for:
// 1. Structured Voice Logging (14 symptoms, flow, mood, energy, sleep)
// 2. Landmark Recall (fuzzy festival date resolution)
// 3. Plan Around It (cycle overlap checking with zero medical advice)
// 4. Accession Slip Multi-Turn Corrections (voice & text)
// 5. Tool Call Inspection & Observability

import { getConfig } from "./config";
import { checkMedicalAdviceGuardrail, MEDICAL_REFUSAL_MESSAGE, checkSevereSymptomEscalation, SEVERE_SYMPTOM_ESCALATION_MESSAGE, getGuardrailResponseMessage, checkModelOutputGuard, REDIRECT_MESSAGES, checkFallSevereInput, SEVERE_FALL_CARE_MESSAGE } from "./guardrail";
import { buildOwnDataAnswer } from "./ownDataAnswer";
import { buildOwnEventsAnswer } from "./eventAnswers";

import { todayLocal, parseMonthDay, isValidDateKey, addDaysToKey, diffDateKeys } from "../../client/src/lib/localDate";
import { evaluateEventOverlap, type PeriodRecord } from "../../client/src/lib/periodEngine";
import {
  resolveLandmarkExpression,
  resolveDateExpression,
  applySlipCorrections,
  applyDayOffset,
  parseRelativeExpression,
  type LandmarkPacks,
} from "./dateArithmetic";
import { classifyIntent } from "./intent";
import { en } from "./lexicon/en";
import { hi } from "./lexicon/hi";
import { ml } from "./lexicon/ml";
import { ta } from "./lexicon/ta";
import { kn } from "./lexicon/kn";
import type { LanguageLexicon } from "./lexicon/en";

// The app's existing 14 symptoms
export const VALID_SYMPTOMS = [
  "cramps",
  "headache",
  "backache",
  "bloating",
  "breast_tenderness",
  "acne",
  "fatigue",
  "cravings",
  "nausea",
  "mood_swings",
  "anxiety",
  "insomnia",
  "dizziness",
  "appetite_change",
] as const;

export type ValidSymptom = (typeof VALID_SYMPTOMS)[number];

export interface StructuredEntry {
  date: string; // YYYY-MM-DD
  /** Optional period end date for a backfilled range, e.g. from X to Y. Only on period_started entries. */
  endDate?: string | null;
  flow: "none" | "spotting" | "light" | "medium" | "heavy" | null;
  symptoms: ValidSymptom[];
  mood: string | null;
  energy: number | null; // 1..5
  sleep: number | null; // hours
  notes: string | null;
  isApproximate?: boolean;
  landmarkName?: string | null;
  kind?: "period_started" | "period_ended" | "daily_log";
  dateExplanation?: string | null;
  dateWindow?: { start: string; end: string } | null;
}

export interface ActivityStep {
  step: string;
  detail?: string;
  status: "pending" | "done" | "clarify";
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  args: Record<string, any>;
  result: Record<string, any>;
  latencyMs: number;
  model: string;
  executedBy: "meta-model" | "offline-rule-engine";
}

export interface AgentContext {
  cycleStats?: {
    avgCycleLength: number;
    avgPeriodLength: number;
    lastPeriodStart?: string | null;
    nextPeriodEarliest?: string | null;
    nextPeriodLatest?: string | null;
    isDefault?: boolean;
  };
  periods?: Array<{ startDate: string; endDate?: string | null }>;
  logs?: Array<{ logDate: string }>;
  currentDate?: string; // YYYY-MM-DD
  provider?: "meta" | "baseten";
  pendingEntry?: StructuredEntry | null;
  recentEntry?: StructuredEntry | null;
  recentEntries?: StructuredEntry[];
  locale?: string;
  matchedEvents?: Array<{ title: string; date: string }>;
  events?: Array<{ title: string; date: string; endDate?: string | null }>;
  calendarVisible?: boolean;
  defaultDate?: string;
  landmarkPacks?: LandmarkPacks | null;
  cycleStatsIsDefault?: boolean;
}

export function negatedFlowValue(text: string): string | null {
  const lower = text.toLowerCase();
  const m1 = lower.match(/\b(none|spotting|light|medium|heavy)\s*,?\s*(?:and\s+)?not\s+(none|spotting|light|medium|heavy)\b/);
  if (m1) return m1[2];
  const m2 = lower.match(/\bnot\s+(none|spotting|light|medium|heavy)\b[^.]*?\b(none|spotting|light|medium|heavy)\b/);
  if (m2) return m2[1];
  return null;
}
export function selectCorrectionTarget(text: string, pending: StructuredEntry | null | undefined, recent: StructuredEntry | null | undefined, candidates?: StructuredEntry[] | null): StructuredEntry | null {
  if (pending) return pending;
  const pool: StructuredEntry[] = (candidates && candidates.length ? candidates : (recent ? [recent] : []));
  if (!pool.length) return recent ?? null;
  const neg = negatedFlowValue(text);
  if (neg) {
    const hit = pool.find((e) => (e.flow || "").toLowerCase() === neg);
    if (hit) return hit;
  }
  return pool[0] ?? recent ?? null;
}

// Q3.3: a date named by anything other than bare today-words (digits, month
// names, weekdays, relative phrases, landmarks). Bare "today" never counts:
// statements about today must never edit old entries.
function namesNonTodayDate(text: string, today: string, packs?: LandmarkPacks | null): string | null {
  const stripped = text.replace(/\b(today|tonight|this morning|right now)\b/gi, " ");
  return resolveDateExpression(stripped, today, packs).date;
}

export interface AgentResult {
  kind?: "own_data_answer";
  usedLiveModel?: boolean;
  mode?: "live" | "offline";
  modeReason?: string | null;
  plannedEvents?: Array<{ title: string; date: string; endDate?: string }>;
  usedPersonalAnchor?: boolean;
  message: string;
  entry?: StructuredEntry | null;
  /** True when entry is a corrected slip that must replace (not merge into) the stored day log. */
  replacesExisting?: boolean;
  /** All backfilled entries, oldest first. entry is always entries[0] for old code. */
  entries?: StructuredEntry[];
  needsClarification: boolean;
  clarificationQuestion?: string | null;
  activityTrail: ActivityStep[];
  toolCalls?: ToolCallRecord[];
  comparison?: {
    dates: Array<{ date: string; label: string; status: string; note: string; window: { start: string; end: string } | null }>;
    summary: string;
  };
  planOverlaps?: Array<{
    name: string;
    eventDate: string;
    overlap: "period-day" | "likely" | "possible" | "unlikely" | "unknown" | "past";
    overlapNote: string;
  }>;
}

// Tool definitions for OpenAI-compatible chat completions API (used by Meta Model API and Baseten)
const TOOLS = [
  {
    type: "function",
    function: {
      name: "log_entry",
      description: "Creates or updates a structured cycle/daily log entry from user's voice message.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Calendar date in YYYY-MM-DD format. Defaults to current date if not specified.",
          },
          endDate: {
            type: "string",
            description: "Optional period end date (YYYY-MM-DD) when the user gives a range, e.g. from October 2 to October 6. Only for period starts.",
          },
          flow: {
            type: "string",
            enum: ["none", "spotting", "light", "medium", "heavy"],
            description: "Menstrual flow level.",
          },
          symptoms: {
            type: "array",
            items: {
              type: "string",
              enum: VALID_SYMPTOMS,
            },
            description: "List of symptoms from the app's 14 supported keys.",
          },
          mood: {
            type: "string",
            description: "User mood (e.g., Great, Good, Okay, Low, Irritable, Anxious, Emotional, Calm).",
          },
          energy: {
            type: "integer",
            minimum: 1,
            maximum: 5,
            description: "Energy rating from 1 (lowest) to 5 (highest).",
          },
          sleep: {
            type: "number",
            description: "Hours of sleep.",
          },
          notes: {
            type: "string",
            description: "Any extra notes or transcribed remarks.",
          },
          isApproximate: {
            type: "boolean",
            description: "Set to true if date was recalled relative to a milestone or life event.",
          },
          landmarkName: {
            type: "string",
            description: "Name of calendar landmark or life event if applicable (e.g. New Year's Day, Marathon, Flight).",
          },
          kind: { type: "string", enum: ["period_started", "period_ended", "daily_log"], description: "Entry kind." },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_entry",
      description: "Applies conversational corrections to a pending Accession Slip (e.g. date change, adding/removing symptoms, modifying flow).",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          flow: { type: "string", enum: ["none", "spotting", "light", "medium", "heavy"] },
          symptoms_add: { type: "array", items: { type: "string", enum: VALID_SYMPTOMS } },
          symptoms_remove: { type: "array", items: { type: "string", enum: VALID_SYMPTOMS } },
          addSymptoms: { type: "array", items: { type: "string", enum: VALID_SYMPTOMS } },
          removeSymptoms: { type: "array", items: { type: "string", enum: VALID_SYMPTOMS } },
          mood: { type: "string" },
          energy: { type: "integer", minimum: 1, maximum: 5 },
          sleep: { type: "number" },
          notes: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "milestone_lookup",
      description: "Looks up dates for verified calendar landmarks in 2025, 2026, and 2027 for landmark date recall (e.g. New Year's Day, Valentine's Day, International Women's Day, New Year's Eve).",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of milestone (e.g. New Year's Day, International Women's Day, New Year's Eve).",
          },
          year: {
            type: "integer",
            description: "Year (2025, 2026, or 2027). Defaults to current or most recent year.",
          },
          offsetDays: { type: "integer", description: "Days to add to the landmark date (negative for before)." },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cycle_history",
      description: "Retrieves user's cycle averages, past periods, and predicted next window.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_overlap",
      description: "Checks whether upcoming life events (marathons, flights, exams, vacations, weddings) overlap the predicted period window.",
      parameters: {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                date: { type: "string", description: "YYYY-MM-DD" },
              },
              required: ["name", "date"],
            },
          },
        },
        required: ["events"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_calendar_events",
      description: "Returns only the personal calendar events the client matched and consented to share in context.matchedEvents. Never invent events.",
      parameters: { type: "object", properties: { query: { type: "string" } } },
    },
  },
];

const SYSTEM_PROMPT = `You are Feather, a voice-first menstrual logging and planning companion built for women globally.
You help women log their cycle, recall past periods relative to universal calendar landmarks (Landmark Recall), and plan around upcoming life events such as flights, marathons, work sprints, exams, and vacations (Plan Around It).
You support natural conversational speech in any language with seamless multilingual recognition.

CRITICAL NON-NEGOTIABLE SAFETY RULES:
1. STRICT MEDICAL & HEALTH REFUSAL:
   - NEVER give medical advice, interpret symptoms, diagnose conditions, recommend medication or dosages, or provide fertility, contraception, or pregnancy-risk guidance.
   - You MUST NEVER use words like "safe", "guaranteed", "clear window", or anything implying pregnancy or fertility safety.
   - NEVER state whether a cycle length, period length, flow or symptom is normal, healthy or abnormal. NEVER give ovulation or fertile-window information. For such questions reply only with: "I can't help with that, but I can log how you feel or show your logged cycles."
   - If the user asks ANY question seeking medical diagnosis, symptom interpretation, medication, treatment, or pregnancy risk, you MUST refuse immediately with this exact fixed message and nothing else:
     "I can only help with logging and planning. For health questions, please talk to a doctor."

2. PURE LOGGING & PLANNING CAPABILITIES:
   - Voice Logging: Extract date, flow, symptoms, mood, energy (1-5), sleep (hours), and notes. Call tool \`log_entry\`.
   - Slip Correction: If the user provides conversational corrections to a pending slip ("no, make it the 3rd", "add headache", "change flow to light"), call \`update_entry\`.
   - Landmark Recall: If user gives fuzzy dates ("around New Year's", "after International Women's Day", "two days before vacation"), call tool \`milestone_lookup\`. If ambiguous, ask a polite, concise clarifying question ("Was it before or after New Year's?").
   - Plan Around It: If user mentions upcoming events ("marathon on Nov 15, flight to Tokyo on Dec 4, exam on Oct 10"), call \`check_overlap\`. Use ONLY neutral scheduling language: "Likely overlap", "Possible overlap", or "Unlikely to overlap (estimate)". Never imply certainty or guarantees.
   - Backfill (several past periods in one message): call one log_entry per period, each with its own date and kind "period_started". If the user lists several periods, log them ALL (one call each), never just the first. If she gives a start and an end ("from October 2 to October 6", "started Sept 9 and ended Sept 13"), put the start in date and the end in endDate on a single period_started call.

   - Next-weekday ambiguity: if she says "next <weekday>" (for example "next Tuesday"), do NOT call log_entry yet. Ask which one she means: the coming <weekday> (<month> <day>) or the one a week later (<month> <day>), computing both dates from today, and wait for her answer.

Tone: Warm, respectful, concise, neutral, non-medical.
Reply in the user's language (context locale) when known. When a pending entry exists, call update_entry with a patch; do not ask the user to re-log.

If the user states that a period started (including 'first period'), ALWAYS call log_entry, even if they sound upset. Keep any text to one or two short sentences. Never say whether something is normal, abnormal, healthy or safe. If the message describes fainting, falling, or heavy bleeding with severe pain, the app shows a care message; do not give advice yourself.`;


function recordsFromContext(context: AgentContext): PeriodRecord[] {
  const periods = context.periods && context.periods.length > 0
    ? context.periods
    : context.cycleStats?.lastPeriodStart
      ? [{ startDate: context.cycleStats.lastPeriodStart, endDate: null }]
      : [];
  return periods.map((per, i) => ({
    id: `ctx-${i}`,
    startDate: per.startDate,
    endDate: per.endDate || undefined,
    confirmed: true,
    source: "manual" as const,
    createdAt: "",
    updatedAt: "",
  }));
}

function evaluateContextOverlaps(events: Array<{ name: string; date: string; endDate?: string }>, context: AgentContext, today: string) {
  const records = recordsFromContext(context);
  const rankOf = (s: string): number => OVERLAP_RANK[s] ?? (s === "logged" ? 5 : 0);
  return events.map((ev) => {
    // Q3.6: ranged events evaluate every day in the span (capped); keep the strongest signal.
    let result = evaluateEventOverlap(ev.date, records, today);
    if (ev.endDate && ev.endDate > ev.date) {
      let d = addDaysToKey(ev.date, 1);
      let guard = 0;
      while (d <= ev.endDate && guard < 366) {
        const r = evaluateEventOverlap(d, records, today);
        if (rankOf(r.status) > rankOf(result.status)) result = r;
        d = addDaysToKey(d, 1);
        guard++;
      }
    }
    return {
      name: ev.name,
      eventDate: ev.date,
      overlap: (result.status === "logged" ? "period-day" : result.status) as "period-day" | "likely" | "possible" | "unlikely" | "unknown" | "past",
      overlapNote: result.note,
      window: result.window,
    };
  });
}

const OVERLAP_RANK: Record<string, number> = { past: 0, unlikely: 1, unknown: 2, possible: 3, likely: 4, "period-day": 5 };
const OVERLAP_VERDICT_LABELS: Record<string, string> = { logged: "Logged period", "period-day": "Logged period", likely: "Likely overlap", possible: "Possible overlap", unlikely: "Unlikely to overlap (estimate)", past: "Past", unknown: "Not enough data yet" };
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function shortDateLabel(dateKey: string): string {
  const m = parseInt(dateKey.slice(5, 7), 10);
  const d = parseInt(dateKey.slice(8, 10), 10);
  return `${SHORT_MONTHS[(m || 1) - 1]} ${d}`;
}
export function isCompareIntent(text: string): boolean {
  return /\b(which is safer|which date is safer|which is better|which date is better|compare|safer)\b/i.test(text);
}
export function scanComparisonDates(text: string, today: string): string[] {
  const MONTH_RE = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
  const re = new RegExp(`\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_RE})|(?:${MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:,?\\s+\\d{4})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b`, "gi");
  const currentYear = parseInt(today.slice(0, 4), 10);
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    let resolved: string | null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) resolved = isValidDateKey(raw) ? raw : null;
    else {
      const explicitYear = /\b\d{4}\b/.test(raw) ? parseInt(raw.match(/\b\d{4}\b/)![0], 10) : null;
      const noYear = raw.replace(/,?\s+\b\d{4}\b/, "");
      resolved = parseMonthDay(noYear, explicitYear ?? currentYear);
      if (resolved && explicitYear === null && resolved < today) resolved = parseMonthDay(noYear, currentYear + 1);
    }
    if (resolved && isValidDateKey(resolved) && !out.includes(resolved)) out.push(resolved);
  }
  return out;
}
export function buildDateComparison(text: string, today: string, context: AgentContext) {
  const dates = scanComparisonDates(text, today);
  if (dates.length < 2) return null;
  const pair = dates.slice(0, 2);
  const overlaps = evaluateContextOverlaps(pair.map((d) => ({ name: shortDateLabel(d), date: d })), context, today);
  const verdicts = overlaps.map((o) => ({ date: o.eventDate, label: shortDateLabel(o.eventDate), status: o.overlap as string, note: o.overlapNote, window: o.window ?? null }));
  const summary = (OVERLAP_RANK[verdicts[0].status] ?? 2) === (OVERLAP_RANK[verdicts[1].status] ?? 2)
    ? "Both look similar."
    : `${(OVERLAP_RANK[verdicts[0].status] ?? 2) < (OVERLAP_RANK[verdicts[1].status] ?? 2) ? verdicts[0].label : verdicts[1].label} overlaps less (estimate)`;
  const message = `${verdicts.map((v) => `${v.label}: ${OVERLAP_VERDICT_LABELS[v.status] || v.status}`).join(" · ")}. ${summary}`;
  return { dates: verdicts, summary, message };
}

export function hasAnyLoggingOrPlanningCue(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^[\s\d\/\-\.,:;]+$/.test(trimmed)) return false;
  const stripped = trimmed
    .toLowerCase()
    .replace(/\b\d+(?:st|nd|rd|th)?\b/g, " ")
    .replace(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|today|yesterday|tomorrow|tonight|morning|evening|night|day|days|week|weeks|month|months|year|years|ago|back|last|this|next|on|the|of|in|at|for|to|from|and|or)\b/g,
      " ",
    )
    .replace(/[\s\d\/\-\.,:;'"!?()]+/g, "")
    .trim();
  return stripped.length > 0;
}


// ---- Fact coverage (Prompt 5 follow-up): slips, never prose ----
// The live model path returns model prose plus structured slips/events. The
// offline disclosure logic inside parseLocally never runs on that result, so
// a fact the model mentioned only in prose was silently dropped. Coverage
// below is computed ONLY from the structured payload actually returned
// (result.entry and plannedEvents). Entries that exist only in tool-call
// history do not count: the UI renders and saves result.entry only. The
// message text is read solely to avoid duplicating a disclosure already
// appended; placement is never inferred from prose. Undated events are not
// dated facts and are never flagged here.

export interface StatedDatedFact {
  date: string;
  flow?: string | null;
  symptoms?: string[];
  eventNoun?: string;
  label: string;
  /** Bare multi-date mention: counted only by the combined live disclosure, never per-fact. */
  multiDateOnly?: boolean;
}

const COVERAGE_EVENT_NOUNS = [
  "wedding", "exam", "trip", "interview", "party", "flight",
  "vacation", "conference", "presentation", "dinner", "meeting",
  "birthday", "anniversary", "marathon", "race", "appointment", "shaadi", "sangeet",
];
const COVERAGE_MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
const COVERAGE_DATE_RE = new RegExp(`(\\d{4}-\\d{2}-\\d{2}|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${COVERAGE_MONTHS})[a-z]*\\b|\\b(?:${COVERAGE_MONTHS})[a-z]*\\s+\\d{1,2}(?:st|nd|rd|th)?\\b)`, "gi");
const COVERAGE_FLOW_RE = /\b(none|spotting|light|medium|heavy)\b/i;
const DAY_WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

function clauseAround(text: string, index: number, length: number): string {
  const start = Math.max(0, text.lastIndexOf(".", index - 1) + 1, text.lastIndexOf("!", index - 1) + 1, text.lastIndexOf("?", index - 1) + 1, text.lastIndexOf(";", index - 1) + 1, text.lastIndexOf("\n", index - 1) + 1);
  const stops = [text.indexOf(".", index + length), text.indexOf("!", index + length), text.indexOf("?", index + length), text.indexOf(";", index + length), text.indexOf("\n", index + length)].filter((i) => i !== -1);
  return text.slice(start, stops.length ? Math.min(...stops) : text.length);
}

/** Clause segment around a match, split on sentence ends, commas, "and"/"but" - keeps nearby facts separate. */
function subClauseAround(text: string, index: number, length: number): string {
  const before = text.slice(0, index);
  const after = text.slice(index + length);
  const startCut = Math.max(before.lastIndexOf(","), before.lastIndexOf(";"), before.lastIndexOf("."), before.lastIndexOf("\n"), Math.max(before.toLowerCase().lastIndexOf(" and "), before.toLowerCase().lastIndexOf(" but ")));
  const afterLow = after.toLowerCase();
  const stops = [afterLow.indexOf(","), afterLow.indexOf(";"), afterLow.indexOf("."), afterLow.indexOf("\n"), afterLow.indexOf(" and "), afterLow.indexOf(" but ")].filter((i) => i !== -1);
  const endCut = stops.length ? index + length + Math.min(...stops) : text.length;
  return text.slice(startCut + 1, endCut);
}

/** Dated facts stated in the prompt, resolved deterministically. Undated mentions are excluded. */
export function findStatedDatedFacts(userPrompt: string, today: string): StatedDatedFact[] {
  const text = userPrompt || "";
  const lower = text.toLowerCase();
  const facts: StatedDatedFact[] = [];
  const push = (fact: StatedDatedFact) => {
    if (!isValidDateKey(fact.date)) return;
    if (!facts.some((f) => f.date === fact.date && f.flow === fact.flow && f.eventNoun === fact.eventNoun)) facts.push(fact);
  };

  // "heavy yesterday" / "yesterday ... heavy" (established disclosure wording).
  const yesterdayKey = addDaysToKey(today, -1);
  const yIdx = lower.search(/\byesterday\b/);
  if (yIdx !== -1) {
    const clause = clauseAround(text, yIdx, "yesterday".length);
    const flowMatch = clause.match(/\b(none|spotting|light|medium|heavy)\s+(?:flow\s+)?yesterday\b/i)
      || clause.match(/\byesterday\b[^.!?;\n]{0,60}?\b(?:flow\s+was\s+)?(none|spotting|light|medium|heavy)\b/i);
    if (flowMatch) {
      push({ date: yesterdayKey, flow: flowMatch[1].toLowerCase(), label: `${flowMatch[1].toLowerCase()} flow yesterday (${yesterdayKey}) as a separate day` });
    } else {
      const symptoms = extractWithLexicon(clause).symptoms;
      if (symptoms.length > 0) {
        push({ date: yesterdayKey, symptoms: [...symptoms], label: `${symptoms.join(" and ")} yesterday (${yesterdayKey}) as a separate day` });
      }
    }
  }

  // Explicit calendar dates (ISO or month-day).
  COVERAGE_DATE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COVERAGE_DATE_RE.exec(text)) !== null) {
    const raw = m[1];
    const clause = clauseAround(text, m.index, raw.length);
    const before = text.slice(Math.max(0, m.index - 120), m.index);
    const nouns = [...before.matchAll(new RegExp(`\\b(${COVERAGE_EVENT_NOUNS.join("|")})\\b`, "gi"))];
    const eventNoun = nouns.length ? nouns[nouns.length - 1][1].toLowerCase() : undefined;
    const currentYear = Number(today.slice(0, 4));
    let resolved: string | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) resolved = isValidDateKey(raw) ? raw : null;
    else {
      const noYear = raw.replace(/,?\s+\b\d{4}\b/, "");
      resolved = parseMonthDay(noYear, currentYear);
      // Q6.3: a from/to (or dashed) range without period words is a plan:
      // keep the stated occurrence instead of rolling it into the past.
      const rangeShape = /\bfrom\b[\s\S]{0,60}?\b(to|till|through|until)\b/i.test(clause) || /\b\d{1,2}(?:st|nd|rd|th)?\s*[-–]\s*\d{1,2}(?:st|nd|rd|th)?\b/.test(clause);
      const periodWord = /\bperiod\b/i.test(clause);
      if (resolved) {
        if (eventNoun) {
          // Plan events roll to the next occurrence (existing plan rule).
          if (resolved < today) resolved = parseMonthDay(noYear, currentYear + 1);
        } else if (rangeShape && !periodWord) {
          // Q6.3: plan range — keep the stated occurrence (never roll back).
        } else if (resolved > today) {
          // Log dates default to the most recent occurrence (existing log rule).
          resolved = parseMonthDay(noYear, currentYear - 1);
        }
      }
    }
    if (!resolved) continue;
    if (eventNoun) {
      push({ date: resolved, eventNoun, label: `${eventNoun} on ${resolved}` });
      continue;
    }
    const flowMatch = clause.match(COVERAGE_FLOW_RE);
    if (flowMatch) {
      push({ date: resolved, flow: flowMatch[1].toLowerCase(), label: `${flowMatch[1].toLowerCase()} flow (${resolved}) as a separate day` });
    } else if (/\bperiod\s+(started|began|came)\b/i.test(clause)) {
      push({ date: resolved, label: `period start (${resolved}) as a separate day` });
    } else {
      push({ date: resolved, multiDateOnly: true, label: `period date (${resolved})` });
    }
  }

  // "heavy flow 3 days ago" style relative facts.
  const agoRe = /\b(\d+|one|two|three|four|five|six|seven)\s+days?\s+ago\b/gi;
  let a: RegExpExecArray | null;
  while ((a = agoRe.exec(text)) !== null) {
    const clause = subClauseAround(text, a.index, a[0].length);
    const flowMatch = clause.match(COVERAGE_FLOW_RE);
    if (!flowMatch) continue;
    const n = /^\d+$/.test(a[1]) ? Number(a[1]) : DAY_WORD_NUMBERS[a[1].toLowerCase()] || 0;
    if (n <= 0) continue;
    const date = addDaysToKey(today, -n);
    push({ date, flow: flowMatch[1].toLowerCase(), label: `${flowMatch[1].toLowerCase()} flow (${date}) as a separate day` });
  }
  return facts;
}

function structuredEntriesOf(result: AgentResult): StructuredEntry[] {
  // Only slips actually returned for rendering/saving count as placed.
  // entries is populated only on multi-period (backfill) turns, where every
  // collected call is rendered for saving; single turns keep entry-only.
  if (result.entries && result.entries.length > 0) return result.entries;
  return result.entry ? [result.entry] : [];
}

function factIsPlaced(fact: StatedDatedFact, entries: StructuredEntry[], events: Array<{ title: string; date: string }>): boolean {
  if (fact.eventNoun) {
    return events.some((e) => e.date === fact.date && (e.title || "").toLowerCase().includes(fact.eventNoun!));
  }
  return entries.some((e) => (e.date === fact.date || (e.endDate != null && e.endDate === fact.date))
    && (!fact.flow || e.flow === fact.flow)
    && (!fact.symptoms?.length || fact.symptoms.every((sym) => (e.symptoms || []).includes(sym as any))));
}

/**
 * Append an "I couldn't place:" disclosure for every stated dated fact that
 * is absent from the structured payload, whatever the prose claims. The
 * prose itself is never edited and never counts as placement. Clarifying
 * questions are left alone (the user is being asked, not told).
 */
export function ensureFactCoverageDisclosure<T extends AgentResult>(result: T, userPrompt: string, today: string): T {
  if (!result || typeof result.message !== "string") return result;
  // A pure clarifying question (no slip, no events) is left alone. But a
  // result that DID return a slip may also end with a question (the live
  // model routinely asks for an undated event's date in the same reply) -
  // coverage still applies there; live runs proved the distinction matters.
  if (!result.entry && !(result.plannedEvents && result.plannedEvents.length > 0)) return result;
  const facts = findStatedDatedFacts(userPrompt, today);
  if (facts.length === 0) return result;
  const entries = structuredEntriesOf(result);
  const events = result.plannedEvents || [];
  let message = result.message;
  for (const fact of facts) {
    if (fact.multiDateOnly) continue;
    if (factIsPlaced(fact, entries, events)) continue;
    if (message.includes("couldn't place") && message.includes(fact.date)) continue;
    message += fact.eventNoun
      ? ` I couldn't place: ${fact.label} \u2014 add it from the calendar if you want it saved.`
      : ` I couldn't place: ${fact.label} \u2014 log that day separately if you want it saved.`;
  }
  if (result.mode === "live") {
    const stated = [...new Set(facts.filter((f) => f.multiDateOnly && !f.eventNoun).map((f) => f.date))].sort();
    if (stated.length >= 2) {
      const placedDates = new Set<string>();
      // Q6.3: ranged and multi-event ranges count every covered day as placed.
      for (const ev of events) {
        if (!ev.date) continue;
        placedDates.add(ev.date);
        const spanEnd = (ev as { endDate?: string }).endDate;
        if (spanEnd && spanEnd > ev.date) {
          let sd = addDaysToKey(ev.date, 1);
          let sguard = 0;
          while (sd <= spanEnd && sguard < 366) { placedDates.add(sd); sd = addDaysToKey(sd, 1); sguard++; }
        }
      }
      for (const e of entries) {
        placedDates.add(e.date);
        if (e.endDate) placedDates.add(e.endDate);
      }
      const missing = stated.filter((d) => !placedDates.has(d));
      if (missing.length > 0) {
        message += " I only prepared " + (stated.length - missing.length) + " of " + stated.length + " dates: " + missing.join(", ") + ". Say the rest again.";
      }
    }
  }
  return message === result.message ? result : { ...result, message };
}

/** Hotfix: classic red-flag tier wins; otherwise the fall/heavy-bleed tier. */
/** B5 trigger, exactly as specified: a period-start statement or a severe pattern. */
function isPeriodStartStatement(text: string): boolean {
  return extractWithLexicon(text).periodStart;
}

function severeTier(text: string): { isSevere: boolean; message: string | null } {
  const classic = checkSevereSymptomEscalation(text);
  if (classic.isSevere) return { isSevere: true, message: classic.escalationMessage };
  if (checkFallSevereInput(text)) return { isSevere: true, message: SEVERE_FALL_CARE_MESSAGE };
  return { isSevere: false, message: null };
}

export async function runLavenderAgent(
  userPrompt: string,
  context: AgentContext = {},
  conversationHistory: Array<{ role: "user" | "assistant" | "system" | "tool"; content: string }> = [],
): Promise<AgentResult> {
  const startTime = Date.now();
  const activityTrail: ActivityStep[] = [];
  const toolCallsRecorded: ToolCallRecord[] = [];

  // Hotfix: severe input is evaluated BEFORE the refusal rules. It wins when the
  // message also states something loggable (period started/ended, flow or
  // symptoms as fact); a pure medical question with no log statement keeps the
  // frozen refusal (Q5/Q3), even if it names a severe symptom.
  const severeLive = severeTier(userPrompt);
  const severeWinsLive = severeLive.isSevere && hasClearLogStatement(userPrompt);
  // Step 1: Pre-execution Server-Side Medical Guardrail Check
  const guardrailCheck = severeWinsLive
    ? { isRefusal: false as const, refusalMessage: null as string | null }
    : checkMedicalAdviceGuardrail(userPrompt);
  if (guardrailCheck.isRefusal) {
    activityTrail.push({
      step: "Safety Guardrail",
      detail: "Medical advice request intercepted",
      status: "done",
    });
    if (hasClearLogStatement(userPrompt)) {
      const fb = parseLocally(userPrompt, context.currentDate || todayLocal(), context);
      return { ...fb, mode: "offline", modeReason: "Offline parser - medical part refused; log handled by offline rules" };
    }
    return {
      message: getGuardrailResponseMessage(userPrompt),
      needsClarification: false,
      activityTrail,
      toolCalls: toolCallsRecorded,
    };
  }

  const today = context.currentDate || todayLocal();
  const severeCheck = severeLive;
  if (severeCheck.isSevere) {
    activityTrail.push({
      step: "Safety Escalation",
      detail: "Red-flag symptom detected — care-seeking signpost prepended",
      status: "done",
    });
  }

  // Q6.5: reminders are not supported; never quote a new window.
  if (/\bremind(?:er)?\b/i.test(userPrompt) && /\bperiod\b/i.test(userPrompt) && (/\bbefore\b/i.test(userPrompt) || /\bnext\b/i.test(userPrompt))) {
    return { message: "I can't set reminders yet; you can export the calendar (.ics) from Settings.", needsClarification: false, activityTrail, toolCalls: toolCallsRecorded, mode: "offline" as const, modeReason: "Offline parser — reminders are not supported" };
  }
  
  if (!severeCheck.isSevere) {
    const ownLive = buildOwnDataAnswer(userPrompt, context);
    if (ownLive) {
      activityTrail.push({ step: "Your Logged Data", detail: "Answered from your own logs, no model call", status: "done" });
      activityTrail.forEach((a) => (a.status = "done"));
      return { message: ownLive.message, kind: ownLive.kind, usedLiveModel: false, entry: null, needsClarification: false, activityTrail, toolCalls: toolCallsRecorded, mode: "offline" as const, modeReason: "Answered from your own logs, no model call" };
    }
    // Q4.1: local calendar questions are answered on this device, before the model.
    const ownEventsLive = buildOwnEventsAnswer(userPrompt, {
      events: context.events,
      periods: context.periods,
      cycleStats: context.cycleStats ? { lastPeriodStart: context.cycleStats.lastPeriodStart ?? null } : undefined,
      today,
    });
    if (ownEventsLive) {
      activityTrail.push({ step: "Your Calendar", detail: "Answered from your own calendar, no model call", status: "done" });
      activityTrail.forEach((a) => (a.status = "done"));
      return { message: ownEventsLive.message, kind: ownEventsLive.kind, usedLiveModel: false, entry: null, needsClarification: false, activityTrail, toolCalls: toolCallsRecorded, mode: "offline" as const, modeReason: "Answered from your own calendar, no model call" };
    }
  }

  // Live path: no regex pre-intercept for corrections. The pending entry is passed
  // to the model, which may call update_entry with a patch (Batch 2.4). Offline mode
  // (parseLocally) is the only place regex corrections run.
  activityTrail.push({
    step: "Processing Speech",
    detail: "Parsing voice input with Muse Spark",
    status: "pending",
  });

  // Fallback pattern parser for offline / test environments
  const fallbackResult = parseLocally(userPrompt, today, context);

  // Q7.3: negation-only messages never reach the model (mirrors the offline rule).
  const liveNegation = detectNegationOnly(userPrompt, today, context);
  if (liveNegation?.kind === "ask") {
    return {
      message: liveNegation.question,
      entry: null,
      needsClarification: true,
      clarificationQuestion: liveNegation.question,
      activityTrail,
      toolCalls: toolCallsRecorded,
      mode: "live",
      modeReason: "Negated symptom needs confirmation; model not called",
    };
  }
  if (liveNegation?.kind === "noted") {
    return {
      message: "Noted, nothing to log.",
      entry: null,
      needsClarification: false,
      activityTrail,
      toolCalls: toolCallsRecorded,
      mode: "live",
      modeReason: "Negation-only message logged nothing; model not called",
    };
  }

  if (!hasAnyLoggingOrPlanningCue(userPrompt)) {
    return { ...fallbackResult, mode: "offline" as const, modeReason: "Offline parser — Meta model not used (bare numbers or date without cycle/event cue)" };
  }

  // C1: "my period is late" is a deterministic clarifying intent in BOTH paths.
  if (/\bperiod\s+(is\s+)?late\b|\blate period\b|\bmissed\s+(my\s+)?period\b|\bam\s+i\s+late\b/i.test(userPrompt) && !/started|flow/i.test(userPrompt)) {
    return { ...fallbackResult, mode: "offline" as const, modeReason: "Offline parser — Meta model not used (late-period question answered directly; no entry created)" };
  }

  // Phase 2: date comparison is deterministic in BOTH paths; nothing is saved.

  if ((fallbackResult as any).comparison) {
    return { ...fallbackResult, mode: "offline" as const, modeReason: "Offline parser — Meta model not used (date comparison answered directly; nothing saved)" };
  }

  const config = getConfig();
  const isBaseten = context.provider === "baseten" || config.useBaseten;
  const apiKey = isBaseten ? config.basetenApiKey : (config.metaApiKey || config.basetenApiKey);
  const baseUrl = isBaseten ? config.basetenBaseUrl : config.metaBaseUrl;
  const model = isBaseten ? "meta-models/muse-spark-open-1026" : config.museSparkModel;

  if (!apiKey) {
    activityTrail.forEach((a) => (a.status = "done"));
    return { ...fallbackResult, mode: "offline", modeReason: "Offline parser — Meta model not used (Meta API key not configured)" };
  }

  const isCorrectionPhrase = /\b(actually|make it\s+(?:light|heavy|medium|spotting|none)|change\s+(?:the\s+)?(?:date|flow)|(?:light|medium|heavy|spotting)\s*,?\s*not\s+(?:light|medium|heavy|spotting)|not\s+(?:light|medium|heavy|spotting)\s*,?\s*(?:but|actually)?\s*(?:light|medium|heavy|spotting))\b/i.test(userPrompt);
  // B3: a recent (already-saved) entry is only a correction target on explicit
  // correction language; a pending slip is always available to patch.
  const targetEntry = context.pendingEntry || (isCorrectionPhrase ? selectCorrectionTarget(userPrompt, null, context.recentEntry, context.recentEntries) : null);
  let livePlannedEvents: Array<{ title: string; date: string; endDate?: string }> = [];

  if (!targetEntry && isCorrectionPhrase && !/\bperiod\s+(?:started|ended)\b/i.test(userPrompt)) {
    return {
      message: "I couldn't find a recent entry to correct.",
      entry: null,
      needsClarification: false,
      activityTrail: [{ step: "Correction Lookup", detail: "No recent entry found to correct", status: "done" }],
      toolCalls: [],
      mode: "live",
      modeReason: null,
    };
  }

  // Q4.2: the model cannot see the calendar unless it is visible; never let it claim otherwise.
  const calendarVisibilityNote = context.calendarVisible === false
    ? "\nYou cannot see the user's calendar; never say they have no events. Say you can't see it here."
    : "";
  // OpenAI-compatible Chat Completions API with Tool Calling
  const messages: any[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\nToday's date is ${today}. Locale: ${context.locale || "en"}. Reply in the user's language.${targetEntry ? `\nPending or recent entry to correct if asked: ${JSON.stringify(targetEntry)}. Call update_entry with a patch (date, flow, symptoms_add, symptoms_remove, mood, energy, sleep, notes).` : ""}${context.matchedEvents && context.matchedEvents.length ? `\nClient-matched personal events (consented): ${JSON.stringify(context.matchedEvents)}. Use find_calendar_events for these.` : ""}${calendarVisibilityNote}${context.defaultDate ? `\nThe user opened voice from the calendar on ${context.defaultDate}. If they do not state a date, log for ${context.defaultDate}; a date they state wins.` : ""}` },
    ...conversationHistory,
    { role: "user", content: userPrompt },
  ];

  let usedPersonalAnchorLive = false;
  let structuredEntry: StructuredEntry | null = null;
  let replacedViaCorrection = false;
  const structuredEntries: StructuredEntry[] = [];
  // Multi mode only for backfill-shaped prompts (several period dates, no
  // detail): single-period turns keep the old overwrite behavior exactly.
  const backfillShape = extractBackfillDates(userPrompt, today);
  const collectBackfillEntries = backfillShape !== null && backfillShape.seeds.length > 0;
  let planOverlaps: any[] | undefined = undefined;
  let needsClarification = false;
  let clarificationQuestion: string | null = null;
  let finalMessage = "";

  // Hotfix (speed): per-call and overall model budgets. The normal path makes
  // the same number of calls with identical results; only a hung model is cut
  // off with a clear message instead of a silent hang.
  const MODEL_CALL_TIMEOUT_MS = 40000;
  const OVERALL_MODEL_BUDGET_MS = 50000;
  const modelDeadline = startTime + OVERALL_MODEL_BUDGET_MS;
  let modelCallMsTotal = 0;
  const modelTimedOut = (): AgentResult => {
    activityTrail.push({ step: "Total Model Time", detail: modelCallMsTotal + " ms", status: "done" });
    return {
      message: "The AI took too long, please try again",
      entry: null,
      needsClarification: false,
      activityTrail,
      toolCalls: toolCallsRecorded,
      mode: "offline",
      modeReason: "Meta model call timed out (overall 50s budget)",
    };
  };
  const MAX_STEPS = 5;
  let stepCount = 0;

  try {
    while (stepCount < MAX_STEPS) {
      stepCount++;

      // Overall budget: stop starting new model calls once 50s are spent.
      const remainingMs = modelDeadline - Date.now();
      if (remainingMs <= 0) return modelTimedOut();
      const modelCallStart = Date.now();
      const callController = new AbortController();
      const callTimer = setTimeout(() => callController.abort(), Math.min(MODEL_CALL_TIMEOUT_MS, remainingMs));
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal: callController.signal,
          body: JSON.stringify({
            model,
            messages,
            tools: TOOLS,
            tool_choice: "auto",
            temperature: 0.2,
            max_tokens: 600,
          }),
        });
      } catch (callErr: any) {
        clearTimeout(callTimer);
        if (callErr && callErr.name === "AbortError") return modelTimedOut();
        throw callErr;
      }
      clearTimeout(callTimer);
      modelCallMsTotal += Date.now() - modelCallStart;
      activityTrail.push({
        step: "Model Call " + stepCount,
        detail: (Date.now() - modelCallStart) + " ms",
        status: "done",
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[Muse Spark] API call failed ${res.status}:`, errorText);
        return { ...fallbackResult, mode: "offline", modeReason: `Offline parser — Meta model not used (Meta API error ${res.status})` };
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      if (!message) break;

      messages.push(message);

      // Check if tool calls exist
      const toolCalls = message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        finalMessage = message.content || "";
        break;
      }

      for (const call of toolCalls) {
        const toolCallStart = Date.now();
        const fnName = call.function.name;
        let fnArgs: any = {};
        try {
          fnArgs = JSON.parse(call.function.arguments);
        } catch {
          fnArgs = {};
        }

        let toolResponseContent = "";
        let toolResultObj: any = {};

        if (fnName === "find_calendar_events") {
          const events = context.matchedEvents || [];
          toolResultObj = { events, source: "context.matchedEvents" };
          if (events.length) usedPersonalAnchorLive = true;
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "milestone_lookup" || fnName === "festival_lookup") {
          const festName = (fnArgs.name || "").toLowerCase();
          let yr = fnArgs.year ? String(fnArgs.year) : undefined;
          activityTrail.push({
            step: "Landmark Recall",
            detail: `Looking up calendar milestone "${fnArgs.name}" for ${yr || "recent"}`,
            status: "done",
          });

          const landmarkRes = resolveLandmarkExpression(fnArgs.name, today, context.landmarkPacks);
          if (landmarkRes.found) {
            const baseDate = landmarkRes.resolvedDate;
            const offsetDate = baseDate && fnArgs.offsetDays ? applyDayOffset(baseDate, Number(fnArgs.offsetDays) || 0) : baseDate;
            toolResultObj = {
              milestone: landmarkRes.landmarkName,
              year: yr || landmarkRes.resolvedDate?.slice(0, 4),
              date: offsetDate,
              baseDate,
              source: "landmarks data (verified dates in landmarks.json / milestones data)",
              found: true,
            };
          } else {
            toolResultObj = {
              found: false,
              message: `Milestone "${fnArgs.name}" date not found in 2025-2027 calendar.`,
            };
          }
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "get_cycle_history") {
          activityTrail.push({
            step: "Cycle Baseline",
            detail: "Reading historical cycle pattern",
            status: "done",
          });
          toolResultObj = {
            avgCycleLength: context.cycleStats?.avgCycleLength ?? null,
            avgPeriodLength: context.cycleStats?.avgPeriodLength ?? null,
            lastPeriodStart: context.cycleStats?.lastPeriodStart || null,
            nextPeriodEarliest: context.cycleStats?.nextPeriodEarliest || null,
            nextPeriodLatest: context.cycleStats?.nextPeriodLatest || null,
            isDefault: context.cycleStats?.isDefault ?? context.cycleStatsIsDefault ?? false,
            note: (context.cycleStats?.isDefault ?? context.cycleStatsIsDefault) ? "Not enough data yet — these are defaults, not learned from logged cycles." : undefined,
          };
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "check_overlap") {
          activityTrail.push({
            step: "Plan Around It",
            detail: `Evaluating cycle overlap for ${fnArgs.events?.length || 0} events`,
            status: "done",
          });
          const badEvent = (fnArgs.events || []).find((e: any) => !e || typeof e.date !== "string" || !isValidDateKey(e.date));
          if (badEvent) { toolResultObj = { error: "Invalid event date: expected YYYY-MM-DD." }; toolResponseContent = JSON.stringify(toolResultObj); }
          const overlaps = badEvent ? [] : evaluateContextOverlaps(fnArgs.events || [], context, today);
          planOverlaps = overlaps;
          const rawEvents = (fnArgs.events || []).filter((e: any) => e && typeof e.date === "string" && isValidDateKey(e.date));
          livePlannedEvents = rawEvents.map((e: any) => ({ title: e.name || e.title || "Event", date: e.date, ...(e.endDate && e.endDate !== e.date ? { endDate: e.endDate } : {}) }));
          toolResultObj = { overlaps };
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "log_entry") {
          const validationError = validateEntryArgs(fnArgs, today);
          if (validationError) {
            toolResultObj = { error: validationError };
          } else {
            activityTrail.push({ step: "Structured Entry", detail: `Prepared log for ${fnArgs.date}`, status: "done" });
            structuredEntry = {
              date: fnArgs.date || today, endDate: fnArgs.endDate || null, flow: fnArgs.flow || null,
              symptoms: (fnArgs.symptoms || []).filter((s: string) => (VALID_SYMPTOMS as readonly string[]).includes(s)),
              mood: fnArgs.mood || null, energy: fnArgs.energy ?? null, sleep: fnArgs.sleep ?? null, notes: fnArgs.notes || null,
              isApproximate: fnArgs.isApproximate || false, landmarkName: fnArgs.landmarkName || null, kind: fnArgs.kind || "daily_log",
            };
            toolResultObj = { success: true, entry: structuredEntry };
            if (collectBackfillEntries) structuredEntries.push(structuredEntry);
          }
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "update_entry") {
          const entryToPatch = targetEntry;
          if (!entryToPatch) {
            toolResultObj = { success: false, error: "No pending slip to update" };
          } else {
            const patched = applyModelPatch(entryToPatch, fnArgs, today);
            if (patched.error) toolResultObj = { error: patched.error };
            else { structuredEntry = patched.entry!; replacedViaCorrection = true; toolResultObj = { success: true, entry: structuredEntry }; }
          }
          toolResponseContent = JSON.stringify(toolResultObj);
        }

        toolCallsRecorded.push({
          id: call.id || "call_" + Date.now(),
          toolName: fnName,
          args: fnArgs,
          result: toolResultObj,
          latencyMs: Date.now() - toolCallStart,
          model,
          executedBy: "meta-model" as const,
        });

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: toolResponseContent,
        });
      }
    }

    activityTrail.push({
      step: "Total Model Time",
      detail: modelCallMsTotal + " ms",
      status: "done",
    });

    // Success claims must come from tool results. If a tool call errored and
    // no valid entry or event exists, replace the model prose instead of
    // relaying a success it did not perform.
    let firstToolError: string | null = null;
    for (const c of toolCallsRecorded) {
      const e = (c.result as any)?.error;
      if (!firstToolError && typeof e === "string" && e) firstToolError = e;
    }
    // Q6.3: a slip-update claim needs a real update_entry success behind it.
    const slipClaimed = /updated your (accession )?slip|slip[^.?!]{0,40}\bupdated\b|made those changes|correction (?:has been |is )?(?:saved|applied)/i.test(finalMessage);
    const updateSucceeded = toolCallsRecorded.some((c) => c.toolName === "update_entry" && (c.result as any)?.success);
    if (!structuredEntry && structuredEntries.length === 0 && livePlannedEvents.length === 0 && !(planOverlaps && planOverlaps.length > 0)) {
      if (slipClaimed && !updateSucceeded) {
        finalMessage = "There's no entry to change.";
      } else if (firstToolError) {
        finalMessage = "I could not save that: " + firstToolError + ". Which date did you mean?";
      } else if (/logged|saved|done|all set|good to go|prepared/i.test(finalMessage)) {
        finalMessage = "I could not save that: no valid entry or event. Which date did you mean?";
      }
    }
    // Hotfix (B5): ONE corrective model call, allowed ONLY when an output guard
    // tripped with no entry/event but the user's message stated a period start
    // or a severe pattern. Forces a single log_entry tool call; never blends
    // the offline parser's result. The normal path keeps its call count.
    const runCorrectiveLogCall = async (): Promise<AgentResult> => {
      const severeHead = severeLive.isSevere ? severeLive.message : null;
      const head = severeHead || "I can log this for you";
      const failRedirect = severeHead
        ? severeHead
        : (bannedOut.blocked ? REDIRECT_MESSAGES.verdict : MEDICAL_REFUSAL_MESSAGE);
      const failResult = (why: string): AgentResult => ({
        message: failRedirect + " Please try again.",
        entry: null,
        needsClarification: false,
        activityTrail,
        toolCalls: toolCallsRecorded,
        mode: "offline",
        modeReason: "Output guard tripped (" + why + "); corrective log call failed",
      });
      const correctRemaining = modelDeadline - Date.now();
      if (correctRemaining <= 5000) return failResult("no time left in budget");
      const cc = new AbortController();
      const ct = setTimeout(() => cc.abort(), Math.min(40000, correctRemaining));
      const callStart = Date.now();
      try {
        const cres = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          signal: cc.signal,
          body: JSON.stringify({
            model,
            messages: [...messages, { role: "user", content: "Call log_entry now with the facts in the user's message. No commentary." }],
            tools: TOOLS,
            tool_choice: { type: "function", function: { name: "log_entry" } },
            temperature: 0.2,
            max_tokens: 600,
          }),
        });
        clearTimeout(ct);
        if (!cres.ok) return failResult("corrective call failed");
        const cdata = await cres.json();
        const cmsg = (cdata.choices && cdata.choices[0] && cdata.choices[0].message) || {};
        const tcalls = cmsg.tool_calls || [];
        let centry: StructuredEntry | null = null;
        for (const call of tcalls) {
          let cargs: any = {};
          try { cargs = JSON.parse(call.function.arguments); } catch { cargs = {}; }
          if (!call.function || call.function.name !== "log_entry") continue;
          const verr = validateEntryArgs(cargs, today);
          if (verr) {
            toolCallsRecorded.push({ id: call.id || "call_corrective", toolName: "log_entry", args: cargs, result: { error: verr }, latencyMs: Date.now() - callStart, model, executedBy: "meta-model" as const });
            continue;
          }
          centry = {
            date: cargs.date || today, endDate: cargs.endDate || null, flow: cargs.flow || null,
            symptoms: (cargs.symptoms || []).filter((st: string) => (VALID_SYMPTOMS as readonly string[]).includes(st)),
            mood: cargs.mood || null, energy: cargs.energy ?? null, sleep: cargs.sleep ?? null, notes: cargs.notes || null,
            isApproximate: cargs.isApproximate || false, landmarkName: cargs.landmarkName || null, kind: cargs.kind || "daily_log",
          };
          toolCallsRecorded.push({ id: call.id || "call_corrective", toolName: "log_entry", args: cargs, result: { success: true, entry: centry }, latencyMs: Date.now() - callStart, model, executedBy: "meta-model" as const });
        }
        if (!centry) return failResult("no valid entry returned");
        activityTrail.push({ step: "Corrective Log Call", detail: "Blocked model reply replaced by a forced log_entry call", status: "done" });
        const tail = "I've prepared your log for " + (centry as StructuredEntry).date + ". Please review and confirm below.";
        return ensureFactCoverageDisclosure({
          message: head + " " + tail,
          entry: centry,
          needsClarification: false,
          clarificationQuestion: null,
          activityTrail,
          toolCalls: toolCallsRecorded,
          mode: "live" as const,
          modeReason: "Corrective log_entry after blocked model reply",
        }, userPrompt, today);
      } catch (e) {
        clearTimeout(ct);
        return failResult("corrective call timed out");
      }
    };
    // v2 output guard: verdict phrasing never discards structured results.
    // With results, only the text is replaced by a neutral summary built from
    // them; a pure verdict with nothing to save keeps the fixed redirect.
    const bannedOut = checkModelOutputGuard(finalMessage);
    if (bannedOut.blocked) {
      const hasResults = !!structuredEntry || structuredEntries.length > 0 || livePlannedEvents.length > 0 || (planOverlaps !== undefined && planOverlaps.length > 0);
      if (!hasResults) {
        // Hotfix (B5): guard tripped with no slip, but the user stated something
        // loggable (or a severe pattern) � keep the care/offer text and make ONE
        // corrective log_entry call instead of the bare redirect.
        if (isPeriodStartStatement(userPrompt) || severeLive.isSevere) {
          return await runCorrectiveLogCall();
        }
        activityTrail.push({ step: "Output Guard", detail: "Model reply replaced by fixed redirect (banned wording)", status: "done" });
        return { message: REDIRECT_MESSAGES.verdict, needsClarification: false, activityTrail, toolCalls: toolCallsRecorded, mode: "live" as const, modeReason: "Output guard replaced the model reply" };
      }
      const summaryEntry = collectBackfillEntries && structuredEntries.length > 0 ? structuredEntries[0] : structuredEntry;
      let summary = summaryEntry ? "Prepared your log for " + shortDateLabel(summaryEntry.date) + ". Please confirm." : "Prepared your log. Please confirm.";
      if (livePlannedEvents.length > 0) summary += " Prepared " + livePlannedEvents.length + " event" + (livePlannedEvents.length === 1 ? "" : "s") + ".";
      if (planOverlaps && planOverlaps.length > 0) summary += " Overlap checked.";
      finalMessage = summary;
      activityTrail.push({ step: "Output Guard", detail: "Model reply replaced with neutral summary (verdict wording removed)", status: "done" });
    }
    // Server-side check on the final assistant response as secondary guardrail defense
    const outputGuard = checkMedicalAdviceGuardrail(finalMessage);
    if (outputGuard.isRefusal) {
      if (!structuredEntry && structuredEntries.length === 0 && livePlannedEvents.length === 0 && !(planOverlaps && planOverlaps.length > 0) && (isPeriodStartStatement(userPrompt) || severeLive.isSevere)) {
        return await runCorrectiveLogCall();
      }
      return {
        message: MEDICAL_REFUSAL_MESSAGE,
        needsClarification: false,
        activityTrail,
        toolCalls: toolCallsRecorded,
      };
    }

    // Detect if agent is asking for clarification
    if (
      finalMessage.includes("?") ||
      finalMessage.toLowerCase().includes("before or after") ||
      finalMessage.toLowerCase().includes("which day")
    ) {
      needsClarification = true;
      clarificationQuestion = finalMessage;
    }

    if (severeCheck.isSevere) {
      if (!structuredEntry && fallbackResult.entry) {
        structuredEntry = fallbackResult.entry;
        if (fallbackResult.entries && fallbackResult.entries.length > 0) structuredEntries.push(...fallbackResult.entries);
      }
      const severeMsg = severeCheck.message || SEVERE_SYMPTOM_ESCALATION_MESSAGE;
      const cleanTail =
        !finalMessage.trim() || finalMessage.includes("talk to a doctor")
          ? `I've prepared your log for ${structuredEntry?.date || today}. Please review and confirm below.`
          : finalMessage.trim();
      finalMessage = cleanTail.startsWith(severeMsg)
        ? cleanTail
        : `${severeMsg} ${cleanTail}`;
    }

    return ensureFactCoverageDisclosure({
      message: finalMessage,
      entry: collectBackfillEntries && structuredEntries.length > 0 ? structuredEntries[0] : structuredEntry,
      replacesExisting: replacedViaCorrection || undefined,
      entries: structuredEntries.length > 0 ? structuredEntries : undefined,
      needsClarification,
      clarificationQuestion,
      activityTrail,
      toolCalls: toolCallsRecorded,
      planOverlaps,
      plannedEvents: livePlannedEvents.length > 0 ? livePlannedEvents : (planOverlaps?.length ? planOverlaps.map((o: any) => ({ title: o.name, date: o.eventDate })) : undefined),
      mode: "live",
      modeReason: null,
      usedPersonalAnchor: usedPersonalAnchorLive,
    }, userPrompt, today);
  } catch (err: any) {
    console.error("[Lavender Agent] Error in runLavenderAgent:", err);
    return { ...fallbackResult, mode: "offline", modeReason: `Offline parser — Meta model not used (${err?.message || "Meta API request failed"})` };
  }
}


export const VALID_MOODS = ["Great", "Good", "Okay", "Low", "Irritable", "Anxious", "Emotional", "Calm"] as const;
const LEXICONS: LanguageLexicon[] = [en, hi, ml, ta, kn];

function phraseIndex(lower: string, phrase: string): number {
  const p = phrase.toLowerCase().trim();
  if (!p) return -1;
  if (/^[a-z0-9\s'-]+$/i.test(p)) {
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`\\b${escaped}\\b`, "i").exec(lower);
    return m ? m.index : -1;
  }
  return lower.indexOf(p);
}
function isNegatedAt(lower: string, idx: number): boolean {
  if (idx < 0) return false;
  const before = lower.slice(Math.max(0, idx - 32), idx);
  if (/\b(no|not|without|never)\s+([\p{L}0-9]+\s+){0,3}$/iu.test(before)) return true;
  for (const lex of LEXICONS) for (const neg of lex.negations) {
    if (neg && before.trimEnd().endsWith(neg)) return true;
  }
  return false;
}
export interface LexiconExtraction { symptoms: ValidSymptom[]; flow: StructuredEntry["flow"]; mood: string | null; periodStart: boolean; periodEnd: boolean; }
export function extractWithLexicon(text: string): LexiconExtraction {
  const lower = text.toLowerCase();
  const symptoms: ValidSymptom[] = [];
  for (const key of VALID_SYMPTOMS) {
    let found = false;
    for (const lex of LEXICONS) {
      for (const phrase of lex.symptoms[key] || []) {
        const idx = phraseIndex(lower, phrase);
        if (idx >= 0 && !isNegatedAt(lower, idx)) { found = true; break; }
      }
      if (found) break;
    }
    if (found) symptoms.push(key);
  }
  let flow: StructuredEntry["flow"] = null;
  if (/\bno (flow|bleeding)\b/i.test(lower)) flow = "none";
  else {
    const order: Array<"heavy"|"medium"|"light"|"spotting"> = ["heavy","medium","light","spotting"];
    outer: for (const level of order) {
      for (const lex of LEXICONS) {
        for (const phrase of lex.flow[level] || []) {
          const idx = phraseIndex(lower, phrase);
          if (idx >= 0 && !isNegatedAt(lower, idx)) { flow = level; break outer; }
        }
      }
    }
    if (!flow) for (const lex of LEXICONS) for (const phrase of lex.flow.none || []) { if (phraseIndex(lower, phrase) >= 0) { flow = "none"; break; } }
  }
  let mood: string | null = null;
  const moodCandidates: Array<{mood:string; phrase:string}> = [];
  for (const lex of LEXICONS) for (const [m, phrases] of Object.entries(lex.mood)) for (const phrase of phrases) moodCandidates.push({ mood: m, phrase });
  moodCandidates.sort((a,b)=>b.phrase.length-a.phrase.length);
  for (const c of moodCandidates) { const idx = phraseIndex(lower, c.phrase); if (idx>=0 && !isNegatedAt(lower, idx)) { mood = c.mood; break; } }
  let periodStart=false, periodEnd=false;
  for (const lex of LEXICONS) {
    if (lex.periodStart.some((ph)=>phraseIndex(lower,ph)>=0)) periodStart=true;
    if (lex.periodEnd.some((ph)=>phraseIndex(lower,ph)>=0)) periodEnd=true;
  }
  if (/\bperiod\s+(started|began|came)\b|\bstarted my period\b|\bgot my period\b|\bhad\s+(?:my\s+)?(?:first\s+)?period\b|\b(?:my\s+)?first\s+period\b|\bgot\s+my\s+first\s+period\b/i.test(lower)) periodStart=true;
  if (/\bperiod\s+(ended|stopped|finished)\b|\bflow stopped\b/i.test(lower)) periodEnd=true;
  return { symptoms, flow, mood, periodStart, periodEnd };
}
export function validateEntryArgs(args: Record<string, any>, today: string): string | null {
  const min = addDaysToKey(today, -731);
  if (args.date !== undefined) {
    if (typeof args.date !== "string" || !isValidDateKey(args.date)) return "Invalid date: expected YYYY-MM-DD calendar date.";
    if (args.date < min || args.date > today) return `Invalid date: must be between ${min} and ${today} (today).`;
  }
  if (args.endDate !== undefined && args.endDate !== null) {
    if (typeof args.endDate !== "string" || !isValidDateKey(args.endDate)) return "Invalid endDate: expected YYYY-MM-DD calendar date.";
    if (typeof args.date === "string" && isValidDateKey(args.date) && args.endDate < args.date) return "Invalid endDate: must not be before date.";
    if (args.endDate > today || args.endDate < min) return "Invalid endDate: must be within the past 731 days and not in the future.";
  }
  if (args.flow !== undefined && args.flow !== null && !["none","spotting","light","medium","heavy"].includes(args.flow)) return "Invalid flow value.";
  if (args.kind !== undefined && !["period_started","period_ended","daily_log"].includes(args.kind)) return "Invalid kind value.";
  if (args.mood !== undefined && args.mood !== null && !(VALID_MOODS as readonly string[]).includes(args.mood)) return "Invalid mood value.";
  if (args.energy !== undefined && args.energy !== null && (!Number.isInteger(args.energy) || args.energy < 1 || args.energy > 5)) return "Invalid energy: must be an integer 1-5.";
  if (args.sleep !== undefined && args.sleep !== null && (typeof args.sleep !== "number" || args.sleep < 0 || args.sleep > 24)) return "Invalid sleep: must be 0-24 hours.";
  const symptomLists = [args.symptoms, args.symptoms_add, args.symptoms_remove, args.addSymptoms, args.removeSymptoms];
  for (const list of symptomLists) if (list !== undefined && (!Array.isArray(list) || list.some((s:any)=>!(VALID_SYMPTOMS as readonly string[]).includes(s)))) return "Invalid symptoms: must be a subset of the supported symptoms.";
  return null;
}
export function applyModelPatch(pending: StructuredEntry, patch: Record<string, any>, today: string): { entry?: StructuredEntry; error?: string } {
  const err = validateEntryArgs(patch, today);
  if (err) return { error: err };
  const updated: StructuredEntry = { ...pending, symptoms: [...pending.symptoms] };
  if (patch.date) updated.date = patch.date;
  if (patch.flow !== undefined) updated.flow = patch.flow;
  if (patch.kind) updated.kind = patch.kind;
  if (patch.mood !== undefined) updated.mood = patch.mood;
  if (patch.energy !== undefined) updated.energy = patch.energy;
  if (patch.sleep !== undefined) updated.sleep = patch.sleep;
  if (patch.endDate !== undefined) updated.endDate = patch.endDate;
  if (patch.notes !== undefined) updated.notes = patch.notes;
  const add = patch.symptoms_add || patch.addSymptoms || [];
  const remove = patch.symptoms_remove || patch.removeSymptoms || [];
  for (const s of add) if (!updated.symptoms.includes(s)) updated.symptoms.push(s);
  updated.symptoms = updated.symptoms.filter((s)=>!remove.includes(s));
  return { entry: updated };
}
function entryDateMatchesLandmark(lm: { resolvedDate?: string | null }, date: string | null): boolean {
  if (!date) return false;
  if (lm.resolvedDate === date) return true;
  // Offset phrases ("2 days before X") resolve a few days away from the landmark itself.
  return Math.abs(diffDateKeys(lm.resolvedDate || date, date)) <= 370;
}
export function findMatchedEvent(text: string, matched?: Array<{title:string;date:string}>): {title:string;date:string} | null {
  if (!matched || matched.length===0) return null;
  const lower = text.toLowerCase();
  let best: {title:string;date:string} | null = null; let bestScore=0;
  for (const ev of matched) {
    const tokens = ev.title.toLowerCase().split(/[^a-z0-9]+/).filter((w)=>w.length>2);
    const score = tokens.filter((w)=>lower.includes(w)).length;
    if (score>bestScore) { bestScore=score; best=ev; }
  }
  return bestScore>0 ? best : null;
}

/**
 * Local fallback parser for offline verification, fast tests, and network resilience.
 * Intent first (Batch 2.1), lexicon word-boundary parser with negation (2.2),
 * rewritten date resolver (2.3). Never fabricates a log for plan-only or empty messages.
 */
// ---------- Backfill: several past periods in one message ----------
// Pure-additive branch: only period-list messages with zero flow, symptom,
// mood, energy or sleep detail take this path. Everything else falls through
// to the single-entry flow unchanged.
const BACKFILL_MAX_ENTRIES = 12;
const BACKFILL_MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const BACKFILL_EVENT_NOUNS = "exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday|shaadi|sangeet";
const BACKFILL_NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const BACKFILL_MONTH_FULL: Record<string, string> = {
  jan: "January", january: "January", feb: "February", february: "February",
  mar: "March", march: "March", apr: "April", april: "April", may: "May",
  jun: "June", june: "June", jul: "July", july: "July", aug: "August",
  august: "August", sep: "September", sept: "September", september: "September",
  oct: "October", october: "October", nov: "November", november: "November",
  dec: "December", december: "December",
};

export interface BackfillSeed {
  date: string;
  endDate?: string | null;
}

export interface BackfillParse {
  seeds: BackfillSeed[];
  warnings: string[];
  monthAsk?: string | null;
}

function backfillNumber(token: string): number | null {
  const t = token.toLowerCase().trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return BACKFILL_NUMBER_WORDS[t] ?? null;
}

// Resolve one date mention inside a backfill segment. Past-only: a bare
// month/day rolls to the most recent past occurrence; explicit future years
// and future ISO dates are reported as future drops.
function resolveBackfillDate(seg: string, today: string): { date?: string; future?: string; none?: true } {
  const year = parseInt(today.slice(0, 4), 10);
  const iso = seg.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const key = iso[1] + "-" + iso[2] + "-" + iso[3];
    if (!isValidDateKey(key)) return { none: true };
    if (key > today) return { future: key };
    return { date: key };
  }
  const ago = seg.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(days?|weeks?)\s+ago\b/i);
  if (ago) {
    const n = backfillNumber(ago[1]);
    if (n === null) return { none: true };
    const days = /week/i.test(ago[2]) ? n * 7 : n;
    return { date: addDaysToKey(today, -days) };
  }
  if (/\byesterday\b/i.test(seg)) return { date: addDaysToKey(today, -1) };
  if (/\btoday\b/i.test(seg)) return { date: today };
  const md = seg.match(new RegExp("\\b(\\d{1,2}(?:st|nd|rd|th)?\\s+(?:" + BACKFILL_MONTHS + ")\\b|\\b(?:" + BACKFILL_MONTHS + ")\\s+\\d{1,2}(?:st|nd|rd|th)?)", "i"));
  if (md) {
    const raw = md[1].replace(/,/g, " ").replace(/\s+/g, " ").trim();
    const explicit = seg.match(/\b(20\d{2})\b/);
    if (explicit) {
      const key = parseMonthDay(raw, parseInt(explicit[1], 10));
      if (!key) return { none: true };
      if (key > today) return { future: key };
      return { date: key };
    }
    let key = parseMonthDay(raw, year);
    if (!key) return { none: true };
    if (key > today) key = parseMonthDay(raw, year - 1);
    if (!key) return { none: true };
    return { date: key };
  }
  return { none: true };
}

// A segment naming a month with no day ("in September") cannot be saved;
// it becomes a clarifying question instead.
function backfillBareMonth(seg: string): string | null {
  let c = " " + seg.toLowerCase() + " ";
  c = c.replace(/\b(i|we|my|our|the|last|this|had|have|has|got|periods|period|started|starts|began|came|were|was|on|in|for|and|then|also)\b/g, " ");
  c = c.replace(/[^a-z]/g, " ").replace(/\s+/g, " ").trim();
  if (!/^[a-z]+$/.test(c)) return null;
  return BACKFILL_MONTH_FULL[c] || null;
}

// Range seed ("from X to Y", "X till Y", "X - Y", "started X and ended Y"),
// or null when this message holds no valid range.
function backfillRangeSeed(text: string, today: string): BackfillSeed | null {
  const lower = text.toLowerCase();
  const finish = (a: string, b: string): BackfillSeed | null => {
    const r1 = resolveBackfillDate(a, today);
    const r2 = resolveBackfillDate(b, today);
    if (!r1.date || !r2.date) return null;
    if (!(r1.date < r2.date) || r2.date > today) return null;
    return { date: r1.date, endDate: r2.date };
  };
  const started = lower.match(/\bstarted\s+(.+?)\s+and\s+ended\s+(.+)/);
  if (started) return finish(started[1], started[2]);
  const fromTo = lower.match(/\bfrom\s+(.+?)\s+(?:to|till|until|through)\s+(.+)/);
  if (fromTo) return finish(fromTo[1], fromTo[2]);
  const till = lower.match(/\b(.+?)\s+till\s+(.+)/);
  if (till) return finish(till[1], till[2]);
  const parts = text.split(/\s+[-\u2013\u2014]\s+/);
  if (parts.length === 2) return finish(parts[0], parts[1]);
  return null;
}

// Split one message into candidate period dates. Returns null when this is
// not a backfill message (single date, dated detail, no period cue, ...).
export function extractBackfillDates(text: string, today: string): BackfillParse | null {
  if (!/\bperiods?\b/i.test(text)) return null;
  const ext = extractWithLexicon(text);
  const lower = text.toLowerCase();
  const hasDetail = ext.symptoms.length > 0 || ext.flow !== null || ext.mood !== null
    || /\benergy\s*(?:is|level|:)?\s*([1-5])\b/i.test(lower)
    || /(?:slept|sleep)\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:h|hours?)\b/i.test(lower)
    || /\b(\d+(?:\.\d+)?)\s*(?:h|hours?)\s+of\s+sleep\b/i.test(lower);
  if (hasDetail) return null;
  const range = backfillRangeSeed(text, today);
  if (range) return { seeds: [range], warnings: [], monthAsk: null };
  const eventRe = new RegExp("\\b(" + BACKFILL_EVENT_NOUNS + ")\\b", "i");
  const segments = text.split(/(?:,|;|&|\bthen\b|\balso\b|\band\b)/i).map((s) => s.trim()).filter(Boolean);
  const dates: string[] = [];
  const warnings: string[] = [];
  const bareMonths: string[] = [];
  for (const seg of segments) {
    if (eventRe.test(seg)) continue;
    const bare = backfillBareMonth(seg);
    if (bare) {
      if (!bareMonths.includes(bare)) bareMonths.push(bare);
      continue;
    }
    const r = resolveBackfillDate(seg, today);
    if (r.date) {
      dates.push(r.date);
      continue;
    }
    if (r.future) {
      warnings.push(r.future + " is in the future, so I left it out.");
      continue;
    }
    if (/\d/.test(seg) || new RegExp("\\b(?:" + BACKFILL_MONTHS + ")\\b", "i").test(seg)) {
      warnings.push("I could not place a date for: " + seg);
    }
  }
  const dupes = dates.length - new Set(dates).size;
  const unique = [...new Set(dates)].sort();
  if (dupes > 0) warnings.push("One date was mentioned twice, so I counted it once.");
  if (unique.length > BACKFILL_MAX_ENTRIES) {
    const dropped = unique.length - BACKFILL_MAX_ENTRIES;
    warnings.push("Keeping the " + BACKFILL_MAX_ENTRIES + " most recent of " + unique.length + " dates (" + dropped + " oldest left out).");
  }
  const seeds = unique.slice(Math.max(0, unique.length - BACKFILL_MAX_ENTRIES)).map((d) => ({ date: d }));
  if (seeds.length >= 2 && bareMonths.length > 0) {
    warnings.push(bareMonths[0] + " still needs a day: add it like " + bareMonths[0] + " 9.");
  }
  if (seeds.length >= 2) return { seeds, warnings, monthAsk: null };
  if (seeds.length === 1 && warnings.length > 0) return { seeds, warnings, monthAsk: null };
  if (bareMonths.length > 0) return { seeds: [], warnings, monthAsk: bareMonths[0] };
  return null;
}

/** Q5: an explicit log statement that can stand alone as a log: a declarative
 * period start/end, a flow level stated as fact, or symptoms with a log anchor
 * (temporal marker or having-verb framing). Bare symptom nouns inside a pure
 * medical question ("is this cramp normal?", "should I take X for cramps",
 * "home remedy for cramps") are NOT log statements: those refuse outright. */
function hasClearLogStatement(text: string): boolean {
  const t = text.trim();
  // A message led by a question word is a pure question, even when it names
  // a flow level ("does heavy flow mean I have PCOS?"): never a log statement.
  if (/^(did|do|does|is|are|was|were|will|would|could|should|can|when|where|why|how|what|which|who|am|has|have)\b/i.test(t)) return false;
  // Declarative period start/end ("my period started yesterday").
  if (/\b(?:my\s+period|period)\s+(?:started|began|came|ended|stopped|finished)\b/i.test(t)) return true;
  if (/\b(?:started|got)\s+my\s+period\b/i.test(t)) return true;
  if (/\bhad\s+(?:my\s+)?(?:first\s+)?period\b/i.test(t)) return true;
  if (/\b(?:my\s+)?first\s+period\b/i.test(t)) return true;
  if (/\bgot\s+my\s+first\s+period\b/i.test(t)) return true;
  // Flow with a stated level, as fact ("heavy flow", "flow was heavy").
  if (/\b(?:heavy|medium|light|spotting|none)\s+flow\b/i.test(t)) return true;
  if (/\bflow\s+(?:was|is)\s+(?:very|really|so|quite|pretty\s+)?(?:heavy|medium|light|spotting|none)\b/i.test(t)) return true;
  if (/\bhad\s+spotting\b/i.test(t)) return true;
  // Symptoms with a log anchor: temporal markers or having-verb framing.
  // ("cramps today", "headache yesterday", "having cramps"). Bare nouns
  // ("is this cramp normal?") and untimed "I have X" do not count.
  const symptomHit = /\b(?:cramps?|headaches?|nausea|fatigue|bloating|back\s+pain|tender|acne|cravings|insomnia|dizziness|hot\s+flashes|spotting|bleeding)\b/i.test(t);
  if (!symptomHit) return false;
  if (/\b(?:today|tonight|yesterday|this\s+morning|last\s+night|tomorrow)\b/i.test(t)) return true;
  if (/\bago\b/i.test(t)) return true;
  if (/\b(?:last|this|next)\s+(?:week|month|night)\b/i.test(t)) return true;
  if (/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(t)) return true;
  if (/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(t)) return true;
  if (/\bhaving\b/i.test(t)) return true;
  return false;
}

/** Q7.3: shared negation-only rule (offline + live). "no <symptom> today" with no other log content never stores the negation and never claims a save: ask before touching today's note, else acknowledge. */
export function detectNegationOnly(
  text: string,
  today: string,
  context: AgentContext,
): { kind: "ask"; question: string } | { kind: "noted" } | null {
  if (context.pendingEntry) return null;
  const negatedToday: string[] = [];
  for (const sym of VALID_SYMPTOMS) {
    const symKey = sym.replace(/_/g, " ");
    if (new RegExp(`\\bno\\s+${symKey}\\b`, "i").test(text)) negatedToday.push(symKey);
  }
  const hasPositiveContent = (() => {
    const ext = extractWithLexicon(text);
    return ext.symptoms.length > 0 || ext.flow !== null || ext.mood !== null || ext.periodStart || ext.periodEnd;
  })();
  const mentionsToday = /\b(today|tonight|this morning|right now)\b/i.test(text);
  if (negatedToday.length === 0 || !mentionsToday || hasPositiveContent) return null;
  const pool = [...(context.recentEntries || []), ...(context.recentEntry ? [context.recentEntry] : [])];
  const todayEntry = pool.find((e) => e && (e as any).date === today);
  const onNote = todayEntry ? (todayEntry.symptoms || []).map((s) => String(s).replace(/_/g, " ").toLowerCase()) : [];
  const present = negatedToday.filter((s) => onNote.indexOf(s.toLowerCase()) !== -1);
  if (present.length > 0) {
    return { kind: "ask", question: "Remove " + present.join(" and ") + " from today\'s note?" };
  }
  return { kind: "noted" };
}

export function parseLocally(text: string, today: string, context: AgentContext): AgentResult {
  const startTime = Date.now();
  const lower = text.toLowerCase();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const activityTrail: ActivityStep[] = [
    { step: "Processing Speech", detail: "Extracted keywords from voice transcript", status: "done" },
  ];
  const toolCalls: ToolCallRecord[] = [];
  const offline = { mode: "offline" as const, modeReason: "Offline parser — Meta model not used (offline rule engine)" };

  const severeLocal = severeTier(text);
  const severeWinsLocal = severeLocal.isSevere && hasClearLogStatement(text);
  let medicalTail: string | null = null;
  if (!severeWinsLocal && checkMedicalAdviceGuardrail(text).isRefusal) {
    if (!hasClearLogStatement(text)) {
          return { message: getGuardrailResponseMessage(text), needsClarification: false, activityTrail: [{ step: "Safety Guardrail", detail: "Medical advice refusal", status: "done" }], toolCalls: [], ...offline };
    }
    medicalTail = " I can" + String.fromCharCode(39) + "t say whether that" + String.fromCharCode(39) + "s normal; please talk to a doctor.";
  }
  const severeCheck = severeLocal;
  if (severeCheck.isSevere) {
    activityTrail.push({ step: "Safety Escalation", detail: "Red-flag symptom detected — care-seeking signpost prepended", status: "done" });
  }
  // Q6.5: reminders are not supported; point at the calendar export instead.
  // Never quote a new window here.
  if (/\bremind(?:er)?\b/i.test(text) && /\bperiod\b/i.test(text) && (/\bbefore\b/i.test(text) || /\bnext\b/i.test(text))) {
    return { message: "I can" + String.fromCharCode(39) + "t set reminders yet; you can export the calendar (.ics) from Settings.", entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
  }
  
  const ownData = buildOwnDataAnswer(text, context);
  if (ownData) {
    activityTrail.push({ step: "Your Logged Data", detail: "Answered from your own logs, no model call", status: "done" });
    return { message: ownData.message, kind: ownData.kind, usedLiveModel: false, entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
  }
  // Q6.6/Q7.3: "no <symptom> today" never stores the negation and never claims
  // a save. If the symptom is already on today's note, ask before touching it.
  const negationOnly = detectNegationOnly(text, today, context);
  if (negationOnly?.kind === "ask") {
    return { message: negationOnly.question, entry: null, needsClarification: true, clarificationQuestion: negationOnly.question, activityTrail, toolCalls, ...offline };
  }
  if (negationOnly?.kind === "noted") {
    return { message: "Noted, nothing to log.", entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
  }

  if (!hasAnyLoggingOrPlanningCue(text)) {
    const q = "I didn't catch anything I can log from that — try something like 'period started yesterday, medium flow'.";
    return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, ...offline };
  }

  // Q3.4: deleting is never done by chat.
  if (/\bdelete\s+(?:my\s+)?last\s+entry\b/i.test(text)) {
    return { message: "Open Chronicle or Calendar to delete entries.", entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
  }
  // Q3.4: undo/cancel discards the pending slip; nothing is saved.
  if (/\b(?:undo\s+that|cancel\s+that|don't\s+log\s+that|discard\s+(?:that|the)\s+slip)\b/i.test(text)) {
    if (context.pendingEntry) {
      activityTrail.push({ step: "Slip Discarded", detail: "Pending slip cancelled by user", status: "done" });
      return { message: "Okay, I discarded that slip. Nothing was saved.", entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
    }
    return { message: "There's no pending slip to discard.", entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
  }

  // Q4.1: local calendar questions are answered on this device from stored events.
  const ownEvents = buildOwnEventsAnswer(text, {
    events: context.events,
    periods: context.periods,
    cycleStats: context.cycleStats ? { lastPeriodStart: context.cycleStats.lastPeriodStart ?? null } : undefined,
    today,
  });
  if (ownEvents) {
    activityTrail.push({ step: "Your Calendar", detail: "Answered from your own calendar, no model call", status: "done" });
    return { message: ownEvents.message, kind: ownEvents.kind, usedLiveModel: false, entry: null, needsClarification: false, activityTrail, toolCalls, ...offline };
  }

  // Offline-only regex corrections on a pending slip or recent saved entry (live path lets the model patch).
  // B3: previous entries may ONLY be corrected on explicit correction language;
  // a new log sentence must never inherit their date/flow/symptoms.
  const isExplicitCorrection =
    /^\s*no[,.!?\s]/i.test(text) ||
    /\bactually\b/i.test(text) ||
    /\bmake it\b/i.test(text) ||
    /\bchange\s+(?:the\s+)?(?:date|flow|mood|energy|it|to)\b/i.test(text) ||
    /\b(?:add|remove|delete)\b/i.test(text) ||
    /\balso had\b/i.test(text) ||
    /\bset\s+(?:the\s+)?date\b/i.test(text) ||
    /\b(?:none|spotting|light|medium|heavy)\s*,?\s*(?:and\s+)?not\s+(?:none|spotting|light|medium|heavy)\b/i.test(text) ||
    /\bnot\s+(?:none|spotting|light|medium|heavy)\b/i.test(text) ||
    /\bi\s+meant\b/i.test(text) ||
    /\bmove\s+(?:it\s+)?to\b/i.test(text) ||
    /\b(?:a\s+)?day\s+later\b/i.test(text) ||
    /\bno\s+wait\b/i.test(text);
  // Q3.3: corrections target only the pending slip, an entry named by date, or
  // "my last entry". Statements about today never edit old entries.
  const lastEntryMentioned = /\b(?:my\s+)?last\s+entry\b/i.test(text);
  const hasCorrectionVerb = /\b(change|changed|correct|correction|fix|fixed|update|updated|edit|edited)\b/i.test(text);
  const namedDate = (isExplicitCorrection || lastEntryMentioned || hasCorrectionVerb) && !context.pendingEntry ? namesNonTodayDate(text, today, context.landmarkPacks) : null;
  const mentionsToday = /\b(today|tonight|this morning|right now)\b/i.test(text);
  const todayOnlyStatement = mentionsToday && !namedDate && !lastEntryMentioned;
  let targetSlip: StructuredEntry | null = context.pendingEntry ?? null;
  let namedDateMatched = false;
  if (!targetSlip && (isExplicitCorrection || lastEntryMentioned || (hasCorrectionVerb && namedDate)) && !todayOnlyStatement) {
    if (namedDate) {
      const pool = context.recentEntries && context.recentEntries.length ? context.recentEntries : (context.recentEntry ? [context.recentEntry] : []);
      const namedHit = pool.find((e) => e.date === namedDate) ?? null;
      if (namedHit) { targetSlip = namedHit; namedDateMatched = true; }
    } else {
      targetSlip = selectCorrectionTarget(text, null, context.recentEntry, context.recentEntries);
    }
  }
  if (targetSlip && (context.pendingEntry || isExplicitCorrection || lastEntryMentioned || namedDateMatched)) {
    const correctionRes = applySlipCorrections(targetSlip, text);
    if (correctionRes.changes.length > 0) {
      toolCalls.push({ id: "call_update_" + Date.now(), toolName: "update_entry", args: { correction: text }, result: { updated: correctionRes.updated, changes: correctionRes.changes }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
      activityTrail.push({ step: "Accession Slip Correction", detail: correctionRes.changes.join("; "), status: "done" });
      return { message: "I've updated your Accession Slip with your corrections. Please review below." + (medicalTail || ""), entry: correctionRes.updated, needsClarification: false, replacesExisting: true, activityTrail, toolCalls, ...offline };
    }
  }

  const isCorrectionAttempt = /\b(actually|make it\s+(?:light|heavy|medium|spotting|none)|change\s+(?:the\s+)?(?:date|flow)|(?:light|medium|heavy|spotting)\s*,?\s*not\s+(?:light|medium|heavy|spotting)|not\s+(?:light|medium|heavy|spotting)\s*,?\s*(?:but|actually)?\s*(?:light|medium|heavy|spotting)|move\s+(?:it\s+)?to|i\s+meant|(?:a\s+)?day\s+later|no\s+wait)\b/i.test(text);
  // Q6.3: a date correction that names an explicit day gets its own answer;
  // bare-day phrases keep the lookup wording ("move it to the 5th").
  const namesExplicitDay = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(text) || /\b\d{4}-\d{2}-\d{2}\b/.test(text) || /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text);
  const isDateCorrection = namesExplicitDay && /\b(change|move|correct|fix|update|edit|meant|later|wait)\b/i.test(text);
  if (!targetSlip && (isCorrectionAttempt || isDateCorrection) && !/\bperiod\s+(?:started|ended)\b/i.test(text)) {
    const noEntryMsg = namesExplicitDay ? "There's no entry to change." : "I couldn't find a recent entry to correct.";
    return {
      message: noEntryMsg,
      entry: null,
      needsClarification: false,
      activityTrail: [{ step: "Correction Lookup", detail: "No recent entry found to correct", status: "done" }],
      toolCalls: [],
      ...offline,
    };
  }

  // Phase 2: compare two dates ("which is safer, Nov 14 or Nov 21"). Read-only:
  // no entry, no planned event is created, and "safer" here is about dates.
  if (isCompareIntent(text)) {
    const comparison = buildDateComparison(text, today, context);
    if (!comparison) {
      const q = "Which two dates should I compare? Give both dates, like Nov 14 and Nov 21.";
      return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, ...offline };
    }
    activityTrail.push({ step: "Date Comparison", detail: comparison.message, status: "done" });
    toolCalls.push({ id: "call_compare_" + Date.now(), toolName: "check_overlap", args: { dates: comparison.dates.map((d) => d.date) }, result: { comparison }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
    return { message: comparison.message, entry: null, needsClarification: false, activityTrail, toolCalls, comparison: { dates: comparison.dates, summary: comparison.summary }, plannedEvents: [], ...offline };
  }

  const intent = classifyIntent(text, !!targetSlip && (Boolean(context.pendingEntry) || isExplicitCorrection));
  const extraction = extractWithLexicon(text);
  const energyMatch = lower.match(/\benergy\s*(?:is|level|:)?\s*([1-5])\b/);
  const energy = energyMatch ? parseInt(energyMatch[1], 10) : null;
  const sleepMatch = lower.match(/\b(?:slept|sleep)\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:h|hours?)\b/) || lower.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hours?)\s+of\s+sleep\b/);
  const sleep = sleepMatch ? parseFloat(sleepMatch[1]) : null;

  // Plan Around It events: any "<title> on <date>" phrase (exam, wedding, dinner, ...).
  // Dates may be "Nov 20", "20 November", "3rd November" or ISO. Plan dates resolve
  // to the NEXT occurrence (never the past) unless an explicit year was given.
  const EVENT_NOUNS = [
    "wedding", "exam", "trip", "interview", "party", "flight",
    "vacation", "conference", "presentation", "dinner", "meeting",
    "birthday", "anniversary", "marathon", "race", "appointment",
    "shaadi", "sangeet"
  ];
  const MONTH_RE = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
  const planDateRe = new RegExp(`\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_RE})|(?:${MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:,?\\s+\\d{4})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b`, "gi");
  const eventMatches: Array<{ name: string; date: string; endDate?: string }> = [];
  const planDateSpans: Array<{ index: number; length: number }> = [];
  let planDateInvalid = false;
  const passedPlanCandidates: Array<{ name: string; thisYear: string; nextYear: string }> = [];
  {
    let m: RegExpExecArray | null; let prevEnd = 0;
    const cleanTitle = (seg: string): string => {
      let t = seg.split(/[.!?\n;]+/).pop() || seg;
      t = t.split(/,|\band\b/i).pop() || t;
      t = t.replace(/[,";]+\s*$/g, "").trim();
      t = t.replace(/^[\s,.;:!?\-&]+/, "").trim();
      t = t.replace(/^\s*(?:and|&|also|plus|then)\s+/i, "");
      let prevLead = "";
      while (prevLead !== t) {
        prevLead = t;
        t = t
          .replace(
            /^\s*(?:i\s+also\s+have|i\s+have|i've\s+got|ive\s+got|i\s+got|there\s+is|there's|we\s+have|we've\s+got|i\s+am\s+(?:worried|nervous|anxious|excited|stressed|thinking|planning|going|preparing)\s+(?:about|for|to)|i'm\s+(?:worried|nervous|anxious|excited|stressed|thinking|planning|going|preparing)\s+(?:about|for|to)|im\s+(?:worried|nervous|anxious|excited|stressed|thinking|planning|going|preparing)\s+(?:about|for|to)|worried\s+about|nervous\s+about|excited\s+for|preparing\s+for|planning\s+for|going\s+to)\s+/i,
            "",
          )
          .trim();
      }
      let prev = "";
      while (prev !== t) {
        prev = t;
        t = t.replace(/\s*(?:\b(?:is|was|scheduled|planned|happening|coming up|on|at|for|from|to attend)\b)\s*$/i, "").trim();
      }
      t = t.replace(/\bcoming up\b/gi, "").replace(/\s+/g, " ").trim();
      t = t.replace(/^\s*(?:an?|the|my|our|his|her|their|meri|mere|mera|hamari|apni|apne|yeh|ye|woh|wo|ek)\s+/i, "").trim();
      return t;
    };
    // Q3.6: overlap questions name the event noun ("...during my exam" -> "exam").
    const focusNounTitle = (candidate: string, sentence: string): string => {
      if (!/\bperiod\b/i.test(sentence)) return candidate;
      const focus = candidate.match(new RegExp(`\\b(?:my|the|a|an|during(?:\\s+my)?|for(?:\\s+my)?)\\s+(${EVENT_NOUNS.join("|")})\\b`, "i"));
      return focus ? focus[1].toLowerCase() : candidate;
    };
    // Q3.6: "from X to Y" / "X-Y" / "X till Y" is ONE event with an end date.
    const rangeSpans: Array<{ index: number; length: number }> = [];
    {
      const DATE_ALT = `(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_RE})|(?:${MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:,?\\s+\\d{4})?|\\d{4}-\\d{2}-\\d{2}`;
      const rangeRe = new RegExp(`\\bfrom\\s+(${DATE_ALT})\\s+(?:to|till|through|-|\\u2013)\\s+(${DATE_ALT})|\\b(${DATE_ALT})\\s*(?:-|\\u2013|\\btill\\b)\\s+(${DATE_ALT})`, "gi");
      const resolveRangeDate = (raw: string): { key: string | null; explicitYear: boolean } => {
        const t = raw.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return { key: isValidDateKey(t) ? t : null, explicitYear: true };
        const yMatch = t.match(/\b(\d{4})\b/);
        const noYear = t.replace(/,?\s+\b\d{4}\b/, "");
        return { key: parseMonthDay(noYear, yMatch ? parseInt(yMatch[1], 10) : currentYear), explicitYear: !!yMatch };
      };
      let rm: RegExpExecArray | null;
      while ((rm = rangeRe.exec(text)) !== null) {
        const startRaw = (rm[1] ?? rm[3] ?? "").trim();
        const endRaw = (rm[2] ?? rm[4] ?? "").trim();
        if (!startRaw || !endRaw) continue;
        const s = resolveRangeDate(startRaw);
        const e = resolveRangeDate(endRaw);
        if (!s.key || !e.key) continue;
        let start = s.key;
        let end = e.key;
        if (!s.explicitYear && !e.explicitYear && start < today) {
          const ns = resolveRangeDate(startRaw + " " + (currentYear + 1));
          const ne = resolveRangeDate(endRaw + " " + (currentYear + 1));
          if (!ns.key || !ne.key) continue;
          start = ns.key; end = ne.key;
        }
        if (end < start) continue;
        const sStart = Math.max(text.lastIndexOf(".", rm.index - 1) + 1, text.lastIndexOf("!", rm.index - 1) + 1, text.lastIndexOf("?", rm.index - 1) + 1, text.lastIndexOf("\n", rm.index - 1) + 1, text.lastIndexOf(";", rm.index - 1) + 1, 0);
        const rangeSentence = text.slice(sStart, rm.index + rm[0].length);
        const rangeTitle = focusNounTitle(cleanTitle(text.slice(sStart, rm.index)) || "Event", rangeSentence);
        eventMatches.push({ name: rangeTitle, date: start, endDate: end });
        rangeSpans.push({ index: rm.index, length: rm[0].length });
        planDateSpans.push({ index: rm.index, length: rm[0].length });
      }
    }
    while ((m = planDateRe.exec(text)) !== null) {
      if (rangeSpans.some((s) => m.index >= s.index && m.index < s.index + s.length)) continue;
      const rawDate = m[0];
      const explicitYear = /\b\d{4}\b/.test(rawDate) && !/^\d{4}-/.test(rawDate) ? parseInt(rawDate.match(/\b\d{4}\b/)![0], 10) : (/^\d{4}-/.test(rawDate) ? parseInt(rawDate.slice(0, 4), 10) : null);
      let resolvedDate: string | null;
      const dateNoYear = rawDate.replace(/,?\s+\b\d{4}\b/, "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) resolvedDate = isValidDateKey(rawDate) ? rawDate : null;
      else {
        resolvedDate = parseMonthDay(dateNoYear, explicitYear ?? currentYear);
      }
      const seg = text.slice(prevEnd, m.index);
      const sentenceStart = Math.max(
        0,
        text.lastIndexOf(".", m.index - 1) + 1,
        text.lastIndexOf("!", m.index - 1) + 1,
        text.lastIndexOf("?", m.index - 1) + 1,
        text.lastIndexOf("\n", m.index - 1) + 1,
        text.lastIndexOf(";", m.index - 1) + 1,
      );
      const nextStops = [
        text.indexOf(".", m.index + rawDate.length),
        text.indexOf("!", m.index + rawDate.length),
        text.indexOf("?", m.index + rawDate.length),
        text.indexOf("\n", m.index + rawDate.length),
        text.indexOf(";", m.index + rawDate.length),
      ].filter((idx) => idx !== -1);
      const sentenceEnd = nextStops.length > 0 ? Math.min(...nextStops) : text.length;
      const localSentence = text.slice(sentenceStart, sentenceEnd);
      const clauseBeforeDate = text.slice(Math.max(prevEnd, sentenceStart), m.index);
      prevEnd = m.index + rawDate.length;
      const hasEventNounInClauseOrSentence = /\b(exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday|plan|planning|shaadi|sangeet)\b/i.test(localSentence);
      const hasCycleOrSymptomInSentence = /\b(period|flow|spotting|bleeding|menstruat|cramps|headache|nausea|fatigue|bloating|back pain|tender breasts|mood|acne|insomnia|cravings|diarrhea|constipation|dizziness|hot flashes)\b/i.test(localSentence);
      const cleanedCandidate = cleanTitle(clauseBeforeDate);
      if (!hasEventNounInClauseOrSentence && (cleanedCandidate === "" || hasCycleOrSymptomInSentence)) continue;
      if (/\b(period|flow|spotting|bleeding|menstruat)/i.test(clauseBeforeDate) && !/\b(exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday|shaadi|sangeet)\b/i.test(clauseBeforeDate)) continue;
      const title = focusNounTitle(cleanedCandidate || "Event", localSentence);
      if (!resolvedDate || !isValidDateKey(resolvedDate)) { planDateInvalid = true; continue; }
      if (explicitYear === null && resolvedDate < today) {
        const nextYear = parseMonthDay(dateNoYear, currentYear + 1);
        if (nextYear) passedPlanCandidates.push({ name: title, thisYear: resolvedDate, nextYear });
        planDateSpans.push({ index: m.index, length: rawDate.length });
        continue;
      }
      planDateSpans.push({ index: m.index, length: rawDate.length });
      eventMatches.push({ name: title, date: resolvedDate });
    }
  }
  // Q3.6: birthdays/anniversaries propose the next occurrence instead of asking.
  for (let i = passedPlanCandidates.length - 1; i >= 0; i--) {
    const c = passedPlanCandidates[i];
    if (/\b(birthday|anniversary)\b/i.test(c.name)) {
      eventMatches.push({ name: c.name, date: c.nextYear });
      passedPlanCandidates.splice(i, 1);
    }
  }
  const unplacedEvents: string[] = [];
  const eventNounRe = new RegExp(`\\b(${EVENT_NOUNS.join("|")})\\b`, "gi");
  let em: RegExpExecArray | null;
  while ((em = eventNounRe.exec(text)) !== null) {
    const kw = em[1].toLowerCase();
    const alreadyMatched = eventMatches.some((e) => e.name.toLowerCase().includes(kw)) ||
      passedPlanCandidates.some((c) => c.name.toLowerCase().includes(kw));
    if (!alreadyMatched && !unplacedEvents.includes(kw)) {
      unplacedEvents.push(kw);
    }
  }
  if (planDateInvalid && eventMatches.length === 0 && extractWithLexicon(text).symptoms.length === 0) {
    const q = "Which date did you mean for that event? Please give the day and month.";
    return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, ...offline };
  }
  let planOverlaps: AgentResult["planOverlaps"] = undefined;
  if (eventMatches.length > 0) {
    activityTrail.push({ step: "Plan Around It", detail: `Found ${eventMatches.length} events`, status: "done" });
    try {
      const bad = eventMatches.find((e) => !isValidDateKey(e.date));
      if (bad) throw new Error(`Unparsed event date: ${bad.date}`);
      planOverlaps = evaluateContextOverlaps(eventMatches, context, today);
    } catch {
      const q = "Which date did you mean for that event? Please give the day and month.";
      return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, ...offline };
    }
    toolCalls.push({ id: "call_overlap_" + Date.now(), toolName: "check_overlap", args: { events: eventMatches }, result: { overlaps: planOverlaps }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
  }

  const hasLogContent = extraction.symptoms.length > 0 || extraction.flow !== null || extraction.mood !== null || energy !== null || sleep !== null || extraction.periodStart || extraction.periodEnd || severeCheck.isSevere;

  // Personal landmark recall (client-matched events only, Batch 5.5 wiring is honoured here too)
  const matchedEvent = findMatchedEvent(text, context.matchedEvents);
  const usedPersonalAnchor = !!matchedEvent && /\b(after|before|around|week of)\b/.test(lower) && !!matchedEvent;

  const earlyLandmark = resolveLandmarkExpression(text, today, context.landmarkPacks);
  const isLandmarkPlan = /\b(plan|planning)\b/i.test(lower) && !hasLogContent && eventMatches.length === 0 && earlyLandmark.found && !!earlyLandmark.resolvedDate;
  if (isLandmarkPlan && earlyLandmark.resolvedDate) {
    if (earlyLandmark.resolvedDate >= today) {
      eventMatches.push({ name: earlyLandmark.landmarkName || "Event", date: earlyLandmark.resolvedDate });
      unplacedEvents.length = 0;
      activityTrail.push({ step: "Plan Around It", detail: `Found ${eventMatches.length} events`, status: "done" });
      planOverlaps = evaluateContextOverlaps(eventMatches, context, today);
      toolCalls.push({ id: "call_overlap_" + Date.now(), toolName: "check_overlap", args: { events: eventMatches }, result: { overlaps: planOverlaps }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
    } else {
      const nextLm = resolveLandmarkExpression(`${earlyLandmark.landmarkName} next year`, today, context.landmarkPacks);
      if (nextLm.found && nextLm.resolvedDate && nextLm.resolvedDate > today) {
        passedPlanCandidates.push({ name: earlyLandmark.landmarkName || "Event", thisYear: earlyLandmark.resolvedDate, nextYear: nextLm.resolvedDate });
        unplacedEvents.length = 0;
      }
    }
  }
  // Prompt 8 Group A: event/planning intent + landmark -> NEXT occurrence event,
  // never a log slip, never the past-year question. Log intent keeps clarifying.
  const EVENT_NOUN_RE = /\b(exam|party|trip|appointment|wedding|interview|birthday|dentist|flight|conference|presentation|holiday|vacation|marathon|race|dinner|event|meeting)\b/i;
  if (!hasLogContent && eventMatches.length === 0 && earlyLandmark.found && earlyLandmark.resolvedDate && (intent === "plan_event" || EVENT_NOUN_RE.test(lower))) {
    let evDate: string | null = earlyLandmark.resolvedDate;
    if (evDate && evDate < today) {
      const lmName = earlyLandmark.landmarkName || "Event";
      const nextLm = resolveLandmarkExpression(`${lmName} next year`, today, context.landmarkPacks);
      if (nextLm.found && nextLm.baseDate) {
        const off = earlyLandmark.baseDate ? Math.round((Date.parse(earlyLandmark.resolvedDate) - Date.parse(earlyLandmark.baseDate)) / 86400000) : 0;
        evDate = applyDayOffset(nextLm.baseDate, off);
      } else { evDate = null; }
    }
    if (evDate && evDate >= today) {
      let title = text.replace(/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\s+(?:before|after)\b/gi, " ");
      if (earlyLandmark.landmarkName) title = title.replace(new RegExp(earlyLandmark.landmarkName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
      title = title.replace(/\b(on|is|starts?|at|coming up)\b/gi, " ").replace(/[^a-zA-Z' ]+/g, " ").replace(/\s+/g, " ").trim().replace(/^(my|the|a|an)\s+/i, "");
      if (!title) title = "Event";
      eventMatches.push({ name: title, date: evDate });
      planOverlaps = evaluateContextOverlaps(eventMatches, context, today);
      activityTrail.push({ step: "Plan Around It", detail: `Found ${eventMatches.length} events`, status: "done" });
      toolCalls.push({ id: "call_overlap_" + Date.now(), toolName: "check_overlap", args: { events: eventMatches }, result: { overlaps: planOverlaps }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
      return { message: eventMatches.map((e) => `${e.name} on ${e.date}`).join("; "), entry: null, needsClarification: false, activityTrail, toolCalls, planOverlaps, plannedEvents: eventMatches.map((e) => ({ title: e.name, date: e.date })), usedPersonalAnchor, ...offline };
    }
  }
  // Backfill: several past periods in one message. Pure-additive branch with
  // zero flow or symptom detail; everything else falls through unchanged.
  const backfill = extractBackfillDates(text, today);
  if (backfill) {
    if (backfill.monthAsk) {
      const q = "Which day in " + backfill.monthAsk + "? Reply like " + '"' + "period started " + backfill.monthAsk + " 9" + '"' + ".";
      return { message: q, entry: null, entries: [], needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, usedPersonalAnchor, ...offline };
    }
    const seeds = backfill.seeds;
    const dated = seeds.map((s) => s.date);
    const rangeNote = seeds.length === 1 && seeds[0].endDate ? " to " + seeds[0].endDate : "";
    const baseMsg = seeds.length === 1
      ? "I found 1 period: " + dated[0] + rangeNote + ". Review and confirm below."
      : "I found " + seeds.length + " period starts: " + dated.join(", ") + ". Review and confirm below.";
    const warnMsg = backfill.warnings.length > 0 ? " " + backfill.warnings.join(" ") : "";
    const entries: StructuredEntry[] = seeds.map((s) => ({
      date: s.date, endDate: s.endDate || null, flow: null, symptoms: [],
      mood: null, energy: null, sleep: null, notes: text,
      isApproximate: false, landmarkName: null, kind: "period_started",
      dateExplanation: null, dateWindow: null,
    }));
    for (const e of entries) {
      toolCalls.push({ id: "call_backfill_" + Date.now() + "_" + e.date, toolName: "log_entry", args: { date: e.date, kind: "period_started" }, result: { entry: { date: e.date } }, latencyMs: 1, model: "offline-rule-engine", executedBy: "offline-rule-engine" });
    }
    activityTrail.push({ step: "Backfill", detail: "Extracted " + seeds.length + " past period date" + (seeds.length === 1 ? "" : "s"), status: "done" });
    return ensureFactCoverageDisclosure({
      message: baseMsg + warnMsg, entry: entries[0], entries,
      needsClarification: false, activityTrail, toolCalls, planOverlaps,
      plannedEvents: eventMatches.map((e) => ({ title: e.name, date: e.date })),
      usedPersonalAnchor, ...offline,
    }, text, today);
  }
  // Intent first: no loggable content -> no log slip (bare landmark recall is exempt:
  // it is the app's landmark-recall shorthand for a period date).
  // Hotfix: intent "other" with real log content (flow/symptoms/severe words the
  // classifier does not name) still falls through to a slip below; only
  // content-free "other" input is a dead end.
  if (!hasLogContent && intent !== "plan_event") {
    if (eventMatches.length === 0 && !matchedEvent && !earlyLandmark.found) {
      if (unplacedEvents.length > 0) {
        const q = `I couldn't place a date for: ${unplacedEvents.join(", ")}`;
        return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
      }
      const late = /\bperiod\s+(is\s+)?late\b|\blate period\b|\bmissed\s+(my\s+)?period\b|\bam\s+i\s+late\b/i.test(lower);
      // Hotfix: a dated care-visit note ("went to the doctor yesterday about my
      // period") is loggable as a daily note for that day. Narrow on purpose:
      // declarative only (no question), a visit noun, and a resolved past/today
      // date. Pure questions, dateless notes and late-questions keep asking.
      const isQuestionLike = /\?\s*$/.test(text.trim()) || /^(did|do|does|is|are|was|were|will|would|could|should|can|when|where|why|how|what|which|who|am|has|have)\b/i.test(text.trim());
      const visitLog = !late && !isQuestionLike && /\bdoctor|clinic|appointment|check-?up|nurse|hospital\b/i.test(text)
        ? resolveDateExpression(text, today, context.landmarkPacks) : null;
      const isDatedVisitNote = !!visitLog && !visitLog.needsClarification && !!visitLog.date && visitLog.date <= today;
      // Q3.7: period starts also count when they only exist as logged period_started entries.
      const startedFromEntries = [...(context.recentEntries || []), ...(context.recentEntry ? [context.recentEntry] : []), ...(context.pendingEntry && (context.pendingEntry as any).kind === "period_started" ? [context.pendingEntry] : [])]
        .filter((e) => e && (e as any).kind === "period_started" && (e as any).date)
        .map((e) => (e as any).date as string);
      const startedFromLogs = (context.logs || []).filter((g) => (g as any) && (g as any).kind === "period_started" && (g as any).logDate).map((g) => (g as any).logDate as string);
      const lastStart = [...(context.periods || []).map((x) => x.startDate).filter(Boolean), ...(context.cycleStats?.lastPeriodStart ? [context.cycleStats.lastPeriodStart] : []), ...startedFromEntries, ...startedFromLogs].filter(Boolean).sort().pop() || null;
      if (!isDatedVisitNote) {
        const q = late ? (lastStart ? `Your last logged period started ${shortDateLabel(lastStart)}. Has a new one started since, or is that the one you mean?` : "I can't tell if your period is late without a logged start \u2014 did it start? Tell me when, or say 'period started today' to log it.") : "I didn't catch anything I can log from that - try something like 'period started yesterday, medium flow'.";
        return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
      }
      // else: dated visit note falls through to daily-note logging below.
    }
  }
  const planPassedQuestion = passedPlanCandidates.length > 0 && eventMatches.length === 0
    ? `Did you mean ${passedPlanCandidates[0].thisYear} (already passed) or ${passedPlanCandidates[0].nextYear}?`
    : null;
  if (planPassedQuestion && !hasLogContent) {
    return { message: planPassedQuestion, entry: null, needsClarification: true, clarificationQuestion: planPassedQuestion, activityTrail, toolCalls, planOverlaps, ...offline };
  }
  if ((intent === "plan_event" || eventMatches.length > 0) && !hasLogContent) {
    // Plan-only: events only, never an empty log for today. A bare landmark phrase
    // (legacy landmark-recall shorthand) still falls through to a log entry below.
    const isBareLandmark = eventMatches.length === 0;
    if (!isBareLandmark) {
      // Q3.6: overlap questions get the overlap answer; ranges show start to end.
      const isOverlapQuestion = /\bperiod\b/i.test(text) && /\b(during|clash(?:es|ed|ing)?|overlap(?:s|ped|ping)?|coincid(?:e|es|ing)|safe)\b/i.test(text);
      const describeEvent = (e: { name: string; date: string; endDate?: string }): string => {
        const base = e.endDate && e.endDate !== e.date ? `${e.name} on ${e.date} to ${e.endDate}` : `${e.name} on ${e.date}`;
        if (!isOverlapQuestion) return base;
        const hit = (planOverlaps || []).find((o) => o.eventDate === e.date && o.name === e.name);
        return hit && hit.overlapNote ? `${base}: ${hit.overlapNote}` : base;
      };
      const msg = unplacedEvents.length > 0
        ? `I couldn't place a date for: ${unplacedEvents.join(", ")}`
        : eventMatches.map(describeEvent).join("; ");
      return { message: msg, entry: null, needsClarification: false, activityTrail, toolCalls, planOverlaps, plannedEvents: eventMatches.map((e) => ({ title: e.name, date: e.date, ...(e.endDate && e.endDate !== e.date ? { endDate: e.endDate } : {}) })), usedPersonalAnchor, ...offline };
    }
  }

  // Date resolution (Batch 2.3). Plan-event dates belong to the event, not the
  // log: strip them so e.g. "dinner on Nov 3 and I have cramps" logs cramps for
  // today instead of asking a stale-date question about the dinner date.
  let logDateText = text;
  if (planDateSpans.length > 0) {
    for (const span of [...planDateSpans].sort((a, b) => b.index - a.index)) {
      logDateText = logDateText.slice(0, span.index) + " " + logDateText.slice(span.index + span.length);
    }
  }
  const logLandmark = resolveLandmarkExpression(logDateText, today, context.landmarkPacks);
  if (logLandmark.found && ((logLandmark.baseDate && logLandmark.baseDate > today) || (logLandmark.resolvedDate && logLandmark.resolvedDate > today))) {
    const lmName = logLandmark.landmarkName || "Landmark";
    const futureBase = logLandmark.baseDate || logLandmark.resolvedDate!;
    const futureYear = futureBase.slice(0, 4);
    const pastLm = resolveLandmarkExpression(`last ${lmName}`, today, context.landmarkPacks);
    const pastBase = pastLm.found ? (pastLm.baseDate || pastLm.resolvedDate) : null;
    const pastYear = pastBase ? pastBase.slice(0, 4) : null;
    const q = pastBase && pastYear && pastBase <= today
      ? `${lmName} ${futureYear} is on ${futureBase}, which hasn't happened yet. Did you mean ${lmName} ${pastYear} (${pastBase})?`
      : `${lmName} ${futureYear} is on ${futureBase}, which hasn't happened yet. Which past date did you mean?`;
    return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
  }
  const resolved = resolveDateExpression(logDateText, today, context.landmarkPacks);
  if (resolved.needsClarification) {
    const dateQ = resolved.clarificationQuestion || "Which date?";
    const dateQMsg = severeCheck.isSevere ? `${severeCheck.message || SEVERE_SYMPTOM_ESCALATION_MESSAGE} ${dateQ}` : dateQ;
    return { message: dateQMsg, entry: null, needsClarification: true, clarificationQuestion: dateQ, activityTrail, toolCalls, planOverlaps, ...offline };
  }
  let entryDate: string | null = resolved.date;
  let dateExplanation: string | null = resolved.explanation || null;
  let dateWindow = resolved.window || null;
  let landmarkName: string | null = earlyLandmark.found && entryDateMatchesLandmark(earlyLandmark, resolved.date) ? earlyLandmark.landmarkName || null : null;
  let isApproximate = !!resolved.window || (landmarkName ? /\baround\b|\bnear\b/.test(lower) : false);
  if (!entryDate && matchedEvent && usedPersonalAnchor) {
    const off = parseRelativeExpression(text);
    entryDate = off.weekday ? matchedEvent.date : applyDayOffset(matchedEvent.date, off.days || 0);
    landmarkName = matchedEvent.title;
    dateExplanation = `${matchedEvent.title} = ${matchedEvent.date}`;
    isApproximate = true;
  }
  if (!entryDate && earlyLandmark.found && earlyLandmark.resolvedDate && earlyLandmark.resolvedDate <= today) {
    entryDate = earlyLandmark.resolvedDate;
    landmarkName = earlyLandmark.landmarkName || null;
    isApproximate = true;
    dateExplanation = landmarkName ? `${landmarkName} = ${entryDate}` : dateExplanation;
  }
  if (!entryDate) {
    const clearlyToday = /\b(today|now|this morning|tonight|right now)\b/.test(lower);
    const pastMarkers =
      /\b(started|began|came|ended|stopped|was|had|yesterday|ago|tha|the|thi|hua|hui|undaayirunnu|kazhinju|kazhinjittu|munpe|pehle|during|around|before|after|holi|equinox|solstice|midsummer|getaway|marathon)\b/i.test(lower) ||
      /\b(ke\s+(?:day|time|din|baad|pehle)|time\s+il|winter\s+(?:holiday\s+)?break)\b/i.test(lower) ||
      /(थी|था|थे|हुआ|हुई|के दिन|के समय|से .* पहले|के बाद|होली|ആയിരുന്നു|തുടങ്ങി|സമയത്ത്|ദിവസം|മുൻപ്|ശേഷം|ഹോളി|വേനൽ\s+അവധി)/.test(text);
    // Q4.4: the calendar ?date= preset wins over silent defaults, never over a stated date.
    const presetDefault = context.defaultDate && /^\d{4}-\d{2}-\d{2}$/.test(context.defaultDate) && isValidDateKey(context.defaultDate) && context.defaultDate <= today ? context.defaultDate : null;
    if (clearlyToday) entryDate = today;
    else if (presetDefault) entryDate = presetDefault;
    else if (hasLogContent && !pastMarkers) entryDate = today; // present-tense symptom/flow log
    else {
      const q = "Which date?";
      const qMsg = severeCheck.isSevere ? `${severeCheck.message || SEVERE_SYMPTOM_ESCALATION_MESSAGE} ${q}` : q;
      return { message: qMsg, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
    }
  }
  if (entryDate > today) {
    const q = `Did you mean last year's date? That date is in the future.`;
    return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
  }

  // B2 multi-fact sentences: the date right after "period started ..." wins for
  // the start, "flow was X on the first day" is the start day's flow, and a
  // different flow or symptoms "yesterday" are named as unplaced instead of dropped/merged.
  let unplacedNote: string | null = null;
  if (extraction.periodStart) {
    const frag = text.match(/(?:period\s+(?:started|began|came)|started\s+my\s+period|got\s+my\s+period)\s+([^,.;!?\n]+?)(?=\s+and\s|\s+but\s|\s+with\s|[,.;!?\n]|$)/i)?.[1];
    if (frag) {
      const r = resolveDateExpression(`period started ${frag}`, today, context.landmarkPacks);
      if (r.date) { entryDate = r.date; dateExplanation = r.explanation || dateExplanation; }
    }
    const firstDayFlow = lower.match(/\bflow\s+was\s+(light|medium|heavy)\s+on\s+the\s+first\s+day\b/) || lower.match(/\b(light|medium|heavy)\s+on\s+the\s+first\s+day\b/);
    if (firstDayFlow) (extraction as any).flow = firstDayFlow[1];
    const yesterdayFlow = lower.match(/\b(light|medium|heavy)\s+yesterday\b/) || lower.match(/\byesterday\s+(?:flow\s+was\s+)?(light|medium|heavy)\b/);

    const yesterdayKey = addDaysToKey(today, -1);
    if (entryDate !== yesterdayKey && /\byesterday\b/i.test(text)) {
      const yesterdayMatch = text.match(/(?:but\s+|and\s+|,)?\s*(?:(?:flow\s+was\s+)?(?:none|spotting|light|medium|heavy)\s+)?yesterday\b[^.]*?(?=\s+and\s+(?:i\s+also\s+have|i\s+have|there\s+is|we\s+have|an?\s+(?:exam|wedding|trip|dinner|flight|party))|\s*\.|$)/i);
      const yesterdayClause = yesterdayMatch ? yesterdayMatch[0] : "";
      const yesterdaySymptoms = yesterdayClause ? extractWithLexicon(yesterdayClause).symptoms : [];

      if (yesterdaySymptoms.length > 0) {
        (extraction as any).symptoms = extraction.symptoms.filter((s: ValidSymptom) => !yesterdaySymptoms.includes(s));
      }

      const yFlow = yesterdayFlow ? yesterdayFlow[1] : null;
      if (yFlow || yesterdaySymptoms.length > 0) {
        const parts: string[] = [];
        if (yFlow) parts.push(`${yFlow} flow`);
        if (yesterdaySymptoms.length > 0) parts.push(`with ${yesterdaySymptoms.join(" and ")}`);
        unplacedNote = `${parts.join(" ")} yesterday (${yesterdayKey}) as a separate day`;
      }
    } else if (yesterdayFlow && yesterdayFlow[1] !== extraction.flow) {
      unplacedNote = `${yesterdayFlow[1]} flow yesterday (${yesterdayKey}) as a separate day`;
    }
  }

  // Multi-sentence / multi-clause dated facts disclosure (Prompt 6 Group D1):
  // When a paragraph contains multiple dated log clauses (e.g., period start + heavy day + symptom days),
  // keep only the primary date's facts on the confirmation slip and disclose all other dated facts in unplacedNote.
  {
    const clauseParts = logDateText
      .split(
        /(?:[.!?\n;]+|,\s*(?=(?:and\s+|but\s+)?(?:on\s+|yesterday\b|today\b|last\s+night\b|day\s+before\s+yesterday\b|the\s+next\s+day\b|day\s*[2-7]\b|\d+\s+days?\s+ago\b|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b))|\b(?:and|but)\s+(?=(?:on\s+|yesterday\b|today\b|last\s+night\b|the\s+next\s+day\b|day\s*[2-7]\b|\d+\s+days?\s+ago\b)))/i,
      )
      .map((s) => s.trim())
      .filter(Boolean);

    if (clauseParts.length >= 2) {
      const parsedClauses = clauseParts.map((cl) => {
        const clRes = resolveDateExpression(cl, today, context.landmarkPacks);
        let clDate = clRes.date;
        const clExplanation = clRes.explanation;
        if (!clDate && entryDate) {
          if (/\b(?:the\s+next\s+day|on\s+day\s*2|on\s+the\s+(?:2nd|second)\s+day|day\s*2)\b/i.test(cl)) clDate = addDaysToKey(entryDate, 1);
          else if (/\b(?:on\s+day\s*3|on\s+the\s+(?:3rd|third)\s+day|day\s*3)\b/i.test(cl)) clDate = addDaysToKey(entryDate, 2);
          else if (/\b(?:on\s+day\s*4|on\s+the\s+(?:4th|fourth)\s+day|day\s*4)\b/i.test(cl)) clDate = addDaysToKey(entryDate, 3);
        }
        const clExt = extractWithLexicon(cl);
        const hasClLog = clExt.periodStart || clExt.periodEnd || clExt.flow !== null || clExt.symptoms.length > 0 || clExt.mood !== null;
        return { text: cl, date: clDate, explanation: clExplanation, ext: clExt, hasClLog };
      });

      const datedLogClauses = parsedClauses.filter((c) => c.hasClLog && c.date !== null && c.date! <= today);
      if (datedLogClauses.length >= 2) {
        const primaryClause = datedLogClauses.find((c) => c.ext.periodStart) || datedLogClauses[0];
        if (!extraction.periodStart && primaryClause.date) {
          entryDate = primaryClause.date;
          dateExplanation = primaryClause.explanation || dateExplanation;
        }
        const otherDated = datedLogClauses.filter((c) => c.date !== entryDate);
        const yesterdayKey = addDaysToKey(today, -1);
        const isMultiOrNonYesterday =
          otherDated.length > 1 ||
          (otherDated.length === 1 && (otherDated[0].date !== yesterdayKey || !unplacedNote));

        if (otherDated.length > 0 && isMultiOrNonYesterday) {
          const sameDateClauses = parsedClauses.filter((c) => c.date === entryDate || (c.date === null && c.hasClLog));
          const sameDateFlows = sameDateClauses.map((c) => c.ext.flow).filter(Boolean);
          const firstDayFlowMatch = lower.match(/\bflow\s+was\s+(light|medium|heavy)\s+on\s+the\s+first\s+day\b/) || lower.match(/\b(light|medium|heavy)\s+on\s+the\s+first\s+day\b/);
          (extraction as any).flow = firstDayFlowMatch ? firstDayFlowMatch[1] : (sameDateFlows[0] ?? null);

          const sameDateSymptoms: ValidSymptom[] = [];
          for (const c of sameDateClauses) {
            for (const s of c.ext.symptoms) {
              if (!sameDateSymptoms.includes(s)) sameDateSymptoms.push(s);
            }
          }
          (extraction as any).symptoms = sameDateSymptoms;

          const sameDateMoods = sameDateClauses.map((c) => c.ext.mood).filter(Boolean);
          (extraction as any).mood = sameDateMoods[0] ?? null;

          const unplacedDescriptions: string[] = [];
          for (const c of otherDated) {
            const parts: string[] = [];
            if (c.ext.flow) parts.push(`${c.ext.flow} flow`);
            if (c.ext.symptoms.length > 0) {
              const symLabels = c.ext.symptoms.map((s) => s.replace(/_/g, " ")).join(" and ");
              parts.push(c.ext.flow ? `with ${symLabels}` : symLabels);
            }
            if (c.ext.mood) parts.push(`mood ${c.ext.mood.toLowerCase()}`);
            if (parts.length === 0 && c.ext.periodEnd) parts.push("period ended");
            if (parts.length > 0) {
              const dayWord = /\byesterday\b/i.test(c.text) ? `yesterday (${c.date})` : /\btoday\b/i.test(c.text) ? `today (${c.date})` : `(${c.date})`;
              unplacedDescriptions.push(`${parts.join(" ")} ${dayWord}`);
            }
          }
          if (unplacedDescriptions.length > 0) {
            unplacedNote = `${unplacedDescriptions.join("; ")} as ${unplacedDescriptions.length === 1 ? "a separate day" : "separate days"}`;
          }
        }
      }
    }
  }

  const kind: StructuredEntry["kind"] = intent === "period_end" || extraction.periodEnd ? "period_ended" : intent === "period_start" || extraction.periodStart ? "period_started" : "daily_log";
  const entry: StructuredEntry = {
    date: entryDate, flow: extraction.flow, symptoms: extraction.symptoms, mood: extraction.mood, energy, sleep, notes: text,
    isApproximate, landmarkName, kind, dateExplanation, dateWindow,
  };
  toolCalls.push({ id: "call_log_" + Date.now(), toolName: "log_entry", args: { date: entryDate, flow: extraction.flow, symptoms: extraction.symptoms, mood: extraction.mood, energy, kind }, result: { entry }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
  const baseMessage = isApproximate && landmarkName ? `I found ${landmarkName} on ${entryDate}. Would you like to confirm this period entry?` : `I've prepared your log for ${entryDate}. Please review and confirm below.`;
  let message = unplacedNote ? `${baseMessage} I couldn't place: ${unplacedNote} — log that day separately if you want it saved.` : baseMessage;
  if (unplacedEvents.length > 0) {
    message += ` I couldn't place a date for: ${unplacedEvents.join(", ")}.`;
  }
  if (severeCheck.isSevere && !message.startsWith(severeCheck.message || SEVERE_SYMPTOM_ESCALATION_MESSAGE)) {
    message = `${severeCheck.message || SEVERE_SYMPTOM_ESCALATION_MESSAGE} ${message}`;
  }
  if (medicalTail) message += medicalTail;
  return { message, entry, needsClarification: (isApproximate && !!landmarkName) || !!planPassedQuestion, clarificationQuestion: planPassedQuestion ?? (isApproximate && landmarkName ? `Did your period start before, on, or after ${landmarkName}?` : null), activityTrail, toolCalls, planOverlaps, plannedEvents: eventMatches.map((e) => ({ title: e.name, date: e.date })), usedPersonalAnchor, ...offline };
}
