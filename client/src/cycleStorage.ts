// Local-only cycle storage and minimal estimation calculation for Feather.
// Preserves user-confirmed entries with 100% offline persistence.
// Zero server-side database and zero third-party analytics.

import {
  getCycleStatistics,
  getPrediction,
  getDailyStatus,
  type PeriodRecord,
  type Prediction,
  type CycleStatistics,
} from "./lib/periodEngine";

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
const LAST_EXPORT_KEY = "feather_last_export_ts";
const ENTRIES_SINCE_EXPORT_KEY = "feather_entries_since_export";

function safeGetItem(key: string): string | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore quota or private browsing restriction
  }
}

const DAY_MS = 86400000;

export function parseDate(s: string): Date {
  const [y = 1970, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setTime(d.getTime() + n * DAY_MS);
  return fmtDate(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY_MS);
}

export function todayStr(): string {
  return fmtDate(new Date());
}

export function prettyDate(s: string): string {
  if (!s) return "—";
  return parseDate(s).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
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
    const raw = safeGetItem(STORAGE_KEY);
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
    safeSetItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save cycle data:", err);
  }
}

export function addOrUpdatePeriod(period: Omit<Period, "id"> & { id?: number }): Period {
  const data = loadCycleData();
  const id = period.id || Date.now();
  const newPeriod: Period = {
    ...period,
    id,
    isApproximate: !!period.landmarkName || !!period.startEarliest,
  };

  const existingIdx = data.periods.findIndex((p) => p.id === id || p.startDate === period.startDate);
  if (existingIdx >= 0) {
    data.periods[existingIdx] = newPeriod;
  } else {
    data.periods.push(newPeriod);
  }

  data.periods.sort((a, b) => b.startDate.localeCompare(a.startDate));
  saveCycleData(data);
  incrementEntriesSinceExport();
  return newPeriod;
}

export function addOrUpdateLog(log: Omit<DayLog, "id"> & { id?: number }): DayLog {
  const data = loadCycleData();
  const id = log.id || Date.now();
  const newLog: DayLog = { ...log, id };

  const existingIdx = data.logs.findIndex((l) => l.logDate === log.logDate);
  if (existingIdx >= 0) {
    data.logs[existingIdx] = newLog;
  } else {
    data.logs.push(newLog);
  }

  data.logs.sort((a, b) => b.logDate.localeCompare(a.logDate));
  saveCycleData(data);
  return newLog;
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Robust menstrual cycle domain calculation powered by Feather Period Engine.
 * Calculates median cycle length, Median Absolute Deviation (MAD) uncertainty windows,
 * and tracks clinical quality metrics without inventing missing data.
 */
export function computeCycleStats(periods: Period[]): CycleStats {
  const today = todayStr();

  if (!periods || periods.length === 0) {
    const emptyPred = getPrediction([], today);
    return {
      hasData: false,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      isDefaultCycle: true,
      isDefaultPeriod: true,
      prediction: emptyPred,
      predictionStatus: emptyPred.status,
      confidence: emptyPred.confidence,
      predictionReason: emptyPred.reason,
    };
  }

  const records = toPeriodRecords(periods);
  const stats = getCycleStatistics(records);
  const prediction = getPrediction(records, today);
  const daily = getDailyStatus(records, [], today);

  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const latest = sorted[sorted.length - 1];

  let currentPeriod: Period | null = null;
  if (latest && latest.startDate <= today) {
    if (!latest.endDate || today <= latest.endDate) {
      currentPeriod = latest;
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

/**
 * Evaluates event overlap using neutral, safe planning language.
 * Never promises certainty or pregnancy safety.
 */
export function evaluateOverlaps(
  events: Array<{ name: string; date: string }>,
  stats: CycleStats,
  periods: Period[],
) {
  const avgCycle = stats.avgCycleLength || 28;
  const avgPeriod = stats.avgPeriodLength || 5;
  const lastStart = stats.lastPeriodStart;

  return events.map((ev) => {
    let overlap: "period-day" | "likely" | "possible" | "unlikely" | "unknown" = "unknown";
    let overlapLabel = "Unknown";
    let overlapNote = "Log a past period first so predictions can be checked against this date.";

    const inActual = periods.some(
      (p) => ev.date >= p.startDate && (p.endDate ? ev.date <= p.endDate : ev.date === p.startDate),
    );

    if (inActual) {
      overlap = "period-day";
      overlapLabel = "Logged period date";
      overlapNote = "This date falls inside a period you have already logged.";
    } else if (lastStart) {
      overlap = "unlikely";
      overlapLabel = "Unlikely to overlap (estimate)";
      overlapNote = "Based on your pattern, your period is not expected to overlap this date.";

      const lastDate = new Date(lastStart);
      for (let k = 1; k <= 12; k++) {
        const predStart = new Date(lastDate.getTime() + avgCycle * k * DAY_MS);
        const coreEnd = new Date(predStart.getTime() + (avgPeriod - 1) * DAY_MS);
        const winStart = new Date(predStart.getTime() - 3 * DAY_MS);
        const winEnd = new Date(coreEnd.getTime() + 3 * DAY_MS);

        const evDate = new Date(ev.date);
        if (evDate >= predStart && evDate <= coreEnd) {
          overlap = "likely";
          overlapLabel = "Likely overlap";
          overlapNote = `Your period is predicted around ${predStart.toISOString().slice(0, 10)} to ${coreEnd.toISOString().slice(0, 10)}, so it will very likely overlap.`;
          break;
        }
        if (evDate >= winStart && evDate <= winEnd) {
          overlap = "possible";
          overlapLabel = "Possible overlap";
          overlapNote = `This date falls in your wider prediction window (${winStart.toISOString().slice(0, 10)} to ${winEnd.toISOString().slice(0, 10)}). Overlap is possible.`;
          break;
        }
      }
    }

    return {
      name: ev.name,
      eventDate: ev.date,
      overlap,
      overlapLabel,
      overlapNote,
    };
  });
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
    },
    null,
    2,
  );
}

export function importCycleDataJSON(jsonStr: string): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonStr);
    const periods = Array.isArray(parsed.periods) ? parsed.periods : [];
    const logs = Array.isArray(parsed.logs) ? parsed.logs : [];

    if (periods.length === 0 && logs.length === 0) {
      return { success: false, count: 0, error: "No valid periods or logs found in file." };
    }

    saveCycleData({ periods, logs });
    recordExportTimestamp();
    return { success: true, count: periods.length + logs.length };
  } catch (e: any) {
    return { success: false, count: 0, error: e.message || "Invalid JSON backup file." };
  }
}

