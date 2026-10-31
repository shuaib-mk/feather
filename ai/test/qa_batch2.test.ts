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

console.log(`\nQABatch2 Results: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
