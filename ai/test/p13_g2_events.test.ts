// Prompt 13 Group 2: one save = one event; stored duplicates heal on load.
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
import { loadEvents, upsertEvent, saveEvents, REAL_EVENTS_KEY, eventDedupeKey } from "../../client/src/lib/events";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const raw = () => JSON.parse(store[REAL_EVENTS_KEY] || "[]");

// Rapid triple save (double-click + retry + second component) -> one event
const a = upsertEvent({ title: "exam", date: "2026-11-20", source: "voice" });
const b = upsertEvent({ title: "exam", date: "2026-11-20", source: "voice" });
const c = upsertEvent({ title: "Exam", date: "2026-11-20", source: "manual" });
check("G2: save x3 rapid -> exactly 1 stored event", raw().length === 1, raw());
check("G2: repeat saves return the existing event (same id)", a.id === b.id && b.id === c.id, [a.id, b.id, c.id]);
check("G2: reload -> still 1", loadEvents().length === 1, loadEvents());

// Pre-seeded duplicates collapse on load, and the store itself is healed
store[REAL_EVENTS_KEY] = JSON.stringify([
  { id: "w1", title: "wedding", date: "2026-12-12", source: "voice" },
  { id: "w2", title: "wedding", date: "2026-12-12", source: "voice" },
  { id: "w3", title: "Wedding ", date: "2026-12-12", source: "manual" },
  { id: "x1", title: "exam", date: "2026-11-22", source: "voice" },
]);
const healed = loadEvents();
check("G2: stored duplicates collapse on load (4 -> 2)", healed.length === 2, healed);
check("G2: the healed list is written back before any later read", raw().length === 2, raw());
check("G2: first occurrence kept", healed.some((e) => e.id === "w1") && !healed.some((e) => e.id === "w2" || e.id === "w3"));

// Different details are NOT merged
store[REAL_EVENTS_KEY] = "[]";
upsertEvent({ title: "trip", date: "2026-12-20", source: "voice" });
upsertEvent({ title: "trip", date: "2026-12-20", endDate: "2026-12-24", source: "manual" });
check("G2: same title/date but different span stay separate", raw().length === 2, raw());
upsertEvent({ title: "Team sync", date: "2026-12-01", source: "ics", uid: "u-1" });
upsertEvent({ title: "Team sync", date: "2026-12-01", source: "ics", uid: "u-2" });
check("G2: ICS events with different uids stay separate", raw().filter((e: any) => e.title === "Team sync").length === 2, raw());
upsertEvent({ title: "exam", date: "2026-11-21", source: "voice" });
upsertEvent({ title: "exam", date: "2026-11-20", source: "voice" });
check("G2: same title on different dates stay separate", raw().filter((e: any) => e.title === "exam").length === 2, raw());

// Bulk writers (ICS import, backup restore) cannot write duplicates either
saveEvents([{ id: "d1", title: "dinner", date: "2026-11-03", source: "manual" }, { id: "d2", title: "dinner", date: "2026-11-03", source: "manual" }] as any);
check("G2: saveEvents never persists duplicates", raw().length === 1, raw());
check("G2: key normalises case, spacing and punctuation", eventDedupeKey({ title: "Anu's  Wedding!", date: "2026-11-20" }) === eventDedupeKey({ title: "anu s wedding", date: "2026-11-20" }));

// Updating an existing event by id still works
store[REAL_EVENTS_KEY] = "[]";
const ev = upsertEvent({ title: "flight", date: "2026-12-05", source: "manual" });
upsertEvent({ id: ev.id, title: "flight to Kochi", date: "2026-12-05", source: "manual" });
check("G2: update by id replaces in place", raw().length === 1 && raw()[0].title === "flight to Kochi", raw());

console.log(`\nP13 Group 2: ${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
