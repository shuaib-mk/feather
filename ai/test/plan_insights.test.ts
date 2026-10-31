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

// ---- Phase 3: day position + past heavier-days pattern ----
import { dayPosition, flowPattern, formatEventPositionLine } from "../../client/src/lib/planInsights";
const win = { start: "2026-11-21", end: "2026-12-01" };
check("position: window start is near the start", dayPosition("2026-11-21", win)?.position === "near_start", JSON.stringify(dayPosition("2026-11-21", win)));
check("position: 2026-11-24 (fraction 0.3) near start", dayPosition("2026-11-24", win)?.position === "near_start");
check("position: 2026-11-26 (fraction 0.5) in the middle", dayPosition("2026-11-26", win)?.position === "middle" && dayPosition("2026-11-26", win)?.phrase === "in the middle of the estimated window");
check("position: window end is near the end", dayPosition("2026-12-01", win)?.position === "near_end");
check("position: before window -> null", dayPosition("2026-11-14", win) === null);
check("position: after window -> null", dayPosition("2026-12-05", win) === null);
check("position: no window -> null", dayPosition("2026-11-24", null) === null && dayPosition("2026-11-24", undefined) === null);
// Periods starting Jan 5, Feb 2, Mar 2, Mar 30 2026 -> first three are completed.
const fpPeriods: any[] = ["2026-01-05", "2026-02-02", "2026-03-02", "2026-03-30"].map((startDate) => ({ startDate }));
const fpLogs: any[] = [
  { logDate: "2026-01-05", flow: "heavy" }, { logDate: "2026-01-06", flow: "heavy" }, { logDate: "2026-01-07", flow: "medium" },
  { logDate: "2026-02-02", flow: "medium" }, { logDate: "2026-02-03", flow: "heavy" }, { logDate: "2026-02-04", flow: "heavy" },
  { logDate: "2026-03-02", flow: "heavy" }, { logDate: "2026-03-03", flow: "light" },
  { logDate: "2026-03-30", flow: "heavy" },
];
const pattern = flowPattern(fpPeriods, fpLogs);
check("flow pattern: modal heavier days are 1-2 over 3 completed periods", !!pattern && JSON.stringify(pattern.patternDays) === "[1,2]" && pattern.periodsUsed === 3, JSON.stringify(pattern));
check("flow pattern: exact past-tense sentence", pattern?.sentence === "In your past logs, heavier flow showed up around days 1-2.", pattern?.sentence);
check("flow pattern: fewer than 2 completed with flow -> null", flowPattern(fpPeriods.slice(0, 2), fpLogs) === null);
check("flow pattern: flow only in latest (open) period -> null", flowPattern(fpPeriods.slice(0, 3), [{ logDate: "2026-03-02", flow: "heavy" }]) === null);
check("flow pattern: spotting never counts as heaviest", flowPattern(fpPeriods, fpLogs.map((l) => ({ ...l, flow: "spotting" }))) === null);
const singleLogs: any[] = [
  { logDate: "2026-01-05", flow: "heavy" }, { logDate: "2026-01-06", flow: "medium" },
  { logDate: "2026-02-02", flow: "heavy" }, { logDate: "2026-03-02", flow: "heavy" },
];
check("flow pattern: single modal day wording", flowPattern(fpPeriods, singleLogs)?.sentence === "In your past logs, heavier flow showed up around day 1.", flowPattern(fpPeriods, singleLogs)?.sentence);
check("event line: near start + pattern -> combined sentence", formatEventPositionLine("2026-11-22", win, pattern) === "This event is near the start of the estimated window, where your past logs show heavier days (estimate).", formatEventPositionLine("2026-11-22", win, pattern));
check("event line: middle -> position only", formatEventPositionLine("2026-11-26", win, pattern) === "This event is in the middle of the estimated window.");
check("event line: near end -> position only", formatEventPositionLine("2026-12-01", win, pattern) === "This event is near the end of the estimated window.");
check("event line: near start without pattern -> position only", formatEventPositionLine("2026-11-22", win, null) === "This event is near the start of the estimated window.");
check("event line: outside window -> empty", formatEventPositionLine("2026-11-14", win, pattern) === "");
const phase3Texts = [
  "This event is near the start of the estimated window.",
  "This event is in the middle of the estimated window.",
  "This event is near the end of the estimated window.",
  "This event is near the start of the estimated window, where your past logs show heavier days (estimate).",
  pattern?.sentence || "",
];
check("phase3 text: no banned words", phase3Texts.every((x) => !/\b(should|expect|normal|irregular|abnormal|healthy|guaranteed)\b/i.test(x)), phase3Texts.join(" | "));
check("phase3 text: guardrail + escalation clean", phase3Texts.every((x) => !checkMedicalAdviceGuardrail(x).isRefusal && !checkSevereSymptomEscalation(x).isSevere), phase3Texts.join(" | "));
check("phase3 UI lines: no symptom/flow words (Discreet-safe)", phase3Texts.slice(0, 4).every((x) => !/\b(cramps?|flow|symptoms?|bleeding|headache|fatigue)\b/i.test(x)), phase3Texts.slice(0, 4).join(" | "));
check("phase3 pattern sentence is past-tense only", !!pattern && pattern.sentence.startsWith("In your past logs"), pattern?.sentence);


