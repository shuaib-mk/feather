import { checkMedicalAdviceGuardrail, checkSevereSymptomEscalation } from "./guardrail";

export type Intent =
  | "period_start"
  | "period_end"
  | "daily_log"
  | "plan_event"
  | "correction"
  | "medical_question"
  | "own_data_question"
  | "own_events_question"
  | "other";
const OWN_EVENTS_TOPIC_SRC =
  "exam|wedding|trip|interview|party|flight|vacation|marathon|race|conference|presentation|dinner|event|appointment|birthday|anniversary|deadline|meeting|travel|holiday|shaadi|sangeet";
const OWN_EVENTS_MONTH_SRC =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const OWN_EVENTS_DATE_HINT_RE = new RegExp(
  "\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:" +
    OWN_EVENTS_MONTH_SRC +
    ")|(?:" +
    OWN_EVENTS_MONTH_SRC +
    ")\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:,?\\s+\\d{4})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b",
  "i",
);
// Log content belongs to the logging pipeline, not to calendar questions.
const OWN_EVENTS_LOG_CUE_RE =
  /\bperiod\s+(?:started|ended|began|came|stopped|finished)\b|\b(?:flow|cramps?|headaches?|nausea|fatigue|bloating|spotting|bleeding|back\s+pain|mood|tender|acne|cravings|insomnia)\b|\benergy\s*(?:is|level|:)?\s*[1-5]\b|\b(?:slept|sleep)\b/i;

const EVENT_WORDS = ["exam", "wedding", "trip", "interview", "party", "flight", "vacation", "marathon", "race", "conference", "presentation", "holiday", "flight", "travel", "plan", "planning"];
const LOG_WORDS = ["flow", "cramps", "cramp", "headache", "backache", "bloating", "fatigue", "tired", "mood", "energy", "slept", "sleep", "spotting", "bleeding", "period", "log", "dizzy", "dizziness", "nausea", "nauseous", "acne", "cravings", "insomnia", "anxious", "anxiety", "tender", "दर्द", "थकान", "सिरदर्द", "ತಲೆನೋವು", "தலைவலி", "തലവേദന"];

const OWN_DATA_PATTERNS = [
  /\bwhat(?:'s|\s+is)\s+my\s+(?:average|avg)\s+cycle\b/i,
  /\bmy\s+(?:average|avg)\s+cycle\b/i,
  /\bhow\s+long\s+are\s+my\s+periods\b/i, /\bhow\s+long\s+do\s+my\s+periods\s+last\b/i,
  /\bhow\s+long\s+are\s+my\s+cycles\b/i,
  /\bwhen\s+is\s+my\s+next\s+period\b/i, /\bmy\s+next\s+period\b/i,
  /\b(?:longest|shortest)\s+(?:cycle|period)\b/i,
  /\bhow\s+many\s+(?:cycles|periods)\s+have\s+i\s+logged\b/i,
  /\bwhen\s+did\s+my\s+last\s+period\s+start\b/i, /\bwhen\s+was\s+my\s+last\s+period\b/i, /\blast\s+period\s+start\b/i,
  /\bdid\s+i\s+log\s+anything\s+in\s+[a-z]+\b/i,
  /\bis\s+\d+\s*days?\s+normal\s+for\s+me\b/i,
  /\bis\s+my\s+cycle\s+regular\b/i, /\bshow\s+(?:me\s+)?my\s+(?:logged\s+)?cycles\b/i,
];
export function isOwnDataQuestion(text: string): boolean {
  const t = text.trim(); if (!t) return false;
  return OWN_DATA_PATTERNS.some((p) => p.test(t));
}

/** Deterministic intent classifier. Intent first: no loggable content -> no log slip. */
export function classifyIntent(text: string, hasPendingEntry: boolean = false): Intent {
  const lower = ` ${text.toLowerCase().trim()} `;
  if (checkMedicalAdviceGuardrail(text).isRefusal) return "medical_question";
  if (isOwnDataQuestion(text)) return "own_data_question";
  if (isOwnEventsQuestion(text)) return "own_events_question";
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
const OWN_EVENTS_CALENDAR_Q_RES = [
  /\bis\s+there\s+any\b/i,
  /\bare\s+there\s+any\b/i,
  /\bis\s+there\s+anything\b/i,
  /\bdo\s+i\s+have\b/i,
  /\bhave\s+i\s+got\b/i,
  /\bwhat(?:'s|\s+is)\s+(?:on\s+my\s+calendar|coming(?:\s+up)?)\b/i,
  /\bwhat\s+do\s+i\s+have\b/i,
  /\bwhat\s+is\s+on\s+my\s+calendar\b/i,
  /\bwhen\s+is\s+my\b/i,
  /\bwhen's\s+my\b/i,
  /\bhow\s+many\s+events\b/i,
  /\bcalendar\s+mein\s+kya\s+hai\b/i,
  /\bkab\s+hai\b/i,
];

const OWN_EVENTS_OVERLAP_WORD_RE = /\b(clash(?:es|ed|ing)?|overlap(?:s|ped|ping)?|coincid(?:e|es|ing)|during)\b/i;

/** Q4.1: overlap questions about a stored event ("will my period clash with
 * my exam", "does my wedding overlap my period"). No date: dated phrases
 * belong to the event-creation path. */
export function isOverlapQuestion(text: string): boolean {
  return (
    /\bperiod\b/i.test(text) &&
    OWN_EVENTS_OVERLAP_WORD_RE.test(text) &&
    new RegExp("\\b(" + OWN_EVENTS_TOPIC_SRC + ")s?\\b", "i").test(text)
  );
}

/** Q4.1: local calendar questions answered on this device (no server, no
 * consent needed). Creation phrases with a placeable date are NOT included:
 * they belong to the Plan Around It creation path. */
export function isOwnEventsQuestion(text: string): boolean {
  if (OWN_EVENTS_DATE_HINT_RE.test(text)) return false;
  if (OWN_EVENTS_LOG_CUE_RE.test(text)) return false;
  if (isOverlapQuestion(text)) return true;
  return OWN_EVENTS_CALENDAR_Q_RES.some((p) => p.test(text));
}
