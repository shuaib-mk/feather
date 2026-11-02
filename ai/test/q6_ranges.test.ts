/** Q6.7: a period with an end date colours every day from start to end. */
import { buildMonthDayStates } from "../../client/src/lib/calendarView";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
{
  const periods: any[] = [{ id: 1, startDate: "2026-10-02", endDate: "2026-10-06" }];
  const days = buildMonthDayStates(2026, 10, periods, [], [], "2026-10-01", "en-US").days;
  const span = ["2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"];
  check("Q6.7: all 5 period days bleed", span.every((d) => days.find((x) => x.date === d)?.bleeding === true), days.filter((d) => span.indexOf(d.date) !== -1).map((d) => d.date + "=" + d.bleeding).join(","));
  check("Q6.7: day before start unmarked", days.find((d) => d.date === "2026-10-01")?.bleeding !== true, "oct1");
  check("Q6.7: day after end unmarked", days.find((d) => d.date === "2026-10-07")?.bleeding !== true, "oct7");
}
{
  const periods: any[] = [{ id: 2, startDate: "2026-10-28", endDate: null }];
  const days = buildMonthDayStates(2026, 10, periods, [], [], "2026-10-28", "en-US").days;
  check("Q6.7: start-only period marks its day", days.find((d) => d.date === "2026-10-28")?.bleeding === true, "oct28");
  check("Q6.7: start-only period does not bleed onward", days.find((d) => d.date === "2026-10-29")?.bleeding !== true, "oct29");
}
console.log("Q6 Ranges Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