// ---- Phase 4: prediction back-test ----
import { backTest, BACKTEST_MIN_COMPARISONS } from "../../client/src/lib/planInsights";
const btStarts = ["2026-01-01", "2026-01-29", "2026-02-26", "2026-03-28", "2026-04-25", "2026-05-25", "2026-06-22"];
const btPeriods: any[] = btStarts.map((startDate) => ({ startDate }));
const bt = backTest(btPeriods);
check("back-test: min comparisons constant is 3", BACKTEST_MIN_COMPARISONS === 3);
check("back-test: targets run from the 4th period start onward", bt.comparisons.length === 4 && bt.comparisons[0].targetStart === "2026-03-28" && bt.comparisons[3].targetStart === "2026-06-22", JSON.stringify(bt.comparisons));
check("back-test: first prediction uses only earlier cycles (Feb 26 + 28d = Mar 26, off by 2)", bt.comparisons[0].predictedStart === "2026-03-26" && bt.comparisons[0].daysOff === 2, JSON.stringify(bt.comparisons[0]));
check("back-test: days off are 2, 0, 2, 0 with average 1.0", JSON.stringify(bt.comparisons.map((c) => c.daysOff)) === "[2,0,2,0]" && bt.averageDaysOff === 1, JSON.stringify(bt));
check("back-test: exact sentence", bt.sentence === "Back-tested on your own history: off by 2, 0, 2, 0 days (average 1.0).", bt.sentence);
check("back-test: unsorted input gives the same result", backTest([...btPeriods].reverse()).sentence === bt.sentence);
check("back-test: later periods never change an earlier comparison", backTest(btPeriods.slice(0, 5)).comparisons[0].predictedStart === "2026-03-26");
check("back-test: 5 starts -> only 2 comparisons -> not enough", backTest(btPeriods.slice(0, 5)).comparisons.length === 2 && backTest(btPeriods.slice(0, 5)).sentence === "Not enough history to check yet." && backTest(btPeriods.slice(0, 5)).averageDaysOff === null);
check("back-test: 3 starts -> no comparisons -> not enough", backTest(btPeriods.slice(0, 3)).comparisons.length === 0 && backTest(btPeriods.slice(0, 3)).sentence === "Not enough history to check yet.");
check("back-test: no data -> not enough, no throw", backTest([]).sentence === "Not enough history to check yet.");
const phase4Texts = [bt.sentence, "Not enough history to check yet.", "Prediction back-test"];
check("phase4 text: labelled back-test, never live accuracy", bt.sentence.startsWith("Back-tested on your own history") && !/live accuracy|accuracy/i.test(bt.sentence.replace("Back-tested", "")), bt.sentence);
check("phase4 text: no banned words", phase4Texts.every((x) => !/\b(should|expect|normal|irregular|abnormal|healthy|guaranteed)\b/i.test(x)), phase4Texts.join(" | "));
check("phase4 text: guardrail + escalation clean", phase4Texts.every((x) => !checkMedicalAdviceGuardrail(x).isRefusal && !checkSevereSymptomEscalation(x).isSevere), phase4Texts.join(" | "));
check("phase4 text: no symptom/flow words (Discreet-safe)", phase4Texts.every((x) => !/\b(cramps?|flow|symptoms?|bleeding|headache|fatigue)\b/i.test(x)), phase4Texts.join(" | "));


