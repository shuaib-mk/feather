/**
 * Feather Menstrual Cycle Domain Engine
 *
 * Pure domain logic: zero React, database, network, or UI dependencies.
 * All dates are local-calendar date strings: YYYY-MM-DD.
 *
 * The key architectural invariant: record facts; derive everything else.
 * A period's recorded start date is a fact. Its next predicted start date is a changing estimate.
 * Estimates are strictly informational planning guides, never medical diagnoses or guarantees.
 */

export type DateKey = string;

export type PeriodRecord = {
  id: string;
  startDate: DateKey;
  endDate?: DateKey;
  confirmed: boolean;
  source: "manual" | "voice" | "text" | "import";
  landmarkName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DailyObservation = {
  date: DateKey;
  bleeding: boolean;
  flow?: "spotting" | "light" | "medium" | "heavy";
  symptoms?: string[];
  mood?: string | null;
  energy?: number | null; // 1..5
  sleepHours?: number | null;
  notes?: string;
};

export type EngineSettings = {
  defaultCycleLength: number;
  defaultPeriodDuration: number;
  historyWindow: number;
};

export type Cycle = {
  startDate: DateKey;
  nextStartDate: DateKey | null;
  lengthDays: number | null;
  quality: "valid" | "short" | "long" | "incomplete";
};

export type Prediction = {
  status: "no-data" | "provisional" | "estimated" | "overdue";
  expectedStart: DateKey | null;
  earliestStart: DateKey | null;
  latestStart: DateKey | null;
  cycleLengthDays: number | null;
  cyclesUsed: number;
  confidence: "none" | "low" | "moderate" | "limited";
  reason: string;
};

export type DailyStatus = {
  date: DateKey;
  cycleDay: number | null;
  bleeding: boolean | null;
  periodRecordId: string | null;
  predictionStatus: Prediction["status"];
};

export type CalendarDay = DailyStatus & {
  isPredictedStart: boolean;
};

export type CycleStatistics = {
  cycles: Cycle[];
  completedCycleCount: number;
  eligibleCycleCount: number;
  excludedForEstimationCount: number;
  averageCycleLength: number | null;
  medianCycleLength: number | null;
  shortestCycle: number | null;
  longestCycle: number | null;
  recentCycleLengths: number[];
  averageBleedingDuration: number | null;
  hasUnknownEndDates: boolean;
};

export type DashboardSummary = {
  asOfDate: DateKey;
  currentCycleDay: number | null;
  isPeriodInProgress: boolean;
  currentPeriodRecord: PeriodRecord | null;
  prediction: Prediction;
  daysUntilExpected: number | null;
  statistics: CycleStatistics;
  recentObservations: DailyObservation[];
};

export const DEFAULT_SETTINGS: EngineSettings = {
  defaultCycleLength: 28,
  defaultPeriodDuration: 5,
  historyWindow: 6,
};

const DAY_MS = 86_400_000;

/**
 * Validates and parses calendar date string in YYYY-MM-DD format using strict UTC roundtrip.
 * Rejects nonexistent dates (e.g., 2026-02-31, 2026-13-01).
 */
export function toDate(key: DateKey): Date {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    throw new Error(`Invalid date format: ${key}`);
  }

  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new Error(`Invalid calendar date: ${key}`);
  }

  return date;
}

/**
 * Converts a UTC Date into local-calendar DateKey string (YYYY-MM-DD).
 */
export function dateKey(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

/**
 * Adds an integer number of calendar days to a date string.
 */
export function addDays(key: DateKey, amount: number): DateKey {
  if (!Number.isInteger(amount)) {
    throw new Error("Day offset must be an integer");
  }

  const date = toDate(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
}

/**
 * Computes difference in calendar days from one date to another.
 * Positive if 'to' is after 'from'.
 */
export function dayDifference(from: DateKey, to: DateKey): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);
}

/**
 * Calculates statistical median of a non-empty numeric array.
 */
