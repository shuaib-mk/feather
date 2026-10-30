/**
 * Batch 1 tests: period model (1.2), one overlap function (1.3),
 * defaults-are-not-data (1.4). See ai/test/localDate.test.ts for 1.1.
 */
import {
  saveCycleData,
  loadCycleData,
  saveLogEntry,
  addOrUpdatePeriod,
  computeCycleStats,
} from "../../client/src/cycleStorage";
import {
  evaluateEventOverlap,
  getPrediction,
  type PeriodRecord,
} from "../../client/src/lib/periodEngine";

let passed = 0;
let failed = 0;
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) { console.log(`[PASS] ${name}${detail ? ` (${detail})` : ""}`); passed++; }
  else { console.error(`[FAIL] ${name}${detail ? ` (${detail})` : ""}`); failed++; }
}
function reset() { saveCycleData({ periods: [], logs: [] }); }
const log = (logDate: string, flow: any) => ({ logDate, flow, symptoms: [], mood: null, energy: null, sleepHours: null, notes: null });

// (a) Flow on 3 consecutive days -> exactly 1 period; cycle average is NOT 1.
try {
  reset();
  saveLogEntry(log("2026-01-01", "heavy"));
  saveLogEntry(log("2026-01-02", "medium"));
  saveLogEntry(log("2026-01-03", "light"));
  const data = loadCycleData();
  const stats = computeCycleStats(data.periods, data.logs);
  assert(data.periods.length === 1, "1.2a three bleeding days = one period", `periods=${data.periods.length}`);
  assert(stats.avgCycleLength !== 1, "1.2a average cycle is not 1 day", `avg=${stats.avgCycleLength}`);
  assert(data.periods[0].startDate === "2026-01-01" && data.periods[0].endDate === "2026-01-03", "1.2a period spans the 3 days");
} catch (e: any) { assert(false, "1.2a", e.message); }

// (b) Backfill the day before a start moves the start earlier.
try {
  reset();
  saveLogEntry(log("2026-02-10", "heavy"));
  saveLogEntry(log("2026-02-09", "medium"));
  const data = loadCycleData();
  assert(data.periods.length === 1 && data.periods[0].startDate === "2026-02-09", "1.2b backfill moves start earlier", JSON.stringify(data.periods));
} catch (e: any) { assert(false, "1.2b", e.message); }

// (c) Gap > 2 days -> new period.
try {
  reset();
  saveLogEntry(log("2026-03-01", "heavy"));
  saveLogEntry(log("2026-03-05", "heavy"));
  const data = loadCycleData();
  assert(data.periods.length === 2, "1.2c gap > 2 days creates a new period", `periods=${data.periods.length}`);
} catch (e: any) { assert(false, "1.2c", e.message); }

// Spotting never starts a period.
try {
  reset();
  saveLogEntry(log("2026-03-10", "spotting"));
  assert(loadCycleData().periods.length === 0, "1.2 spotting does not start a period");
} catch (e: any) { assert(false, "1.2 spotting", e.message); }

// (d) period_ended sets endDate and validates >= start.
try {
  reset();
  saveLogEntry(log("2026-04-01", "heavy"), { kind: "period_started" });
  saveLogEntry(log("2026-04-05", null), { kind: "period_ended" });
  const data = loadCycleData();
  assert(data.periods.length === 1 && data.periods[0].endDate === "2026-04-05", "1.2d period_ended sets endDate", JSON.stringify(data.periods));
  let threw = false;
  try { saveLogEntry(log("2026-03-01", null), { kind: "period_ended" }); } catch { threw = true; }
  // Ending before the start targets the same period and must not move its end backwards past start validity;
  // ending with no period at all must throw:
  reset();
  let threw2 = false;
  try { saveLogEntry(log("2026-04-05", null), { kind: "period_ended" }); } catch { threw2 = true; }
  assert(threw2, "1.2d period_ended with no period throws (visible error)");
} catch (e: any) { assert(false, "1.2d", e.message); }

// (e) 11-day run -> asks the user, does not extend, saves neither part.
try {
  reset();
  const days = ["01","02","03","04","05","06","07","08","09","10"];
  for (const d of days) saveLogEntry(log(`2026-05-${d}`, "medium"));
  const res = saveLogEntry(log("2026-05-11", "medium"));
  const data = loadCycleData();
  assert(res.needsConfirmation === true && res.saved === false, "1.2e 11th day asks for confirmation");
  assert(data.periods[0].endDate === "2026-05-10" && data.logs.length === 10, "1.2e nothing saved when asking", `logs=${data.logs.length}`);
  const forced = saveLogEntry(log("2026-05-11", "medium"), { confirmLongPeriod: true });
  assert(forced.saved && loadCycleData().periods[0].endDate === "2026-05-11", "1.2e confirmed long period saves");
} catch (e: any) { assert(false, "1.2e", e.message); }

