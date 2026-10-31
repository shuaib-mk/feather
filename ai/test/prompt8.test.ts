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
console.log("Prompt8A Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
