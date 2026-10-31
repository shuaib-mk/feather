import { checkMedicalAdviceGuardrail, checkSevereSymptomEscalation } from "./guardrail";

export type Intent =
  | "period_start"
  | "period_end"
  | "daily_log"
  | "plan_event"
  | "correction"
  | "medical_question"
  | "other";

const EVENT_WORDS = ["exam", "wedding", "trip", "interview", "party", "flight", "vacation", "marathon", "race", "conference", "presentation", "holiday", "flight", "travel", "plan", "planning"];
const LOG_WORDS = ["flow", "cramps", "cramp", "headache", "backache", "bloating", "fatigue", "tired", "mood", "energy", "slept", "sleep", "spotting", "bleeding", "period", "log", "dizzy", "dizziness", "nausea", "nauseous", "acne", "cravings", "insomnia", "anxious", "anxiety", "tender", "दर्द", "थकान", "सिरदर्द", "ತಲೆನೋವು", "தலைவலி", "തലവേദന"];

/** Deterministic intent classifier. Intent first: no loggable content -> no log slip. */
export function classifyIntent(text: string, hasPendingEntry: boolean = false): Intent {
  const lower = ` ${text.toLowerCase().trim()} `;
  if (checkMedicalAdviceGuardrail(text).isRefusal) return "medical_question";
  if (hasPendingEntry && /\b(change|make it|actually|remove|add|instead|no,|correction|update)\b/.test(lower)) return "correction";
  if (/\bperiod\s+(is\s+)?late\b|\blate\s+period\b|\bmissed\s+(my\s+)?period\b/.test(lower) && !/started|flow|log/.test(lower)) return "other";
  const hasEvent = EVENT_WORDS.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
  const hasLog = LOG_WORDS.some((w) => lower.includes(w)) || /\benergy\s*[1-5]\b/.test(lower) || checkSevereSymptomEscalation(text).isSevere;
  if (hasEvent && !hasLog) return "plan_event";
  if (/\bperiod\s+(ended|stopped|finished)\b|\bflow\s+stopped\b/.test(lower)) return "period_end";
  if (/\bperiod\s+(started|began|came)\b|\bstarted\s+my\s+period\b|\bgot\s+my\s+period\b/.test(lower)) return "period_start";
  if (hasLog) return "daily_log";
  if (hasEvent) return "plan_event";
  return "other";
}
