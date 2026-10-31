// Muse Spark Agent with tool calling loop for:
// 1. Structured Voice Logging (14 symptoms, flow, mood, energy, sleep)
// 2. Landmark Recall (fuzzy festival date resolution)
// 3. Plan Around It (cycle overlap checking with zero medical advice)
// 4. Accession Slip Multi-Turn Corrections (voice & text)
// 5. Tool Call Inspection & Observability

import { getConfig } from "./config";
import { checkMedicalAdviceGuardrail, MEDICAL_REFUSAL_MESSAGE } from "./guardrail";

import { todayLocal, parseMonthDay, isValidDateKey, addDaysToKey, diffDateKeys } from "../../client/src/lib/localDate";
import { evaluateEventOverlap, type PeriodRecord } from "../../client/src/lib/periodEngine";
import {
  resolveLandmarkExpression,
  resolveDateExpression,
  applySlipCorrections,
  applyDayOffset,
  parseRelativeExpression,
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
  currentDate?: string; // YYYY-MM-DD
  provider?: "meta" | "baseten";
  pendingEntry?: StructuredEntry | null;
  recentEntry?: StructuredEntry | null;
  recentEntries?: StructuredEntry[];
  locale?: string;
  matchedEvents?: Array<{ title: string; date: string }>;
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

export interface AgentResult {
  mode?: "live" | "offline";
  modeReason?: string | null;
  plannedEvents?: Array<{ title: string; date: string }>;
  usedPersonalAnchor?: boolean;
  message: string;
  entry?: StructuredEntry | null;
  needsClarification: boolean;
  clarificationQuestion?: string | null;
  activityTrail: ActivityStep[];
  toolCalls?: ToolCallRecord[];
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
   - If the user asks ANY question seeking medical diagnosis, symptom interpretation, medication, treatment, or pregnancy risk, you MUST refuse immediately with this exact fixed message and nothing else:
     "I can only help with logging and planning. For health questions, please talk to a doctor."

2. PURE LOGGING & PLANNING CAPABILITIES:
   - Voice Logging: Extract date, flow, symptoms, mood, energy (1-5), sleep (hours), and notes. Call tool \`log_entry\`.
   - Slip Correction: If the user provides conversational corrections to a pending slip ("no, make it the 3rd", "add headache", "change flow to light"), call \`update_entry\`.
   - Landmark Recall: If user gives fuzzy dates ("around New Year's", "after International Women's Day", "two days before vacation"), call tool \`milestone_lookup\`. If ambiguous, ask a polite, concise clarifying question ("Was it before or after New Year's?").
   - Plan Around It: If user mentions upcoming events ("marathon on Nov 15, flight to Tokyo on Dec 4, exam on Oct 10"), call \`check_overlap\`. Use ONLY neutral scheduling language: "Likely overlap", "Possible overlap", or "Unlikely to overlap (estimate)". Never imply certainty or guarantees.

Tone: Warm, respectful, concise, neutral, non-medical.
Reply in the user's language (context locale) when known. When a pending entry exists, call update_entry with a patch; do not ask the user to re-log.`;


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

function evaluateContextOverlaps(events: Array<{ name: string; date: string }>, context: AgentContext, today: string) {
  const records = recordsFromContext(context);
  return events.map((ev) => {
    const result = evaluateEventOverlap(ev.date, records, today);
    return {
      name: ev.name,
      eventDate: ev.date,
      overlap: (result.status === "logged" ? "period-day" : result.status) as "period-day" | "likely" | "possible" | "unlikely" | "unknown" | "past",
      overlapNote: result.note,
      window: result.window,
    };
  });
}

export async function runLavenderAgent(
  userPrompt: string,
  context: AgentContext = {},
  conversationHistory: Array<{ role: "user" | "assistant" | "system" | "tool"; content: string }> = [],
): Promise<AgentResult> {
  const startTime = Date.now();
  const activityTrail: ActivityStep[] = [];
  const toolCallsRecorded: ToolCallRecord[] = [];

  // Step 1: Pre-execution Server-Side Medical Guardrail Check
  const guardrailCheck = checkMedicalAdviceGuardrail(userPrompt);
  if (guardrailCheck.isRefusal) {
    activityTrail.push({
      step: "Safety Guardrail",
      detail: "Medical advice request intercepted",
      status: "done",
    });
    return {
      message: MEDICAL_REFUSAL_MESSAGE,
      needsClarification: false,
      activityTrail,
      toolCalls: toolCallsRecorded,
    };
  }

  const today = context.currentDate || todayLocal();

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

  // C1: "my period is late" is a deterministic clarifying intent in BOTH paths.
  if (/\bperiod\s+(is\s+)?late\b|\blate period\b|\bmissed\s+(my\s+)?period\b/i.test(userPrompt) && !/started|flow/i.test(userPrompt)) {
    return { ...fallbackResult, mode: "offline" as const, modeReason: "Offline parser — Meta model not used (late-period question answered directly; no entry created)" };
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
  let livePlannedEvents: Array<{ title: string; date: string }> = [];

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

  // OpenAI-compatible Chat Completions API with Tool Calling
  const messages: any[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\nToday's date is ${today}. Locale: ${context.locale || "en"}. Reply in the user's language.${targetEntry ? `\nPending or recent entry to correct if asked: ${JSON.stringify(targetEntry)}. Call update_entry with a patch (date, flow, symptoms_add, symptoms_remove, mood, energy, sleep, notes).` : ""}${context.matchedEvents && context.matchedEvents.length ? `\nClient-matched personal events (consented): ${JSON.stringify(context.matchedEvents)}. Use find_calendar_events for these.` : ""}` },
    ...conversationHistory,
    { role: "user", content: userPrompt },
  ];

  let usedPersonalAnchorLive = false;
  let structuredEntry: StructuredEntry | null = null;
  let planOverlaps: any[] | undefined = undefined;
  let needsClarification = false;
  let clarificationQuestion: string | null = null;
  let finalMessage = "";

  const MAX_STEPS = 5;
  let stepCount = 0;

  try {
    while (stepCount < MAX_STEPS) {
      stepCount++;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0.2,
        }),
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

          const landmarkRes = resolveLandmarkExpression(fnArgs.name, today);
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
          livePlannedEvents = rawEvents.map((e: any) => ({ title: e.name || e.title || "Event", date: e.date }));
          toolResultObj = { overlaps };
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "log_entry") {
          const validationError = validateEntryArgs(fnArgs, today);
          if (validationError) {
            toolResultObj = { error: validationError };
          } else {
            activityTrail.push({ step: "Structured Entry", detail: `Prepared log for ${fnArgs.date}`, status: "done" });
            structuredEntry = {
              date: fnArgs.date || today, flow: fnArgs.flow || null,
              symptoms: (fnArgs.symptoms || []).filter((s: string) => (VALID_SYMPTOMS as readonly string[]).includes(s)),
              mood: fnArgs.mood || null, energy: fnArgs.energy ?? null, sleep: fnArgs.sleep ?? null, notes: fnArgs.notes || null,
              isApproximate: fnArgs.isApproximate || false, landmarkName: fnArgs.landmarkName || null, kind: fnArgs.kind || "daily_log",
            };
            toolResultObj = { success: true, entry: structuredEntry };
          }
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "update_entry") {
          const entryToPatch = targetEntry;
          if (!entryToPatch) {
            toolResultObj = { success: false, error: "No pending slip to update" };
          } else {
            const patched = applyModelPatch(entryToPatch, fnArgs, today);
            if (patched.error) toolResultObj = { error: patched.error };
            else { structuredEntry = patched.entry!; toolResultObj = { success: true, entry: structuredEntry }; }
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

    // Server-side check on the final assistant response as secondary guardrail defense
    const outputGuard = checkMedicalAdviceGuardrail(finalMessage);
    if (outputGuard.isRefusal) {
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

    return {
      message: finalMessage,
      entry: structuredEntry,
      needsClarification,
      clarificationQuestion,
      activityTrail,
      toolCalls: toolCallsRecorded,
      planOverlaps,
      plannedEvents: livePlannedEvents.length > 0 ? livePlannedEvents : (planOverlaps?.length ? planOverlaps.map((o: any) => ({ title: o.name, date: o.eventDate })) : undefined),
      mode: "live",
      modeReason: null,
      usedPersonalAnchor: usedPersonalAnchorLive,
    };
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
  if (/\bperiod\s+(started|began|came)\b|\bstarted my period\b|\bgot my period\b/i.test(lower)) periodStart=true;
  if (/\bperiod\s+(ended|stopped|finished)\b|\bflow stopped\b/i.test(lower)) periodEnd=true;
  return { symptoms, flow, mood, periodStart, periodEnd };
}
export function validateEntryArgs(args: Record<string, any>, today: string): string | null {
  if (args.date !== undefined) {
    if (typeof args.date !== "string" || !isValidDateKey(args.date)) return "Invalid date: expected YYYY-MM-DD calendar date.";
    const min = addDaysToKey(today, -731);
    if (args.date < min || args.date > today) return `Invalid date: must be between ${min} and ${today} (today).`;
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
export function parseLocally(text: string, today: string, context: AgentContext): AgentResult {
  const startTime = Date.now();
  const lower = text.toLowerCase();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const activityTrail: ActivityStep[] = [
    { step: "Processing Speech", detail: "Extracted keywords from voice transcript", status: "done" },
  ];
  const toolCalls: ToolCallRecord[] = [];
  const offline = { mode: "offline" as const, modeReason: "Offline parser — Meta model not used (offline rule engine)" };

  if (checkMedicalAdviceGuardrail(text).isRefusal) {
    return { message: MEDICAL_REFUSAL_MESSAGE, needsClarification: false, activityTrail: [{ step: "Safety Guardrail", detail: "Medical advice refusal", status: "done" }], toolCalls: [], ...offline };
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
    /\bnot\s+(?:none|spotting|light|medium|heavy)\b/i.test(text);
  const targetSlip = context.pendingEntry || (isExplicitCorrection ? selectCorrectionTarget(text, null, context.recentEntry, context.recentEntries) : null);
  if (targetSlip && (context.pendingEntry || isExplicitCorrection)) {
    const correctionRes = applySlipCorrections(targetSlip, text);
    if (correctionRes.changes.length > 0) {
      toolCalls.push({ id: "call_update_" + Date.now(), toolName: "update_entry", args: { correction: text }, result: { updated: correctionRes.updated, changes: correctionRes.changes }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
      activityTrail.push({ step: "Accession Slip Correction", detail: correctionRes.changes.join("; "), status: "done" });
      return { message: "I've updated your Accession Slip with your corrections. Please review below.", entry: correctionRes.updated, needsClarification: false, activityTrail, toolCalls, ...offline };
    }
  }

  const isCorrectionAttempt = /\b(actually|make it\s+(?:light|heavy|medium|spotting|none)|change\s+(?:the\s+)?(?:date|flow)|(?:light|medium|heavy|spotting)\s*,?\s*not\s+(?:light|medium|heavy|spotting)|not\s+(?:light|medium|heavy|spotting)\s*,?\s*(?:but|actually)?\s*(?:light|medium|heavy|spotting))\b/i.test(text);
  if (!targetSlip && isCorrectionAttempt && !/\bperiod\s+(?:started|ended)\b/i.test(text)) {
    return {
      message: "I couldn't find a recent entry to correct.",
      entry: null,
      needsClarification: false,
      activityTrail: [{ step: "Correction Lookup", detail: "No recent entry found to correct", status: "done" }],
      toolCalls: [],
      ...offline,
    };
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
  const MONTH_RE = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
  const planDateRe = new RegExp(`\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_RE})|(?:${MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:,?\\s+\\d{4})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b`, "gi");
  const eventMatches: Array<{ name: string; date: string }> = [];
  const planDateSpans: Array<{ index: number; length: number }> = [];
  let planDateInvalid = false;
  const passedPlanCandidates: Array<{ name: string; thisYear: string; nextYear: string }> = [];
  {
    let m: RegExpExecArray | null; let prevEnd = 0;
    const cleanTitle = (seg: string): string => {
      let t = seg.replace(/[,";]+\s*$/g, "").trim();
      t = t.replace(/^\s*(?:and|&)\s+/i, "");
      t = t.replace(/^\s*(?:i also have|i have|i've got|ive got|there is|there's)\s+/i, "");
      let prev = "";
      while (prev !== t) {
        prev = t;
        t = t.replace(/\s*(?:\b(?:is|was|scheduled|planned|happening|coming up|on|at|for|to attend)\b)\s*$/i, "").trim();
      }
      t = t.replace(/\bcoming up\b/gi, "").replace(/\s+/g, " ").trim();
      t = t.replace(/^\s*(?:an?|the)\s+/i, "").trim();
      return t;
    };
    while ((m = planDateRe.exec(text)) !== null) {
      const rawDate = m[0];
      const explicitYear = /\b\d{4}\b/.test(rawDate) && !/^\d{4}-/.test(rawDate) ? parseInt(rawDate.match(/\b\d{4}\b/)![0], 10) : (/^\d{4}-/.test(rawDate) ? parseInt(rawDate.slice(0, 4), 10) : null);
      let resolvedDate: string | null;
      const dateNoYear = rawDate.replace(/,?\s+\b\d{4}\b/, "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) resolvedDate = isValidDateKey(rawDate) ? rawDate : null;
      else {
        resolvedDate = parseMonthDay(dateNoYear, explicitYear ?? currentYear);
      }
      const seg = text.slice(prevEnd, m.index);
      prevEnd = m.index + rawDate.length;
      if (/\b(period|flow|spotting|bleeding|menstruat)/i.test(seg) && !/\b(exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday)\b/i.test(seg)) continue;
      const title = cleanTitle(seg.split(/\band\b/i).pop() || seg) || "Event";
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
  const EVENT_NOUNS = [
    "wedding", "exam", "trip", "interview", "party", "flight",
    "vacation", "conference", "presentation", "dinner", "meeting",
    "birthday", "anniversary", "marathon", "race", "appointment"
  ];
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

  const hasLogContent = extraction.symptoms.length > 0 || extraction.flow !== null || extraction.mood !== null || energy !== null || sleep !== null || extraction.periodStart || extraction.periodEnd;

  // Personal landmark recall (client-matched events only, Batch 5.5 wiring is honoured here too)
  const matchedEvent = findMatchedEvent(text, context.matchedEvents);
  const usedPersonalAnchor = !!matchedEvent && /\b(after|before|around|week of)\b/.test(lower) && !!matchedEvent;

  const earlyLandmark = resolveLandmarkExpression(text, today);
  const isLandmarkPlan = /\b(plan|planning)\b/i.test(lower) && !hasLogContent && eventMatches.length === 0 && earlyLandmark.found && !!earlyLandmark.resolvedDate;
  if (isLandmarkPlan && earlyLandmark.resolvedDate) {
    if (earlyLandmark.resolvedDate >= today) {
      eventMatches.push({ name: earlyLandmark.landmarkName || "Event", date: earlyLandmark.resolvedDate });
      unplacedEvents.length = 0;
      activityTrail.push({ step: "Plan Around It", detail: `Found ${eventMatches.length} events`, status: "done" });
      planOverlaps = evaluateContextOverlaps(eventMatches, context, today);
      toolCalls.push({ id: "call_overlap_" + Date.now(), toolName: "check_overlap", args: { events: eventMatches }, result: { overlaps: planOverlaps }, latencyMs: Math.max(1, Date.now() - startTime), model: "offline-rule-engine", executedBy: "offline-rule-engine" });
    } else {
      const nextLm = resolveLandmarkExpression(`${earlyLandmark.landmarkName} next year`, today);
      if (nextLm.found && nextLm.resolvedDate && nextLm.resolvedDate > today) {
        passedPlanCandidates.push({ name: earlyLandmark.landmarkName || "Event", thisYear: earlyLandmark.resolvedDate, nextYear: nextLm.resolvedDate });
        unplacedEvents.length = 0;
      }
    }
  }
  // Intent first: no loggable content -> no log slip (bare landmark recall is exempt:
  // it is the app's landmark-recall shorthand for a period date).
  if (intent === "other" || (!hasLogContent && intent !== "plan_event")) {
    if (eventMatches.length === 0 && !matchedEvent && !earlyLandmark.found) {
      if (unplacedEvents.length > 0) {
        const q = `I couldn't place a date for: ${unplacedEvents.join(", ")}`;
        return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
      }
      const late = /\bperiod\s+(is\s+)?late\b|\blate period\b|\bmissed\s+(my\s+)?period\b/i.test(lower);
      const q = late ? "I can't tell if your period is late without a logged start — did it start? Tell me when, or say 'period started today' to log it." : "I didn't catch anything I can log from that — try something like 'period started yesterday, medium flow'.";
      return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
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
      const msg = unplacedEvents.length > 0
        ? `I couldn't place a date for: ${unplacedEvents.join(", ")}`
        : eventMatches.map((e) => `${e.name} on ${e.date}`).join("; ");
      return { message: msg, entry: null, needsClarification: false, activityTrail, toolCalls, planOverlaps, plannedEvents: eventMatches.map((e) => ({ title: e.name, date: e.date })), usedPersonalAnchor, ...offline };
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
  const logLandmark = resolveLandmarkExpression(logDateText, today);
  if (logLandmark.found && ((logLandmark.baseDate && logLandmark.baseDate > today) || (logLandmark.resolvedDate && logLandmark.resolvedDate > today))) {
    const lmName = logLandmark.landmarkName || "Landmark";
    const futureBase = logLandmark.baseDate || logLandmark.resolvedDate!;
    const futureYear = futureBase.slice(0, 4);
    const pastLm = resolveLandmarkExpression(`last ${lmName}`, today);
    const pastBase = pastLm.found ? (pastLm.baseDate || pastLm.resolvedDate) : null;
    const pastYear = pastBase ? pastBase.slice(0, 4) : null;
    const q = pastBase && pastYear && pastBase <= today
      ? `${lmName} ${futureYear} is on ${futureBase}, which hasn't happened yet. Did you mean ${lmName} ${pastYear} (${pastBase})?`
      : `${lmName} ${futureYear} is on ${futureBase}, which hasn't happened yet. Which past date did you mean?`;
    return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
  }
  const resolved = resolveDateExpression(logDateText, today);
  if (resolved.needsClarification) {
    return { message: resolved.clarificationQuestion || "Which date?", entry: null, needsClarification: true, clarificationQuestion: resolved.clarificationQuestion || "Which date?", activityTrail, toolCalls, planOverlaps, ...offline };
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
    if (clearlyToday) entryDate = today;
    else if (hasLogContent && !pastMarkers) entryDate = today; // present-tense symptom/flow log
    else {
      const q = "Which date?";
      return { message: q, entry: null, needsClarification: true, clarificationQuestion: q, activityTrail, toolCalls, planOverlaps, ...offline };
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
    const frag = text.match(/period\s+started\s+([^,.]+?)(?=\s+and\s|\s+but\s|,|$)/i)?.[1];
    if (frag) {
      const r = resolveDateExpression(`period started ${frag}`, today);
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
  return { message, entry, needsClarification: (isApproximate && !!landmarkName) || !!planPassedQuestion, clarificationQuestion: planPassedQuestion ?? (isApproximate && landmarkName ? `Did your period start before, on, or after ${landmarkName}?` : null), activityTrail, toolCalls, planOverlaps, plannedEvents: eventMatches.map((e) => ({ title: e.name, date: e.date })), usedPersonalAnchor, ...offline };
}
