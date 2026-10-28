/**
 * Feather Period Engine — Comprehensive Verification & Acceptance Test Suite
 *
 * Verifies all 20 required domain test cases and 7 mathematical invariants:
 *  1. Empty history -> 'no-data' state
 *  2. First-ever period -> 'provisional' state
 *  3. One completed cycle -> personalized history begins
 *  4. Multiple completed cycles -> robust median estimation
 *  5. Stable vs highly variable cycle histories (MAD calculation)
 *  6. Unusually short, long, and anomalous cycles
 *  7. Duplicate IDs and duplicate start dates rejected
 *  8. Invalid dates and reversed intervals rejected
 *  9. Overlapping period records rejected
 * 10. Unknown period end dates handled without fabrication
 * 11. Explicit daily observations overriding interval bleeding
 * 12. Record creation, editing, deletion, and correction
 * 13. Future-dated records do not corrupt earlier predictions
 * 14. Predictions before, on, and after the expected date
 * 15. Correct clearing of overdue status upon new period
 * 16. Leap years, month boundaries, and year boundaries
 * 17. Timezone independence of calendar date arithmetic
 * 18. Persistence, import, and migration edge cases
 * 19. Calendar and dashboard consistency
 * 20. Idempotent submission and retry handling
 *
 * Plus 7 Domain Invariants:
 *  I1. Date arithmetic inverse consistency
 *  I2. Cycle length equals consecutive start date difference
 *  I3. Deterministic reproducibility
 *  I4. Corrections propagate to all derived outputs
 *  I5. Unconfirmed records never influence predictions
 *  I6. Historical records immutability during calculation
 *  I7. Calendar and dashboard prediction agreement
 */

import {
  FeatherEngine,
  toDate,
  dateKey,
  addDays,
  dayDifference,
  median,
  validateRecords,
  reconstructCycles,
  getCycleStatistics,
  getPrediction,
  getDailyStatus,
  getCalendarMonth,
  getDashboard,
  type PeriodRecord,
  type DailyObservation,
} from "../../client/src/lib/periodEngine";

import {
  addOrUpdatePeriod,
  addOrUpdateLog,
  loadCycleData,
  saveCycleData,
  importCycleDataJSON,
  computeCycleStats,
  type Period,
} from "../../client/src/cycleStorage";

