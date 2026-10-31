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

// ---- Phase 2: nearby clearer dates + compare two dates ----
import { suggestClearDates, formatClearDatesLine, formatClearDate } from "../../client/src/lib/planInsights";
import { toEngineRecords } from "../../client/src/lib/calendarView";
import { parseLocally, runLavenderAgent, isCompareIntent } from "../backend/agent";
// Regular 28-day history: starts Aug 4, Sep 1, Sep 29, Oct 27 2026 (3 completed cycles of 28).
const regularPeriods: any[] = ["2026-08-04", "2026-09-01", "2026-09-29", "2026-10-27"].map((startDate, i) => ({ id: 100 + i, startDate, endDate: null, isApproximate: false }));
const regularRecords = toEngineRecords(regularPeriods as any);
const regularLengths = [28, 28, 28];
const today2 = "2026-11-01";
check("clear dates: nearest unlikely around a likely Nov 24 event", JSON.stringify(suggestClearDates("2026-11-24", regularRecords, today2, regularLengths)) === JSON.stringify(["2026-11-18", "2026-11-19", "2026-11-20"]), JSON.stringify(suggestClearDates("2026-11-24", regularRecords, today2, regularLengths)));
check("clear dates: never past, never the event itself", suggestClearDates("2026-11-02", regularRecords, today2, regularLengths).every((d) => d >= today2 && d !== "2026-11-02"));
check("clear dates: trust not_enough -> none", suggestClearDates("2026-11-24", regularRecords, today2, [28, 30]).length === 0);
// Wide-window history (21/35 alternating): every date within +/-10 of Oct 23 is inside the window -> none.
const widePeriods: any[] = ["2026-06-05", "2026-06-26", "2026-07-31", "2026-08-21", "2026-09-25"].map((startDate, i) => ({ id: 200 + i, startDate, endDate: null, isApproximate: false }));
check("clear dates: none when whole +/-10 range overlaps window", suggestClearDates("2026-10-23", toEngineRecords(widePeriods as any), "2026-10-10", [21, 35, 21, 35]).length === 0, JSON.stringify(suggestClearDates("2026-10-23", toEngineRecords(widePeriods as any), "2026-10-10", [21, 35, 21, 35])));
check("clear date format is Sat Nov 14 style", formatClearDate("2026-11-14") === "Sat Nov 14", formatClearDate("2026-11-14"));
const clearLine = formatClearDatesLine(["2026-11-14", "2026-11-15"]);
check("clear line exact spec wording", clearLine === "Nearby dates that look clearer (estimate): Sat Nov 14, Sun Nov 15.", clearLine);
check("empty clear list -> empty line (shows nothing)", formatClearDatesLine([]) === "");
// Compare intent: offline parser, both verdicts + summary, nothing saved, guardrail-safe.
const ctx2: any = { periods: regularPeriods.map((p) => ({ startDate: p.startDate, endDate: null })), currentDate: today2 };
try {
  const r: any = parseLocally("which is safer, Nov 14 or Nov 21", today2, ctx2);
  check("compare: both verdicts shown", !!r.comparison && r.comparison.dates.length === 2 && r.message.includes("Nov 14") && r.message.includes("Nov 21"), r.message);
  check("compare: Nov 14 overlaps less (estimate)", r.comparison.summary === "Nov 14 overlaps less (estimate)", r.comparison.summary);
  check("compare: nothing saved (no entry, no events)", !r.entry && !(r.plannedEvents && r.plannedEvents.length), JSON.stringify(r.entry));
  check("compare: verdict wording frozen labels", r.message.includes("Unlikely to overlap (estimate)") && r.message.includes("Possible overlap"), r.message);
} catch (e: any) { check("compare offline", false, e.message); }
try {
  const r: any = parseLocally("compare Nov 14 and Nov 15", today2, ctx2);
  check("compare: similar dates -> Both look similar", !!r.comparison && r.comparison.summary === "Both look similar.", r.message);
} catch (e: any) { check("compare similar", false, e.message); }
try {
  const r: any = await runLavenderAgent("which is safer, Nov 14 or Nov 21", ctx2, []);
  check("compare: agent path returns comparison, nothing saved", !!r.comparison && !r.entry && r.message.includes("overlaps less (estimate)"), r.message);
} catch (e: any) { check("compare agent path", false, e.message); }
check("compare intent detected", isCompareIntent("which is safer, Nov 14 or Nov 21") && isCompareIntent("compare Nov 14 and Nov 21") && !isCompareIntent("period started today"));
check("'safer' about dates does NOT trigger medical guardrail", !checkMedicalAdviceGuardrail("which is safer, Nov 14 or Nov 21").isRefusal && !checkMedicalAdviceGuardrail("compare Nov 14 and Nov 21").isRefusal);
const phase2Texts = [clearLine, "Nov 14 overlaps less (estimate)", "Both look similar.", "Nov 14: Unlikely to overlap (estimate) - Nov 21: Possible overlap"];
check("phase2 text: no banned words", phase2Texts.every((t) => !/\b(should|expect|normal|irregular|abnormal|healthy|guaranteed)\b/i.test(t)), phase2Texts.join(" | "));
check("phase2 text: guardrail + escalation clean", phase2Texts.every((t) => !checkMedicalAdviceGuardrail(t).isRefusal && !checkSevereSymptomEscalation(t).isSevere), phase2Texts.join(" | "));
check("phase2 text: no symptom/flow words (Discreet-safe)", phase2Texts.every((t) => !/\b(cramps?|flow|symptoms?|bleeding|headache|fatigue)\b/i.test(t)), phase2Texts.join(" | "));
console.log("\nPlanInsights Results: " + passed + " passed, " + failed + " failed.");
if (failed) process.exit(1);
