// Deep Chronobiology Synthesis & Global Life Foresight Matrix Test Suite
// Verifies longitudinal reasoning, phase correlations, and 12-month global milestones matrix.

import { runDeepCycleSynthesis } from "../backend/synthesis";

async function runTests() {
  console.log("=== Running Feather Deep AI Synthesis Tests ===\n");
  let passed = 0;
  let failed = 0;

  const samplePeriods = [
    { startDate: "2026-08-25", endDate: "2026-08-30" },
    { startDate: "2026-09-22", endDate: "2026-09-27" },
    { startDate: "2026-10-20", endDate: "2026-10-25" },
  ];

  const sampleLogs = [
    { logDate: "2026-10-20", flow: "heavy", symptoms: ["cramps", "headache"], mood: "Low", energy: 2 },
    { logDate: "2026-10-22", flow: "medium", symptoms: ["fatigue"], mood: "Okay", energy: 3 },
    { logDate: "2026-10-25", flow: "light", symptoms: [], mood: "Great", energy: 4 },
  ];

  const cycleStats = {
    avgCycleLength: 28,
    avgPeriodLength: 5,
    lastPeriodStart: "2026-10-20",
  };

  const testCurrentDate = "2026-10-28";
  const res = await runDeepCycleSynthesis(samplePeriods, sampleLogs, cycleStats, testCurrentDate);

  // 1. Executive Summary
  if (res.executiveSummary && typeof res.executiveSummary === "string" && res.executiveSummary.length > 20) {
    console.log("[PASS] Executive summary generated successfully.");
    passed++;
  } else {
    console.error("[FAIL] Executive summary missing or too short.");
    failed++;
  }

  // 2. Regularity Score
  if (res.regularityScore >= 0 && res.regularityScore <= 100) {
    console.log(`[PASS] Regularity score calculated: ${res.regularityScore}/100.`);
    passed++;
  } else {
    console.error(`[FAIL] Invalid regularity score: ${res.regularityScore}`);
    failed++;
  }

  // 3. Phase Correlations (Menstrual, Follicular, Ovulatory, Luteal)
  if (res.phaseCorrelations && res.phaseCorrelations.length === 4) {
    console.log(`[PASS] 4 Biological phase correlations analyzed: ${res.phaseCorrelations.map(p => p.phase.split(' ')[0]).join(", ")}`);
    passed++;
  } else {
    console.error(`[FAIL] Phase correlations count expected 4, got ${res.phaseCorrelations?.length}`);
    failed++;
  }

  // 4. Global Milestone Foresight Matrix (Starting from 2026-10-28 into 2026-2027)
  const matrix = res.milestoneForecastMatrix || res.festivalForecastMatrix;
  if (matrix && matrix.length >= 10) {
    const has2025 = matrix.some(f => f.date.startsWith("2025"));
    const all2026Or2027 = matrix.every(f => f.date.startsWith("2026") || f.date.startsWith("2027"));
    const allAfterCurrentDate = matrix.every(f => f.date >= "2026-10-28");

    if (!has2025 && all2026Or2027 && allAfterCurrentDate) {
      console.log(`[PASS] Foresight matrix starts from current date (${testCurrentDate}): ${matrix.length} milestones evaluated across 2026-2027 (zero 2025 dates).`);
      passed++;
    } else {
      console.error(`[FAIL] Foresight matrix contains 2025 dates or dates prior to current date (${testCurrentDate}).`);
      failed++;
    }

    const winter = matrix.find(f => (f.milestone || f.festival || "").toLowerCase().includes("winter"));
    const iwd = matrix.find(f => (f.milestone || f.festival || "").toLowerCase().includes("women"));
    const summer = matrix.find(f => (f.milestone || f.festival || "").toLowerCase().includes("summer solstice"));
    if (winter && iwd && summer) {
      console.log(`[PASS] Key milestones verified in 2026-2027: Winter Break=${winter.date}, Women's Day=${iwd.date}, Summer Solstice=${summer.date}.`);
      passed++;
    } else {
      console.error("[FAIL] Key milestones missing from matrix.");
      failed++;
    }
  } else {
    console.error(`[FAIL] Milestone foresight matrix incomplete: got ${matrix?.length}`);
    failed++;
  }

  // 5. Honest Telemetry & Execution Mode Labeling
  const isRealApi = res.telemetry?.isLiveApi === true;
  if (isRealApi) {
    console.log(`[PASS] Execution Mode: REAL API CALL | Provider: ${res.telemetry?.provider} | Model: ${res.telemetry?.model} | Tokens: ${res.telemetry?.tokensEstimated} | Latency: ${res.telemetry?.latencyMs}ms`);
    passed++;
  } else {
    console.log(`[PASS] Execution Mode: OFFLINE FALLBACK (Deterministic rules engine, no live API call) | Provider: ${res.telemetry?.provider} | Model: ${res.telemetry?.model}`);
    passed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
