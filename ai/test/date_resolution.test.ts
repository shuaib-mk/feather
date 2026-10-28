// Date resolution & Global Milestone Recall test suite
import { runLavenderAgent } from "../backend/agent";
import milestonesData from "../backend/milestones.json";

async function runTests() {
  console.log("=== Running Date Resolution & Global Landmark Recall Tests ===\n");
  let passed = 0;
  let failed = 0;

  // 1. Verify all 12 global milestones are present for 2025, 2026, and 2027
  const requiredMilestones = [
    "New Year's Day",
    "Valentine's Day",
    "International Women's Day",
    "Spring Equinox",
    "Earth Day",
    "Summer Solstice",
    "Midsummer Vacation Season",
    "Late Summer Getaway",
    "Autumn Equinox",
    "Global Marathon Season",
    "Winter Holiday Break",
    "New Year's Eve",
  ];

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
  const promptTwoDaysBeforeNY = "Two days before New Year's";
  const resNY = await runLavenderAgent(promptTwoDaysBeforeNY, { currentDate: "2026-10-28" });
  if (resNY.entry && resNY.entry.date === "2025-12-30" && resNY.entry.landmarkName?.includes("New Year")) {
    console.log(`[PASS] Landmark Recall "Two days before New Year's" resolved to most recent past occurrence: ${resNY.entry.date} (landmark=${resNY.entry.landmarkName})`);
    passed++;
  } else {
    console.error(`[FAIL] "Two days before New Year's" expected 2025-12-30, got ${resNY.entry?.date}`);
    failed++;
  }

  // 4. Test Landmark Recall for next year (2027) events
  const promptNextYear = "Planning a trip around Summer Solstice next year";
  const resNextYear = await runLavenderAgent(promptNextYear, { currentDate: "2026-10-28" });
  if (resNextYear.entry && resNextYear.entry.date === "2027-06-21") {
    console.log(`[PASS] Landmark Recall "Summer Solstice next year" resolved to 2027 occurrence: ${resNextYear.entry.date}`);
    passed++;
  } else {
    console.error(`[FAIL] "Summer Solstice next year" expected 2027-06-21, got ${resNextYear.entry?.date}`);
    failed++;
  }

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

  console.log(`\nDate Resolution Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
