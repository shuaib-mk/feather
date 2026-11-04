// Prompt 13 Group 16: import/export and storage nits.
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
import fs from "node:fs";
import { importCycleDataJSON, loadCycleData, lastVaultLoadProblem, exportCycleDataJSON, getLastExportTimestamp, getEntriesSinceExport, incrementEntriesSinceExport, recordExportTimestamp, todayStr, addDays } from "../../client/src/cycleStorage";
import { enterDemoMode, exitDemoMode } from "../../client/src/lib/demoMode";
import { parseICS } from "../../client/src/lib/ics";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const reset = () => { for (const k in store) delete store[k]; };
const today = todayStr();

// 16.1 import validation
reset();
const r = importCycleDataJSON(JSON.stringify({
  periods: [
    { startDate: "2026-08-01", endDate: "2026-08-05", startEarliest: "garbage", startLatest: "2026-08-03" },
    { startDate: addDays(today, 30) },
  ],
  logs: [
    { logDate: "2026-08-02", flow: "torrential", symptoms: [] },
    { logDate: "2026-08-03", flow: "heavy", symptoms: ["cramps", "made-up-symptom"], energy: 99, sleepHours: -4 },
    { logDate: addDays(today, 10), flow: "light" },
  ],
}));
const d = loadCycleData();
const log3 = d.logs.find((l) => l.logDate === "2026-08-03")!;
check("16.1: invalid flow value is rejected", r.skipped.some((s) => s.key === "2026-08-02" && /invalid flow/.test(s.reason)) && !d.logs.some((l) => l.logDate === "2026-08-02"), r.skipped);
check("16.1: unknown symptoms are dropped, known ones kept", JSON.stringify(log3.symptoms) === '["cramps"]', log3.symptoms);
check("16.1: energy clamped to 1-5 and sleep to 0-24", log3.energy === 5 && log3.sleepHours === 0, log3);
check("16.1: invalid uncertainty fields are not stored as dates", d.periods[0].startEarliest == null && d.periods[0].startLatest == null, d.periods[0]);
check("16.1: future-dated period and log are rejected with a reason", r.skipped.filter((s) => s.reason === "future-dated").length === 2, r.skipped);
check("16.1: the result reports what was skipped", r.success && r.skipped.length === 3, r);

// 16.2 corrupted vault
reset();
store["feather_cycle_vault_v1"] = "{not json";
const c1 = loadCycleData();
check("16.2: unparseable vault -> empty vault + visible notice", c1.periods.length === 0 && /could not be read/.test(lastVaultLoadProblem() || ""));
check("16.2: the unreadable data is left untouched (not overwritten)", store["feather_cycle_vault_v1"] === "{not json");
store["feather_cycle_vault_v1"] = JSON.stringify({ periods: [{ startDate: "2026-08-01" }, { nope: 1 }, null], logs: "oops" });
const c2 = loadCycleData();
check("16.2: bad rows are skipped, good rows kept, list logic never crashes", c2.periods.length === 1 && Array.isArray(c2.logs) && /damaged record/.test(lastVaultLoadProblem() || ""), c2);
store["feather_cycle_vault_v1"] = JSON.stringify({ periods: [], logs: [] });
loadCycleData();
check("16.2: a healthy vault clears the notice", lastVaultLoadProblem() === null);

// 16.3 period-start delete warning
const chron = fs.readFileSync("client/src/pages/ChroniclePage.tsx", "utf8");
const cal = fs.readFileSync("client/src/pages/CalendarPage.tsx", "utf8");
check("16.3: Chronicle warns 'This deletes the entire period starting <date>'", /This deletes the entire period starting \$\{prettyDate\(deleteTarget\.date\)\}/.test(chron));
check("16.3: Calendar warns before deleting a period-start day", /Delete the period starting \{prettyDate\(sel\.date\)\}\? This removes the whole period record\./.test(cal));

// 16.4 export does not reset counters until the download starts
reset();
incrementEntriesSinceExport(); incrementEntriesSinceExport();
exportCycleDataJSON();
check("16.4: generating the export alone resets nothing", getLastExportTimestamp() === null && getEntriesSinceExport() === 2);
recordExportTimestamp();
check("16.4: counters reset once the download is recorded", getLastExportTimestamp() !== null && getEntriesSinceExport() === 0);
const ctx = fs.readFileSync("client/src/context/CycleContext.tsx", "utf8");
check("16.4: the download handler records the export only after a.click()", /a\.click\(\);\s*recordExportTimestamp\(\);/.test(ctx));

// 16.5 exiting demo keeps the real vault's export keys
reset();
recordExportTimestamp(); incrementEntriesSinceExport();
const realTs = store["feather_last_export_ts"];
enterDemoMode("2026-11-04");
incrementEntriesSinceExport(); recordExportTimestamp();
exitDemoMode();
check("16.5: real export keys survive a demo session untouched", store["feather_last_export_ts"] === realTs && store["feather_entries_since_export"] === "1" && store["feather_demo_last_export_ts"] == null, store);

// 16.6 ICS weekly BYDAY
const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:w1", "SUMMARY:Class", "DTSTART;VALUE=DATE:20261102", "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
const parsed = parseICS(ics, "2026-10-01", "2027-01-31");
const dates = parsed.events.filter((e: any) => e.title === "Class").map((e: any) => e.date).sort();
check("16.6: WEEKLY;BYDAY=MO,WE,FR expands to every listed weekday", JSON.stringify(dates) === JSON.stringify(["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09", "2026-11-11", "2026-11-13"]), dates);
const ics2 = ics.replace("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6", "RRULE:FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO;COUNT=3");
check("16.6: unsupported BY* rules produce a per-rule warning", parseICS(ics2, "2026-10-01", "2027-01-31").warnings.some((w: string) => /BYSETPOS/.test(w)));

// 16.7 dead code
check("16.7: INITIAL_DATA removed", !/INITIAL_DATA/.test(fs.readFileSync("client/src/cycleStorage.ts", "utf8")));

console.log(`\nP13 Group 16: ${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
