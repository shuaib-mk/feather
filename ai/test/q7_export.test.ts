/** Q7.6: reset paths clear export tracking; banner only with entries. */
import { saveCycleData, loadCycleData, exportCycleDataJSON, importCycleDataJSON, getLastExportTimestamp, getEntriesSinceExport, incrementEntriesSinceExport, isExportOverdue, recordExportTimestamp } from "../../client/src/cycleStorage";
import { purgeVaultStorage } from "../../client/src/context/CycleContext";
import { eraseLockAndStartFresh } from "../../client/src/lib/appLock";
import { exitDemoMode, enterDemoMode } from "../../client/src/lib/demoMode";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
(globalThis as any).window = undefined;
function seedExported() {
  for (const k in store) delete store[k];
  saveCycleData({ periods: [{ id: 1, startDate: "2026-10-02", endDate: "2026-10-06" } as any], logs: [] });
  recordExportTimestamp();
  incrementEntriesSinceExport(); incrementEntriesSinceExport();
}
seedExported();
check("Q7.6 setup: timestamp and counter set", getLastExportTimestamp() !== null && getEntriesSinceExport() === 2, getLastExportTimestamp() + "/" + getEntriesSinceExport());
check("Q7.6 STEP0: overdue false right after export", isExportOverdue(14) === false, String(isExportOverdue(14)));
check("Q7.6 STEP0: missing timestamp means overdue", (() => { delete store["feather_last_export_ts"]; return isExportOverdue(14); })() === true, "no-ts");
purgeVaultStorage(() => {});
check("Q7.6: purge clears export tracking", getLastExportTimestamp() === null && getEntriesSinceExport() === 0, getLastExportTimestamp() + "/" + getEntriesSinceExport());
seedExported();
eraseLockAndStartFresh();
check("Q7.6 STEP0: erase-lock clears export tracking", getLastExportTimestamp() === null && getEntriesSinceExport() === 0, getLastExportTimestamp() + "/" + getEntriesSinceExport());
seedExported();
enterDemoMode();
exitDemoMode();
// Prompt 13 Group 16.5 (owner-approved change): demo mode keeps its own export
// counters; exiting demo must NOT delete the real vault's export history.
check("Q7.6 STEP0: exit demo keeps the real vault's export tracking", getLastExportTimestamp() !== null && getEntriesSinceExport() === 2, getLastExportTimestamp() + "/" + getEntriesSinceExport());
for (const k in store) delete store[k];
saveCycleData({ periods: [{ id: 1, startDate: "2026-10-02", endDate: "2026-10-06" } as any], logs: [] });
const backup = exportCycleDataJSON();
saveCycleData({ periods: [], logs: [] });
incrementEntriesSinceExport();
const ir = importCycleDataJSON(backup);
if (!ir.success) throw new Error(ir.error);
check("Q7.6 STEP0: import clears export tracking", getLastExportTimestamp() === null && getEntriesSinceExport() === 0, getLastExportTimestamp() + "/" + getEntriesSinceExport());
import("node:fs").then((fs) => {
  const ctx = fs.readFileSync("client/src/context/CycleContext.tsx", "utf8");
  check("Q7.6: banner shows only when entries exist", ctx.indexOf("data.periods.length + data.logs.length") !== -1, "banner condition");
  console.log("Q7 Export Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
});
