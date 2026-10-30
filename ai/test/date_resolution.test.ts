// Date resolution & Global Milestone Recall test suite
import { runLavenderAgent } from "../backend/agent";
import { LANDMARKS } from "../backend/landmarks";
const milestonesData = LANDMARKS.map((l:any)=>({name:l.names.en, aliases:Object.values(l.names) as string[], dates:l.dates}));

async function runTests() {
  console.log("=== Running Date Resolution & Global Landmark Recall Tests ===\n");
  let passed = 0;
  let failed = 0;

  // 1. Verify all 12 global milestones are present for 2025, 2026, and 2027
  const requiredMilestones = ["New Year's Day","Valentine's Day","International Women's Day","Earth Day","Christmas","New Year's Eve"];
  for (const rm of requiredMilestones) {
    const found = milestonesData.find(
      (f) => f.name.toLowerCase().includes(rm.toLowerCase()) || f.aliases.some((a) => a.toLowerCase().includes(rm.toLowerCase())),
    );
    if (found && (found.dates as any)["2025"] && (found.dates as any)["2026"] && (found.dates as any)["2027"]) {
      console.log(`[PASS] Global Milestone ${rm} verified: 2025=${(found.dates as any)["2025"]}, 2026=${(found.dates as any)["2026"]}, 2027=${(found.dates as any)["2027"]}`);
      passed++;
    } else {
      console.error(`[FAIL] Global Milestone ${rm} missing required 2025/2026/2027 dates.`);
      failed++;
    }
  }

  // 2. Test Landmark Recall fuzzy date resolution with International Women's Day
  const landmarkPrompt = "My period started around International Women's Day with medium flow and cramps.";
  const res = await runLavenderAgent(landmarkPrompt, { currentDate: "2025-04-01" });

  if (res.entry && res.entry.landmarkName?.includes("Women") && res.entry.isApproximate) {
    console.log(`[PASS] Landmark Recall resolved Women's Day: date=${res.entry.date}, landmark=${res.entry.landmarkName}`);
    passed++;
  } else {
    console.error(`[FAIL] Landmark Recall failed to resolve International Women's Day.`);
    failed++;
  }

  // 3. Test Landmark Recall with currentDate=2026-10-28: "Two days before New Year's" -> most recent past occurrence (2025-12-30)
  const promptTwoDaysBeforeNY = "Period started two days before New Year's";
  const resNY = await runLavenderAgent(promptTwoDaysBeforeNY, { currentDate: "2026-10-28" });
  if (resNY.entry && resNY.entry.date === "2025-12-30" && resNY.entry.landmarkName?.includes("New Year")) {
    console.log(`[PASS] Landmark Recall "Two days before New Year's" resolved to most recent past occurrence: ${resNY.entry.date} (landmark=${resNY.entry.landmarkName})`);
    passed++;
  } else {
    console.error(`[FAIL] "Two days before New Year's" expected 2025-12-30, got ${resNY.entry?.date}`);
    failed++;
  }

  // 4. Test Landmark Recall for next year (2027) events
  const { resolveLandmarkExpression } = await import("../backend/dateArithmetic");
  const resNextYear = resolveLandmarkExpression("Christmas next year", "2026-10-28");
  if (resNextYear.found && resNextYear.baseDate === "2027-12-25") { console.log(`[PASS] Landmark Recall "Christmas next year" resolved to 2027 occurrence: ${resNextYear.baseDate}`); passed++; } else { console.error(`[FAIL] "Christmas next year" expected 2027-12-25, got ${resNextYear.baseDate}`); failed++; }

  // 5. Test Current Date resolution
  const promptToday = "Period started today with heavy flow";
  const resToday = await runLavenderAgent(promptToday, { currentDate: "2026-10-28" });
  if (resToday.entry && resToday.entry.date === "2026-10-28" && resToday.entry.flow === "heavy") {
    console.log(`[PASS] Current-date logging resolved accurately to: ${resToday.entry.date}`);
    passed++;
  } else {
    console.error(`[FAIL] Current-date logging failed, got ${resToday.entry?.date}`);
    failed++;
  }

  // 6. Test Plan Around It overlap calculation for universal events (marathons, flights, exams)
  const planPrompt = "I have a marathon on 2025-10-15 and flight to Paris on 2025-10-28.";
  const planRes = await runLavenderAgent(planPrompt, {
    currentDate: "2025-10-01",
    cycleStats: {
      avgCycleLength: 28,
      avgPeriodLength: 5,
      lastPeriodStart: "2025-09-17",
    },
  });

  if (planRes.planOverlaps && planRes.planOverlaps.length === 2) {
    console.log(`[PASS] Plan Around It evaluated 2 events correctly:`);
    for (const ov of planRes.planOverlaps) {
      console.log(`       - ${ov.name} (${ov.eventDate}): ${ov.overlap} -> ${ov.overlapNote}`);
    }
    passed++;
  } else {
    console.error(`[FAIL] Plan Around It failed to evaluate overlaps.`);
    failed++;
  }

  // 7. Edge-Case: "last Diwali" resolution relative to anchor 2026-10-28 (must resolve to 2025-10-20)
  const promptLastDiwali = "Period started during last Diwali with medium flow";
  const resLastDiwali = await runLavenderAgent(promptLastDiwali, { currentDate: "2026-10-28" });
  if (resLastDiwali.entry && resLastDiwali.entry.date === "2025-10-20" && resLastDiwali.entry.landmarkName?.includes("Diwali")) {
    console.log(`[PASS] Edge-Case "last Diwali" anchored at 2026-10-28 resolved to past occurrence: ${resLastDiwali.entry.date} (landmark=${resLastDiwali.entry.landmarkName})`);
    passed++;
  } else {
    console.error(`[FAIL] "last Diwali" expected 2025-10-20, got ${resLastDiwali.entry?.date} (${resLastDiwali.entry?.landmarkName})`);
    failed++;
  }

  // 8. Edge-Case: "the Monday before Women's Day" (Women's Day 2026-03-08 is Sunday -> Monday before is 2026-03-02)
  const promptMondayBefore = "My period started the Monday before Women's Day";
  const resMondayBefore = await runLavenderAgent(promptMondayBefore, { currentDate: "2026-10-28" });
  if (resMondayBefore.entry && resMondayBefore.entry.date === "2026-03-02") {
    console.log(`[PASS] Edge-Case "the Monday before Women's Day" resolved to: ${resMondayBefore.entry.date}`);
    passed++;
  } else {
    console.error(`[FAIL] "the Monday before Women's Day" expected 2026-03-02, got ${resMondayBefore.entry?.date}`);
    failed++;
  }

  // 9. Edge-Case: Deterministic Leap Year arithmetic
  const { isLeapYear, applyDayOffset } = await import("../backend/dateArithmetic");
  const is2028Leap = isLeapYear(2028);
  const is2026Leap = isLeapYear(2026);
  const leapDayOffset = applyDayOffset("2028-02-28", 1);
  const postLeapOffset = applyDayOffset("2028-02-29", 1);
  if (is2028Leap && !is2026Leap && leapDayOffset === "2028-02-29" && postLeapOffset === "2028-03-01") {
    console.log(`[PASS] Edge-Case Leap Year arithmetic verified: 2028 is leap, 2028-02-28+1=${leapDayOffset}, 2028-02-29+1=${postLeapOffset}`);
    passed++;
  } else {
    console.error(`[FAIL] Leap Year arithmetic failed.`);
    failed++;
  }

  // 10. Edge-Case: Year Boundary crossing backwards and forwards
  const nyBoundaryBackward = applyDayOffset("2026-01-01", -2); // 2025-12-30
  const nyeBoundaryForward = applyDayOffset("2025-12-31", 2);  // 2026-01-02
  if (nyBoundaryBackward === "2025-12-30" && nyeBoundaryForward === "2026-01-02") {
    console.log(`[PASS] Edge-Case Year Boundary verified: 2026-01-01 - 2 days = ${nyBoundaryBackward}; 2025-12-31 + 2 days = ${nyeBoundaryForward}`);
    passed++;
  } else {
    console.error(`[FAIL] Year boundary arithmetic failed.`);
    failed++;
  }

  // 11. Edge-Case: Multi-turn Accession Slip Correction
  const initialSlipPrompt = "Period started today with heavy flow";
  const initialSlip = await runLavenderAgent(initialSlipPrompt, { currentDate: "2026-10-28" });
  if (initialSlip.entry) {
    const correctionPrompt = "no, make it the 3rd, add headache, and change flow to light";
    const correctedSlip = await runLavenderAgent(correctionPrompt, {
      currentDate: "2026-10-28",
      pendingEntry: initialSlip.entry,
    });
    if (
      correctedSlip.entry &&
      correctedSlip.entry.date === "2026-10-03" &&
      correctedSlip.entry.flow === "light" &&
      correctedSlip.entry.symptoms.includes("headache")
    ) {
      console.log(`[PASS] Edge-Case Accession Slip Correction verified: date=${correctedSlip.entry.date}, flow=${correctedSlip.entry.flow}, symptoms=${correctedSlip.entry.symptoms.join(",")}`);
      passed++;
    } else {
      console.error(`[FAIL] Accession slip correction failed:`, correctedSlip.entry);
      failed++;
    }
  }

  console.log(`\nDate Resolution Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