// ---- Phase 5: symptom echo ----
import { symptomEcho, formatSymptomEchoLine, SYMPTOM_ECHO_MIN_PERIODS, SYMPTOM_ECHO_MIN_RATIO } from "../../client/src/lib/planInsights";
// Starts Jan 5, Feb 2, Mar 2, Mar 30, Apr 27 2026 -> 4 completed periods.
const sePeriods: any[] = ["2026-01-05", "2026-02-02", "2026-03-02", "2026-03-30", "2026-04-27"].map((startDate) => ({ startDate }));
const seLogs: any[] = [
  { logDate: "2026-01-05", symptoms: ["cramps", "headache"] },
  { logDate: "2026-02-02", symptoms: ["cramps"] },
  { logDate: "2026-03-02", symptoms: ["cramps"] },
  { logDate: "2026-03-31", symptoms: ["headache"] },
];
const echo = symptomEcho(sePeriods, seLogs);
check("echo constants are 3 periods / 60 percent", SYMPTOM_ECHO_MIN_PERIODS === 3 && SYMPTOM_ECHO_MIN_RATIO === 0.6);
check("echo: cramps on day 1 in 3 of 4 completed periods, exact spec sentence", !!echo && echo.symptom === "cramps" && echo.hitPeriods === 3 && echo.totalPeriods === 4 && echo.sentence === "You've logged cramps near day 1 in 3 of your last 4 periods.", JSON.stringify(echo));
check("echo: 2 of 4 periods (50 percent) -> null", symptomEcho(sePeriods, seLogs.slice(0, 2)) === null);
check("echo: symptom on day 3 only -> null", symptomEcho(sePeriods, [{ logDate: "2026-01-07", symptoms: ["cramps"] }, { logDate: "2026-02-04", symptoms: ["cramps"] }, { logDate: "2026-03-04", symptoms: ["cramps"] }]) === null);
check("echo: symptom only in latest open period -> null", symptomEcho(sePeriods, [{ logDate: "2026-04-27", symptoms: ["cramps"] }]) === null);
check("echo: fewer than 3 completed periods -> null", symptomEcho(sePeriods.slice(0, 3), seLogs) === null);
// 7 starts -> 6 completed; cramps in 3 of 6 = 50 percent -> below 60 percent.
const se7: any[] = ["2026-01-05", "2026-02-02", "2026-03-02", "2026-03-30", "2026-04-27", "2026-05-25", "2026-06-22"].map((startDate) => ({ startDate }));
check("echo: 3 of 6 completed (50 percent) -> null", symptomEcho(se7, seLogs) === null);
const mixedEcho = symptomEcho(sePeriods, [
  { logDate: "2026-01-05", symptoms: ["cramps"] },
  { logDate: "2026-02-03", symptoms: ["cramps"] },
  { logDate: "2026-03-02", symptoms: ["cramps"] },
]);
check("echo: hits across days 1-2 read as days 1-2", mixedEcho?.sentence === "You've logged cramps near days 1-2 in 3 of your last 4 periods.", mixedEcho?.sentence);
const multiEcho = symptomEcho(sePeriods, [
  { logDate: "2026-01-05", symptoms: ["cramps", "headache"] },
  { logDate: "2026-02-02", symptoms: ["cramps", "headache"] },
  { logDate: "2026-03-02", symptoms: ["cramps", "headache"] },
  { logDate: "2026-03-30", symptoms: ["cramps"] },
]);
check("echo: several qualify -> most periods wins", multiEcho?.symptom === "cramps" && multiEcho?.hitPeriods === 4, JSON.stringify(multiEcho));
check("echo line: inside window shows the sentence", formatSymptomEchoLine("2026-11-26", win, echo) === echo?.sentence);
check("echo line: outside window shows nothing", formatSymptomEchoLine("2026-11-14", win, echo) === "");
check("echo line: no echo -> nothing", formatSymptomEchoLine("2026-11-26", win, null) === "");
check("echo line: no window -> nothing", formatSymptomEchoLine("2026-11-26", null, echo) === "");
// Guardrail bait: the template instantiated with common logged symptoms must never trip either guardrail.
const baitSentences = ["cramps", "headache", "backache", "fatigue", "bloating"].map((sym) => {
  const e = symptomEcho(sePeriods, [
    { logDate: "2026-01-05", symptoms: [sym] },
    { logDate: "2026-02-02", symptoms: [sym] },
    { logDate: "2026-03-03", symptoms: [sym] },
  ]);
  return e?.sentence || "";
});
check("echo bait: every symptom instantiates the template", baitSentences.every((x) => x.length > 0), baitSentences.join(" | "));
check("echo bait: no sentence triggers medical guardrail", baitSentences.every((x) => !checkMedicalAdviceGuardrail(x).isRefusal), baitSentences.join(" | "));
check("echo bait: no sentence triggers severe-symptom escalation", baitSentences.every((x) => !checkSevereSymptomEscalation(x).isSevere), baitSentences.join(" | "));
check("echo text: no banned or advice words", baitSentences.every((x) => !/\b(should|expect|normal|irregular|abnormal|healthy|guaranteed|take|try|remedy|treatment)\b/i.test(x)), baitSentences.join(" | "));
check("echo text: past/log wording only, no future claim", baitSentences.every((x) => x.startsWith("You've logged")), baitSentences.join(" | "));

console.log("\nPlanInsights Results: " + passed + " passed, " + failed + " failed.");
if (failed) process.exit(1);
