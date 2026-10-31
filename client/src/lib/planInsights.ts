/**
 * Plan Around It insights (pure, read-only).
 *
 * Phase 1: window-trust grading. This module never changes how windows are
 * computed; it only describes how much cycle history sits behind a window
 * that the existing engine already produced.
 * Phase 2: nearby clearer dates, reusing the one overlap function.
 * Phase 3: where an event sits inside the estimated window, and the
 * period-days that most often carried the heaviest logged flow in past
 * completed periods. Both are read-only descriptions of existing data.
 */

import { evaluateEventOverlap, addDays, dayDifference, type PeriodRecord } from "./periodEngine";


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

// ---- Phase 3: day position + past heavier-days pattern ----

/** Estimated window as produced by evaluateEventOverlap (inclusive calendar dates). */
export interface EstimatedWindow {
  start: string;
  end: string;
}

export type DayPositionKind = "near_start" | "middle" | "near_end";

export interface DayPosition {
  position: DayPositionKind;
  /** e.g. "near the start of the estimated window". */
  phrase: string;
  /** 0 at window start, 1 at window end. */
  fraction: number;
}

const DAY_POSITION_PHRASES: Record<DayPositionKind, string> = {
  near_start: "near the start of the estimated window",
  middle: "in the middle of the estimated window",
  near_end: "near the end of the estimated window",
};

/**
 * Where an event date sits inside the estimated window. Definition: the
 * window is split into equal thirds by elapsed days - fraction below 1/3 is
 * "near the start", below 2/3 is "in the middle", otherwise "near the end".
 * Bounds are inclusive; an event outside the window (or no window) returns
 * null, so callers show no position line at all.
 */
export function dayPosition(eventDate: string, window: EstimatedWindow | null | undefined): DayPosition | null {
  if (!window || !window.start || !window.end) return null;
  if (eventDate < window.start || eventDate > window.end) return null;
  const span = dayDifference(window.start, window.end);
  const fraction = span <= 0 ? 0 : dayDifference(window.start, eventDate) / span;
  const position: DayPositionKind = fraction < 1 / 3 ? "near_start" : fraction < 2 / 3 ? "middle" : "near_end";
  return { position, phrase: DAY_POSITION_PHRASES[position], fraction };
}

const FLOW_RANK: Record<string, number> = { light: 1, medium: 2, heavy: 3 };

export interface FlowPattern {
  /** Period-days (1 = first logged day of a period) that most often carried the heaviest logged flow. */
  patternDays: number[];
  /** Completed periods with flow logged that fed the pattern. */
  periodsUsed: number;
  /** Past-tense sentence, e.g. "In your past logs, heavier flow showed up around days 1-2." */
  sentence: string;
}

type PeriodStartLike = { startDate?: string | null } | null | undefined;
type FlowLogLike = { logDate?: string | null; flow?: string | null } | null | undefined;

function formatPatternDays(days: number[]): string {
  if (days.length === 1) return `day ${days[0]}`;
  const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  if (contiguous) return `days ${days[0]}-${days[days.length - 1]}`;
  return `days ${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`;
}

/**
 * The period-days that most often carried each completed period's heaviest
 * logged flow. A period counts as completed once a later period start
 * exists; the latest period is never used. Returns null when fewer than 2
 * completed periods have a bleeding flow logged (spotting/none do not
 * count). The sentence describes past logs only; it says nothing about any
 * future period.
 */
export function flowPattern(
  periods: ReadonlyArray<PeriodStartLike>,
  logs: ReadonlyArray<FlowLogLike>,
): FlowPattern | null {
  const starts = [...new Set(periods.map((p) => p?.startDate).filter((d): d is string => typeof d === "string" && !!d))].sort();
  if (starts.length < 2) return null;
  const dayCounts = new Map<number, number>();
  let periodsUsed = 0;
  for (let i = 0; i < starts.length - 1; i++) {
    const start = starts[i];
    const nextStart = starts[i + 1];
    let heaviest = 0;
    const heavyDays = new Set<number>();
    for (const log of logs) {
      const date = log?.logDate;
      const rank = log?.flow ? FLOW_RANK[log.flow] || 0 : 0;
      if (!date || rank === 0 || date < start || date >= nextStart) continue;
      const day = dayDifference(start, date) + 1;
      if (rank > heaviest) {
        heaviest = rank;
        heavyDays.clear();
        heavyDays.add(day);
      } else if (rank === heaviest) {
        heavyDays.add(day);
      }
    }
    if (heaviest === 0) continue;
    periodsUsed++;
    for (const day of heavyDays) dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  }
  if (periodsUsed < 2 || dayCounts.size === 0) return null;
  const maxCount = Math.max(...dayCounts.values());
  const patternDays = [...dayCounts.entries()]
    .filter(([, count]) => count === maxCount)
    .map(([day]) => day)
    .sort((a, b) => a - b);
  return {
    patternDays,
    periodsUsed,
    sentence: `In your past logs, heavier flow showed up around ${formatPatternDays(patternDays)}.`,
  };
}

/**
 * One event line for Plan Around It. Near the start of the window with a
 * past heavier-days pattern, the two facts are combined; otherwise only the
 * position is stated. Empty string when the event is outside the window.
 * Neither form contains flow or symptom words (Discreet Mode wording).
 */
export function formatEventPositionLine(
  eventDate: string,
  window: EstimatedWindow | null | undefined,
  pattern: FlowPattern | null,
): string {
  const pos = dayPosition(eventDate, window);
  if (!pos) return "";
  if (pos.position === "near_start" && pattern) {
    return "This event is near the start of the estimated window, where your past logs show heavier days (estimate).";
  }
  return `This event is ${pos.phrase}.`;
}
