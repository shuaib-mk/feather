/** Phase 1 (Plan Around It): window-trust grading in client/src/lib/planInsights.ts. */
import { gradeWindowTrust, formatWindowTrustLine, TRUST_SPREAD_THRESHOLDS, TRUST_MIN_COMPLETED_CYCLES } from "../../client/src/lib/planInsights";
import { checkMedicalAdviceGuardrail, checkSevereSymptomEscalation } from "../backend/guardrail";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail = "") { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name + " " + detail); failed++; } }
check("thresholds constant is 4 / 8 days, min 3 cycles", TRUST_SPREAD_THRESHOLDS.highMaxSpreadDays === 4 && TRUST_SPREAD_THRESHOLDS.mediumMaxSpreadDays === 8 && TRUST_MIN_COMPLETED_CYCLES === 3);
for (const h of [[], [30], [28, 30]] as number[][]) {
  const t = gradeWindowTrust(h);
  check("not_enough for " + h.length + " completed cycles", t.level === "not_enough" && t.reason === "Not enough history yet. This is a rough window." && t.completedCycles === h.length, JSON.stringify(t));
}
check("spread 4 -> high", gradeWindowTrust([28, 30, 32]).level === "high" && gradeWindowTrust([28, 30, 32]).spreadDays === 4);
check("spread 5 -> medium", gradeWindowTrust([28, 30, 33]).level === "medium");
check("spread 8 -> medium", gradeWindowTrust([28, 30, 36]).level === "medium" && gradeWindowTrust([28, 30, 36]).spreadDays === 8);
check("spread 9 -> low", gradeWindowTrust([28, 30, 37]).level === "low");
const low = gradeWindowTrust([26, 30, 38]);
check("low reason uses real range 26-38", low.level === "low" && low.reason === "Your cycles ranged 26-38 days, so this window is wide.", low.reason);
const demoLengths = gradeWindowTrust([38, 26, 33, 29, 36, 28]);
check("demo-length history (6 completed) grades low, 26-38", demoLengths.level === "low" && demoLengths.completedCycles === 6 && demoLengths.reason.includes("26-38"), JSON.stringify(demoLengths));
const objs = gradeWindowTrust([{ lengthDays: 29 }, { lengthDays: 30 }, { lengthDays: 31 }, { lengthDays: null }]);
check("object history spread 2 -> high, ignores null", objs.level === "high" && objs.completedCycles === 3, JSON.stringify(objs));
check("line carries level + reason", formatWindowTrustLine(low).includes("Low") && formatWindowTrustLine(low).includes("26-38"));
check("not_enough line is exact spec text", formatWindowTrustLine(gradeWindowTrust([30])) === "Not enough history yet. This is a rough window.");
const texts = [gradeWindowTrust([]).reason, gradeWindowTrust([28, 30, 32]).reason, gradeWindowTrust([28, 30, 33]).reason, low.reason, formatWindowTrustLine(low), formatWindowTrustLine(gradeWindowTrust([29, 30, 31]))];
const banned = /\b(should|expect|normal|irregular|abnormal|healthy|safe|clear|guaranteed)\b/i;
check("no banned words in trust text", texts.every((t) => !banned.test(t)), texts.join(" | "));
check("no trust sentence triggers medical guardrail", texts.every((t) => !checkMedicalAdviceGuardrail(t).isRefusal), texts.join(" | "));
check("no trust sentence triggers severe-symptom escalation", texts.every((t) => !checkSevereSymptomEscalation(t).isSevere), texts.join(" | "));
check("no symptom/flow words (Discreet-safe)", texts.every((t) => !/\b(cramps?|flow|symptoms?|bleeding|headache|fatigue)\b/i.test(t)), texts.join(" | "));
console.log("\nPlanInsights Results: " + passed + " passed, " + failed + " failed.");
if (failed) process.exit(1);

