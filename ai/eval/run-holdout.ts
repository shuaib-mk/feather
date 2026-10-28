import { checkMedicalAdviceGuardrail } from "../backend/guardrail";
import { HOLDOUT_SAMPLES } from "./holdout.dataset";

console.log("=== RUNNING BLIND HOLDOUT EVALUATION (FIRST-RUN) ===");
let passed = 0;
let failed = 0;

const failures: Array<{ text: string; expected: boolean; actual: boolean; reason: string }> = [];

for (const sample of HOLDOUT_SAMPLES) {
  const result = checkMedicalAdviceGuardrail(sample.text);
  const isMatch = result.isRefusal === sample.expectedRefusal;

  if (isMatch) {
    passed++;
    console.log(`[PASS] [${sample.category.toUpperCase()}] "${sample.text}" -> refusal=${result.isRefusal}`);
  } else {
    failed++;
    console.log(`[FAIL] [${sample.category.toUpperCase()}] "${sample.text}" -> expected refusal=${sample.expectedRefusal}, got refusal=${result.isRefusal}`);
    failures.push({
      text: sample.text,
      expected: sample.expectedRefusal,
      actual: result.isRefusal,
      reason: (result as any).matchedCategory || "none",
    });
  }
}

console.log("\n==========================================");
console.log(`TOTAL: ${HOLDOUT_SAMPLES.length} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`ACCURACY: ${((passed / HOLDOUT_SAMPLES.length) * 100).toFixed(1)}%`);
console.log("==========================================");

if (failures.length > 0) {
  console.log("\nFAILURES BREAKDOWN:");
  for (const f of failures) {
    console.log(`- "${f.text}": expected refusal=${f.expected}, got=${f.actual} (rule: ${f.reason})`);
  }
}
