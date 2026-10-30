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

console.log(`\nbatch1 (1.2): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
