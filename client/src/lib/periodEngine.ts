/**
 * Feather Menstrual Cycle Domain Engine
 *
 * Pure domain logic: zero React, database, network, or UI dependencies.
 * All dates are local-calendar date strings: YYYY-MM-DD.
 *
 * Architectural Invariants:
 * 1. Record facts; derive everything else. A recorded start date is a fact; a predicted date is a changing estimate.
 * 2. Unconfirmed records are preserved in canonical storage but strictly excluded from cycle reconstruction and predictions.
 * 3. Daily status respects explicit observations: never invent end dates or assume bleeding stopped without evidence.
 * 4. Prediction anchoring: future records do not corrupt predictions for earlier evaluation dates.
 * 5. Estimates are informational planning guides, never medical diagnoses or contraceptive advice.
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

/**
 * Cycle quality classification adhering to FIGO clinical thresholds:
 * - 'valid': 21 - 38 calendar days (standard clinical normal range)
 * - 'short': 15 - 20 calendar days (unusually short / polymenorrhea)
 * - 'long': 39 - 90 calendar days (unusually long / oligomenorrhea)
 * - 'anomalous': < 15 or > 90 calendar days (extreme anomaly or likely multi-cycle recording gap)
 * - 'incomplete': ongoing cycle (most recent period without subsequent recorded start)
 */
