// Muse Spark Agent with tool calling loop for:
// 1. Structured Voice Logging (14 symptoms, flow, mood, energy, sleep)
// 2. Landmark Recall (fuzzy festival date resolution)
// 3. Plan Around It (cycle overlap checking with zero medical advice)
// 4. Accession Slip Multi-Turn Corrections (voice & text)
// 5. Tool Call Inspection & Observability

import { getConfig } from "./config";
import { checkMedicalAdviceGuardrail, MEDICAL_REFUSAL_MESSAGE } from "./guardrail";
import festivalsData from "./milestonesData";
import {
  resolveLandmarkExpression,
  applySlipCorrections,
  applyDayOffset,
  parseRelativeExpression,
} from "./dateArithmetic";

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
}

export interface AgentContext {
  cycleStats?: {
    avgCycleLength: number;
    avgPeriodLength: number;
    lastPeriodStart?: string | null;
    nextPeriodEarliest?: string | null;
    nextPeriodLatest?: string | null;
  };
  periods?: Array<{ startDate: string; endDate?: string | null }>;
  currentDate?: string; // YYYY-MM-DD
  provider?: "meta" | "baseten";
  pendingEntry?: StructuredEntry | null;
}

export interface AgentResult {
  message: string;
  entry?: StructuredEntry | null;
  needsClarification: boolean;
  clarificationQuestion?: string | null;
  activityTrail: ActivityStep[];
  toolCalls?: ToolCallRecord[];
  planOverlaps?: Array<{
    name: string;
    eventDate: string;
    overlap: "period-day" | "likely" | "possible" | "unlikely" | "unknown";
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
          addSymptoms: { type: "array", items: { type: "string", enum: VALID_SYMPTOMS } },
          removeSymptoms: { type: "array", items: { type: "string", enum: VALID_SYMPTOMS } },
          mood: { type: "string" },
          energy: { type: "integer", minimum: 1, maximum: 5 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "milestone_lookup",
      description: "Looks up dates for global calendar and seasonal milestones in 2025, 2026, and 2027 for landmark date recall (e.g. New Year's Day, International Women's Day, Spring Equinox, Summer Solstice, Global Marathon Season, Winter Holiday Break, New Year's Eve, Diwali, Onam, Vishu).",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of milestone (e.g. New Year's Day, International Women's Day, Summer Solstice, Winter Holiday Break, Diwali).",
          },
          year: {
            type: "integer",
            description: "Year (2025, 2026, or 2027). Defaults to current or most recent year.",
          },
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
];

const SYSTEM_PROMPT = `You are Feather, a voice-first menstrual logging and planning companion built for women globally.
You help women log their cycle, recall past periods relative to universal calendar landmarks (Landmark Recall), and plan around upcoming life events such as flights, marathons, work sprints, exams, and vacations (Plan Around It).
You support natural conversational speech in English, Spanish, French, Malayalam, and Hindi vernacular code-switching.

CRITICAL NON-NEGOTIABLE SAFETY RULES:
1. STRICT MEDICAL & HEALTH REFUSAL:
   - NEVER give medical advice, interpret symptoms, diagnose conditions, recommend medication or dosages, or provide fertility, contraception, or pregnancy-risk guidance.
   - You MUST NEVER use words like "safe", "guaranteed", "clear window", or anything implying pregnancy or fertility safety.
   - If the user asks ANY question seeking medical diagnosis, symptom interpretation, medication, treatment, or pregnancy risk, you MUST refuse immediately with this exact fixed message and nothing else:
     "I can only help with logging and planning. For health questions, please talk to a doctor."

2. PURE LOGGING & PLANNING CAPABILITIES:
   - Voice Logging: Extract date, flow, symptoms, mood, energy (1-5), sleep (hours), and notes. Call tool \`log_entry\`.
   - Slip Correction: If the user provides conversational corrections to a pending slip ("no, make it the 3rd", "add headache", "change flow to light"), call \`update_entry\`.
   - Landmark Recall: If user gives fuzzy dates ("around New Year's", "after International Women's Day", "two days before Diwali"), call tool \`milestone_lookup\`. If ambiguous, ask a polite, concise clarifying question ("Was it before or after New Year's?").
   - Plan Around It: If user mentions upcoming events ("marathon on Nov 15, flight to Tokyo on Dec 4, exam on Oct 10"), call \`check_overlap\`. Use ONLY neutral scheduling language: "Likely overlap", "Possible overlap", or "Unlikely to overlap (estimate)". Never imply certainty or guarantees.

Tone: Warm, respectful, concise, neutral, non-medical.`;

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

