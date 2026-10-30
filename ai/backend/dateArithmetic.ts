// Deterministic date arithmetic engine for Feather.
// Separates calendar landmark lookup from exact date arithmetic so that:
// 1. All day and weekday offsets are computed deterministically (zero hallucination).
// 2. Leap years, year boundaries, and relative landmark offsets (e.g. "last Diwali",
//    "the Monday before Women's Day", "two days before New Year's") are guaranteed exact.

import { MILESTONES_DATA } from "./landmarks";
import type { MilestoneItem } from "./landmarks";
import type { StructuredEntry, ValidSymptom } from "./agent";
import { VALID_SYMPTOMS } from "./agent";
import { addDaysToKey, diffDateKeys, weekdayOfKey, todayLocal, parseMonthDay, isValidDateKey } from "../../client/src/lib/localDate";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function applyDayOffset(isoDate: string, offsetDays: number): string {
  if (!offsetDays) return isoDate;
  return addDaysToKey(isoDate, offsetDays);
}

/**
 * Calculates the date of a specific weekday strictly before or after a base date.
 * Example: Women's Day 2026 is 2026-03-08 (Sunday).
 * The Monday before is 2026-03-02 (6 days prior).
 */
export function findWeekdayOffset(
  baseIsoDate: string,
  targetWeekdayName: string,
  direction: "before" | "after",
): string {
  const targetDayIdx = WEEKDAYS.indexOf(targetWeekdayName.toLowerCase());
  if (targetDayIdx === -1) return baseIsoDate;

  const baseDayIdx = weekdayOfKey(baseIsoDate);

  let diffDays = 0;
  if (direction === "before") {
    diffDays = (baseDayIdx - targetDayIdx + 7) % 7;
    if (diffDays === 0) diffDays = 7; // strictly before
    return applyDayOffset(baseIsoDate, -diffDays);
  } else {
    diffDays = (targetDayIdx - baseDayIdx + 7) % 7;
    if (diffDays === 0) diffDays = 7; // strictly after
    return applyDayOffset(baseIsoDate, diffDays);
  }
}

export interface RelativeOffsetResult {
  days: number;
  weekday?: string;
  direction?: "before" | "after";
}