const DEMO_FLAG_KEY = "feather_is_synthetic_demo";

export function isDemoDataLoaded(): boolean {
  return safeGetItem(DEMO_FLAG_KEY) === "true";
}

/**
 * Loads realistic, clearly-labelled synthetic cycle history for Hackathon judges
 * so the Plan Around It forecast and Foresight matrix light up instantly with zero mic or typing.
 */
export function loadSyntheticDemoData(): { periods: Period[]; logs: DayLog[] } {
  const syntheticPeriods: Period[] = [
    {
      id: 101,
      startDate: "2026-07-28",
      endDate: "2026-08-01",
      landmarkName: "Late Summer Vacation",
    },
    {
      id: 102,
      startDate: "2026-08-25",
      endDate: "2026-08-29",
      landmarkName: "Onam Holiday",
    },
    {
      id: 103,
      startDate: "2026-09-22",
      endDate: "2026-09-26",
      landmarkName: "Autumn Equinox",
    },
    {
      id: 104,
      startDate: "2026-10-20",
      endDate: "2026-10-24",
      landmarkName: "Global Marathon Window",
    },
  ];

  const syntheticLogs: DayLog[] = [
    {
      id: 201,
      logDate: "2026-10-20",
      flow: "heavy",
      symptoms: ["cramps", "fatigue", "headache"],
      mood: "Low",
      energy: 2,
      sleepHours: 7,
      notes: "[Synthetic Judge Demo] Cycle day 1 with cramps",
    },
    {
      id: 202,
      logDate: "2026-10-21",
      flow: "heavy",
      symptoms: ["cramps", "backache"],
      mood: "Okay",
      energy: 3,
      sleepHours: 7.5,
      notes: "[Synthetic Judge Demo] Cycle day 2 flow medium-heavy",
    },
    {
      id: 203,
      logDate: "2026-10-22",
      flow: "medium",
      symptoms: ["bloating"],
      mood: "Good",
      energy: 3,
      sleepHours: 8,
      notes: "[Synthetic Judge Demo] Energy recovering",
    },
    {
      id: 204,
      logDate: "2026-10-23",
      flow: "light",
      symptoms: [],
      mood: "Great",
      energy: 4,
      sleepHours: 8,
      notes: "[Synthetic Judge Demo] Light flow, feeling good",
    },
    {
      id: 205,
      logDate: "2026-10-24",
      flow: "spotting",
      symptoms: [],
      mood: "Calm",
      energy: 5,
      sleepHours: 8.5,
      notes: "[Synthetic Judge Demo] Final spotting day",
    },
  ];

  const syntheticData = { periods: syntheticPeriods, logs: syntheticLogs };
  saveCycleData(syntheticData);
  safeSetItem(DEMO_FLAG_KEY, "true");
  return syntheticData;
}

export function clearSyntheticDemoData(): void {
  saveCycleData({ periods: [], logs: [] });
  safeSetItem(DEMO_FLAG_KEY, "false");
}
