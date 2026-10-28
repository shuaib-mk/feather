/**
 * Feather Period Engine — Acceptance Test Suite
 *
 * Verifies all 11 core domain invariants:
 * 1. No recorded period -> No fabricated personal prediction
 * 2. One recorded start -> Clearly provisional estimate
 * 3. Two completed cycles -> Historical cycle length available
 * 4. Irregular historical cycles -> Wider uncertainty and lower confidence
 * 5. Unknown period end -> Duration remains unknown
 * 6. Duplicate start date -> Validation error
 * 7. Invalid calendar date -> Rejected
 * 8. Corrected historical date -> All dependent statistics and estimates recalculate
 * 9. New period recorded -> New cycle begins; old overdue state disappears
 * 10. Date crosses month/year boundary -> Correct date arithmetic
 * 11. Offline mode -> Core calculations work without network access
 */

import {
  FeatherEngine,
  toDate,
  addDays,
  dayDifference,
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

async function runAcceptanceTests() {
  console.log("=== Running Feather Menstrual Domain Engine Acceptance Tests ===\n");
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

  // -------------------------------------------------------------
  // Scenario 1: No recorded period -> No fabricated personal prediction
  // -------------------------------------------------------------
  try {
    const emptyEngine = new FeatherEngine([], []);
    const pred = emptyEngine.getPrediction("2026-10-28");
    assert(
      pred.status === "no-data" &&
        pred.expectedStart === null &&
        pred.earliestStart === null &&
        pred.latestStart === null &&
        pred.confidence === "none" &&
        pred.cyclesUsed === 0,
      "Scenario 1: No recorded period -> No fabricated personal prediction",
      `status=${pred.status}, confidence=${pred.confidence}`,
    );
  } catch (err: any) {
    assert(false, "Scenario 1: No recorded period", err.message);
  }

  // -------------------------------------------------------------
  // Scenario 2: One recorded start -> Clearly provisional estimate
  // -------------------------------------------------------------
  try {
    const onePeriod: PeriodRecord[] = [
      {
        id: "p1",
        startDate: "2026-10-01",
        confirmed: true,
        source: "manual",
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ];
    const engine = new FeatherEngine(onePeriod, []);
    const predBefore = engine.getPrediction("2026-10-15");
    assert(
      predBefore.status === "provisional" &&
        predBefore.expectedStart === "2026-10-29" && // 2026-10-01 + 28
        predBefore.earliestStart === "2026-10-25" &&
        predBefore.latestStart === "2026-11-02" &&
        predBefore.confidence === "low" &&
        predBefore.cyclesUsed === 0,
      "Scenario 2A: One recorded start -> Clearly provisional estimate",
      `expected=${predBefore.expectedStart}, status=${predBefore.status}`,
    );

    // Overdue check
    const predOverdue = engine.getPrediction("2026-11-05");
    assert(
      predOverdue.status === "overdue" && predOverdue.confidence === "low",
      "Scenario 2B: One recorded start elapsed -> Overdue provisional",
      `status=${predOverdue.status}`,
    );
  } catch (err: any) {
    assert(false, "Scenario 2: One recorded start", err.message);
  }

  // -------------------------------------------------------------
  // Scenario 3: Two completed cycles -> Historical cycle length available
  // -------------------------------------------------------------
  try {
    // 3 starts = 2 completed cycles: Aug 1 to Aug 29 (28d), Aug 29 to Sep 26 (28d)
    const records: PeriodRecord[] = [
      { id: "p1", startDate: "2026-08-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-08-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p3", startDate: "2026-09-26", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const engine = new FeatherEngine(records, []);
    const stats = engine.getCycleStatistics();
    const pred = engine.getPrediction("2026-10-10");

    assert(
      stats.completedCycleCount === 2 &&
        stats.averageCycleLength === 28 &&
        stats.medianCycleLength === 28 &&
        pred.status === "estimated" &&
        pred.expectedStart === "2026-10-24" &&
        pred.cyclesUsed === 2 &&
        pred.confidence === "limited",
      "Scenario 3: Two completed cycles -> Historical length available",
      `completed=${stats.completedCycleCount}, expected=${pred.expectedStart}, confidence=${pred.confidence}`,
    );
  } catch (err: any) {
    assert(false, "Scenario 3: Two completed cycles", err.message);
  }

  // -------------------------------------------------------------
  // Scenario 4: Irregular historical cycles -> Wider uncertainty and lower confidence
  // -------------------------------------------------------------
  try {
    // Cycles: 24d, 35d, 22d, 36d (highly variable)
    const irregular: PeriodRecord[] = [
      { id: "p1", startDate: "2026-05-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-05-25", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // 24d
      { id: "p3", startDate: "2026-06-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // 35d
      { id: "p4", startDate: "2026-07-21", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // 22d
      { id: "p5", startDate: "2026-08-26", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // 36d
    ];
    const engine = new FeatherEngine(irregular, []);
    const stats = engine.getCycleStatistics();
    const pred = engine.getPrediction("2026-09-01");

    const margin = dayDifference(pred.expectedStart!, pred.latestStart!);
    assert(
      stats.shortestCycle === 22 &&
        stats.longestCycle === 36 &&
        margin >= 6 && // Wider uncertainty margin
        (pred.confidence === "limited" || pred.confidence === "low"),
      "Scenario 4: Irregular cycles -> Wider uncertainty window",
      `shortest=${stats.shortestCycle}, longest=${stats.longestCycle}, margin=±${margin} days, confidence=${pred.confidence}`,
    );
  } catch (err: any) {
    assert(false, "Scenario 4: Irregular historical cycles", err.message);
  }

  // -------------------------------------------------------------
  // Scenario 5: Unknown period end -> Duration remains unknown
  // -------------------------------------------------------------
  try {
    const unknownEndRecords: PeriodRecord[] = [
      { id: "p1", startDate: "2026-09-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // no endDate
      { id: "p2", startDate: "2026-09-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" }, // no endDate
    ];
    const engine = new FeatherEngine(unknownEndRecords, []);
    const stats = engine.getCycleStatistics();
    assert(
      stats.hasUnknownEndDates === true && stats.averageBleedingDuration === null,
      "Scenario 5: Unknown period end -> Duration remains unknown without fabrication",
      `hasUnknownEndDates=${stats.hasUnknownEndDates}, avgBleedingDuration=${stats.averageBleedingDuration}`,
    );
  } catch (err: any) {
    assert(false, "Scenario 5: Unknown period end", err.message);
  }

  // -------------------------------------------------------------
  // Scenario 6: Duplicate start date -> Validation error
  // -------------------------------------------------------------
  try {
    let duplicateRejected = false;
    try {
      validateRecords([
        { id: "p1", startDate: "2026-10-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
        { id: "p2", startDate: "2026-10-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      ]);
    } catch (e: any) {
      if (e.message.includes("Duplicate period start date")) {
        duplicateRejected = true;
      }
    }
    assert(duplicateRejected, "Scenario 6: Duplicate start date -> Validation error thrown");
  } catch (err: any) {
    assert(false, "Scenario 6: Duplicate start date", err.message);
  }

  // -------------------------------------------------------------
  // Scenario 7: Invalid calendar date -> Rejected
  // -------------------------------------------------------------
  try {
    let invalidFebRejected = false;
    let nonexistentMonthRejected = false;
    try {
      toDate("2026-02-31");
    } catch {
      invalidFebRejected = true;
    }
    try {
      toDate("2026-13-01");
    } catch {
      nonexistentMonthRejected = true;
    }
    assert(
      invalidFebRejected && nonexistentMonthRejected,
      "Scenario 7: Invalid calendar date -> Rejected strictly via UTC roundtrip",
    );
  } catch (err: any) {
    assert(false, "Scenario 7: Invalid calendar date", err.message);
  }

  // -------------------------------------------------------------
  // Scenario 8: Corrected historical date -> Dependent statistics & estimates recalculate
  // -------------------------------------------------------------
  try {
    const engine = new FeatherEngine([
      { id: "p1", startDate: "2026-08-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-08-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p3", startDate: "2026-09-26", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ]);

    const initialPred = engine.getPrediction("2026-10-01");
    assert(initialPred.expectedStart === "2026-10-24", "Scenario 8A: Initial prediction before correction");

    // Correct p2 date from Aug 29 to Aug 31 (+2 days)
    engine.updatePeriod("p2", { startDate: "2026-08-31" });
    const correctedStats = engine.getCycleStatistics();
    const correctedPred = engine.getPrediction("2026-10-01");

    // Cycles are now: 2026-08-01 to 2026-08-31 (30d), 2026-08-31 to 2026-09-26 (26d).
    // Median cycle length: (30 + 26) / 2 = 28d.
    assert(
      correctedStats.cycles[0].lengthDays === 30 &&
        correctedStats.cycles[1].lengthDays === 26 &&
        correctedPred.expectedStart === "2026-10-24",
      "Scenario 8B: Corrected date dynamically recomputes all cycles and projections",
      `cycle0=${correctedStats.cycles[0].lengthDays}d, cycle1=${correctedStats.cycles[1].lengthDays}d`,
    );
  } catch (err: any) {
    assert(false, "Scenario 8: Corrected historical date", err.message);
  }

  // -------------------------------------------------------------
  // Scenario 9: New period recorded -> New cycle begins; old overdue state disappears
  // -------------------------------------------------------------
  try {
    const engine = new FeatherEngine([
      { id: "p1", startDate: "2026-08-01", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-08-29", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ]);

    // Expected next was 2026-09-26. On 2026-10-02, it is overdue.
    const overduePred = engine.getPrediction("2026-10-02");
    assert(
      overduePred.status === "overdue" && overduePred.expectedStart === "2026-09-26",
      "Scenario 9A: Overdue state confirmed prior to logging new period",
      `status=${overduePred.status}`,
    );

    // Now user logs period on 2026-10-02
    engine.createPeriod({ startDate: "2026-10-02" });
    const freshPred = engine.getPrediction("2026-10-02");

    assert(
      freshPred.status === "estimated" &&
        freshPred.expectedStart === "2026-11-02", // 2026-10-02 + median(28, 34) = 31d
      "Scenario 9B: New period recorded -> New cycle begins and overdue status clears",
      `newStatus=${freshPred.status}, newExpected=${freshPred.expectedStart}`,
    );
  } catch (err: any) {
    assert(false, "Scenario 9: New period recorded", err.message);
  }

  // -------------------------------------------------------------
  // Scenario 10: Date crosses month/year boundary -> Correct date arithmetic
  // -------------------------------------------------------------
  try {
    // Leap year leap day arithmetic
    const feb28 = "2028-02-28";
    const leapDay = addDays(feb28, 1);
    const mar01 = addDays(leapDay, 1);
    assert(
      leapDay === "2028-02-29" && mar01 === "2028-03-01",
      "Scenario 10A: Leap year rollover verified",
      `2028-02-28 + 1 = ${leapDay}, + 1 = ${mar01}`,
    );

    // Year boundary rollover
    const dec30 = "2025-12-30";
    const jan02 = addDays(dec30, 3);
    const diff = dayDifference(dec30, jan02);
    assert(
      jan02 === "2026-01-02" && diff === 3,
      "Scenario 10B: Year boundary rollover verified",
      `2025-12-30 + 3 days = ${jan02}, diff = ${diff}`,
    );
  } catch (err: any) {
    assert(false, "Scenario 10: Date boundary arithmetic", err.message);
  }

  // -------------------------------------------------------------
  // Scenario 11: Offline mode -> Core calculations work without network access
  // -------------------------------------------------------------
  try {
    // Verify dashboard and calendar generation with zero network
    const records: PeriodRecord[] = [
      { id: "p1", startDate: "2026-09-01", endDate: "2026-09-06", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
      { id: "p2", startDate: "2026-09-29", endDate: "2026-10-04", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    ];
    const observations: DailyObservation[] = [
      { date: "2026-09-29", bleeding: true, flow: "heavy", symptoms: ["cramps"] },
      { date: "2026-10-05", bleeding: false, symptoms: ["bloating"] },
    ];

    const engine = new FeatherEngine(records, observations);
    const dashboard = engine.getDashboard("2026-10-15");
    const calendarOct = engine.getCalendarMonth(2026, 10);

    const oct5Status = calendarOct.find((d) => d.date === "2026-10-05");

    assert(
      dashboard.currentCycleDay === 17 && // 2026-09-29 to 2026-10-15 is day 17
        dashboard.isPeriodInProgress === false &&
        calendarOct.length === 31 &&
        oct5Status?.bleeding === false, // observation overrode span
      "Scenario 11: Offline mode -> Core calculations, daily status, and calendar operate purely in-memory",
      `cycleDay=${dashboard.currentCycleDay}, octDays=${calendarOct.length}, oct5Bleeding=${oct5Status?.bleeding}`,
    );
  } catch (err: any) {
    assert(false, "Scenario 11: Offline mode", err.message);
  }

  console.log("\n==========================================");
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`SUCCESS RATE: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log("==========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