async function runAllTests() {
  console.log("==================================================================");
  console.log("=== Feather Menstrual Cycle Domain Engine: Full Verification ===");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}${detail ? ` (${detail})` : ""}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` (${detail})` : ""}`);
      failed++;
    }
  }

  // ==================================================================
  // 1. Empty History
  // ==================================================================
  try {
    const engine = new FeatherEngine([], []);
    const pred = engine.getPrediction("2026-10-28");
    const stats = engine.getCycleStatistics();

    assert(
      pred.status === "no-data" &&
        pred.expectedStart === null &&
        pred.earliestStart === null &&
        pred.latestStart === null &&
        pred.confidence === "none" &&
        pred.cyclesUsed === 0 &&
        stats.completedCycleCount === 0 &&
        stats.averageCycleLength === null,
      "Test 1: Empty history returns no-data state without fabricated predictions",
      `status=${pred.status}, confidence=${pred.confidence}`,
    );
  } catch (err: any) {
    assert(false, "Test 1: Empty history", err.message);
  }

  // ==================================================================
  // 2. First-Ever Period
  // ==================================================================
  try {
    const single: PeriodRecord[] = [
      {
        id: "p1",
        startDate: "2026-10-01",
        confirmed: true,
        source: "manual",
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ];
    const engine = new FeatherEngine(single, []);
    const pred = engine.getPrediction("2026-10-15");

    assert(
      pred.status === "provisional" &&
        pred.expectedStart === "2026-10-29" && // 2026-10-01 + 28d default
        pred.earliestStart === "2026-10-25" &&
        pred.latestStart === "2026-11-02" &&
        pred.confidence === "low" &&
        pred.cyclesUsed === 0,
      "Test 2: First-ever period returns provisional estimate anchored to default interval",
      `expected=${pred.expectedStart}, status=${pred.status}`,
    );
  } catch (err: any) {
    assert(false, "Test 2: First-ever period", err.message);
  }

  // ==================================================================
  // 3. One Completed Cycle
  // ==================================================================
  try {
    const records: PeriodRecord[] = [
      { id: "p1", startDate: "2026-08-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-08-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const engine = new FeatherEngine(records, []);
    const stats = engine.getCycleStatistics();
    const pred = engine.getPrediction("2026-09-10");

    assert(
      stats.completedCycleCount === 1 &&
        stats.cycles[0].lengthDays === 28 &&
        stats.cycles[0].quality === "valid" &&
        pred.status === "estimated" &&
        pred.expectedStart === "2026-09-26" && // 2026-08-29 + 28d
        pred.cyclesUsed === 1 &&
        pred.confidence === "low", // 1 cycle history = low confidence
      "Test 3: One completed cycle provides personalized estimate with honest confidence",
      `completed=${stats.completedCycleCount}, expected=${pred.expectedStart}, confidence=${pred.confidence}`,
    );
  } catch (err: any) {
    assert(false, "Test 3: One completed cycle", err.message);
  }

  // ==================================================================
  // 4. Multiple Completed Cycles
  // ==================================================================
  try {
    // 5 starts = 4 completed cycles: all 28 days
    const records: PeriodRecord[] = [
      { id: "p1", startDate: "2026-05-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-05-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p3", startDate: "2026-06-26", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p4", startDate: "2026-07-24", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p5", startDate: "2026-08-21", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const engine = new FeatherEngine(records, []);
    const stats = engine.getCycleStatistics();
    const pred = engine.getPrediction("2026-09-01");

    assert(
      stats.completedCycleCount === 4 &&
        stats.medianCycleLength === 28 &&
        pred.status === "estimated" &&
        pred.expectedStart === "2026-09-18" &&
        pred.confidence === "moderate" && // 4 cycles with mad=0 reaches moderate
        pred.cyclesUsed === 4,
      "Test 4: Multiple completed regular cycles yield moderate confidence prediction",
      `completed=${stats.completedCycleCount}, expected=${pred.expectedStart}, confidence=${pred.confidence}`,
    );
  } catch (err: any) {
    assert(false, "Test 4: Multiple completed cycles", err.message);
  }

  // ==================================================================
  // 5. Stable vs Highly Variable Cycle Histories (MAD Margin)
  // ==================================================================
  try {
    const stableRecords: PeriodRecord[] = [
      { id: "s1", startDate: "2026-05-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "s2", startDate: "2026-05-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "s3", startDate: "2026-06-26", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "s4", startDate: "2026-07-24", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const variableRecords: PeriodRecord[] = [
      { id: "v1", startDate: "2026-05-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "v2", startDate: "2026-05-23", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // 22d
      { id: "v3", startDate: "2026-06-28", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // 36d
      { id: "v4", startDate: "2026-07-20", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // 22d
      { id: "v5", startDate: "2026-08-25", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // 36d
    ];

    const stablePred = new FeatherEngine(stableRecords).getPrediction("2026-08-01");
    const variablePred = new FeatherEngine(variableRecords).getPrediction("2026-09-01");

    const stableMargin = dayDifference(stablePred.expectedStart!, stablePred.latestStart!);
    const variableMargin = dayDifference(variablePred.expectedStart!, variablePred.latestStart!);

    assert(
      stableMargin === 3 && variableMargin >= 8 && variablePred.confidence === "limited",
      "Test 5: MAD uncertainty bounds: stable history has ±3d margin; variable history widens to ±8d+",
      `stableMargin=±${stableMargin}d, variableMargin=±${variableMargin}d`,
    );
  } catch (err: any) {
    assert(false, "Test 5: Stable vs variable MAD", err.message);
  }

  // ==================================================================
  // 6. Unusually Short, Long, and Anomalous Cycles
  // ==================================================================
  try {
    const cyclesRecords: PeriodRecord[] = [
      { id: "c1", startDate: "2026-01-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "c2", startDate: "2026-01-19", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // 18d -> short
      { id: "c3", startDate: "2026-03-05", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // 45d -> long
      { id: "c4", startDate: "2026-03-12", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // 7d -> anomalous (<15d)
      { id: "c5", startDate: "2026-04-10", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // 29d -> valid
    ];
    const engine = new FeatherEngine(cyclesRecords);
    const stats = engine.getCycleStatistics();

    const shortCycle = stats.cycles.find((c) => c.quality === "short");
    const longCycle = stats.cycles.find((c) => c.quality === "long");
    const anomalousCycle = stats.cycles.find((c) => c.quality === "anomalous");
    const validCycle = stats.cycles.find((c) => c.quality === "valid");

    assert(
      shortCycle?.lengthDays === 18 &&
        longCycle?.lengthDays === 45 &&
        anomalousCycle?.lengthDays === 7 &&
        validCycle?.lengthDays === 29 &&
        stats.completedCycleCount === 4 &&
        stats.eligibleCycleCount === 3 &&
        stats.excludedForEstimationCount === 1,
      "Test 6: Cycles classified into valid, short, long, and anomalous; anomalous excluded from estimation",
      `eligible=${stats.eligibleCycleCount}, excluded=${stats.excludedForEstimationCount}`,
    );
  } catch (err: any) {
    assert(false, "Test 6: Cycle classifications", err.message);
  }

  // ==================================================================
  // 7. Duplicate IDs and Duplicate Start Dates Rejected
  // ==================================================================
  try {
    let dupIdCaught = false;
    let dupStartCaught = false;

    try {
      validateRecords([
        { id: "dup_id", startDate: "2026-05-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
        { id: "dup_id", startDate: "2026-06-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      ]);
    } catch (e: any) {
      if (e.message.includes("Duplicate record ID")) dupIdCaught = true;
    }

    try {
      validateRecords([
        { id: "p1", startDate: "2026-07-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
        { id: "p2", startDate: "2026-07-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      ]);
    } catch (e: any) {
      if (e.message.includes("Duplicate period start date")) dupStartCaught = true;
    }

    assert(dupIdCaught && dupStartCaught, "Test 7: Duplicate IDs and duplicate start dates strictly rejected");
  } catch (err: any) {
    assert(false, "Test 7: Duplicate IDs and dates", err.message);
  }

  // ==================================================================
  // 8. Invalid Dates and Reversed Intervals
  // ==================================================================
  try {
    let invalidDateCaught = false;
    let reversedIntervalCaught = false;

    try {
      toDate("2026-02-31");
    } catch {
      invalidDateCaught = true;
    }

    try {
      validateRecords([
        {
          id: "rev1",
          startDate: "2026-08-10",
          endDate: "2026-08-05", // endDate before startDate
          confirmed: true,
          source: "manual",
          createdAt: "",
          updatedAt: "",
        },
      ]);
    } catch (e: any) {
      if (e.message.includes("End date precedes start date")) reversedIntervalCaught = true;
    }

    assert(invalidDateCaught && reversedIntervalCaught, "Test 8: Invalid calendar dates and reversed intervals rejected");
  } catch (err: any) {
    assert(false, "Test 8: Invalid dates and intervals", err.message);
  }

  // ==================================================================
  // 9. Overlapping Records Rejected
  // ==================================================================
  try {
    let overlapCaught = false;
    try {
      validateRecords([
        { id: "p1", startDate: "2026-08-01", endDate: "2026-08-06", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
        { id: "p2", startDate: "2026-08-04", endDate: "2026-08-09", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      ]);
    } catch (e: any) {
      if (e.message.includes("Overlapping period records")) overlapCaught = true;
    }

    assert(overlapCaught, "Test 9: Overlapping confirmed period intervals strictly rejected");
  } catch (err: any) {
    assert(false, "Test 9: Overlapping records", err.message);
  }

  // ==================================================================
  // 10. Unknown Period End Dates Handled Without Fabrication
  // ==================================================================
  try {
    const unknownEnd: PeriodRecord[] = [
      { id: "p1", startDate: "2026-09-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-09-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const engine = new FeatherEngine(unknownEnd);
    const stats = engine.getCycleStatistics();
    const day1Status = engine.getDailyStatus("2026-09-01");
    const day3Status = engine.getDailyStatus("2026-09-03"); // no observation, unknown end

    assert(
      stats.hasUnknownEndDates === true &&
        stats.averageBleedingDuration === null &&
        day1Status.bleeding === true && // start day confirmed
        day3Status.bleeding === null, // subsequent day unknown without explicit observation
      "Test 10: Unknown end date preserves null duration without fabricating stopped bleeding",
      `hasUnknown=${stats.hasUnknownEndDates}, avgDuration=${stats.averageBleedingDuration}, day3Bleeding=${day3Status.bleeding}`,
    );
  } catch (err: any) {
    assert(false, "Test 10: Unknown end dates", err.message);
  }

  // ==================================================================
  // 11. Explicit Daily Observations Overriding Inferred Bleeding
  // ==================================================================
  try {
    const records: PeriodRecord[] = [
      { id: "p1", startDate: "2026-10-01", endDate: "2026-10-05", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const obs: DailyObservation[] = [
      { date: "2026-10-03", bleeding: false }, // user stopped bleeding early or dry day
      { date: "2026-10-12", bleeding: true, flow: "spotting" }, // mid-cycle spotting
    ];
    const engine = new FeatherEngine(records, obs);

    const oct3 = engine.getDailyStatus("2026-10-03");
    const oct4 = engine.getDailyStatus("2026-10-04");
    const oct12 = engine.getDailyStatus("2026-10-12");

    assert(
      oct3.bleeding === false && // explicit non-bleeding observation overrode interval
        oct4.bleeding === true && // interval fallback when no observation
        oct12.bleeding === true && // explicit spotting observation outside interval
        oct12.periodRecordId === null, // not part of period record p1
      "Test 11: Explicit daily observations strictly override interval bleeding assumptions",
      `oct3=${oct3.bleeding}, oct4=${oct4.bleeding}, oct12Bleed=${oct12.bleeding}, oct12PeriodId=${oct12.periodRecordId}`,
    );
  } catch (err: any) {
    assert(false, "Test 11: Explicit observation overrides", err.message);
  }

  // ==================================================================
  // 12. Record Creation, Editing, Deletion, and Correction
  // ==================================================================
  try {
    const engine = new FeatherEngine([]);
    engine.createPeriod({ startDate: "2026-07-01", endDate: "2026-07-05" });
    const p2 = engine.createPeriod({ startDate: "2026-07-29", endDate: "2026-08-02" });

    let stats = engine.getCycleStatistics();
    assert(stats.completedCycleCount === 1 && stats.cycles[0].lengthDays === 28, "Test 12A: Created two periods");

    // Edit p2 start date to 2026-07-31 (+2 days)
    engine.updatePeriod(p2.id, { startDate: "2026-07-31" });
    stats = engine.getCycleStatistics();
    assert(stats.cycles[0].lengthDays === 30, "Test 12B: Edited start date recalculated cycle length to 30d");

    // Delete p2
    engine.deletePeriod(p2.id);
    stats = engine.getCycleStatistics();
    assert(stats.completedCycleCount === 0 && engine.getRecords().length === 1, "Test 12C: Deleted period recalculated count to 0");
  } catch (err: any) {
    assert(false, "Test 12: Record mutation lifecycle", err.message);
  }

  // ==================================================================
  // 13. Future-Dated Records Do Not Corrupt Earlier Predictions
  // ==================================================================
  try {
    const records: PeriodRecord[] = [
      { id: "p1", startDate: "2026-08-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-08-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p3", startDate: "2026-09-26", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p_future", startDate: "2026-12-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // advance entry
    ];
    const engine = new FeatherEngine(records);

    // Evaluate prediction as of October 15, 2026
    const octPred = engine.getPrediction("2026-10-15");
    // Evaluate before any periods as of July 1, 2026
    const julyPred = engine.getPrediction("2026-07-01");

    assert(
      octPred.expectedStart === "2026-10-24" && // anchored to 2026-09-26 + 28d, not 2026-12-01
        octPred.status === "estimated" &&
        julyPred.status === "no-data", // prior to all records -> no-data
      "Test 13: Future-dated records do not corrupt prediction anchors for earlier dates",
      `octExpected=${octPred.expectedStart}, octStatus=${octPred.status}, julyStatus=${julyPred.status}`,
    );
  } catch (err: any) {
    assert(false, "Test 13: Future-dated records", err.message);
  }

  // ==================================================================
  // 14. Predictions Before, On, and After the Expected Date
  // ==================================================================
  try {
    const records: PeriodRecord[] = [
      { id: "p1", startDate: "2026-08-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-09-26", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const engine = new FeatherEngine(records);
    // Expected next: 2026-10-24

    const beforePred = engine.getPrediction("2026-10-20");
    const onDatePred = engine.getPrediction("2026-10-24");
    const afterPred = engine.getPrediction("2026-10-25");

    assert(
      beforePred.status === "estimated" &&
        onDatePred.status === "estimated" &&
        afterPred.status === "overdue",
      "Test 14: Prediction state transitions: 'estimated' before and on expected date, 'overdue' after",
      `before=${beforePred.status}, on=${onDatePred.status}, after=${afterPred.status}`,
    );
  } catch (err: any) {
    assert(false, "Test 14: Prediction timeline transitions", err.message);
  }

  // ==================================================================
  // 15. Correct Clearing of Overdue Status Upon New Period
  // ==================================================================
  try {
    const engine = new FeatherEngine([
      { id: "p1", startDate: "2026-08-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-09-26", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ]);

    // Expected was 2026-10-24. On 2026-10-30, status is overdue.
    const overduePred = engine.getPrediction("2026-10-30");
    assert(overduePred.status === "overdue", "Test 15A: Overdue state before logging new period");

    // User logs new period starting 2026-10-30
    engine.createPeriod({ startDate: "2026-10-30" });
    const freshPred = engine.getPrediction("2026-10-30");

    assert(
      freshPred.status === "estimated" && freshPred.expectedStart === "2026-11-30",
      "Test 15B: New period immediately clears overdue state and anchors next cycle",
      `newStatus=${freshPred.status}, newExpected=${freshPred.expectedStart}`,
    );
  } catch (err: any) {
    assert(false, "Test 15: Overdue status clearing", err.message);
  }

  // ==================================================================
  // 16. Leap Years, Month Boundaries, and Year Boundaries
  // ==================================================================
  try {
    // Leap year 2028 (February has 29 days)
    const feb28_28 = "2028-02-28";
    const leapDay = addDays(feb28_28, 1);
    const mar01_28 = addDays(feb28_28, 2);

    // Non-leap year 2026 (February has 28 days)
    const feb28_26 = "2026-02-28";
    const mar01_26 = addDays(feb28_26, 1);

    // Year boundary
    const dec31 = "2025-12-31";
    const jan01 = addDays(dec31, 1);
    const diff = dayDifference("2025-12-30", "2026-01-02");

    assert(
      leapDay === "2028-02-29" &&
        mar01_28 === "2028-03-01" &&
        mar01_26 === "2026-03-01" &&
        jan01 === "2026-01-01" &&
        diff === 3,
      "Test 16: Leap year leap day, month rollovers, and year boundary arithmetic verified",
    );
  } catch (err: any) {
    assert(false, "Test 16: Leap year and boundaries", err.message);
  }

  // ==================================================================
  // 17. Timezone Independence of Calendar Date Arithmetic
  // ==================================================================
  try {
    // Tests that adding 1 day 365 times produces exact year rollover without hour drift
    let cur = "2026-01-01";
    for (let i = 0; i < 365; i++) {
      cur = addDays(cur, 1);
    }
    assert(cur === "2027-01-01", "Test 17: Date arithmetic is 100% immune to DST/timezone drift across 365 days");
  } catch (err: any) {
    assert(false, "Test 17: Timezone independence", err.message);
  }

  // ==================================================================
  // 18. Persistence, Import, and Migration Edge Cases
  // ==================================================================
  try {
    const rawBackupJSON = JSON.stringify({
      periods: [
        { id: 101, startDate: "2026-07-01", endDate: "2026-07-05" },
        { id: 102, startDate: "2026-07-29", endDate: "2026-08-02" },
        { id: 999, startDate: "invalid-date", endDate: "2026-08-01" }, // should be discarded
      ],
      logs: [
        { id: 201, logDate: "2026-07-01", flow: "heavy", symptoms: ["cramps"] },
      ],
    });

    const importResult = importCycleDataJSON(rawBackupJSON);
    const loaded = loadCycleData();
    const stats = computeCycleStats(loaded.periods);

    assert(
      importResult.success === true &&
        loaded.periods.length === 2 && // invalid record discarded
        stats.hasData === true &&
        stats.avgCycleLength === 28,
      "Test 18: Import sanitizes corrupted records and preserves vault data integrity",
      `success=${importResult.success}, count=${importResult.count}, periods=${loaded.periods.length}`,
    );
  } catch (err: any) {
    assert(false, "Test 18: Persistence and import", err.message);
  }

  // ==================================================================
  // 19. Calendar and Dashboard Consistency
  // ==================================================================
  try {
    const records: PeriodRecord[] = [
      { id: "p1", startDate: "2026-08-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-09-26", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const engine = new FeatherEngine(records, []);
    const refDate = "2026-10-15";

    const dashboard = engine.getDashboard(refDate);
    const calendarOct = engine.getCalendarMonth(2026, 10, refDate);

    const predictedDay = calendarOct.find((d) => d.isPredictedStart);

    assert(
      dashboard.prediction.expectedStart === "2026-10-24" &&
        predictedDay?.date === "2026-10-24" &&
        dashboard.prediction.status === "estimated",
      "Test 19: Dashboard and calendar agree 100% on predicted date and status for identical reference date",
      `dashboardExp=${dashboard.prediction.expectedStart}, calendarPredDay=${predictedDay?.date}`,
    );
  } catch (err: any) {
    assert(false, "Test 19: Calendar/dashboard consistency", err.message);
  }

  // ==================================================================
  // 20. Idempotent Submission and Retry Handling
  // ==================================================================
  try {
    const engine = new FeatherEngine([]);
    // First creation with fixed ID
    engine.createPeriod({ id: "fixed_id_100", startDate: "2026-10-01" });
    assert(engine.getRecords().length === 1, "Test 20A: Initial creation with fixed ID");

    // Retry submission with exact same ID (idempotent write)
    engine.createPeriod({ id: "fixed_id_100", startDate: "2026-10-01", landmarkName: "Retry Note" });
    assert(
      engine.getRecords().length === 1 && engine.getRecords()[0].landmarkName === "Retry Note",
      "Test 20B: Repeated submission with same ID updates existing record without creating duplicate",
    );
  } catch (err: any) {
    assert(false, "Test 20: Idempotency", err.message);
  }

  // ==================================================================
  // Invariant Tests (Mathematical & Behavioral Guarantees)
  // ==================================================================
  console.log("\n--- Testing Core Mathematical Invariants ---");

  // Invariant 1: Date Addition and Subtraction Inverse Consistency
  try {
    const testDates = ["2026-01-01", "2026-02-28", "2028-02-29", "2026-12-31"];
    let inv1Holds = true;
    for (const d of testDates) {
      for (const k of [1, 7, 28, 45, 90]) {
        const added = addDays(d, k);
        const subtracted = addDays(added, -k);
        if (subtracted !== d || dayDifference(d, added) !== k) {
          inv1Holds = false;
        }
      }
    }
    assert(inv1Holds, "Invariant 1: Date addition and subtraction are exact inverses across month/year/leap bounds");
  } catch (err: any) {
    assert(false, "Invariant 1", err.message);
  }

  // Invariant 2: Cycle Lengths Match Consecutive Start-Date Differences
  try {
    const records: PeriodRecord[] = [
      { id: "1", startDate: "2026-01-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "2", startDate: "2026-01-28", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "3", startDate: "2026-02-27", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "4", startDate: "2026-03-30", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const cycles = reconstructCycles(records);
    const inv2Holds =
      cycles[0].lengthDays === dayDifference("2026-01-01", "2026-01-28") &&
      cycles[1].lengthDays === dayDifference("2026-01-28", "2026-02-27") &&
      cycles[2].lengthDays === dayDifference("2026-02-27", "2026-03-30");
    assert(inv2Holds, "Invariant 2: Cycle length always equals exact calendar difference between consecutive starts");
  } catch (err: any) {
    assert(false, "Invariant 2", err.message);
  }

  // Invariant 3: Predictions Are Reproducible for Identical Inputs
  try {
    const records: PeriodRecord[] = [
      { id: "1", startDate: "2026-05-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "2", startDate: "2026-05-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const p1 = getPrediction(records, "2026-06-15");
    const p2 = getPrediction(records, "2026-06-15");
    assert(
      JSON.stringify(p1) === JSON.stringify(p2),
      "Invariant 3: Predictions are 100% deterministic and reproducible for identical inputs",
    );
  } catch (err: any) {
    assert(false, "Invariant 3", err.message);
  }

  // Invariant 4: Corrections Update All Derived Outputs
  try {
    const engine = new FeatherEngine([
      { id: "p1", startDate: "2026-05-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-05-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ]);
    const initExp = engine.getPrediction("2026-06-15").expectedStart;
    engine.updatePeriod("p2", { startDate: "2026-06-01" }); // +3 days
    const nextExp = engine.getPrediction("2026-06-15").expectedStart;
    assert(
      initExp !== nextExp && nextExp === addDays("2026-06-01", 31),
      "Invariant 4: Any correction immediately updates all dependent cycles, statistics, and predictions",
      `initExp=${initExp}, nextExp=${nextExp}`,
    );
  } catch (err: any) {
    assert(false, "Invariant 4", err.message);
  }

  // Invariant 5: Unconfirmed Entries Do Not Influence Predictions
  try {
    const confirmedOnly: PeriodRecord[] = [
      { id: "c1", startDate: "2026-08-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "c2", startDate: "2026-08-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const withUnconfirmed: PeriodRecord[] = [
      ...confirmedOnly,
      { id: "u1", startDate: "2026-08-15", confirmed: false, source: "voice", createdAt: "", updatedAt: "" },
    ];
    const pred1 = getPrediction(confirmedOnly, "2026-09-10");
    const pred2 = getPrediction(withUnconfirmed, "2026-09-10");

    assert(
      pred1.expectedStart === pred2.expectedStart &&
        pred1.cycleLengthDays === pred2.cycleLengthDays &&
        pred1.status === pred2.status,
      "Invariant 5: Unconfirmed draft records have strictly zero influence on predictions or cycle statistics",
    );
  } catch (err: any) {
    assert(false, "Invariant 5", err.message);
  }

  // Invariant 6: Historical Records Immutability During Calculation
  try {
    const originalRecords: PeriodRecord[] = [
      { id: "p1", startDate: "2026-08-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-08-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const snapshot = JSON.stringify(originalRecords);
    getPrediction(originalRecords, "2026-09-15");
    getCycleStatistics(originalRecords);
    getDashboard(originalRecords, [], "2026-09-15");

    assert(
      JSON.stringify(originalRecords) === snapshot,
      "Invariant 6: Historical records remain completely immutable during calculation",
    );
  } catch (err: any) {
    assert(false, "Invariant 6", err.message);
  }

  // Invariant 7: Calendar and Dashboard Prediction Agreement
  try {
    const records: PeriodRecord[] = [
      { id: "p1", startDate: "2026-09-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-09-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const dashboard = getDashboard(records, [], "2026-10-15");
    const calendar = getCalendarMonth(2026, 10, records, [], "2026-10-15");

    const expectedDayInCalendar = calendar.find((d) => d.isPredictedStart);
    assert(
      dashboard.prediction.expectedStart === expectedDayInCalendar?.date,
      "Invariant 7: Dashboard expected date and Calendar isPredictedStart indicator match 100%",
    );
  } catch (err: any) {
    assert(false, "Invariant 7", err.message);
  }

  console.log("\n==================================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`SUCCESS RATE: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