function matchesAlias(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const lowerNeedle = needle.toLowerCase().trim();
  // If Latin alphanumeric phrase, use word boundary to avoid substring collisions (e.g. "holi" in "holiday")
  if (/^[a-z0-9\s'-]+$/i.test(lowerNeedle)) {
    const escaped = lowerNeedle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
  }
  // For non-Latin (Malayalam, Hindi), match substring
  return haystack.includes(lowerNeedle);
}

/**
 * Parses relative offset phrases like:
 * - "2 days before" / "two days before" / "3 days after"
 * - "the day before" / "day after"
 * - "the Monday before" / "the Friday after"
 * - Malayalam: "രണ്ട് ദിവസം മുൻപ്" (2 days before), "ഒരു ദിവസം മുൻപ്" (1 day before), "ശേഷം" (after)
 * - Hindi: "दो दिन पहले" (2 days before), "एक दिन पहले" (1 day before), "के बाद" (after)
 */
export function parseRelativeExpression(text: string): RelativeOffsetResult {
  const lower = text.toLowerCase();

  // 1. Weekday offset: "the Monday before", "Friday after"
  const weekdayMatch = lower.match(
    /\b(?:the\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(before|prior to|ahead of|after|following)\b/i,
  );
  if (weekdayMatch) {
    const weekday = weekdayMatch[1].toLowerCase();
    const dirStr = weekdayMatch[2].toLowerCase();
    const direction = dirStr.includes("before") || dirStr.includes("prior") || dirStr.includes("ahead") ? "before" : "after";
    return { days: 0, weekday, direction };
  }

  // 2. Multilingual relative offsets (Malayalam & Hindi)
  // Malayalam "രണ്ട് ദിവസം മുൻപ്" (-2), "ഒരു ദിവസം മുൻപ്" (-1), "ശേഷം" (+1)
  if (lower.includes("രണ്ട് ദിവസം മുൻപ്") || lower.includes("2 ദിവസം മുൻപ്")) return { days: -2, direction: "before" };
  if (lower.includes("ഒരു ദിവസം മുൻപ്") || lower.includes("1 ദിവസം മുൻപ്")) return { days: -1, direction: "before" };
  if (lower.includes("മൂന്ന് ദിവസം മുൻപ്") || lower.includes("3 ദിവസം മുൻപ്")) return { days: -3, direction: "before" };
  if (lower.includes("ദിവസം മുൻപ്") || lower.includes("മുൻപ്") || lower.includes("munpe")) return { days: -1, direction: "before" };

  // Hindi "दो दिन पहले" (-2), "एक दिन पहले" (-1), "के बाद" (+1)
  if (lower.includes("दो दिन पहले") || lower.includes("2 दिन पहले")) return { days: -2, direction: "before" };
  if (lower.includes("एक दिन पहले") || lower.includes("1 दिन पहले") || lower.includes("से एक दिन पहले")) return { days: -1, direction: "before" };
  if (lower.includes("तीन दिन पहले") || lower.includes("3 दिन पहले")) return { days: -3, direction: "before" };
  if (lower.includes("पहले") || lower.includes("pehle")) return { days: -1, direction: "before" };

  // 3. Day count offset in English / Code-mixed: "2 days before", "three days after"
  const offsetRegex =
    /(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an|the)\s+)?days?\s+(before|prior to|ahead of|after|following)/i;
  const m = lower.match(offsetRegex);
  if (m) {
    const numStr = (m[1] || "1").toLowerCase();
    let count = 1;
    const wordMap: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      a: 1, an: 1, the: 1,
    };
    if (/^\d+$/.test(numStr)) {
      count = parseInt(numStr, 10);
    } else if (wordMap[numStr] !== undefined) {
      count = wordMap[numStr];
    }
    const dirStr = m[2].toLowerCase();
    const isBefore = dirStr.includes("before") || dirStr.includes("prior") || dirStr.includes("ahead");
    return { days: isBefore ? -count : count, direction: isBefore ? "before" : "after" };
  }

  // 4. Single day: "the day before" or "the day after" / "day before"
  const singleDayMatch = lower.match(/\b(?:the\s+)?day\s+(before|after)\b/i);
  if (singleDayMatch) {
    const isBefore = singleDayMatch[1].toLowerCase() === "before";
    return { days: isBefore ? -1 : 1, direction: isBefore ? "before" : "after" };
  }

  // Code-mixed "kazhinju" / "ke baad" / "baad"
  if (lower.includes("2 days after") || lower.includes("kazhinju 2 days") || lower.includes("kazhinjittu 3 days")) {
    if (lower.includes("3 days")) return { days: 3, direction: "after" };
    return { days: 2, direction: "after" };
  }

  return { days: 0 };
}

/**
 * Resolves calendar landmark fuzzy recall deterministically across 2025-2027.
 * Handles "last Diwali", "Christmas next year", explicit years, and relative offsets.
 */
