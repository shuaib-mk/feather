/** Q1: data integrity + app lock. */
import { saveCycleData, loadCycleData, addOrUpdatePeriod, bulkSavePeriods } from "../../client/src/cycleStorage";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}

const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
function resetVault() { for (const k in store) delete store[k]; }

// --- Q1.1 unique IDs ---
{
  resetVault();
  const ids: number[] = [];
  for (let i = 0; i < 20; i++) {
    const d = "2026-01-" + String(i + 1).padStart(2, "0");
    ids.push(addOrUpdatePeriod({ startDate: d, endDate: d }).id);
  }
  const data = loadCycleData();
  check("Q1.1: 20 rapid periods stored", data.periods.length === 20, data.periods.length);
  check("Q1.1: all 20 ids unique", new Set(ids).size === 20, ids);
  check("Q1.1: ids stay numeric", ids.every((x) => typeof x === "number"), ids.slice(0, 3));
}

console.log("Q1 Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);

// --- Q1.2 diary bulk import: one atomic save with skipped reasons ---
{
  resetVault();
  saveCycleData({ periods: [{ id: 1, startDate: "2026-09-01", endDate: "2026-09-05" } as any], logs: [] });
  let vaultWrites = 0;
  const rawSet = (globalThis as any).localStorage.setItem;
  (globalThis as any).localStorage.setItem = (k: string, v: string) => { if (k === "feather_cycle_vault_v1") vaultWrites++; return rawSet(k, v); };
  const res = bulkSavePeriods([
    { startDate: "2026-10-02", endDate: null },
    { startDate: "not-a-date", endDate: null },
    { startDate: "2026-10-06", endDate: "2026-10-02" },
    { startDate: "2026-09-01", endDate: null },
    { startDate: "2026-09-03", endDate: "2026-09-10" },
    { startDate: "2026-10-09", endDate: null },
    { startDate: "2026-10-09", endDate: null },
  ]);
  (globalThis as any).localStorage.setItem = rawSet;
  check("Q1.2: 2 saved", res.saved === 2, res);
  check("Q1.2: 5 skipped with reasons", res.skipped.length === 5, res.skipped);
  const reasons = res.skipped.map((s) => s.reason).sort().join("|");
  check("Q1.2: reasons cover invalid/duplicate/overlap/end", reasons.indexOf("invalid date") !== -1 && reasons.indexOf("duplicate start date") !== -1 && reasons.indexOf("overlaps an existing period") !== -1 && reasons.indexOf("end date precedes start date") !== -1, reasons);
  check("Q1.2: single vault write", vaultWrites === 1, vaultWrites);
  const data = loadCycleData();
  check("Q1.2: existing period intact plus 2 new", data.periods.length === 3 && data.periods.some((p) => p.startDate === "2026-10-02") && data.periods.some((p) => p.startDate === "2026-10-09"), data.periods.map((p) => p.startDate));
  const empty = bulkSavePeriods([]);
  check("Q1.2: empty batch saves nothing", empty.saved === 0 && empty.skipped.length === 0, empty);
}
