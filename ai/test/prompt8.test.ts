/** Prompt 8 Group A: offline landmark EVENTS resolve to next occurrence. */
import { parseLocally } from "../backend/agent";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail: any = "") { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, detail); failed++; } }
const TODAY = "2026-10-31";
const ctx: any = { currentDate: TODAY, periods: [{ startDate: "2026-09-30" }] };
const probes: Array<[string, string]> = [
  ["my exam is 2 days before Christmas", "2026-12-23"],
  ["party on New Year's Day", "2027-01-01"],
  ["my trip starts 3 days after New Year's Day", "2027-01-04"],
  ["dentist appointment on Diwali", "2026-11-08"],
];
for (const [text, date] of probes) {
  const r = parseLocally(text, TODAY, ctx);
  check("event date: " + text, (r.plannedEvents || []).some((e) => e.date === date), JSON.stringify(r.plannedEvents) + " | " + r.message);
  check("no log slip, no clarification: " + text, !r.entry && !r.needsClarification, r.message);
  check("overlap verdict present: " + text, Array.isArray(r.planOverlaps) && r.planOverlaps.length === 1, JSON.stringify(r.planOverlaps));
}
const log = parseLocally("my period started 2 days before Christmas", TODAY, ctx);
check("log-intent future landmark still clarifies", log.needsClarification === true && !log.entry && !(log.plannedEvents || []).length, log.message);
check("clarification mentions Christmas", /Christmas/.test(log.message), log.message);

// Group B (storage level): deleting a period day from Calendar uses the same
// deleteDayLog as Chronicle; duration is derived and shrinks 2d -> 1d.
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
const cs = await import("../../client/src/cycleStorage");
cs.saveCycleData({ periods: [{ id: 1, startDate: "2026-10-30", endDate: "2026-10-31" } as any], logs: [
  { logDate: "2026-10-30", flow: "heavy", kind: "period_started", symptoms: [], mood: null, energy: null, sleepHours: null, notes: "" } as any,
  { logDate: "2026-10-31", flow: "heavy", kind: "daily_log", symptoms: [], mood: null, energy: null, sleepHours: null, notes: "" } as any,
] });
check("duration 2d before delete", cs.effectivePeriodDurationDays(cs.loadCycleData().periods[0], cs.loadCycleData().periods, cs.loadCycleData().logs) === 2);
cs.deleteDayLog("2026-10-31");
const after = cs.loadCycleData();
check("day log deleted", !after.logs.some((l: any) => l.logDate === "2026-10-31"));
check("duration recalculates to 1d after delete", cs.effectivePeriodDurationDays(after.periods[0], after.periods, after.logs) === 1, JSON.stringify(after.periods));


// Group C1: position line for every event, computed against the verdict window.
const pi = await import("../../client/src/lib/planInsights");
const win = { start: "2026-11-25", end: "2026-12-07" };
check("position after window", pi.describeEventPosition("2026-12-12", win) === "This event is 5 days after the estimated window ends.", pi.describeEventPosition("2026-12-12", win));
check("position before window", pi.describeEventPosition("2026-11-23", win) === "This event is 2 days before the estimated window starts.", pi.describeEventPosition("2026-11-23", win));
check("position inside window", pi.describeEventPosition("2026-11-26", win).includes("near the start of the estimated window"), pi.describeEventPosition("2026-11-26", win));
check("no window -> no position line", pi.describeEventPosition("2026-12-12", null) === "");


// Group E1: late-period message is state-aware.
const lateWith = parseLocally("my period is late", TODAY, { periods: [{ startDate: "2026-09-30" }] } as any);
check("late with history references last start", lateWith.message.includes("Your last logged period started Sep 30") && lateWith.needsClarification && !lateWith.entry, lateWith.message);
const lateWithout = parseLocally("my period is late", TODAY, {} as any);
check("late without history keeps original wording", lateWithout.message.includes("without a logged start"), lateWithout.message);

console.log("Prompt8A Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