export function median(values: number[]): number {
  if (!values.length) {
    throw new Error("Cannot calculate median of empty data");
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function roundDay(value: number): number {
  return Math.round(value);
}

/**
 * Validates canonical records dataset:
 * - Dates must be valid calendar dates
 * - endDate cannot precede startDate
 * - IDs must be unique
 * - Duplicate start dates are rejected
 * - Overlapping period spans are rejected
 * Returns chronologically sorted confirmed records.
 */
export function validateRecords(records: PeriodRecord[]): PeriodRecord[] {
  const confirmed = records.filter((r) => r.confirmed);

  for (const record of confirmed) {
    if (!record.id) throw new Error("Missing record ID");
    toDate(record.startDate);

    if (record.endDate) {
      toDate(record.endDate);
      if (record.endDate < record.startDate) {
        throw new Error(`End date precedes start date: ${record.id}`);
      }
    }
  }

  const sorted = [...confirmed].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const ids = new Set<string>();

  for (const record of sorted) {
    if (ids.has(record.id)) {
      throw new Error(`Duplicate record ID: ${record.id}`);
    }
    ids.add(record.id);
  }

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];

    if (previous.startDate === current.startDate) {
      throw new Error("Duplicate period start date");
    }

    if (previous.endDate && current.startDate <= previous.endDate) {
      throw new Error("Overlapping period records");
    }
  }

  return sorted;
}

/**
 * Reconstructs consecutive cycle boundaries from confirmed records.
 * Classifies cycles by clinical quality thresholds:
 * - 'short' (< 21 days)
 * - 'long' (> 35 days)
 * - 'valid' (21 - 35 days)
 * - 'incomplete' (most recent ongoing cycle with no subsequent start recorded)
 */
export function reconstructCycles(records: PeriodRecord[]): Cycle[] {
  const sorted = validateRecords(records);

  return sorted.map((record, index) => {
    const next = sorted[index + 1];
    const length = next ? dayDifference(record.startDate, next.startDate) : null;

    let quality: Cycle["quality"] = "incomplete";

    if (length !== null) {
      if (length < 21) quality = "short";
      else if (length > 35) quality = "long";
      else quality = "valid";
    }

    return {
      startDate: record.startDate,
      nextStartDate: next?.startDate ?? null,
      lengthDays: length,
      quality,
    };
  });
}

/**
 * Computes robust cycle statistics:
 * - Retains all historical cycles rather than silently discarding outliers
 * - Filters standard estimation candidates to physiologically plausible cycles (15–90 days)
 * - Calculates mean, median, shortest, and longest cycles
 * - Analyzes confirmed bleeding duration without fabricating missing end dates
 */