  const today = context.currentDate || new Date().toISOString().slice(0, 10);

  // Check if this is an interactive correction on an active pending Accession Slip
  if (context.pendingEntry) {
    const correctionRes = applySlipCorrections(context.pendingEntry, userPrompt);
    if (correctionRes.changes.length > 0) {
      toolCallsRecorded.push({
        id: "call_update_" + Date.now(),
        toolName: "update_entry",
        args: { userCorrection: userPrompt },
        result: { updated: correctionRes.updated, changes: correctionRes.changes },
        latencyMs: Math.max(1, Date.now() - startTime),
        model: context.provider === "baseten" ? "meta-models/muse-spark-open-1026" : "muse-spark-1.3",
      });

      activityTrail.push({
        step: "Accession Slip Correction",
        detail: correctionRes.changes.join("; "),
        status: "done",
      });

      return {
        message: "I've updated your Accession Slip with your corrections. Please review below.",
        entry: correctionRes.updated,
        needsClarification: false,
        activityTrail,
        toolCalls: toolCallsRecorded,
      };
    }
  }

  activityTrail.push({
    step: "Processing Speech",
    detail: "Parsing voice input with Muse Spark",
    status: "pending",
  });

  // Fallback pattern parser for offline / test environments
  const fallbackResult = parseLocally(userPrompt, today, context);

  const config = getConfig();
  const isBaseten = context.provider === "baseten" || config.useBaseten;
  const apiKey = isBaseten ? config.basetenApiKey : (config.metaApiKey || config.basetenApiKey);
  const baseUrl = isBaseten ? config.basetenBaseUrl : config.metaBaseUrl;
  const model = isBaseten ? "meta-models/muse-spark-open-1026" : config.museSparkModel;

  if (!apiKey) {
    // Return high quality offline fallback with activity trail and recorded tool calls
    activityTrail.forEach((a) => (a.status = "done"));
    return fallbackResult;
  }

  // OpenAI-compatible Chat Completions API with Tool Calling
  const messages: any[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\nToday's date is ${today}.` },
    ...conversationHistory,
    { role: "user", content: userPrompt },
  ];

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
        return fallbackResult;
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

