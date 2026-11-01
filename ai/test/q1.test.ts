/** Q1: data integrity + app lock. */
import { saveCycleData, loadCycleData, addOrUpdatePeriod } from "../../client/src/cycleStorage";

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