export function getCycleStatistics(
  records: PeriodRecord[],
  settings = DEFAULT_SETTINGS,
): CycleStatistics {
  const cycles = reconstructCycles(records);
  const completed = cycles.filter((c) => c.lengthDays !== null);

  // Retain all cycles in history. Use plausible cycles for standard estimate, while flagging unusual ones.
  const eligible = completed.filter(
    (c) => c.lengthDays! >= 15 && c.lengthDays! <= 90,
  );

  const recent = eligible.slice(-settings.historyWindow).map((c) => c.lengthDays!);
  const lengths = completed.map((c) => c.lengthDays!);

  // Bleeding duration analysis
  const sorted = validateRecords(records);
  const durations = sorted
    .filter((r) => r.endDate)
    .map((r) => dayDifference(r.startDate, r.endDate!) + 1);

  const hasUnknownEndDates = sorted.some((r) => !r.endDate);
  const averageBleedingDuration = durations.length
    ? roundDay(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  return {
    cycles,
    completedCycleCount: completed.length,
    eligibleCycleCount: eligible.length,
    excludedForEstimationCount: completed.length - eligible.length,
    averageCycleLength: lengths.length
      ? roundDay(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      : null,
    medianCycleLength: lengths.length ? roundDay(median(lengths)) : null,
    shortestCycle: lengths.length ? Math.min(...lengths) : null,
    longestCycle: lengths.length ? Math.max(...lengths) : null,
    recentCycleLengths: recent,
    averageBleedingDuration,
    hasUnknownEndDates,
  };
}

/**
 * Generates cycle prediction anchored to the latest confirmed period record as of a given date.
 * Enforces the formal state machine:
 * - 'no-data': zero confirmed records
 * - 'provisional': single confirmed start recorded (falls back to population default with wide margin)
 * - 'estimated': 1+ completed eligible cycles available for personalized median & MAD calculation
 * - 'overdue': expected start date has elapsed without a newly confirmed period record
 *
 * Uncertainty margin is derived from the Median Absolute Deviation (MAD), bounded between 3 and 10 days.
 */
export function getPrediction(
  records: PeriodRecord[],
  asOfDate: DateKey,
  settings = DEFAULT_SETTINGS,
): Prediction {
  toDate(asOfDate);

  const sorted = validateRecords(records);
  const last = sorted[sorted.length - 1];

  if (!last) {
    return {
      status: "no-data",
      expectedStart: null,
      earliestStart: null,
      latestStart: null,
      cycleLengthDays: null,
      cyclesUsed: 0,
      confidence: "none",
      reason: "No confirmed period start has been recorded.",
    };
  }

  const stats = getCycleStatistics(sorted, settings);
  const history = stats.recentCycleLengths;
  const observedCount = history.length;

  // Single recorded start: provisional prediction
  if (observedCount === 0) {
    const next = addDays(last.startDate, settings.defaultCycleLength);
    return {
      status: asOfDate > next ? "overdue" : "provisional",
      expectedStart: next,
      earliestStart: addDays(next, -4),
      latestStart: addDays(next, 4),
      cycleLengthDays: settings.defaultCycleLength,
      cyclesUsed: 0,
      confidence: "low",
      reason: "No completed cycle history; using a provisional default.",
    };
  }

  const cycleLength = roundDay(median(history));
  const expected = addDays(last.startDate, cycleLength);

  const deviations = history.map((length) => Math.abs(length - cycleLength));
  const mad = median(deviations);

  // Heuristic display range based on historical variability (3 to 10 days)
  const margin = Math.min(10, Math.max(3, Math.ceil(1.5 * mad)));

  const confidence: Prediction["confidence"] =
    observedCount >= 4 && mad <= 3
      ? "moderate"
      : observedCount >= 2
      ? "limited"
      : "low";

  return {
    status: asOfDate > expected ? "overdue" : "estimated",
    expectedStart: expected,
    earliestStart: addDays(expected, -margin),
    latestStart: addDays(expected, margin),
    cycleLengthDays: cycleLength,
    cyclesUsed: observedCount,
    confidence,
    reason:
      observedCount >= 2
        ? "Estimated from recent completed cycles."
        : "Limited personal history; estimate may be inaccurate.",
  };
}

/**
 * Returns canonical daily status for a given calendar date:
 * - Cycle Day 1 is strictly the first day of menstrual bleeding
 * - Explicit daily observations override span-based assumptions
 */
export function getDailyStatus(
  records: PeriodRecord[],
  observations: DailyObservation[],
  date: DateKey,
  settings = DEFAULT_SETTINGS,
): DailyStatus {
  toDate(date);

  const sorted = validateRecords(records);
  const current = [...sorted].reverse().find((r) => r.startDate <= date);
  const observation = observations.find((o) => o.date === date);

  let bleeding: boolean | null = observation ? observation.bleeding : null;
  let periodRecordId: string | null = null;

  if (current) {
    periodRecordId = current.id;
    if (current.endDate && date <= current.endDate) {
      bleeding = observation?.bleeding ?? true;
    }
  }

  const prediction = getPrediction(records, date, settings);

  return {
    date,
    cycleDay: current ? dayDifference(current.startDate, date) + 1 : null,
    bleeding,
    periodRecordId,
    predictionStatus: prediction.status,
  };
}

/**
 * Generates comprehensive calendar month day-by-day status matrix.
 */
export function getCalendarMonth(
  year: number,
  month: number,
  records: PeriodRecord[],
  observations: DailyObservation[],
  settings = DEFAULT_SETTINGS,
): CalendarDay[] {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("Invalid calendar month");
  }

  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: CalendarDay[] = [];

  for (let day = 1; day <= count; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const prediction = getPrediction(records, date, settings);
    const daily = getDailyStatus(records, observations, date, settings);

    days.push({
      ...daily,
      isPredictedStart: prediction.expectedStart === date,
    });
  }

  return days;
}

/**
 * Generates unified dashboard summary for any evaluation date.
 */
export function getDashboard(
  records: PeriodRecord[],
  observations: DailyObservation[],
  asOfDate: DateKey,
  settings = DEFAULT_SETTINGS,
): DashboardSummary {
  toDate(asOfDate);

  const sorted = validateRecords(records);
  const latest = sorted[sorted.length - 1] || null;
  const prediction = getPrediction(records, asOfDate, settings);
  const statistics = getCycleStatistics(records, settings);
  const daily = getDailyStatus(records, observations, asOfDate, settings);

  const isPeriodInProgress = Boolean(
    latest &&
      latest.startDate <= asOfDate &&
      (!latest.endDate || asOfDate <= latest.endDate),
  );

  const daysUntilExpected = prediction.expectedStart
    ? dayDifference(asOfDate, prediction.expectedStart)
    : null;

  const recentObservations = [...observations]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return {
    asOfDate,
    currentCycleDay: daily.cycleDay,
    isPeriodInProgress,
    currentPeriodRecord: latest,
    prediction,
    daysUntilExpected,
    statistics,
    recentObservations,
  };
}

/**
 * Validates entire dataset (records + daily observations).
 */
export function validateDataset(
  records: PeriodRecord[],
  observations: DailyObservation[],
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    validateRecords(records);
  } catch (err: any) {
    errors.push(err.message);
  }

  const obsDates = new Set<string>();
  for (const obs of observations) {
    try {
      toDate(obs.date);
      if (obsDates.has(obs.date)) {
        errors.push(`Duplicate daily observation date: ${obs.date}`);
      }
      obsDates.add(obs.date);
    } catch (err: any) {
      errors.push(`Invalid observation date: ${obs.date} (${err.message})`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Stateful Engine Instance with Complete Public API Facade:
 * createPeriod, updatePeriod, deletePeriod, recordDailyObservation,
 * getCycleHistory, getCycleStatistics, getPrediction, getDailyStatus,
 * getCalendarMonth, getDashboard, validateDataset
 */
export class FeatherEngine {
  private records: PeriodRecord[] = [];
  private observations: DailyObservation[] = [];
  private settings: EngineSettings;

  constructor(
    initialRecords: PeriodRecord[] = [],
    initialObservations: DailyObservation[] = [],
    settings: EngineSettings = DEFAULT_SETTINGS,
  ) {
    this.settings = { ...settings };
    this.records = validateRecords(initialRecords);
    this.observations = [...initialObservations];
  }

  public getRecords(): PeriodRecord[] {
    return [...this.records];
  }

  public getObservations(): DailyObservation[] {
    return [...this.observations];
  }

  public createPeriod(input: {
    startDate: DateKey;
    endDate?: DateKey;
    confirmed?: boolean;
    source?: PeriodRecord["source"];
    landmarkName?: string | null;
  }): PeriodRecord {
    const id = `period_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const record: PeriodRecord = {
      id,
      startDate: input.startDate,
      endDate: input.endDate,
      confirmed: input.confirmed ?? true,
      source: input.source ?? "manual",
      landmarkName: input.landmarkName ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const nextRecords = [...this.records, record];
    this.records = validateRecords(nextRecords);
    return record;
  }

  public updatePeriod(
    id: string,
    patch: Partial<Omit<PeriodRecord, "id" | "createdAt">>,
  ): PeriodRecord {
    const idx = this.records.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw new Error(`Period record not found: ${id}`);
    }

    const existing = this.records[idx];
    const updated: PeriodRecord = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const nextRecords = [...this.records];
    nextRecords[idx] = updated;
    this.records = validateRecords(nextRecords);
    return updated;
  }

  public deletePeriod(id: string): void {
    const nextRecords = this.records.filter((r) => r.id !== id);
    this.records = validateRecords(nextRecords);
  }

  public recordDailyObservation(input: DailyObservation): DailyObservation {
    toDate(input.date);
    const existingIdx = this.observations.findIndex((o) => o.date === input.date);

    if (existingIdx >= 0) {
      this.observations[existingIdx] = { ...this.observations[existingIdx], ...input };
    } else {
      this.observations.push(input);
    }

    this.observations.sort((a, b) => b.date.localeCompare(a.date));
    return input;
  }

  public deleteDailyObservation(date: DateKey): void {
    this.observations = this.observations.filter((o) => o.date !== date);
  }

  public getCycleHistory(): Cycle[] {
    return reconstructCycles(this.records);
  }

  public getCycleStatistics(): CycleStatistics {
    return getCycleStatistics(this.records, this.settings);
  }

  public getPrediction(asOfDate: DateKey): Prediction {
    return getPrediction(this.records, asOfDate, this.settings);
  }

  public getDailyStatus(date: DateKey): DailyStatus {
    return getDailyStatus(this.records, this.observations, date, this.settings);
  }

  public getCalendarMonth(year: number, month: number): CalendarDay[] {
    return getCalendarMonth(year, month, this.records, this.observations, this.settings);
  }

  public getDashboard(asOfDate: DateKey): DashboardSummary {
    return getDashboard(this.records, this.observations, asOfDate, this.settings);
  }

  public validateDataset(): { isValid: boolean; errors: string[] } {
    return validateDataset(this.records, this.observations);
  }
}