        if (fnName === "milestone_lookup" || fnName === "festival_lookup") {
          const festName = (fnArgs.name || "").toLowerCase();
          let yr = fnArgs.year ? String(fnArgs.year) : undefined;
          activityTrail.push({
            step: "Landmark Recall",
            detail: `Looking up calendar milestone "${fnArgs.name}" for ${yr || "recent"}`,
            status: "done",
          });

          const landmarkRes = resolveLandmarkExpression(fnArgs.name, today);
          if (landmarkRes.found) {
            toolResultObj = {
              milestone: landmarkRes.landmarkName,
              year: yr || landmarkRes.resolvedDate?.slice(0, 4),
              date: landmarkRes.resolvedDate,
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
            avgCycleLength: context.cycleStats?.avgCycleLength || 28,
            avgPeriodLength: context.cycleStats?.avgPeriodLength || 5,
            lastPeriodStart: context.cycleStats?.lastPeriodStart || null,
            nextPeriodEarliest: context.cycleStats?.nextPeriodEarliest || null,
            nextPeriodLatest: context.cycleStats?.nextPeriodLatest || null,
          };
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "check_overlap") {
          activityTrail.push({
            step: "Plan Around It",
            detail: `Evaluating cycle overlap for ${fnArgs.events?.length || 0} events`,
            status: "done",
          });
          const overlaps = evaluateOverlaps(fnArgs.events || [], context);
          planOverlaps = overlaps;
          toolResultObj = { overlaps };
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "log_entry") {
          activityTrail.push({
            step: "Structured Entry",
            detail: `Prepared log for ${fnArgs.date}`,
            status: "done",
          });
          structuredEntry = {
            date: fnArgs.date || today,
            flow: fnArgs.flow || null,
            symptoms: (fnArgs.symptoms || []).filter((s: string) => (VALID_SYMPTOMS as readonly string[]).includes(s)),
            mood: fnArgs.mood || null,
            energy: fnArgs.energy || null,
            sleep: fnArgs.sleep || null,
            notes: fnArgs.notes || null,
            isApproximate: fnArgs.isApproximate || false,
            landmarkName: fnArgs.landmarkName || null,
          };
          toolResultObj = { success: true, entry: structuredEntry };
          toolResponseContent = JSON.stringify(toolResultObj);
        } else if (fnName === "update_entry") {
          if (context.pendingEntry) {
            const slipRes = applySlipCorrections(context.pendingEntry, userPrompt);
            structuredEntry = slipRes.updated;
            toolResultObj = { success: true, entry: structuredEntry, changes: slipRes.changes };
          } else {
            toolResultObj = { success: false, error: "No pending slip to update" };
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
      message: finalMessage || fallbackResult.message,
      entry: structuredEntry || fallbackResult.entry,
      needsClarification,
      clarificationQuestion,
      activityTrail,
      toolCalls: toolCallsRecorded.length > 0 ? toolCallsRecorded : fallbackResult.toolCalls,
      planOverlaps: planOverlaps || fallbackResult.planOverlaps,
    };
  } catch (err: any) {
    console.error("[Lavender Agent] Error in runLavenderAgent:", err);
    return fallbackResult;
  }
}

/**
 * Local fallback parser for offline verification, fast tests, and network resilience.
 */
export function parseLocally(text: string, today: string, context: AgentContext): AgentResult {
  const startTime = Date.now();
  const lower = text.toLowerCase();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const activityTrail: ActivityStep[] = [
    { step: "Processing Speech", detail: "Extracted keywords from voice transcript", status: "done" },
  ];
  const toolCalls: ToolCallRecord[] = [];

  // Medical guardrail check
  if (checkMedicalAdviceGuardrail(text).isRefusal) {
    return {
      message: MEDICAL_REFUSAL_MESSAGE,
      needsClarification: false,
      activityTrail: [{ step: "Safety Guardrail", detail: "Medical advice refusal", status: "done" }],
      toolCalls: [],
    };
  }

  // Check if modifying an active pending Accession Slip
  if (context.pendingEntry) {
    const correctionRes = applySlipCorrections(context.pendingEntry, text);
    if (correctionRes.changes.length > 0) {
      toolCalls.push({
        id: "call_update_" + Date.now(),
        toolName: "update_entry",
        args: { correction: text },
        result: { updated: correctionRes.updated, changes: correctionRes.changes },
        latencyMs: Math.max(1, Date.now() - startTime),
        model: "offline-rule-engine",
      });

      activityTrail.push({
        step: "Accession Slip Correction",
        detail: correctionRes.changes.join("; "),
        status: "done",
      });

      return {
        message: "I've updated your Accession Slip with your corrections. Please review below.",
        entry: correctionRes.updated,
        needsClarification: false,
        activityTrail,
        toolCalls,
      };
    }
  }

  // Check for Plan Around It events
  const eventMatches: Array<{ name: string; date: string }> = [];
  const eventRegex = /(?:exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation)(?:\s+(?:to|in|for)\s+[a-zA-Z]+)?\s+(?:on|at)?\s*([a-zA-Z]+\s+\d{1,2}|\d{4}-\d{2}-\d{2})/gi;
  let match: RegExpExecArray | null;
  while ((match = eventRegex.exec(text)) !== null) {
    const rawDate = match[1];
    let resolvedDate = rawDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      const parsed = new Date(`${rawDate} ${currentYear}`);
      if (!isNaN(parsed.getTime())) {
        resolvedDate = parsed.toISOString().slice(0, 10);
      }
    }
    eventMatches.push({ name: match[0].split(/\s+(?:on|at)/)[0] || "Event", date: resolvedDate });
  }

  let planOverlaps: any[] | undefined = undefined;
  if (eventMatches.length > 0) {
    activityTrail.push({ step: "Plan Around It", detail: `Found ${eventMatches.length} events`, status: "done" });
    planOverlaps = evaluateOverlaps(eventMatches, context);
    toolCalls.push({
      id: "call_overlap_" + Date.now(),
      toolName: "check_overlap",
      args: { events: eventMatches },
      result: { overlaps: planOverlaps },
      latencyMs: Math.max(1, Date.now() - startTime),
      model: "offline-rule-engine",
    });
  }

