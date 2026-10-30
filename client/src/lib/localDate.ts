/**
 * Shared local-calendar date helpers for Feather.
 *
 * Dates are calendar dates in the USER'S LOCAL timezone, stored as YYYY-MM-DD.
 * Never derive "today" from a UTC ISO string: around midnight UTC and local
 * dates differ. Calendar arithmetic (add/diff) is done on the YYYY-MM-DD
 * parts via UTC-constructed dates, which is timezone-independent; only
 * converting an instant (Date) to a key, and asking for "today", is local.
 */

export type DateKey = string;

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export function isValidDateKey(key: unknown): key is DateKey {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  try {
    parseDateKey(key);
    return true;
  } catch {
    return false;
  }
}

/** Strictly parses YYYY-MM-DD, rejecting nonexistent dates (2026-02-31). */
export function parseDateKey(key: DateKey): { year: number; month: number; day: number } {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    throw new Error(`Invalid date format: ${key}`);
  }
  const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date: ${key}`);
  }
  return { year, month, day };
}

export function formatDateKey(year: number, month: number, day: number): DateKey {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Internal: UTC-constructed Date for a key. Only for calendar arithmetic. */
export function dateKeyToUTCDate(key: DateKey): Date {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Internal: key for a UTC-constructed Date. Do NOT use for local "today". */
export function utcDateToDateKey(date: Date): DateKey {
  return formatDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Converts an instant to the calendar date in the local timezone. */
export function toLocalKey(date: Date): DateKey {
  return formatDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Today as a local calendar date (YYYY-MM-DD). */
export function todayLocal(now: Date = new Date()): DateKey {
  return toLocalKey(now);
}

/** Adds calendar days to a key. Timezone- and DST-independent. */
export function addDaysToKey(key: DateKey, amount: number): DateKey {
  if (!Number.isInteger(amount)) throw new Error("Day offset must be an integer");
  const date = dateKeyToUTCDate(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return utcDateToDateKey(date);
}

/** Calendar days from `from` to `to` (positive when `to` is later). */
export function diffDateKeys(from: DateKey, to: DateKey): number {
  return Math.round((dateKeyToUTCDate(to).getTime() - dateKeyToUTCDate(from).getTime()) / 86_400_000);
}

/** Weekday of a calendar date: 0 = Sunday ... 6 = Saturday. */
export function weekdayOfKey(key: DateKey): number {
  return dateKeyToUTCDate(key).getUTCDay();
}

/**
 * Safely parses a month/day phrase WITHOUT new Date(string):
 * "Nov 3", "3 Nov", "November 3", "3rd November", "Nov 3rd".
 * Returns null when the phrase is not a recognisable month/day.
 */
export function parseMonthDay(text: string, year: number): DateKey | null {
  if (!Number.isInteger(year)) return null;
  const cleaned = text.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  const monthFirst = cleaned.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
  const dayFirst = cleaned.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)$/);
  let month: number | undefined;
  let day: number | undefined;
  if (monthFirst) {
    month = MONTH_NAMES[monthFirst[1]];
    day = Number(monthFirst[2]);
  } else if (dayFirst) {
    day = Number(dayFirst[1]);
    month = MONTH_NAMES[dayFirst[2]];
  } else {
    return null;
  }
  if (!month || !day) return null;
  const key = formatDateKey(year, month, day);
  return isValidDateKey(key) ? key : null;
}
