/**
 * Plan Around It insights (pure, read-only).
 *
 * Phase 1: window-trust grading. This module never changes how windows are
 * computed; it only describes how much cycle history sits behind a window
 * that the existing engine already produced.
 * Phase 2: nearby clearer dates, reusing the one overlap function.
 */

import { evaluateEventOverlap, addDays, type PeriodRecord } from "./periodEngine";


/** Spread thresholds in days: at or below high = "high", at or below medium = "medium", above = "low". Change trust grading here only. */
export const TRUST_SPREAD_THRESHOLDS = {
  highMaxSpreadDays: 4,
  mediumMaxSpreadDays: 8,
} as const;

/** Completed cycles required before a window can be graded at all. */
export const TRUST_MIN_COMPLETED_CYCLES = 3;

export type WindowTrustLevel = "not_enough" | "high" | "medium" | "low";

export interface WindowTrust {
  level: WindowTrustLevel;
  reason: string;
  completedCycles: number;
  spreadDays: number | null;
  shortestDays: number | null;
  longestDays: number | null;
}

type CycleLengthLike = number | { lengthDays?: number | null } | null | undefined;

function toLengths(history: ReadonlyArray<CycleLengthLike>): number[] {
  const lengths: number[] = [];
  for (const item of history) {
    const value = typeof item === "number" ? item : item?.lengthDays;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) lengths.push(value);
  }
  return lengths;
}

/**
 * Grade trust in an estimated window from completed cycle lengths
 * (longest minus shortest = spread). Fewer than
 * TRUST_MIN_COMPLETED_CYCLES completed cycles cannot be graded.
 */
export function gradeWindowTrust(history: ReadonlyArray<CycleLengthLike>): WindowTrust {
  const lengths = toLengths(history);
  if (lengths.length < TRUST_MIN_COMPLETED_CYCLES) {
    return {
      level: "not_enough",
      reason: "Not enough history yet. This is a rough window.",
      completedCycles: lengths.length,
      spreadDays: null,
      shortestDays: null,
      longestDays: null,
    };
  }
  const shortestDays = Math.min(...lengths);
  const longestDays = Math.max(...lengths);
  const spreadDays = longestDays - shortestDays;
  const range = `Your cycles ranged ${shortestDays}-${longestDays} days`;
  if (spreadDays <= TRUST_SPREAD_THRESHOLDS.highMaxSpreadDays) {
    return { level: "high", reason: `${range}, so this window is narrow.`, completedCycles: lengths.length, spreadDays, shortestDays, longestDays };
  }
  if (spreadDays <= TRUST_SPREAD_THRESHOLDS.mediumMaxSpreadDays) {
    return { level: "medium", reason: `${range}, so this window is moderately wide.`, completedCycles: lengths.length, spreadDays, shortestDays, longestDays };
  }
  return { level: "low", reason: `${range}, so this window is wide.`, completedCycles: lengths.length, spreadDays, shortestDays, longestDays };
}

const LEVEL_LABELS: Record<WindowTrustLevel, string> = {
  not_enough: "Not enough history yet",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** One short trust line (level + reason) for Plan Around It, Dashboard and Calendar. */
export function formatWindowTrustLine(trust: WindowTrust): string {
  if (trust.level === "not_enough") return trust.reason;
  return `Window trust: ${LEVEL_LABELS[trust.level]} - ${trust.reason}`;
}

/** How far either side of an event to look for clearer dates (days). */
export const CLEAR_DATE_SEARCH_DAYS = 10;
/** Maximum number of clearer dates returned. */
export const CLEAR_DATE_MAX_RESULTS = 3;

const CLEAR_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sat Nov 14" for a YYYY-MM-DD key, read as a plain calendar date (UTC fields only). */
export function formatClearDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${weekday} ${CLEAR_MONTHS[(m || 1) - 1]} ${d}`;
}

/**
 * Up to 3 nearest dates within +/-CLEAR_DATE_SEARCH_DAYS of the event that the
 * existing overlap function reads as "unlikely", never past dates and never
 * the event date itself. Selection is by nearest distance; the returned list
 * is chronological for display. Returns [] when trust is not_enough, so no
 * clearer-date line is shown on thin history.
 */
export function suggestClearDates(
  eventDate: string,
  records: PeriodRecord[],
  today: string,
  history: ReadonlyArray<CycleLengthLike>,
): string[] {
  if (gradeWindowTrust(history).level === "not_enough") return [];
  const found: Array<{ date: string; distance: number }> = [];
  for (let offset = -CLEAR_DATE_SEARCH_DAYS; offset <= CLEAR_DATE_SEARCH_DAYS; offset++) {
    if (offset === 0) continue;
    const date = addDays(eventDate, offset);
    if (date < today) continue;
    if (evaluateEventOverlap(date, records, today).status === "unlikely") {
      found.push({ date, distance: Math.abs(offset) });
    }
  }
  return found
    .sort((a, b) => a.distance - b.distance || a.date.localeCompare(b.date))
    .slice(0, CLEAR_DATE_MAX_RESULTS)
    .map((f) => f.date)
    .sort();
}

/** "Nearby dates that look clearer (estimate): Sat Nov 14, Sun Nov 15." or "" when none. */
export function formatClearDatesLine(dates: string[]): string {
  if (!dates.length) return "";
  return `Nearby dates that look clearer (estimate): ${dates.map(formatClearDate).join(", ")}.`;
}