  // Check for Landmark Recall using deterministic date arithmetic
  let landmarkDate: string | null = null;
  let landmarkName: string | null = null;
  let isApproximate = false;

  const landmarkRes = resolveLandmarkExpression(text, today);
  if (landmarkRes.found && landmarkRes.resolvedDate) {
    landmarkName = landmarkRes.landmarkName;
    landmarkDate = landmarkRes.resolvedDate;
    isApproximate = true;

    activityTrail.push({
      step: "Landmark Recall",
      detail: `Found calendar milestone: ${landmarkName} -> ${landmarkDate}`,
      status: "done",
    });

    toolCalls.push({
      id: "call_milestone_" + Date.now(),
      toolName: "milestone_lookup",
      args: { landmarkName, anchorDate: today },
      result: { baseDate: landmarkRes.baseDate, resolvedDate: landmarkDate },
      latencyMs: Math.max(1, Date.now() - startTime),
      model: "offline-rule-engine",
    });
  }

  // Symptoms extraction from valid 14
  const detectedSymptoms: ValidSymptom[] = [];
  if (lower.includes("cramp") || lower.includes("വയറുവേദന") || lower.includes("दर्द")) detectedSymptoms.push("cramps");
  if (lower.includes("headache") || lower.includes("തലവേദന") || lower.includes("सिरदर्द")) detectedSymptoms.push("headache");
  if (lower.includes("back") || lower.includes("നടുവേദന") || lower.includes("कमर दर्द")) detectedSymptoms.push("backache");
  if (lower.includes("bloat") || lower.includes("വയറ് വീർത്തു") || lower.includes("पेट फूलना")) detectedSymptoms.push("bloating");
  if (lower.includes("breast") || lower.includes("സ്തന")) detectedSymptoms.push("breast_tenderness");
  if (lower.includes("acne") || lower.includes("breakout") || lower.includes("മുഖക്കുരു")) detectedSymptoms.push("acne");
  if (lower.includes("fatigue") || lower.includes("tired") || lower.includes("ക്ഷീണം") || lower.includes("थकान")) detectedSymptoms.push("fatigue");
  if (lower.includes("craving") || lower.includes("മധുരം കഴിക്കാൻ")) detectedSymptoms.push("cravings");
  if (lower.includes("nausea") || lower.includes("ഛർദ്ദി") || lower.includes("उल्टी")) detectedSymptoms.push("nausea");
  if (lower.includes("mood swing") || lower.includes("സങ്കടം")) detectedSymptoms.push("mood_swings");
  if (lower.includes("anxious") || lower.includes("anxiety") || lower.includes("ആശങ്ക")) detectedSymptoms.push("anxiety");
  if (lower.includes("sleep") || lower.includes("insomnia") || lower.includes("ഉറക്കമില്ലായ്മ")) detectedSymptoms.push("insomnia");
  if (lower.includes("dizz") || lower.includes("തലകറക്കം") || lower.includes("चक्कर")) detectedSymptoms.push("dizziness");
  if (lower.includes("appetite") || lower.includes("വിശപ്പ്")) detectedSymptoms.push("appetite_change");

  // Flow level extraction
  let flow: StructuredEntry["flow"] = null;
  if (lower.includes("heavy") || lower.includes("കൂടുതൽ") || lower.includes("ज्यादा")) flow = "heavy";
  else if (lower.includes("medium") || lower.includes("സാധാരണ") || lower.includes("मध्यम")) flow = "medium";
  else if (lower.includes("light") || lower.includes("കുറവ്") || lower.includes("कम")) flow = "light";
  else if (lower.includes("spotting") || lower.includes("ഡ്രോപ്പ്") || lower.includes("स्पॉटिंग")) flow = "spotting";
  else if (lower.includes("period started") || lower.includes("period") || lower.includes("തുടങ്ങി")) flow = "medium";

