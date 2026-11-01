/** Q5: fail-loud test runner. Runs every suite to completion (no early stop),
 * prints each suite result, and exits non-zero when anything fails. */
import { spawnSync } from "node:child_process";

const suites = [
  ["guardrail", ["npx", "tsx", "ai/test/guardrail.test.ts"]],
  ["date_resolution", ["npx", "tsx", "ai/test/date_resolution.test.ts"]],
  ["periodEngine", ["npx", "tsx", "ai/test/periodEngine.test.ts"]],
  ["localdate", ["npm", "run", "test:localdate"]],
  ["batch1", ["npx", "tsx", "ai/test/batch1.test.ts"]],
  ["batch2", ["npx", "tsx", "ai/test/batch2.test.ts"]],
  ["batch3", ["npx", "tsx", "ai/test/batch3.test.ts"]],
  ["batch4", ["npx", "tsx", "ai/test/batch4.test.ts"]],
  ["batch5", ["npx", "tsx", "ai/test/batch5.test.ts"]],
  ["batch6", ["npx", "tsx", "ai/test/batch6.test.ts"]],
  ["batch7", ["npx", "tsx", "ai/test/batch7.test.ts"]],
  ["batch8", ["npx", "tsx", "ai/test/batch8.test.ts"]],
  ["parser-fixes", ["npx", "tsx", "ai/test/parser-fixes.test.ts"]],
  ["transcribe", ["npx", "tsx", "ai/test/transcribe.test.ts"]],
  ["qa_bugs", ["npx", "tsx", "ai/test/qa_bugs.test.ts"]],
  ["qa_batch2", ["npx", "tsx", "ai/test/qa_batch2.test.ts"]],
  ["qa_batch2_followup", ["npx", "tsx", "ai/test/qa_batch2_followup.test.ts"]],
  ["prompt6_audit", ["npx", "tsx", "ai/test/prompt6_audit.test.ts"]],
  ["fact_coverage", ["npx", "tsx", "ai/test/fact_coverage.test.ts"]],
  ["plan_insights", ["npx", "tsx", "ai/test/plan_insights.test.ts"]],
  ["guardrail_v2", ["npx", "tsx", "ai/test/guardrail_v2.test.ts"]],
  ["prompt8", ["npx", "tsx", "ai/test/prompt8.test.ts"]],
  ["backfill", ["npx", "tsx", "ai/test/backfill.test.ts"]],
  ["q1", ["npx", "tsx", "ai/test/q1.test.ts"]],
  ["q2", ["npx", "tsx", "ai/test/q2.test.ts"]],
  ["q3", ["npx", "tsx", "ai/test/q3.test.ts"]],
  ["q4", ["npx", "tsx", "ai/test/q4.test.ts"]],
  ["q5_gate", ["npx", "tsx", "ai/test/q5_gate.test.ts"]],
  ["integration", ["npx", "tsx", "ai/test/integration.test.ts"]],
  ["render_smoke", ["npx", "tsx", "ai/test/render_smoke.test.tsx"]],
];

const failed = [];
for (const [name, cmd] of suites) {
  console.log("=== suite: " + name + " ===");
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) failed.push(name + " (exit " + r.status + ")");
  console.log("=== suite " + name + ": " + (r.status === 0 ? "PASS" : "FAIL") + " ===");
}
console.log("SUITES FAILED: " + (failed.length ? failed.join(", ") : "none"));
if (failed.length) {
  console.error("TEST CHAIN FAILED: " + failed.length + " suite(s) failed.");
  process.exit(1);
}
console.log("TEST CHAIN PASSED: all " + suites.length + " suites green.");
