// Deterministic date arithmetic engine for Feather.
// Separates calendar landmark lookup from exact date arithmetic so that:
// 1. All day and weekday offsets are computed deterministically (zero hallucination).
// 2. Leap years, year boundaries, and relative landmark offsets (e.g. "last Diwali",
//    "the Monday before Women's Day", "two days before New Year's") are guaranteed exact.

import { MILESTONES_DATA } from "./milestonesData";
import type { MilestoneItem } from "./milestonesData";
import type { StructuredEntry, ValidSymptom } from "./agent";
import { VALID_SYMPTOMS } from "./agent";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function applyDayOffset(isoDate: string, offsetDays: number): string {
  if (!offsetDays) return isoDate;
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
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

  const baseDate = new Date(baseIsoDate + "T12:00:00Z");
  const baseDayIdx = baseDate.getUTCDay();

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
 * Handles "last Diwali", "Summer Solstice next year", explicit years, and relative offsets.
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
      const parts = (updated.date || new Date().toISOString().slice(0, 10)).split("-");
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
