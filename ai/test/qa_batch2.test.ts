/** Deep-audit batch 2 regression tests (Groups A-E). */
import { saveCycleData, loadCycleData, saveLogEntry, deletePeriodEntry, deleteDayLog, countDailyNotes, countEntryDates, effectivePeriodDurationDays } from "../../client/src/cycleStorage";
import { buildMonthDayStates } from "../../client/src/lib/calendarView";
import { buildDemoData } from "../../client/src/lib/demoMode";
import { computeCycleStats } from "../../client/src/cycleStorage";
import { toStatsView } from "../../client/src/lib/statsView";
import { getPrediction } from "../../client/src/lib/periodEngine";
import { toEngineRecords } from "../../client/src/lib/calendarView";
import { parseLocally } from "../backend/agent";
import { sendAgentMessage, MAX_PROMPT_CHARS } from "../frontend/aiClient";

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

// B2: multi-fact sentence — start = 3 days ago, first-day flow, dated event only (exam), unplaced wedding & yesterday named.
try {
  const r = parseLocally("my period started three days ago and the flow was medium on the first day but heavy yesterday with bad cramps and a headache and I also have an exam coming up on November 20 and a wedding to attend", "2026-10-31", {});
  check("B2 start date = 3 days ago (2026-10-28)", r.entry?.date === "2026-10-28", JSON.stringify(r.entry));
  check("B2 first-day flow = medium", r.entry?.flow === "medium", r.entry?.flow || "");
  check("B2 start day symptoms empty (not attached to wrong day)", (r.entry?.symptoms || []).length === 0, JSON.stringify(r.entry?.symptoms));
  const evs = (r as any).plannedEvents || [];
  check("B2 only dated event (clean title 'exam') offered", evs.length === 1 && evs[0].title === "exam" && evs[0].date === "2026-11-20", JSON.stringify(evs));
  check("B2 unplaced fact named, not dropped", /couldn't place/i.test(r.message) && r.message.includes("2026-10-30"), r.message);
  check("B2 unplaced wedding named", /couldn't place a date for:\s*wedding/i.test(r.message), r.message);
} catch (e: any) { check("B2", false, e.message); }


// C1: "my period is late" -> clarifying question, no entry.
try {
  const r = parseLocally("my period is late", "2026-10-31", {});
  check("C1 late period clarifies, no entry", !r.entry && r.needsClarification === true && /can't tell if your period is late/i.test(r.message) && /period started today/i.test(r.message), r.message);
} catch (e: any) { check("C1", false, e.message); }

// C2: gibberish -> visible message, nothing to save.
try {
  const r = parseLocally("asdfgh qwerty banana", "2026-10-31", {});
  check("C2 gibberish gets a visible message, no entry", !r.entry && /didn't catch anything I can log/i.test(r.message), r.message);
} catch (e: any) { check("C2", false, e.message); }

// C3: over-1,000-char input is flagged and never sent to the API.
try {
  let fetchCalls = 0;
  (globalThis as any).fetch = async () => { fetchCalls++; return { ok: true, json: async () => ({}) }; };
  const r = await sendAgentMessage("x".repeat(MAX_PROMPT_CHARS + 1), { currentDate: "2026-10-31" });
  check("C3 over-limit flagged, API not called", fetchCalls === 0 && /1,000 characters/i.test(r.message), `fetchCalls=${fetchCalls} msg=${r.message}`);
} catch (e: any) { check("C3", false, e.message); }


// D3: calendar predicted days are exactly the engine earliest..latest window.
try {
  const periods: any[] = ["2026-01-01", "2026-01-29", "2026-02-26", "2026-03-26"].map((s, i) => ({ id: i + 1, startDate: s, endDate: null }));
  const pred = getPrediction(toEngineRecords(periods) as any, "2026-03-30");
  const m = buildMonthDayStates(2026, 4, periods, [], [], "2026-03-30");
  const predicted = m.days.filter((d) => d.predicted).map((d) => d.date);
  check("D3 calendar window = engine earliest..latest", !!pred.earliestStart && predicted.length > 0 && predicted[0] === pred.earliestStart && predicted[predicted.length - 1] === pred.latestStart, JSON.stringify({ pred, predicted }));
} catch (e: any) { check("D3", false, e.message); }

// D5: implausibly short cycle is flagged; golden demo stats unchanged and unflagged.
try {
  const v = toStatsView({ allCycleLengths: [4, 30, 32], completedCycleCount: 3, medianCycleLength: 30, averageBleedingDuration: 5 } as any);
  check("D5 short cycle flagged at 4 days", v.shortCycleDays === 4, JSON.stringify(v));
  const demo = buildDemoData("2026-10-30");
  const stats = computeCycleStats(demo.periods as any, demo.logs);
  const dv = toStatsView(stats.statistics);
  check("D5 demo: range 26-38, avg bleeding 5, no short-cycle flag (stat formulas unchanged)", dv.min === 26 && dv.max === 38 && dv.averageBleedingDays === 5 && dv.shortCycleDays === null, JSON.stringify(dv));
} catch (e: any) { check("D5", false, e.message); }

console.log(`\nQABatch2 Results: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