export function resolveLandmarkExpression(
  text: string,
  today: string,
): {
  found: boolean;
  landmarkName: string | null;
  baseDate: string | null;
  resolvedDate: string | null;
  isApproximate: boolean;
} {
  const lower = text.toLowerCase();
  const currentYear = parseInt(today.slice(0, 4), 10);

  // Sort landmarks by longest match first to prevent prefix collisions (e.g. "Midsummer break" vs "Midsummer")
  const sortedMilestones = [...MILESTONES_DATA].sort((a, b) => {
    const maxA = Math.max(a.name.length, ...a.aliases.map((al) => al.length));
    const maxB = Math.max(b.name.length, ...b.aliases.map((al) => al.length));
    return maxB - maxA;
  });

  for (const fest of sortedMilestones) {
    const matchesLandmark =
      matchesAlias(lower, fest.name) ||
      fest.aliases.some((a) => matchesAlias(lower, a));

    if (matchesLandmark) {
      let baseDate: string | null = null;
      const explicitYearMatch = lower.match(/\b(202[5-7])\b/);

      if (explicitYearMatch && (fest.dates as any)[explicitYearMatch[1]]) {
        baseDate = (fest.dates as any)[explicitYearMatch[1]];
      } else if (lower.includes("next year")) {
        const nextYear = String(currentYear + 1);
        baseDate = (fest.dates as any)[nextYear] || (fest.dates as any)["2027"];
      } else if (lower.includes("last ") || lower.includes("past ") || lower.includes("കഴിഞ്ഞ") || lower.includes("पिछली")) {
        // "last Diwali", "last Christmas", "കഴിഞ്ഞ ദീപാവലിക്ക്", "पिछली दीवाली" -> most recent past occurrence <= today
        const pastDates = Object.values(fest.dates)
          .filter((d: any) => typeof d === "string" && d <= today)
          .sort() as string[];
        baseDate = pastDates.length > 0 ? pastDates[pastDates.length - 1] : null;
      } else if ((fest.dates as any)[String(currentYear)]) {
        // Default: use the landmark date for the active year (2026)
        baseDate = (fest.dates as any)[String(currentYear)];
      } else {
        const allDates = Object.values(fest.dates).sort() as string[];
        baseDate = allDates[0] || null;
      }

      if (!baseDate) continue;

      // Apply relative offset (days or weekday)
      const rel = parseRelativeExpression(lower);
      let finalDate = baseDate;

      if (rel.weekday && rel.direction) {
        finalDate = findWeekdayOffset(baseDate, rel.weekday, rel.direction);
      } else if (rel.days !== 0) {
        finalDate = applyDayOffset(baseDate, rel.days);
      }

      return {
        found: true,
        landmarkName: fest.name,
        baseDate,
        resolvedDate: finalDate,
        isApproximate: true,
      };
    }
  }

  return {
    found: false,
    landmarkName: null,
    baseDate: null,
    resolvedDate: null,
    isApproximate: false,
  };
}

/**
 * Updates an active pending Accession Slip using conversational corrections:
 * - "no, make it the 3rd" / "change date to the 5th"
 * - "add headache" / "add nausea and cramps" / "remove acne"
 * - "change flow to light" / "make flow heavy"
 * - "mood is calm" / "change mood to good"
 * - "energy 4"
 */
