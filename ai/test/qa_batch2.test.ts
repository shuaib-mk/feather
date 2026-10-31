/** Deep-audit batch 2 regression tests (Groups A-E). */
import { saveCycleData, loadCycleData, saveLogEntry, deletePeriodEntry, deleteDayLog, countDailyNotes, countEntryDates, effectivePeriodDurationDays } from "../../client/src/cycleStorage";
import { buildMonthDayStates } from "../../client/src/lib/calendarView";
import { buildDemoData } from "../../client/src/lib/demoMode";
import { parseLocally } from "../backend/agent";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail = "") { if (cond) { console.log(`[PASS] ${name}`); passed++; } else { console.error(`[FAIL] ${name} ${detail}`); failed++; } }
const log = (logDate: string, flow: any, kind?: any) => ({ logDate, flow, kind, symptoms: [], mood: null, energy: null, sleepHours: null, notes: null });
function reset() { saveCycleData({ periods: [], logs: [] }); }

// A1: Delete period removes the record entirely (period + its start-date log).
try {
  reset();
  saveLogEntry({ ...log("2026-10-26", "heavy"), kind: "period_started" });
  let d = loadCycleData();
  check("A1 setup: 1 period + 1 log", d.periods.length === 1 && d.logs.length === 1, JSON.stringify(d));
  deletePeriodEntry(d.periods[0].id);
  d = loadCycleData();
  check("A1 delete period removes record entirely", d.periods.length === 0 && d.logs.length === 0 && countEntryDates(d.periods, d.logs) === 0, JSON.stringify(d));
} catch (e: any) { check("A1", false, e.message); }

// A2: deleting a period day shrinks the derived (and stored) duration.
try {
  reset();
  saveLogEntry({ ...log("2026-10-30", "heavy"), kind: "period_started" });
  saveLogEntry(log("2026-10-31", "medium"));
  let d = loadCycleData();
  check("A2 setup duration 2", d.periods.length === 1 && effectivePeriodDurationDays(d.periods[0], d.periods, d.logs) === 2, JSON.stringify(d.periods));
  deleteDayLog("2026-10-31");
  d = loadCycleData();
  check("A2 duration recalculated to 1 after day deletion", d.periods.length === 1 && effectivePeriodDurationDays(d.periods[0], d.periods, d.logs) === 1 && d.periods[0].endDate === "2026-10-30", JSON.stringify(d.periods));
} catch (e: any) { check("A2", false, e.message); }

// A3: calendar never claims "period day logged" without a log; deletions show immediately.
try {
  const periods: any[] = [{ id: 1, startDate: "2026-10-30", endDate: "2026-10-31" }];
  const logs: any[] = [{ id: 1, logDate: "2026-10-30", flow: "heavy", symptoms: [], mood: null, energy: null, sleepHours: null, notes: null }];
  const m = buildMonthDayStates(2026, 10, periods, logs, [], "2026-10-30");
  const d31 = m.days.find((x) => x.date === "2026-10-31");
  check("A3 period span without log is not 'period day logged'", !!d31 && d31.bleeding === false && !d31.label.includes("period day logged"), d31?.label);
  const m2 = buildMonthDayStates(2026, 10, periods, [], [], "2026-10-30");
  check("A3 after deletion no bleeding claimed", m2.days.find((x) => x.date === "2026-10-30")?.bleeding === false);
} catch (e: any) { check("A3", false, e.message); }

// A4: Daily Notes = distinct entry dates - period starts (demo golden: 14 / 7 / 7).
try {
  const demo = buildDemoData("2026-10-30");
  check("A4 demo entry dates = 14", countEntryDates(demo.periods as any, demo.logs) === 14, String(countEntryDates(demo.periods as any, demo.logs)));
  check("A4 demo daily notes = 7 (not 14)", countDailyNotes(demo.periods as any, demo.logs) === 7, String(countDailyNotes(demo.periods as any, demo.logs)));
  check("A4 demo periods = 7", demo.periods.length === 7);
} catch (e: any) { check("A4", false, e.message); }


// B1: symptom note dated today, no invented flow, even when a recent entry exists.
try {
  const recent: any = { date: "2026-10-30", flow: "heavy", symptoms: ["cramps"], mood: null, energy: null, sleep: null, notes: null, kind: "period_started" };
  const r = parseLocally("cramps and headache today", "2026-10-31", { recentEntry: recent });
  check("B1 date is today, not the recent entry date", r.entry?.date === "2026-10-31", JSON.stringify(r.entry));
  check("B1 no invented flow", r.entry?.flow === null || r.entry?.flow === undefined, JSON.stringify(r.entry));
  check("B1 is a daily note, not merged into the old period", r.entry?.kind === "daily_log", r.entry?.kind);
} catch (e: any) { check("B1", false, e.message); }

// B3: no symptom/flow inheritance into fresh entries; period-start "today" is a period.
try {
  const recent: any = { date: "2026-10-30", flow: "heavy", symptoms: ["cramps", "headache"], mood: null, energy: null, sleep: null, notes: null, kind: "period_started" };
  const r = parseLocally("period started today, medium flow", "2026-10-31", { recentEntry: recent });
  check("B3 fresh period-start today is a period", r.entry?.kind === "period_started", JSON.stringify(r.entry));
  check("B3 no inherited symptoms", JSON.stringify(r.entry?.symptoms || []) === "[]", JSON.stringify(r.entry?.symptoms));
  check("B3 flow is the stated medium", r.entry?.flow === "medium", r.entry?.flow || "");
  const r2 = parseLocally("period started today, medium flow", "2026-10-31", {});
  check("B3 period-start today (clean context) is a period", r2.entry?.kind === "period_started" && r2.entry?.date === "2026-10-31", JSON.stringify(r2.entry));
} catch (e: any) { check("B3", false, e.message); }

// B3 guard: explicit corrections still edit the recent entry in place (batch-1 golden).
try {
  const recent: any = { date: "2026-10-27", flow: "heavy", symptoms: ["cramps"], mood: "Okay", energy: 3, sleep: 7, notes: null, kind: "period_started" };
  const r = parseLocally("actually it was light, not heavy", "2026-10-28", { recentEntry: recent });
  check("B3 explicit correction still applies", r.entry?.flow === "light" && r.entry?.date === "2026-10-27", JSON.stringify(r.entry));
} catch (e: any) { check("B3 correction", false, e.message); }

// B2: multi-fact sentence — start = 3 days ago, first-day flow, both events, unplaced named.
try {
  const r = parseLocally("my period started three days ago and the flow was medium on the first day but heavy yesterday with bad cramps and a headache and I also have an exam coming up on November 20 and a wedding to attend", "2026-10-31", {});
  check("B2 start date = 3 days ago (2026-10-28)", r.entry?.date === "2026-10-28", JSON.stringify(r.entry));
  check("B2 first-day flow = medium", r.entry?.flow === "medium", r.entry?.flow || "");
  const evs = (r as any).plannedEvents || [];
  check("B2 both events offered", evs.length === 2 && evs.some((e: any) => /exam/i.test(e.title)) && evs.some((e: any) => /wedding/i.test(e.title)), JSON.stringify(evs));
  check("B2 events dated 2026-11-20", evs.every((e: any) => e.date === "2026-11-20"), JSON.stringify(evs));
  check("B2 unplaced fact named, not dropped", /couldn't place/i.test(r.message) && r.message.includes("2026-10-30"), r.message);
} catch (e: any) { check("B2", false, e.message); }

console.log(`\nQABatch2 Results: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
