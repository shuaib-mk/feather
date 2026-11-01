/** Q4.8: every way data enters must reach every consumer. */
import { parseLocally } from "../backend/agent";
import { buildOwnEventsAnswer } from "../backend/eventAnswers";
import {
  saveCycleData, loadCycleData, saveLogEntry, addOrUpdatePeriod,
  importCycleDataJSON, exportCycleDataJSON, computeCycleStats,
} from "../../client/src/cycleStorage";
import { loadEvents, upsertEvent, saveEvents } from "../../client/src/lib/events";
import { enterDemoMode, exitDemoMode } from "../../client/src/lib/demoMode";
import { parseICS } from "../../client/src/lib/ics";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const TODAY = "2026-11-01";
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
function resetVault() { for (const k in store) delete store[k]; }
const PERIODS = [{ startDate: "2026-08-14" }, { startDate: "2026-09-09" }, { startDate: "2026-10-02" }];

function voiceSeesEvent(title: string, date: string, ctxExtra: any = {}): boolean {
  const r = buildOwnEventsAnswer("when is my " + title, { events: loadEvents(), periods: PERIODS, today: TODAY, ...ctxExtra });
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const want = months[parseInt(date.slice(5, 7), 10) - 1] + " " + parseInt(date.slice(8, 10), 10);
  return !!r && r.message.indexOf(title) !== -1 && r.message.indexOf(want) !== -1;
}
function planSeesEvent(date: string): boolean {
  const r = parseLocally("will my period clash with my exam on " + date, TODAY, { periods: PERIODS, currentDate: TODAY } as any);
  return !!r && Array.isArray((r as any).planOverlaps) && (r as any).planOverlaps.length === 1;
}
function calendarSees(title: string): boolean {
  return loadEvents().some((e) => e.title === title);
}
function exportSees(title: string): boolean {
  return exportCycleDataJSON().indexOf(title) !== -1;
}

// --- 1. manual event ---
{
  resetVault();
  upsertEvent({ title: "exam", date: "2026-11-20", source: "manual" });
  check("manual event: voice answers", voiceSeesEvent("exam", "2026-11-20"), "voice");
  check("manual event: plan overlaps", planSeesEvent("2026-11-20"), "plan");
  check("manual event: calendar lists", calendarSees("exam"), "calendar");
  check("manual event: export contains", exportSees("exam"), "export");
}

// --- 2. voice event (parsed slip saved to calendar) ---
{
  resetVault();
  const r = parseLocally("exam on Nov 20", TODAY, { periods: PERIODS, currentDate: TODAY } as any);
  const ev = (r as any).plannedEvents?.[0];
  check("voice event: slip parsed", !!ev && ev.title === "exam" && ev.date === "2026-11-20", JSON.stringify(ev));
  upsertEvent({ title: ev.title, date: ev.date, source: "voice" });
  check("voice event: voice answers", voiceSeesEvent("exam", "2026-11-20"), "voice");
  check("voice event: plan overlaps", planSeesEvent("2026-11-20"), "plan");
  check("voice event: calendar lists", calendarSees("exam"), "calendar");
  check("voice event: export contains", exportSees("exam"), "export");
}

// --- 3. ICS import ---
{
  resetVault();
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:ics-test-1", "DTSTART:20261122", "SUMMARY:flight", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const parsed = parseICS(ics, "2026-11-01", "2026-12-31");
  check("ics: parsed in window", parsed.events.length === 1 && parsed.events[0].date === "2026-11-22", JSON.stringify(parsed.events));
  saveEvents(parsed.events);
  check("ics event: voice answers", voiceSeesEvent("flight", "2026-11-22"), "voice");
  check("ics event: calendar lists", calendarSees("flight"), "calendar");
  check("ics event: export contains", exportSees("flight"), "export");
}

// --- 4. backup import ---
{
  resetVault();
  const res = importCycleDataJSON(JSON.stringify({
    app: "Feather", periods: [{ id: 11, startDate: "2026-10-02", endDate: "2026-10-06" }],
    logs: [{ id: 11, logDate: "2026-10-02", flow: "heavy", symptoms: ["cramps"], mood: null, energy: null, sleepHours: null, notes: null }],
    events: [{ id: "b1", title: "wedding", date: "2026-12-05", source: "manual" }],
  }));
  check("backup: import succeeds", res.success === true, JSON.stringify(res.added));
  const data = loadCycleData();
  check("backup: stats see period", computeCycleStats(data.periods, data.logs).lastPeriodStart === "2026-10-02", "stats");
  check("backup: voice sees log month", parseLocally("did I log anything in October", TODAY, { periods: data.periods, logs: data.logs, currentDate: TODAY } as any).message.indexOf("Oct 2") !== -1, "voice log");
  check("backup: voice sees event", voiceSeesEvent("wedding", "2026-12-05"), "voice event");
  check("backup: calendar lists event", calendarSees("wedding"), "calendar");
  check("backup: export contains all", exportSees("wedding") && exportSees("2026-10-02"), "export");
}

// --- 5. backfilled periods ---
{
  resetVault();
  const r = parseLocally("I had my period on October 2nd and September 9th", TODAY, {} as any);
  const entries = (r as any).entries || [];
  check("backfill: two entries prepared", entries.length === 2, entries.length);
  for (const e of entries) addOrUpdatePeriod({ startDate: e.date, endDate: e.endDate || e.date });
  const data = loadCycleData();
  check("backfill: stats see starts", computeCycleStats(data.periods, data.logs).lastPeriodStart === "2026-10-02", "stats");
  const overlap = parseLocally("will my period clash with my exam on Nov 20", TODAY, { periods: data.periods, currentDate: TODAY } as any);
  check("backfill: plan uses saved periods", Array.isArray(overlap.planOverlaps) && overlap.planOverlaps.length === 1, "plan");
  check("backfill: export contains starts", exportSees("2026-10-02") && exportSees("2026-09-09"), "export");
}

// --- 6. calendar day edit ---
{
  resetVault();
  const saved = saveLogEntry({ logDate: "2026-10-28", flow: "medium", kind: "daily_log", symptoms: ["headache"], mood: null, energy: null, sleepHours: null, notes: null });
  check("day edit: saved", !!saved && saved.saved !== false, "save");
  check("day edit: calendar data has it", loadCycleData().logs.some((l) => l.logDate === "2026-10-28"), "calendar");
  const data = loadCycleData();
  check("day edit: voice sees log month", parseLocally("did I log anything in October", TODAY, { periods: [], logs: data.logs, currentDate: TODAY } as any).message.indexOf("Oct 28") !== -1, "voice");
  check("day edit: export contains", exportSees("2026-10-28"), "export");
}

// --- 7. demo mode ---
{
  resetVault();
  enterDemoMode();
  const demoEvents = loadEvents();
  check("demo: events seeded", demoEvents.length >= 2, demoEvents.length);
  const r = buildOwnEventsAnswer("is there any exam coming", { today: TODAY });
  check("demo: voice answers without ctx events", !!r && /exam/i.test(r.message), r && r.message);
  const exported = exportCycleDataJSON();
  check("demo: export contains demo periods", exported.indexOf("2026") !== -1, "export");
  exitDemoMode();
  check("demo: exit clears demo namespace", loadEvents().length === 0, loadEvents().length);
  resetVault();
}

console.log("Integration Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
