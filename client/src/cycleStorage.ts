// Local-only cycle storage and minimal estimation calculation for Feather.
// Preserves user-confirmed entries with 100% offline persistence.
// Zero server-side database and zero third-party analytics.

import {
  getCycleStatistics,
  getPrediction,
  getDailyStatus,
  toDate,
  addDays as engineAddDays,
  dayDifference,
  validateRecords,
  isBleedingFlow,
  lastBleedingDayForPeriod,
  type EntryKind,
  type PeriodRecord,
  type Prediction,
  type CycleStatistics,
} from "./lib/periodEngine";
import { todayLocal, toLocalKey } from "./lib/localDate";

export interface Period {
  id: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null;
  startEarliest?: string | null;
  startLatest?: string | null;
  landmarkName?: string | null;
  isApproximate?: boolean;
}

export interface DayLog {
  id: number;
  kind?: EntryKind;
  logDate: string; // YYYY-MM-DD
  flow: "none" | "spotting" | "light" | "medium" | "heavy" | null;
  symptoms: string[];
  mood: string | null;
  energy: number | null; // 1..5
  sleepHours: number | null;
  notes: string | null;
}

export interface CycleStats {
  hasData: boolean;
  avgCycleLength: number; // Defaults to 28 if < 2 recorded periods
  avgPeriodLength: number; // Defaults to 5 if < 1 recorded flow length
  isDefaultCycle: boolean;
  isDefaultPeriod: boolean;
  /** True when any headline number (28-day cycle / 5-day bleeding) is a default, not learned. */
  isDefault: boolean;
  lastPeriodStart?: string | null;
  currentPeriod?: Period | null;
  nextPeriodDate?: string | null;
  cycleDay?: number | null;

  // Domain Engine Ground Truth Fields
  prediction?: Prediction;
  statistics?: CycleStatistics;
  medianCycleLength?: number | null;
  earliestNextDate?: string | null;
  latestNextDate?: string | null;
  confidence?: Prediction["confidence"];
  predictionStatus?: Prediction["status"];
  predictionReason?: string;
}

export const OVERLAP_DISCLAIMER =
  "Estimates based on your logged cycles. Cycles vary, so this is not a guarantee and not contraception or medical advice.";

const STORAGE_KEY = "feather_cycle_vault_v1";
export const DEMO_STORAGE_KEY = "feather_demo_v1";
export function activeVaultKey(): string { try { const ls = (globalThis as any).localStorage; if (ls && ls.getItem("feather_demo_active")==="1") return DEMO_STORAGE_KEY; } catch {} return STORAGE_KEY; }
const LAST_EXPORT_KEY = "feather_last_export_ts";
const ENTRIES_SINCE_EXPORT_KEY = "feather_entries_since_export";

const inMemoryVault = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage.getItem(key);
    }
  } catch {
    // fallback
  }
  return inMemoryVault.get(key) ?? null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
      (globalThis as any).localStorage.setItem(key, value);
      return;
    }
  } catch {
    // ignore quota or private browsing restriction
  }
  inMemoryVault.set(key, value);
}


/**
 * Parses calendar date string in YYYY-MM-DD format using strict UTC roundtrip.
 */
export function parseDate(s: string): Date {
  return toDate(s);
}

export function fmtDate(d: Date): string {
  return toLocalKey(d);
}

/**
 * Adds an integer number of calendar days, completely immune to DST and timezone drift.
 */
export function addDays(s: string, n: number): string {
  return engineAddDays(s, n);
}

/**
 * Computes calendar day difference (b - a).
 */
export function diffDays(a: string, b: string): number {
  return dayDifference(a, b);
}

export function todayStr(): string {
  return todayLocal();
}

export function prettyDate(s: string): string {
  if (!s) return "—";
  return parseDate(s).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}


// Initial sample seed to demonstrate landmark recall immediately on first launch
const INITIAL_DATA: { periods: Period[]; logs: DayLog[] } = {
  periods: [
    {
      id: 1,
      startDate: addDays(todayStr(), -26),
      endDate: addDays(todayStr(), -21),
      isApproximate: false,
    },
    {
      id: 2,
      startDate: addDays(todayStr(), -54),
      endDate: addDays(todayStr(), -49),
      landmarkName: "International Women's Day",
      isApproximate: true,
    },
  ],
  logs: [
    {
      id: 1,
      logDate: addDays(todayStr(), -26),
      flow: "heavy",
      symptoms: ["cramps", "fatigue"],
      mood: "Low",
      energy: 2,
      sleepHours: 7,
      notes: "First day, heavy flow",
    },
    {
      id: 2,
      logDate: addDays(todayStr(), -25),
      flow: "medium",
      symptoms: ["cramps", "bloating"],
      mood: "Okay",
      energy: 3,
      sleepHours: 8,
      notes: "Cramps eased after warm compress",
    },
  ],
};