export function applySlipCorrections(
  current: StructuredEntry,
  correctionText: string,
): { updated: StructuredEntry; changes: string[] } {
  const updated: StructuredEntry = { ...current, symptoms: [...(current.symptoms || [])] };
  const lower = correctionText.toLowerCase();
  const changes: string[] = [];

  // 1. Date correction
  // "no, make it the 3rd", "make it 3rd", "change to the 12th", "actually 5th"
  const dayMatch = lower.match(
    /\b(?:no,?\s+)?(?:make\s+it\s+(?:the\s+)?|change\s+(?:the\s+)?date\s+to\s+(?:the\s+)?|actually\s+(?:it\s+was\s+)?(?:the\s+)?|set\s+date\s+to\s+(?:the\s+)?|on\s+the\s+)(\d{1,2})(?:st|nd|rd|th)?\b/i,
  );
  if (dayMatch) {
    const dayNum = parseInt(dayMatch[1], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      const parts = (updated.date || todayLocal()).split("-");
      const year = parts[0];
      const month = parts[1];
      const newDayStr = String(dayNum).padStart(2, "0");
      updated.date = `${year}-${month}-${newDayStr}`;
      changes.push(`Date updated to ${updated.date}`);
    }
  }

  // 2. Flow correction
  const flowMatch = lower.match(/\b(?:change\s+flow\s+to|flow\s+(?:to|is|was)|make\s+flow)\s+(none|spotting|light|medium|heavy)\b/i);
  if (flowMatch) {
    updated.flow = flowMatch[1].toLowerCase() as any;
    changes.push(`Flow updated to ${updated.flow}`);
  } else {
    // Direct flow words
    if (lower.includes("heavy flow") || lower.includes("flow heavy")) {
      updated.flow = "heavy";
      changes.push("Flow set to heavy");
    } else if (lower.includes("light flow") || lower.includes("flow light")) {
      updated.flow = "light";
      changes.push("Flow set to light");
    } else if (lower.includes("medium flow") || lower.includes("flow medium")) {
      updated.flow = "medium";
      changes.push("Flow set to medium");
    } else if (lower.includes("spotting")) {
      updated.flow = "spotting";
      changes.push("Flow set to spotting");
    }
  }

  // 3. Symptoms addition
  for (const sym of VALID_SYMPTOMS) {
    const symKey = sym.replace("_", " ");
    const addPattern = new RegExp(`\\b(?:add|include|also\\s+had|and)\\s+${symKey}\\b`, "i");
    if (addPattern.test(lower) || (lower.includes(symKey) && !lower.includes(`remove ${symKey}`) && !lower.includes(`no ${symKey}`))) {
      if (!updated.symptoms.includes(sym)) {
        updated.symptoms.push(sym);
        changes.push(`Added symptom: ${symKey}`);
      }
    }
  }

  // 4. Symptoms removal
  for (const sym of VALID_SYMPTOMS) {
    const symKey = sym.replace("_", " ");
    const removePattern = new RegExp(`\\b(?:remove|delete|no|without)\\s+${symKey}\\b`, "i");
    if (removePattern.test(lower)) {
      const idx = updated.symptoms.indexOf(sym);
      if (idx !== -1) {
        updated.symptoms.splice(idx, 1);
        changes.push(`Removed symptom: ${symKey}`);
      }
    }
  }

  // 5. Mood correction
  const moodWords = ["Great", "Good", "Okay", "Low", "Irritable", "Anxious", "Emotional", "Calm"];
  for (const m of moodWords) {
    if (lower.includes(m.toLowerCase())) {
      updated.mood = m;
      changes.push(`Mood updated to ${m}`);
      break;
    }
  }

  // 6. Energy correction
  const energyMatch = lower.match(/\benergy\s+(?:is|to|level)?\s*([1-5])\b/i);
  if (energyMatch) {
    updated.energy = parseInt(energyMatch[1], 10);
    changes.push(`Energy level set to ${updated.energy}`);
  }

  return { updated, changes };
}

export interface ResolvedDate {
  date: string | null;
  confidence: "high" | "medium" | "low" | "none";
  window?: { start: string; end: string };
  explanation: string;
  needsClarification?: boolean;
  clarificationQuestion?: string;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5, "छह": 6, "सात": 7,
  "ഒന്ന്": 1, "രണ്ട്": 2, "മൂന്ന്": 3, "നാല്": 4, "അഞ്ച്": 5, "ആറ്": 6,
  "ஒன்று": 1, "இரண்டு": 2, "மூன்று": 3, "நான்கு": 4, "ஐந்து": 5, "ஆறு": 6,
  "ಒಂದು": 1, "ಎರಡು": 2, "ಮೂರು": 3, "ನಾಲ್ಕು": 4, "ஐದು": 5, "ಆರು": 6,
};

function numberValue(token: string): number | null {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return NUMBER_WORDS[token.toLowerCase()] ?? null;
}