  // Mood extraction
  let mood: string | null = null;
  if (lower.includes("great") || lower.includes("നല്ല സന്തോഷം")) mood = "Great";
  else if (lower.includes("good") || lower.includes("നല്ലത്")) mood = "Good";
  else if (lower.includes("low") || lower.includes("സങ്കടം") || lower.includes("उदास")) mood = "Low";
  else if (lower.includes("irritable") || lower.includes("ദേഷ്യം")) mood = "Irritable";
  else if (lower.includes("calm") || lower.includes("ശാന്തം")) mood = "Calm";
  else if (lower.includes("okay") || lower.includes("കുഴപ്പമില്ല")) mood = "Okay";

  // Energy
  let energy: number | null = null;
  if (lower.includes("energy 1") || lower.includes("very tired")) energy = 1;
  else if (lower.includes("energy 2") || lower.includes("tired")) energy = 2;
  else if (lower.includes("energy 3") || lower.includes("moderate energy")) energy = 3;
  else if (lower.includes("energy 4") || lower.includes("good energy")) energy = 4;
  else if (lower.includes("energy 5") || lower.includes("full of energy")) energy = 5;

  const entryDate = landmarkDate || today;

  const entry: StructuredEntry = {
    date: entryDate,
    flow,
    symptoms: detectedSymptoms,
    mood,
    energy,
    sleep: null,
    notes: text,
    isApproximate,
    landmarkName,
  };

  toolCalls.push({
    id: "call_log_" + Date.now(),
    toolName: "log_entry",
    args: { date: entryDate, flow, symptoms: detectedSymptoms, mood, energy },
    result: { entry },
    latencyMs: Math.max(1, Date.now() - startTime),
    model: "offline-rule-engine",
  });

  const message = isApproximate
    ? `I found ${landmarkName} on ${landmarkDate}. Would you like to confirm this period entry?`
    : `I've prepared your log for ${entryDate}. Please review and confirm below.`;

  return {
    message,
    entry,
    needsClarification: isApproximate,
    clarificationQuestion: isApproximate ? `Did your period start before, on, or after ${landmarkName}?` : null,
    activityTrail,
    toolCalls,
    planOverlaps,
  };
}

/**
 * Predictor overlap evaluation logic (mirrors server/actions.ts getFeatures)
 */
function evaluateOverlaps(events: Array<{ name: string; date: string }>, context: AgentContext) {
  const avgCycle = context.cycleStats?.avgCycleLength || 28;
  const avgPeriod = context.cycleStats?.avgPeriodLength || 5;
  const lastStart = context.cycleStats?.lastPeriodStart;
  const periods = context.periods || [];

  return events.map((ev) => {
    let overlap: "period-day" | "likely" | "possible" | "unlikely" | "unknown" = "unknown";
    let overlapNote = "Log a past period first so predictions can be checked against this date.";

    const inActual = periods.some(
      (p) => ev.date >= p.startDate && (p.endDate ? ev.date <= p.endDate : ev.date === p.startDate),
    );

    if (inActual) {
      overlap = "period-day";
      overlapNote = "This date falls inside a period you have already logged.";
    } else if (lastStart) {
      overlap = "unlikely";
      overlapNote = "Based on your pattern, your period is not expected to overlap this date.";

      const lastDate = new Date(lastStart);
      for (let k = 1; k <= 12; k++) {
        const predStart = new Date(lastDate.getTime() + avgCycle * k * 86400000);
        const coreEnd = new Date(predStart.getTime() + (avgPeriod - 1) * 86400000);
        const winStart = new Date(predStart.getTime() - 3 * 86400000);
        const winEnd = new Date(coreEnd.getTime() + 3 * 86400000);

        const evDate = new Date(ev.date);
        if (evDate >= predStart && evDate <= coreEnd) {
          overlap = "likely";
          overlapNote = `Your period is predicted around ${predStart.toISOString().slice(0, 10)} to ${coreEnd.toISOString().slice(0, 10)}, so it will very likely overlap.`;
          break;
        }
        if (evDate >= winStart && evDate <= winEnd) {
          overlap = "possible";
          overlapNote = `This date falls in your wider prediction window (${winStart.toISOString().slice(0, 10)} to ${winEnd.toISOString().slice(0, 10)}). Overlap is possible.`;
          break;
        }
      }
    }

    return {
      name: ev.name,
      eventDate: ev.date,
      overlap,
      overlapNote,
    };
  });
}