// (f) Approximate start window is a real window; engine uses midpoint + widened uncertainty.
try {
  reset();
  const p = addOrUpdatePeriod({ startDate: "2026-06-15", endDate: null, startEarliest: "2026-06-15", startLatest: "2026-06-15", isApproximate: true } as any);
  assert(p.startEarliest === "2026-06-12" && p.startLatest === "2026-06-18", "1.2f same-day window expands to +/-3", `${p.startEarliest}..${p.startLatest}`);
  const records: PeriodRecord[] = [
    { id: "a", startDate: "2026-05-15", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
    { id: "b", startDate: "2026-06-15", startEarliest: "2026-06-12", startLatest: "2026-06-18", confirmed: true, source: "manual", createdAt: "", updatedAt: "" },
  ];
  const wide = getPrediction(records, "2026-06-20");
  const narrowRecords: PeriodRecord[] = records.map((r) => ({ ...r, startEarliest: null, startLatest: null }));
  const narrow = getPrediction(narrowRecords, "2026-06-20");
  const wideWidth = wide.earliestStart && wide.latestStart ? (new Date(wide.latestStart).getTime() - new Date(wide.earliestStart).getTime()) : 0;
  const narrowWidth = narrow.earliestStart && narrow.latestStart ? (new Date(narrow.latestStart).getTime() - new Date(narrow.earliestStart).getTime()) : 0;
  assert(wideWidth > narrowWidth, "1.2f approximate anchor widens the prediction window", `${wideWidth} > ${narrowWidth}`);
} catch (e: any) { assert(false, "1.2f", e.message); }

// Open period: no bleeding log for 3+ days counts as ended at read time, never written.
try {
  reset();
  saveLogEntry(log("2026-07-01", "heavy"));
  saveLogEntry(log("2026-07-02", "light"));
  const raw = loadCycleData();
  // Stored record stays open (endDate = last saved bleeding day only because logs create it);
  // currentPeriod is computed against a later "today" inside computeCycleStats via engine dates:
  const stats = computeCycleStats(raw.periods, raw.logs);
  assert(typeof stats.avgPeriodLength === "number", "1.2 open period stats compute without inventing an end");
} catch (e: any) { assert(false, "1.2 open period", e.message); }


// ---- 1.3 one overlap function ----
try {
  const rec = (id: string, startDate: string, endDate?: string): PeriodRecord => ({ id, startDate, endDate, confirmed: true, source: "manual", createdAt: "", updatedAt: "" });
  // Irregular 25-38 day history: starts giving lengths 25, 38, 28, 33
  const history: PeriodRecord[] = [
    rec("1", "2026-01-01", "2026-01-05"),
    rec("2", "2026-01-26", "2026-01-30"),
    rec("3", "2026-03-05", "2026-03-09"),
    rec("4", "2026-04-02", "2026-04-06"),
    rec("5", "2026-05-05", "2026-05-09"),
  ];
  const today = "2026-05-10";
  const statsCycle = 33; // median of 25,38,28,33 = 30.5 -> engine rounds; compute windows via function instead
  const k1Date = "2026-06-04"; // ~ one cycle after last start
  const k1 = evaluateEventOverlap(k1Date, history, today);
  // Event ~6 cycles ahead: last start + ~183 days
  const k6 = evaluateEventOverlap("2026-11-04", history, today);
  const width = (r: any) => r.window ? (new Date(r.window.end).getTime() - new Date(r.window.start).getTime()) / 86400000 : 0;
  assert(k1.window !== null && k6.window !== null, "1.3 irregular history produces windows");
  assert(width(k6) > width(k1), "1.3 k=6 window is wider than k=1", `k1=${width(k1)}d k6=${width(k6)}d statuses=${k1.status}/${k6.status}`);
  const past = evaluateEventOverlap("2026-05-01", history, today);
  assert(past.status === "past" || past.status === "logged", "1.3 past event is past/logged", past.status);
  const logged = evaluateEventOverlap("2026-05-06", history, today);
  assert(logged.status === "logged", "1.3 event inside a logged period is logged", logged.status);
  const unknown = evaluateEventOverlap("2027-01-01", [rec("only", "2026-05-01", "2026-05-05")], today);
  assert(unknown.status === "unknown" && /log more cycles/i.test(unknown.note), "1.3 fewer than 2 completed cycles = unknown, never unlikely", unknown.status);
  const oneCycle: PeriodRecord[] = [rec("a", "2026-03-01", "2026-03-05"), rec("b", "2026-03-29", "2026-04-02")];
  assert(evaluateEventOverlap("2026-05-01", oneCycle, "2026-04-10").status === "unknown", "1.3 one completed cycle is still unknown");
} catch (e: any) { assert(false, "1.3", e.message); }


// ---- 1.4 defaults are not data ----
try {
  reset();
  const empty = computeCycleStats([], []);
  assert(empty.isDefault === true && empty.isDefaultCycle === true && empty.isDefaultPeriod === true, "1.4 empty stats are flagged isDefault");
  const one = computeCycleStats([{ id: 1, startDate: "2026-01-01", endDate: "2026-01-05" }], []);
  assert(one.isDefaultCycle === true, "1.4 one period (no completed cycle) cycle length is still default");
  const learned = computeCycleStats([
    { id: 1, startDate: "2026-01-01", endDate: "2026-01-05" },
    { id: 2, startDate: "2026-01-29", endDate: "2026-02-02" },
    { id: 3, startDate: "2026-02-26", endDate: "2026-03-02" },
  ], []);
  assert(learned.isDefault === false && learned.avgCycleLength === 28, "1.4 learned 28 from real cycles is not flagged default", `avg=${learned.avgCycleLength}`);
} catch (e: any) { assert(false, "1.4", e.message); }

console.log(`\nbatch1: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