function explain(key: string): string {
  const d = new Date(key + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Rewritten date resolver on the local-date helper (Batch 2.3).
 * Log dates default to the PAST: most recent occurrence <= today.
 * Never resolves a future log date; asks instead.
 */
export function resolveDateExpression(text: string, today: string): ResolvedDate {
  const lower = ` ${text.toLowerCase()} `;
  const none: ResolvedDate = { date: null, confidence: "none", explanation: "" };

  // Landmark offsets & ranges need the landmark; handle "after X" with no number first.
  const landmarkRes = resolveLandmarkExpression(text, today);
  const hasAfterWithoutNumber = /\bafter\b/.test(lower) && !/\d|one|two|three|four|five|six|seven|day after|week after/.test(lower);

  // Explicit range: "from the 3rd to the 7th" (optionally with a month name)
  const rangeMatch = lower.match(/(?:from\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|-|–)\s*(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s*([a-z]+)?/);
  if (rangeMatch && /(from|to the|to \d)/.test(lower)) {
    const monthName = rangeMatch[3];
    const year = parseInt(today.slice(0, 4), 10);
    let start = monthName ? parseMonthDay(`${rangeMatch[1]} ${monthName}`, year) : null;
    let end = monthName ? parseMonthDay(`${rangeMatch[2]} ${monthName}`, year) : null;
    if (!start) {
      const base = `${today.slice(0, 7)}-${String(rangeMatch[1]).padStart(2, "0")}`;
      const baseEnd = `${today.slice(0, 7)}-${String(rangeMatch[2]).padStart(2, "0")}`;
      if (isValidDateKey(base) && isValidDateKey(baseEnd)) { start = base; end = baseEnd; }
    }
    if (start && end) {
      if (start > today) { start = addDaysToKey(start, -365); end = addDaysToKey(end!, -365); }
      return { date: start, confidence: "medium", window: { start, end }, explanation: `${explain(start)} to ${explain(end)}` };
    }
  }

  // Today-ish
  if (/\b(today|this morning|now|tonight)\b/.test(lower)) {
    return { date: today, confidence: "high", explanation: `today = ${explain(today)}` };
  }
  if (/\blast night\b/.test(lower)) {
    const d = addDaysToKey(today, -1);
    return { date: d, confidence: "medium", explanation: `last night = ${explain(d)}` };
  }
  if (/\bday before yesterday\b/.test(lower)) {
    const d = addDaysToKey(today, -2);
    return { date: d, confidence: "high", explanation: `day before yesterday = ${explain(d)}` };
  }
  if (/\byesterday\b/.test(lower)) {
    const d = addDaysToKey(today, -1);
    return { date: d, confidence: "high", explanation: `yesterday = ${explain(d)}` };
  }

  // N days/weeks ago, digits or number words (en/hi/ml/ta/kn)
  const agoMatch = lower.match(/([a-z\u0900-\u0D7F]+|\d+)\s*(days?|weeks?)\s+ago\b/) || lower.match(/(\d+)\s*(days?|weeks?)\s+ago\b/);
  if (agoMatch) {
    const n = numberValue(agoMatch[1]);
    if (n !== null) {
      const days = agoMatch[2].startsWith("week") ? n * 7 : n;
      const d = addDaysToKey(today, -days);
      return { date: d, confidence: "high", explanation: `${n} ${agoMatch[2]} ago = ${explain(d)}` };
    }
  }
  // Number-word ago without the word "ago" handled by patterns above; also "3 days back"
  const backMatch = lower.match(/(\d+)\s*(days?|weeks?)\s+back\b/);
  if (backMatch) {
    const n = parseInt(backMatch[1], 10);
    const d = addDaysToKey(today, backMatch[2].startsWith("week") ? -n * 7 : -n);
    return { date: d, confidence: "high", explanation: `${n} ${backMatch[2]} back = ${explain(d)}` };
  }

  // last / this <weekday>
  const weekdayMatch = lower.match(/\b(last|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    const target = WEEKDAYS.indexOf(weekdayMatch[2]);
    const todayIdx = weekdayOfKey(today);
    let diff = (todayIdx - target + 7) % 7;
    if (weekdayMatch[1] === "last" && diff === 0) diff = 7;
    const d = addDaysToKey(today, -diff);
    return { date: d, confidence: "high", explanation: `${weekdayMatch[1]} ${weekdayMatch[2]} = ${explain(d)}` };
  }

  // Numeric dates: D/M vs M/D
  const numericMatch = lower.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (numericMatch) {
    const a = parseInt(numericMatch[1], 10);
    const b = parseInt(numericMatch[2], 10);
    const yr = numericMatch[3] ? (numericMatch[3].length === 2 ? 2000 + parseInt(numericMatch[3], 10) : parseInt(numericMatch[3], 10)) : parseInt(today.slice(0, 4), 10);
    let day: number, month: number;
    if (a > 12 && b <= 12) { day = a; month = b; }
    else if (b > 12 && a <= 12) { month = a; day = b; }
    else {
      return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `Is ${numericMatch[1]}/${numericMatch[2]} day/month or month/day?` };
    }
    const key = `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!isValidDateKey(key)) return { ...none, needsClarification: true, clarificationQuestion: "That date does not exist. Which date did you mean?" };
    if (key > today) {
      return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `Did you mean last year's ${explain(key)}?` };
    }
    return { date: key, confidence: "high", explanation: `${numericMatch[0]} = ${explain(key)}` };
  }

  // "the Monday before/after X" is handled by landmark resolution below via weekday check
  // Month/day ordinals: "3rd November", "3 Nov", "Nov 3"
  const ordinalMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/) ||
    lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (ordinalMatch && !landmarkRes.found) {
    const year = parseInt(today.slice(0, 4), 10);
    let key = parseMonthDay(ordinalMatch[0].trim(), year);
    if (key) {
      const explicitYear = lower.match(/\b(20\d{2})\b/);
      if (explicitYear) {
        key = parseMonthDay(ordinalMatch[0].trim(), parseInt(explicitYear[1], 10));
        if (key && key > today) {
          return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `Did you mean last year's ${explain(key)}?` };
        }
      } else if (key > today) {
        key = parseMonthDay(ordinalMatch[0].trim(), year - 1);
      }
      if (key) return { date: key, confidence: "high", explanation: `${ordinalMatch[0].trim()} = ${explain(key)}` };
    }
  }

  // Landmarks (past occurrence by default for logs)
  if (landmarkRes.found && landmarkRes.landmarkName) {
    if (hasAfterWithoutNumber && /\bafter\b/.test(lower) && !/weekday/.test(lower) && !/days? after/.test(lower)) {
      // resolveLandmarkExpression already applies "day after" (=1); only bare "after X" asks
      if (/\bafter\s+[a-z]/.test(lower) && !/\d\s*days?\s+after|day after|week after/.test(lower)) {
        return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `How many days after ${landmarkRes.landmarkName}?` };
      }
    }
    // Choose most recent occurrence <= today for log dates, unless explicitly future/next
    let base = landmarkRes.baseDate;
    let resolved = landmarkRes.resolvedDate;
    // Recompute base as past occurrence when the chosen date is in the future and no explicit future intent
    if (resolved && resolved > today && !/next|upcoming|planning/.test(lower)) {
      // step back a year at a time using landmark dates table via resolve with "last"
      const lastRes = resolveLandmarkExpression(`last ${landmarkRes.landmarkName}`, today);
      if (lastRes.found && lastRes.resolvedDate) {
        // Preserve offsets relative to base: difference between resolved and its base
        const offset = base && resolved ? diffDateKeys(base, resolved) : 0;
        base = lastRes.baseDate;
        resolved = lastRes.resolvedDate ? addDaysToKey(lastRes.resolvedDate, offset - (lastRes.baseDate && lastRes.resolvedDate ? diffDateKeys(lastRes.baseDate, lastRes.resolvedDate) : 0)) : resolved;
        // Simpler: resolved = past base + original offset from base
        if (base && lastRes.baseDate) {
          const origOffset = landmarkRes.baseDate && landmarkRes.resolvedDate ? diffDateKeys(landmarkRes.baseDate, landmarkRes.resolvedDate) : 0;
          resolved = addDaysToKey(lastRes.baseDate, origOffset);
        }
      }
    }
    if (resolved && resolved > today && !/next|upcoming|planning/.test(lower)) {
      return { date: null, confidence: "none", explanation: "", needsClarification: true, clarificationQuestion: `Did you mean last year's ${landmarkRes.landmarkName}?` };
    }
    if (resolved) {
      const around = /\baround\b|\bnear\b/.test(lower);
      const weekOf = /\bweek of\b/.test(lower);
      const window = around ? { start: addDaysToKey(resolved, -3), end: addDaysToKey(resolved, 3) }
        : weekOf ? { start: resolved, end: addDaysToKey(resolved, 6) } : undefined;
      return {
        date: resolved,
        confidence: around || weekOf ? "medium" : "high",
        window,
        explanation: `${landmarkRes.landmarkName} = ${explain(resolved)}${window ? ` (window ${explain(window.start)} to ${explain(window.end)})` : ""}`,
      };
    }
  }

  return none;
}