export function loadCycleData(): { periods: Period[]; logs: DayLog[] } {
  try {
    const raw = safeGetItem(activeVaultKey());
    if (!raw) {
      return { periods: [], logs: [] };
    }
    return JSON.parse(raw);
  } catch {
    return { periods: [], logs: [] };
  }
}

export function saveCycleData(data: { periods: Period[]; logs: DayLog[] }): void {
  try {
    const key = activeVaultKey();
    if (key === DEMO_STORAGE_KEY) { let prev:any={}; try { prev = JSON.parse(safeGetItem(key) || "{}"); } catch {} safeSetItem(key, JSON.stringify({ ...prev, periods: data.periods, logs: data.logs, events: prev.events || [] })); }
    else safeSetItem(key, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save cycle data:", err);
  }
}

export const MAX_PERIOD_DAYS = 10;
export const APPROXIMATE_DEFAULT_RADIUS_DAYS = 3;

/** Real approximate window: supplied range wins, otherwise +/- radius (default 3 for "around"). */
export function approximateWindow(
  startDate: string,
  startEarliest?: string | null,
  startLatest?: string | null,
  radiusDays: number = APPROXIMATE_DEFAULT_RADIUS_DAYS,
): { startEarliest: string; startLatest: string } {
  if (startEarliest && startLatest && startEarliest < startLatest) {
    return { startEarliest, startLatest };
  }
  return {
    startEarliest: engineAddDays(startDate, -radiusDays),
    startLatest: engineAddDays(startDate, radiusDays),
  };
}

function sortedPeriodsAsc(periods: Period[]): Period[] {
  return [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function lastBleedingDay(period: Period, logs: DayLog[], periodsAsc: Period[]): string {
  const idx = periodsAsc.findIndex((x) => x.id === period.id);
  const nextStart = idx >= 0 ? periodsAsc[idx + 1]?.startDate : undefined;
  let last = period.endDate || period.startDate;
  for (const log of logs) {
    if (!isBleedingFlow(log.flow) && log.kind !== "period_started") continue;
    if (log.logDate < period.startDate) continue;
    if (nextStart && log.logDate >= nextStart) continue;
    if (log.logDate > last) last = log.logDate;
  }
  return last;
}

export function addOrUpdatePeriod(period: Omit<Period, "id"> & { id?: number }): Period {
  toDate(period.startDate);
  if (period.endDate) {
    toDate(period.endDate);
    if (period.endDate < period.startDate) {
      throw new Error(`End date precedes start date: ${period.startDate} to ${period.endDate}`);
    }
  }

  const data = loadCycleData();
  const id = period.id || Date.now();
  const isApproximate = Boolean(period.isApproximate || period.landmarkName || period.startEarliest);
  const window = isApproximate
    ? approximateWindow(period.startDate, period.startEarliest, period.startLatest)
    : { startEarliest: period.startEarliest ?? null, startLatest: period.startLatest ?? null };
  const newPeriod: Period = {
    ...period,
    id,
    isApproximate,
    startEarliest: window.startEarliest,
    startLatest: window.startLatest,
  };

  const existingIdx = data.periods.findIndex((p) => p.id === id || p.startDate === period.startDate);
  const candidatePeriods = [...data.periods];
  if (existingIdx >= 0) {
    candidatePeriods[existingIdx] = newPeriod;
  } else {
    candidatePeriods.push(newPeriod);
  }

  // Pre-commit validation against domain rules (rejects duplicate start dates, overlaps, invalid dates)
  validateRecords(toPeriodRecords(candidatePeriods));

  candidatePeriods.sort((a, b) => b.startDate.localeCompare(a.startDate));
  data.periods = candidatePeriods;
  saveCycleData(data);
  incrementEntriesSinceExport();
  return newPeriod;
}

export interface SaveLogEntryOptions {
  kind?: EntryKind;
  /** Set only after the user confirms a period longer than MAX_PERIOD_DAYS in the confirm slip. */
  confirmLongPeriod?: boolean;
  landmarkName?: string | null;
  startEarliest?: string | null;
  startLatest?: string | null;
}

export interface SaveLogEntryResult {
  log: DayLog;
  period: Period | null;
  needsConfirmation: boolean;
  confirmationReason?: string;
  saved: boolean;
}

/**
 * Saves a daily log and its period atomically (both or neither) in one write.
 * Bleeding (light/medium/heavy) merges into a period within a 2-day gap;
 * spotting is logged but never starts or extends a period.
 */
export function saveLogEntry(
  logInput: Omit<DayLog, "id"> & { id?: number },
  options: SaveLogEntryOptions = {},
): SaveLogEntryResult {
  const kind: EntryKind = options.kind || logInput.kind || "daily_log";
  toDate(logInput.logDate);
  const data = loadCycleData();
  const periodsAsc = sortedPeriodsAsc(data.periods);
  const logId = logInput.id || Date.now();
  const newLog: DayLog = { ...logInput, id: logId, kind };

  const candidateLogs = [...data.logs];
  const existingLogIdx = candidateLogs.findIndex((l) => l.logDate === logInput.logDate);
  if (existingLogIdx >= 0) candidateLogs[existingLogIdx] = newLog;
  else candidateLogs.push(newLog);

  let candidatePeriods = [...data.periods];
  let affected: Period | null = null;

  const finish = (needsConfirmation = false, confirmationReason?: string): SaveLogEntryResult => {
    if (needsConfirmation) {
      // Nothing is written: the confirm slip must ask before saving either part.
      return { log: newLog, period: affected, needsConfirmation: true, confirmationReason, saved: false };
    }
    validateRecords(toPeriodRecords(candidatePeriods));
    candidateLogs.sort((a, b) => b.logDate.localeCompare(a.logDate));
    candidatePeriods.sort((a, b) => b.startDate.localeCompare(a.startDate));
    saveCycleData({ periods: candidatePeriods, logs: candidateLogs });
    return { log: newLog, period: affected, needsConfirmation: false, saved: true };
  };

  if (kind === "period_ended") {
    const target = [...periodsAsc].reverse().find((per) => per.startDate <= logInput.logDate);
    if (!target) throw new Error("No period to end: log a period start first.");
    if (logInput.logDate < target.startDate) {
      throw new Error(`Period end ${logInput.logDate} precedes start ${target.startDate}`);
    }
    affected = { ...target, endDate: logInput.logDate };
    candidatePeriods = candidatePeriods.map((per) => (per.id === target.id ? affected! : per));
    return finish();
  }

  const wantsPeriod = logInput.flow !== "spotting" && (kind === "period_started" || isBleedingFlow(logInput.flow));
  if (wantsPeriod) {
    const date = logInput.logDate;
    // Inside an existing period or its observed bleeding span?
    for (const per of periodsAsc) {
      const last = lastBleedingDay(per, data.logs, periodsAsc);
      if (date >= per.startDate && date <= last) {
        affected = per;
        return finish();
      }
    }
    // Within 2 days after the last bleeding day -> extend.
    for (const per of periodsAsc) {
      const last = lastBleedingDay(per, data.logs, periodsAsc);
      const gap = dayDifference(last, date);
      if (gap >= 1 && gap <= 2) {
        const newEnd = date;
        if (dayDifference(per.startDate, newEnd) + 1 > MAX_PERIOD_DAYS && !options.confirmLongPeriod) {
          affected = per;
          return finish(true, `This would make a ${dayDifference(per.startDate, newEnd) + 1}-day period (over ${MAX_PERIOD_DAYS} days). Save it anyway?`);
        }
        affected = { ...per, endDate: newEnd };
        candidatePeriods = candidatePeriods.map((x) => (x.id === per.id ? affected! : x));
        return finish();
      }
    }
    // Within 2 days before a period start -> move the start earlier.
    for (const per of periodsAsc) {
      const gap = dayDifference(date, per.startDate);
      if (gap >= 1 && gap <= 2) {
        const end = per.endDate || lastBleedingDay(per, data.logs, periodsAsc);
        if (dayDifference(date, end) + 1 > MAX_PERIOD_DAYS && !options.confirmLongPeriod) {
          affected = per;
          return finish(true, `This would make a ${dayDifference(date, end) + 1}-day period (over ${MAX_PERIOD_DAYS} days). Save it anyway?`);
        }
        affected = { ...per, startDate: date, endDate: per.endDate || date };
        candidatePeriods = candidatePeriods.map((x) => (x.id === per.id ? affected! : x));
        return finish();
      }
    }
    // No period within the 2-day gap -> create a new period.
    const isApproximate = Boolean(options.landmarkName || options.startEarliest || options.startLatest);
    const window = isApproximate
      ? approximateWindow(date, options.startEarliest, options.startLatest)
      : { startEarliest: null as string | null, startLatest: null as string | null };
    const newPeriodId = Math.max(Date.now(), ...candidatePeriods.map((x) => x.id), logId) + 1;
    affected = {
      id: newPeriodId,
      startDate: date,
      endDate: date,
      startEarliest: window.startEarliest,
      startLatest: window.startLatest,
      landmarkName: options.landmarkName ?? null,
      isApproximate,
    };
    candidatePeriods.push(affected);
    return finish();
  }

  // Spotting / non-bleeding daily logs never start or extend a period.
  return finish();
}

export function addOrUpdateLog(log: Omit<DayLog, "id"> & { id?: number }): DayLog {
  const result = saveLogEntry(log);
  if (result.needsConfirmation) {
    throw new Error(result.confirmationReason || "This log needs confirmation before saving.");
  }
  return result.log;
}

export function deleteDayLog(logDate: string): void {
  const data = loadCycleData();
  data.logs = data.logs.filter((l) => l.logDate !== logDate);
  saveCycleData(data);
}

export function deletePeriodEntry(id: number): void {
  const data = loadCycleData();
  data.periods = data.periods.filter((p) => p.id !== id);
  saveCycleData(data);
}

/**
 * Converts stored Period array into domain engine PeriodRecord array.
 */
function toPeriodRecords(periods: Period[]): PeriodRecord[] {
  return (periods || []).map((p) => ({
    id: String(p.id),
    startDate: p.startDate,
    endDate: p.endDate || undefined,
    confirmed: true,
    source: "manual",
    landmarkName: p.landmarkName || null,
    startEarliest: p.startEarliest || null,
    startLatest: p.startLatest || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Robust menstrual cycle domain calculation powered by Feather Period Engine.
 * Calculates median cycle length, Median Absolute Deviation (MAD) uncertainty windows,
 * and tracks clinical quality metrics without inventing missing data.
 */
export function computeCycleStats(periods: Period[], logs: DayLog[] = []): CycleStats {
  const today = todayStr();

  if (!periods || periods.length === 0) {
    const emptyPred = getPrediction([], today);
    return {
      hasData: false,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      isDefaultCycle: true,
      isDefaultPeriod: true,
      isDefault: true,
      prediction: emptyPred,
      predictionStatus: emptyPred.status,
      confidence: emptyPred.confidence,
      predictionReason: emptyPred.reason,
    };
  }

  const records = toPeriodRecords(periods);
  const observations = (logs || []).map((l) => ({
    date: l.logDate,
    bleeding: isBleedingFlow(l.flow) || l.kind === "period_started",
    flow: l.flow || undefined,
    symptoms: l.symptoms,
    mood: l.mood,
    energy: l.energy,
    sleepHours: l.sleepHours,
    notes: l.notes || undefined,
  }));
  const stats = getCycleStatistics(records, undefined, observations as any, today);
  const prediction = getPrediction(records, today);
  const daily = getDailyStatus(records, observations as any, today);

  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const latest = sorted[sorted.length - 1];

  // An open period never stays "open forever": with no bleeding log for 3+
  // days it counts as ended at its last bleeding day (read-time only).
  let currentPeriod: Period | null = null;
  if (latest && latest.startDate <= today) {
    if (latest.endDate) {
      if (today <= latest.endDate) currentPeriod = latest;
    } else {
      const lastBleed = lastBleedingDay(latest, logs || [], sortedPeriodsAsc(periods));
      if (dayDifference(lastBleed, today) < 3) currentPeriod = latest;
    }
  }

  const avgCycle = stats.medianCycleLength || stats.averageCycleLength || 28;
  const avgPeriod = stats.averageBleedingDuration || 5;

  return {
    hasData: true,
    avgCycleLength: avgCycle,
    avgPeriodLength: avgPeriod,
    isDefaultCycle: stats.completedCycleCount === 0,
    isDefaultPeriod: stats.averageBleedingDuration === null,
    isDefault: stats.completedCycleCount === 0 || stats.averageBleedingDuration === null,
    lastPeriodStart: latest?.startDate || null,
    currentPeriod,
    nextPeriodDate: prediction.expectedStart,
    cycleDay: daily.cycleDay,
    prediction,
    statistics: stats,
    medianCycleLength: stats.medianCycleLength,
    earliestNextDate: prediction.earliestStart,
    latestNextDate: prediction.latestStart,
    confidence: prediction.confidence,
    predictionStatus: prediction.status,
    predictionReason: prediction.reason,
  };
}

// ========================================================
// BACKUP, EXPORT & LOCAL VAULT MANAGEMENT
// ========================================================

export function getLastExportTimestamp(): number | null {
  const ts = safeGetItem(LAST_EXPORT_KEY);
  return ts ? parseInt(ts, 10) : null;
}

export function recordExportTimestamp(): void {
  safeSetItem(LAST_EXPORT_KEY, String(Date.now()));
  resetEntriesSinceExport();
}

export function getEntriesSinceExport(): number {
  const val = safeGetItem(ENTRIES_SINCE_EXPORT_KEY);
  return val ? parseInt(val, 10) : 0;
}

export function incrementEntriesSinceExport(): number {
  const current = getEntriesSinceExport() + 1;
  safeSetItem(ENTRIES_SINCE_EXPORT_KEY, String(current));
  return current;
}

export function resetEntriesSinceExport(): void {
  safeSetItem(ENTRIES_SINCE_EXPORT_KEY, "0");
}

export function isExportOverdue(days: number = 14): boolean {
  const lastTs = getLastExportTimestamp();
  if (!lastTs) return true;
  const elapsedDays = (Date.now() - lastTs) / (1000 * 60 * 60 * 24);
  return elapsedDays >= days;
}

export function exportCycleDataJSON(): string {
  const data = loadCycleData();
  recordExportTimestamp();
  return JSON.stringify(
    {
      app: "Feather",
      version: "2.0.0",
      exportedAt: new Date().toISOString(),
      periods: data.periods,
      logs: data.logs,
      events: (() => { try { return JSON.parse(localStorage.getItem("feather_events_v1") || "[]"); } catch { return []; } })(),
    },
    null,
    2,
  );
}

export function importCycleDataJSON(jsonStr: string): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonStr);
    const rawPeriods = Array.isArray(parsed.periods) ? parsed.periods : [];
    const rawLogs = Array.isArray(parsed.logs) ? parsed.logs : [];

    if (rawPeriods.length === 0 && rawLogs.length === 0) {
      return { success: false, count: 0, error: "No valid periods or logs found in file." };
    }

    const validPeriods: Period[] = [];
    for (const p of rawPeriods) {
      if (!p || typeof p.startDate !== "string") continue;
      try {
        toDate(p.startDate);
        if (p.endDate) {
          toDate(p.endDate);
          if (p.endDate < p.startDate) continue;
        }
        validPeriods.push({
          id: typeof p.id === "number" ? p.id : Date.now() + Math.floor(Math.random() * 100000),
          startDate: p.startDate,
          endDate: p.endDate || null,
          landmarkName: p.landmarkName || null,
          isApproximate: Boolean(p.isApproximate),
        });
      } catch {
        // Skip malformed entries
      }
    }

    // Validate period relationships (e.g. overlaps, duplicate starts)
    validateRecords(toPeriodRecords(validPeriods));

    const validLogs: DayLog[] = [];
    for (const l of rawLogs) {
      if (!l || typeof l.logDate !== "string") continue;
      try {
        toDate(l.logDate);
        validLogs.push({
          id: typeof l.id === "number" ? l.id : Date.now() + Math.floor(Math.random() * 100000),
          logDate: l.logDate,
          flow: l.flow || null,
          symptoms: Array.isArray(l.symptoms) ? l.symptoms : [],
          mood: l.mood || null,
          energy: typeof l.energy === "number" ? l.energy : null,
          sleepHours: typeof l.sleepHours === "number" ? l.sleepHours : null,
          notes: l.notes || null,
        });
      } catch {
        // Skip malformed log
      }
    }

    try { if (Array.isArray((parsed as any).events)) localStorage.setItem("feather_events_v1", JSON.stringify((parsed as any).events)); } catch {}
    saveCycleData({ periods: validPeriods, logs: validLogs });
    recordExportTimestamp();
    return { success: true, count: validPeriods.length + validLogs.length };
  } catch (e: any) {
    return { success: false, count: 0, error: e.message || "Invalid JSON backup file." };
  }
}

