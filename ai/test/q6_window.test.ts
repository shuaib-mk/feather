/** Q6.5: one estimated window everywhere. Dashboard, Calendar shading, chat
 * answers and Plan Around It share the same window, dates and label. */
import { parseLocally, runLavenderAgent } from "../backend/agent";
import { getEstimatedWindow, getPrediction, evaluateEventOverlap, ESTIMATED_WINDOW_LABEL } from "../../client/src/lib/periodEngine";
import { addDaysToKey } from "../../client/src/lib/localDate";
import { computeCycleStats } from "../../client/src/cycleStorage";
import { buildMonthDayStates } from "../../client/src/lib/calendarView";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const TODAY = "2026-11-01";
const PERIODS = [
  { id: 1, startDate: "2026-09-04", endDate: "2026-09-08" },
  { id: 2, startDate: "2026-09-28", endDate: "2026-10-02" },
  { id: 3, startDate: "2026-10-22", endDate: "2026-10-26" },
] as any;
const RECS = PERIODS.map((p: any, i: number) => ({ id: "r" + i, startDate: p.startDate, endDate: p.endDate, confirmed: true, source: "manual" as const, createdAt: "", updatedAt: "" }));

async function main() {
  const w = getEstimatedWindow(RECS, TODAY);
  check("Q6.5: one function returns the window with the label", !!w && w.label === "estimated window" && w.start <= w.end, JSON.stringify(w));
  check("Q6.5: label constant", ESTIMATED_WINDOW_LABEL === "estimated window", ESTIMATED_WINDOW_LABEL);

  const stats = computeCycleStats(PERIODS, []);
  check("Q6.5: dashboard matches the shared window", stats.earliestNextDate === w!.start && stats.latestNextDate === w!.end, stats.earliestNextDate + ".." + stats.latestNextDate);
  check("Q6.5: most-likely day lies inside the window", !!stats.nextPeriodDate && stats.nextPeriodDate >= w!.start && stats.nextPeriodDate <= w!.end, stats.nextPeriodDate);

  const cal = buildMonthDayStates(2026, 11, PERIODS, [], [], TODAY, "en-US");
  const shaded = cal.days.filter((d) => d.predicted).map((d) => d.date).sort();
  const inMonth: string[] = [];
  for (let d = w!.start; d <= w!.end; d = addDaysToKey(d, 1)) if (d.slice(0, 7) === "2026-11" && d >= TODAY) inMonth.push(d);
  check("Q6.5: calendar shading matches the shared window", JSON.stringify(shaded) === JSON.stringify(inMonth.filter((d) => d <= w!.end && d >= TODAY)), JSON.stringify(shaded));

  const chat = parseLocally("when is my next period", TODAY, { periods: PERIODS.map((p: any) => ({ startDate: p.startDate })), cycleStats: { lastPeriodStart: "2026-10-22", nextPeriodEarliest: w!.start, nextPeriodLatest: w!.end }, currentDate: TODAY } as any);
  check("Q6.5: chat quotes the shared window with its label", chat.message.indexOf("estimated window") !== -1 && chat.message.indexOf(w!.start) === -1 && chat.message.indexOf("Nov") !== -1, chat.message);

  const ov = evaluateEventOverlap(w!.start, RECS, TODAY);
  const pred = getPrediction(RECS, TODAY);
  check("Q6.5: clash answers anchor to the shared window", ov.expectedStart === pred.expectedStart && /Likely|Possible|Unlikely|Logged|unknown|Not enough/i.test(ov.note), ov.note);

  const rem = parseLocally("remind me before my next period", TODAY, { periods: PERIODS, currentDate: TODAY } as any);
  check("Q6.5: reminder answer is fixed and quotes no window", rem.message === "I can't set reminders yet; you can export the calendar (.ics) from Settings." && rem.entry === null, rem.message);
  const liveRem: any = await runLavenderAgent("remind me before my next period", { currentDate: TODAY, periods: PERIODS } as any);
  check("Q6.5: reminder answer fixed on the live path", liveRem.message === "I can't set reminders yet; you can export the calendar (.ics) from Settings." && !liveRem.entry, liveRem.message);
}
main().then(() => {
  console.log("Q6 Window Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
});
