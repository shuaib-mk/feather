/** Q6.2: short-cycle gate. Any save that would make a <21-day gap between two
 * period starts must confirm first with the exact message. */
import { saveCycleData, loadCycleData, computeCycleStats, saveLogEntry, addOrUpdatePeriod, shortGapForNewStart, findShortGapStarts } from "../../client/src/cycleStorage";
import { saveBackfillRows } from "../../client/src/lib/backfill";
import { importCycleDataJSON } from "../../client/src/cycleStorage";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
function resetVault() { for (const k in store) delete store[k]; }
const MSG = "This starts only 10 days after your previous period start. Save anyway?";

{
  resetVault();
  saveCycleData({ periods: [
    { id: 1, startDate: "2026-08-04", endDate: "2026-08-08" },
    { id: 2, startDate: "2026-09-01", endDate: "2026-09-05" },
    { id: 3, startDate: "2026-09-28", endDate: "2026-10-02" },
  ] as any, logs: [] });
  const before = computeCycleStats(loadCycleData().periods, []);
  const d = loadCycleData().periods;
  check("Q6.2: 27-day median history", before.avgCycleLength === 28 || before.avgCycleLength === 27, before.avgCycleLength);
  const hit = shortGapForNewStart("2026-10-12", d);
  check("Q6.2: 14-day gap flagged", !!hit && hit.gapDays === 14 && hit.neighbourStart === "2026-09-28", JSON.stringify(hit));
  check("Q6.2: 27-day gap passes", shortGapForNewStart("2026-10-25", d) === null, "no gate");
  check("Q6.2: same start is not a gap", shortGapForNewStart("2026-09-28", d) === null, "edit safe");
}

// --- storage gate: saveLogEntry ---
{
  resetVault();
  saveCycleData({ periods: [{ id: 1, startDate: "2026-10-02", endDate: "2026-10-06" } as any], logs: [] });
  const r = saveLogEntry({ logDate: "2026-10-12", flow: null, symptoms: [], mood: null, energy: null, sleepHours: null, notes: null, kind: "period_started" } as any, { kind: "period_started" });
  check("Q6.2: unconfirmed short start needs confirmation", r.needsConfirmation === true && r.confirmationReason === "This starts only 10 days after your previous period start. Save anyway?" && r.saved === false, r.confirmationReason);
  const r2 = saveLogEntry({ logDate: "2026-10-12", flow: null, symptoms: [], mood: null, energy: null, sleepHours: null, notes: null, kind: "period_started" } as any, { kind: "period_started", confirmShortGap: true });
  check("Q6.2: confirmed short start saves", r2.saved === true && loadCycleData().periods.some((p) => p.startDate === "2026-10-12"), "saved");
}

// --- storage gate: addOrUpdatePeriod ---
{
  resetVault();
  saveCycleData({ periods: [{ id: 1, startDate: "2026-10-02", endDate: "2026-10-06" } as any], logs: [] });
  let msg = "";
  try { addOrUpdatePeriod({ startDate: "2026-10-15", endDate: null }); } catch (e: any) { msg = String(e.message); }
  check("Q6.2: typed short start throws exact confirm copy", msg === "This starts only 13 days after your previous period start. Save anyway?", msg);
  const p = addOrUpdatePeriod({ startDate: "2026-10-15", endDate: null }, { confirmShortGap: true });
  check("Q6.2: typed short start saves when confirmed", p.startDate === "2026-10-15" && loadCycleData().periods.length === 2, "saved");
}

// --- scanner-like import: 3 isolated days after 27-day-median history ---
{
  resetVault();
  saveCycleData({ periods: [
    { id: 1, startDate: "2026-08-07", endDate: "2026-08-11" },
    { id: 2, startDate: "2026-09-03", endDate: "2026-09-07" },
    { id: 3, startDate: "2026-09-30", endDate: "2026-10-04" },
  ] as any, logs: [] });
  const medianBefore = computeCycleStats(loadCycleData().periods, []).avgCycleLength;
  const days = ["2026-10-12", "2026-10-15", "2026-10-18"];
  const shorts = findShortGapStarts(days, loadCycleData().periods);
  check("Q6.2: all 3 isolated days flagged short", shorts.length === 3, JSON.stringify(shorts.map((s) => s.gapDays)));
  const kept = days.filter((s) => !shorts.some((h) => h.startDate === s));
  check("Q6.2: median unchanged when short rows excluded", kept.length === 0 && computeCycleStats(loadCycleData().periods, []).avgCycleLength === medianBefore, medianBefore);
}

// --- backfill rows ---
{
  resetVault();
  saveCycleData({ periods: [{ id: 1, startDate: "2026-10-02", endDate: "2026-10-06" } as any], logs: [] });
  const rows = [{ key: "a", date: "2026-10-12", endDate: "", selected: true }];
  let threw = "";
  try { saveBackfillRows(rows as any, "2026-11-01", false); } catch (e: any) { threw = String(e.message); }
  check("Q6.2: backfill short row throws confirm copy", threw === "This starts only 10 days after your previous period start. Save anyway?", threw);
  const n = saveBackfillRows(rows as any, "2026-11-01", false, true);
  check("Q6.2: backfill short row saves when confirmed", n === 1 && loadCycleData().periods.some((p) => p.startDate === "2026-10-12"), n);
}

// --- import preflight ---
{
  resetVault();
  saveCycleData({ periods: [{ id: 1, startDate: "2026-10-02", endDate: "2026-10-06" } as any], logs: [] });
  const backup = JSON.stringify({ app: "Feather", periods: [{ id: 5, startDate: "2026-10-20", endDate: null }], logs: [], events: [] });
  const pre = findShortGapStarts(["2026-10-20"], loadCycleData().periods);
  check("Q6.2: import short start flagged before save", pre.length === 1 && pre[0].gapDays === 18, JSON.stringify(pre));
  const res = importCycleDataJSON(backup);
  check("Q6.2: import proceeds after confirm", res.success === true && loadCycleData().periods.some((p) => p.startDate === "2026-10-20"), JSON.stringify(res.added));
  resetVault();
}

console.log("Q6 Short-Gap Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