export type Cycle = {
  startDate: DateKey;
  nextStartDate: DateKey | null;
  lengthDays: number | null;
  quality: "valid" | "short" | "long" | "anomalous" | "incomplete";
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
  allCycleLengths: number[];
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
 * Completely immune to timezone offsets and daylight saving transitions.
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
 * - All records must have valid IDs and calendar dates
 * - endDate cannot precede startDate
 * - IDs must be unique across all records
 * - Confirmed records must have unique start dates
 * - Confirmed period spans cannot overlap
 * - Unconfirmed records are preserved in the dataset
 * Returns all records sorted chronologically by startDate.
 */
export function validateRecords(records: PeriodRecord[]): PeriodRecord[] {
  const ids = new Set<string>();

  for (const record of records) {
    if (!record || typeof record.id !== "string" || !record.id.trim()) {
      throw new Error(`Missing or invalid record ID: ${record?.id}`);
    }
    if (ids.has(record.id)) {
      throw new Error(`Duplicate record ID: ${record.id}`);
    }
    ids.add(record.id);

    toDate(record.startDate);

    if (record.endDate) {
      toDate(record.endDate);
      if (record.endDate < record.startDate) {
        throw new Error(`End date precedes start date: ${record.id}`);
      }
    }
  }

  // Sort all records chronologically
  const sorted = [...records].sort((a, b) => {
    const cmp = a.startDate.localeCompare(b.startDate);
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });

  // Enforce uniqueness and non-overlapping intervals for confirmed records
  const confirmed = sorted.filter((r) => r.confirmed);

  for (let i = 1; i < confirmed.length; i++) {
    const previous = confirmed[i - 1];
    const current = confirmed[i];

    if (previous.startDate === current.startDate) {
      throw new Error(`Duplicate period start date: ${current.startDate}`);
    }

    // Interval overlap: if previous has an endDate and current starts on or before it
    if (previous.endDate && current.startDate <= previous.endDate) {
      throw new Error(
        `Overlapping period records: ${previous.id} (${previous.startDate}..${previous.endDate}) and ${current.id} (${current.startDate})`,
      );
    }
  }

  return sorted;
}

/**
 * Reconstructs consecutive cycle boundaries from confirmed records.
 * Quality classifications:
 * - 'valid': 21 - 38 days
 * - 'short': 15 - 20 days
 * - 'long': 39 - 90 days
 * - 'anomalous': < 15 or > 90 days (excluded from standard estimation)
 * - 'incomplete': most recent cycle with no subsequent confirmed start
 */
export function reconstructCycles(records: PeriodRecord[]): Cycle[] {
  const sorted = validateRecords(records);
  const confirmed = sorted.filter((r) => r.confirmed);

  return confirmed.map((record, index) => {
    const next = confirmed[index + 1];
    const length = next ? dayDifference(record.startDate, next.startDate) : null;

    let quality: Cycle["quality"] = "incomplete";

    if (length !== null) {
      if (length < 15 || length > 90) {
        quality = "anomalous";
      } else if (length < 21) {
        quality = "short";
      } else if (length > 38) {
        quality = "long";
      } else {
        quality = "valid";
      }
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
 * Computes robust cycle statistics from confirmed records:
 * - Retains all completed cycles in history rather than silently discarding them
 * - Restricts prediction history to physiologically eligible cycles (15–90 days)
 * - Anomalous cycles (<15d or >90d) are counted and reported separately for transparency
 * - Bleeding duration analyzes confirmed end dates without inventing missing ones
 */
export function getCycleStatistics(
  records: PeriodRecord[],
  settings = DEFAULT_SETTINGS,
): CycleStatistics {
  const cycles = reconstructCycles(records);
  const completed = cycles.filter((c) => c.lengthDays !== null);

  // Eligible cycles for statistical estimation: valid, short, and long (15–90 days).
  // Anomalous cycles (<15d or >90d) are excluded from the median calculation.
  const eligible = completed.filter(
    (c) => c.lengthDays! >= 15 && c.lengthDays! <= 90,
  );

  const recent = eligible.slice(-settings.historyWindow).map((c) => c.lengthDays!);
  const allLengths = completed.map((c) => c.lengthDays!);

  // Bleeding duration analysis
  const sorted = validateRecords(records);
  const confirmed = sorted.filter((r) => r.confirmed);
  const durations = confirmed
    .filter((r) => r.endDate)
    .map((r) => dayDifference(r.startDate, r.endDate!) + 1);

  const hasUnknownEndDates = confirmed.some((r) => !r.endDate);
  const averageBleedingDuration = durations.length
    ? roundDay(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  return {
    cycles,
    completedCycleCount: completed.length,
    eligibleCycleCount: eligible.length,
    excludedForEstimationCount: completed.length - eligible.length,
    averageCycleLength: allLengths.length
      ? roundDay(allLengths.reduce((a, b) => a + b, 0) / allLengths.length)
      : null,
    medianCycleLength: allLengths.length ? roundDay(median(allLengths)) : null,
    shortestCycle: allLengths.length ? Math.min(...allLengths) : null,
    longestCycle: allLengths.length ? Math.max(...allLengths) : null,
    allCycleLengths: allLengths,
    recentCycleLengths: recent,
    averageBleedingDuration,
    hasUnknownEndDates,
  };
}

/**
 * Generates cycle prediction anchored to the latest confirmed period record on or before asOfDate.
 * Enforces the formal state machine:
 * - 'no-data': zero confirmed records on or before asOfDate
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
  const confirmed = sorted.filter((r) => r.confirmed);

  // Anchor strictly to confirmed periods that started on or before the reference date.
  // Future-dated entries cannot anchor a past or current prediction.
  const pastConfirmed = confirmed.filter((r) => r.startDate <= asOfDate);
  const last = pastConfirmed[pastConfirmed.length - 1];

  if (!last) {
    return {
      status: "no-data",
      expectedStart: null,
      earliestStart: null,
      latestStart: null,
      cycleLengthDays: null,
      cyclesUsed: 0,
      confidence: "none",
      reason: "No confirmed period start has been recorded on or before this date.",
    };
  }

  // Calculate statistics based on records up to the anchor
  const stats = getCycleStatistics(pastConfirmed, settings);
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
 * - Cycle Day 1 is strictly the recorded period start date
 * - periodRecordId is only set if the date falls inside [startDate, endDate]
 * - Explicit daily observations strictly override interval-based bleeding assumptions
 * - Never invents an end date or assumes bleeding stopped without evidence
 */
export function getDailyStatus(
  records: PeriodRecord[],
  observations: DailyObservation[],
  date: DateKey,
  settings = DEFAULT_SETTINGS,
): DailyStatus {
  toDate(date);

  const sorted = validateRecords(records);
  const confirmed = sorted.filter((r) => r.confirmed);

  // Latest period that started on or before this date
  const current = [...confirmed].reverse().find((r) => r.startDate <= date);
  const observation = observations.find((o) => o.date === date);

  // Determine if date is inside the period's bleeding interval
  const isWithinPeriod = Boolean(
    current &&
      date >= current.startDate &&
      (current.endDate ? date <= current.endDate : date === current.startDate),
  );

  let periodRecordId: string | null = isWithinPeriod && current ? current.id : null;
  let bleeding: boolean | null = null;

  if (observation && observation.bleeding !== undefined) {
    // Explicit daily observation strictly overrides interval assumption
    bleeding = observation.bleeding;
  } else if (isWithinPeriod) {
    // Inside confirmed period interval without conflicting observation
    bleeding = true;
  } else {
    // Outside confirmed period with no observation -> status is unknown (null), never invented
    bleeding = null;
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
 * Accepts an optional reference date (asOfDate) to ensure calendar status
 * and dashboard status agree 100% across all dates.
 */
export function getCalendarMonth(
  year: number,
  month: number,
  records: PeriodRecord[],
  observations: DailyObservation[],
  asOfDate?: DateKey,
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
  const referenceDate = asOfDate || `${year}-${String(month).padStart(2, "0")}-01`;
  const unifiedPrediction = getPrediction(records, referenceDate, settings);

  for (let day = 1; day <= count; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const daily = getDailyStatus(records, observations, date, settings);

    days.push({
      ...daily,
      isPredictedStart: unifiedPrediction.expectedStart === date,
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
  const confirmed = sorted.filter((r) => r.confirmed);
  const pastConfirmed = confirmed.filter((r) => r.startDate <= asOfDate);
  const latest = pastConfirmed[pastConfirmed.length - 1] || null;

  const prediction = getPrediction(records, asOfDate, settings);
  const statistics = getCycleStatistics(pastConfirmed, settings);
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
 * getCalendarMonth, getDashboard, validateDataset.
 * Mutations are atomic and reject invalid or corrupted states.
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

  /**
   * Creates or idempotently updates a period record.
   * If an id is provided and already exists, updates it.
   */
  public createPeriod(input: {
    id?: string;
    startDate: DateKey;
    endDate?: DateKey;
    confirmed?: boolean;
    source?: PeriodRecord["source"];
    landmarkName?: string | null;
  }): PeriodRecord {
    const id = input.id || `period_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const existingIdx = this.records.findIndex((r) => r.id === id);

    const record: PeriodRecord = {
      id,
      startDate: input.startDate,
      endDate: input.endDate,
      confirmed: input.confirmed ?? true,
      source: input.source ?? "manual",
      landmarkName: input.landmarkName ?? null,
      createdAt: existingIdx >= 0 ? this.records[existingIdx].createdAt : now,
      updatedAt: now,
    };

    const nextRecords = [...this.records];
    if (existingIdx >= 0) {
      nextRecords[existingIdx] = record;
    } else {
      nextRecords.push(record);
    }

    // Atomic validation: only commit if entire set is valid
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

  public getCalendarMonth(year: number, month: number, asOfDate?: DateKey): CalendarDay[] {
    return getCalendarMonth(year, month, this.records, this.observations, asOfDate, this.settings);
  }

  public getDashboard(asOfDate: DateKey): DashboardSummary {
    return getDashboard(this.records, this.observations, asOfDate, this.settings);
  }

  public validateDataset(): { isValid: boolean; errors: string[] } {
    return validateDataset(this.records, this.observations);
  }
}

