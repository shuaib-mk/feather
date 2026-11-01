/** Backfill tests: several past periods in one message. */
import { parseLocally, runLavenderAgent } from "../backend/agent";
import { saveLogEntry, loadCycleData, saveCycleData, computeCycleStats } from "../../client/src/cycleStorage";
import {
  backfillRowsFromEntries,
  validateBackfillRows,
  backfillRowWarnings,
  backfillGapDays,
  backfillDurationDays,
  saveBackfillRows,
} from "../../client/src/lib/backfill";
import { evaluateEventOverlap, type PeriodRecord } from "../../client/src/lib/periodEngine";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}

const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
function resetVault() { for (const k in store) delete store[k]; }

const TODAY = "2026-11-01";

// --- 1. two periods in one message ---
{
  const r = parseLocally("I had my period on October 2nd and September 9th", TODAY, {} as any);
  check("two periods: 2 entries", !!r.entries && r.entries.length === 2, r.entries);
  check("two periods: oldest first", !!r.entries && r.entries[0].date === "2026-09-09" && r.entries[1].date === "2026-10-02", r.entries);
  check("two periods: entry is entries[0]", !!r.entries && r.entry === r.entries[0], r.entry);
  check("two periods: kind period_started", !!r.entries && r.entries.every((e) => e.kind === "period_started"), r.entries);
  check("two periods: no clarification", r.needsClarification === false, r.message);
}

// --- 2. three periods, comma and and separators ---
{
  const r = parseLocally("my last periods started October 2nd, September 9th and August 14th", TODAY, {} as any);
  check("three periods: 3 entries", !!r.entries && r.entries.length === 3, r.entries);
  check("three periods: sorted oldest first", !!r.entries && r.entries.map((e) => e.date).join(",") === "2026-08-14,2026-09-09,2026-10-02", r.entries);
}

// --- 3. range from X to Y is one entry with endDate ---
{
  const r = parseLocally("my period was from October 2 to October 6", TODAY, {} as any);
  check("range: 1 entry", !!r.entries && r.entries.length === 1, r.entries);
  check("range: start and endDate", !!r.entries && r.entries[0].date === "2026-10-02" && r.entries[0].endDate === "2026-10-06", r.entries);
}

// --- 4. started X and ended Y ---
{
  const r = parseLocally("period started Sept 9 and ended Sept 13", TODAY, {} as any);
  check("started-ended: 1 entry with endDate", !!r.entries && r.entries.length === 1 && r.entries[0].date === "2026-09-09" && r.entries[0].endDate === "2026-09-13", r.entries);
}

// --- 5. day-first order ---
{
  const r = parseLocally("I had periods on 2nd October, 9th September", TODAY, {} as any);
  check("day-first: 2 entries sorted", !!r.entries && r.entries.map((e) => e.date).join(",") === "2026-09-09,2026-10-02", r.entries);
}

// --- 6. relative lists ---
{
  const r = parseLocally("periods started 3 weeks ago and 7 weeks ago", TODAY, {} as any);
  check("relative: 2 entries", !!r.entries && r.entries.length === 2, r.entries);
  check("relative: 3 weeks = Oct 11, 7 weeks = Sep 13", !!r.entries && r.entries[0].date === "2026-09-13" && r.entries[1].date === "2026-10-11", r.entries);
}

// --- 7. bare month asks ---
{
  const r = parseLocally("I had my period in September", TODAY, {} as any);
  check("bare month: asks which day", r.needsClarification === true && /Which day in September/.test(r.message || ""), r.message);
  check("bare month: no entries", !!r.entries && r.entries.length === 0 && r.entry === null, r.entries);
}

// --- 8. future date dropped with warning ---
{
  const r = parseLocally("my periods started October 2nd and October 2nd 2027", TODAY, {} as any);
  check("future: past date kept", !!r.entries && r.entries.length === 1 && r.entries[0].date === "2026-10-02", r.entries);
  check("future: warning names it", /left it out/.test(r.message || ""), r.message);
}

// --- 9. thirteen dates capped at twelve ---
{
  const r = parseLocally("my periods started October 2nd, September 9th, August 14th, July 20th, June 15th, May 10th, April 12th, March 8th, February 9th, January 5th, December 1st, November 3rd and October 6th", TODAY, {} as any);
  check("cap: 12 entries", !!r.entries && r.entries.length === 12, r.entries && r.entries.length);
  check("cap: oldest dropped, most recent kept", !!r.entries && r.entries[0].date === "2025-12-01" && r.entries[11].date === "2026-10-06", r.entries && r.entries.map((e) => e.date));
  check("cap: warning shown", /most recent/.test(r.message || ""), r.message);
}

// --- 10. duplicates removed ---
{
  const r = parseLocally("my periods started October 2nd, September 9th and October 2nd", TODAY, {} as any);
  check("dupes: 2 unique entries", !!r.entries && r.entries.length === 2, r.entries);
  check("dupes: warning shown", /counted it once/.test(r.message || ""), r.message);
  const twin = parseLocally("my periods started October 2nd and October 2nd", TODAY, {} as any);
  check("twins: one entry plus dupe warning", !!twin.entries && twin.entries.length === 1 && twin.entries[0].date === "2026-10-02" && /counted it once/.test(twin.message || ""), twin.message);
}

// --- 11. bare December rolls to last year, not the future ---
{
  const r = parseLocally("my periods started December 25th and October 2nd", TODAY, {} as any);
  check("december: past occurrence kept", !!r.entries && r.entries.map((e) => e.date).join(",") === "2025-12-25,2026-10-02", r.entries);
  const multiMsgs = [
    parseLocally("I had my period on October 2nd and September 9th", TODAY, {} as any).message,
    parseLocally("my period was from October 2 to October 6", TODAY, {} as any).message,
  ].join(" ").toLowerCase();
  check("messages: numbers only, no interpretation", ["irregular", "normal", "healthy", "abnormal"].every((w) => multiMsgs.indexOf(w) === -1), multiMsgs);
}

// --- 12. single-entry phrases behave exactly as before ---
{
  const one = parseLocally("my period started yesterday", TODAY, {} as any);
  check("single: yesterday entry, no entries array", one.entries === undefined && !!one.entry && one.entry.date === "2026-10-31" && one.entry.kind === "period_started", one.entry);
  const detail = parseLocally("period started yesterday, medium flow with cramps", TODAY, {} as any);
  check("single detail: flow kept, no entries array", detail.entries === undefined && !!detail.entry && detail.entry.flow === "medium", detail.entry);
  const plan = parseLocally("exam on Nov 20", TODAY, {} as any);
  check("plan-only: event, no entry", plan.entry === null && plan.entries === undefined && (plan.plannedEvents || []).some((e) => e.date === "2026-11-20"), plan.plannedEvents);
  const late = parseLocally("my period is late", TODAY, {} as any);
  check("late: asks, no entry", late.entry === null && late.needsClarification === true, late.message);
  const badRange = parseLocally("my period was from October 6 to October 2", TODAY, {} as any);
  check("bad range: no partial entry, asks instead", badRange.entries === undefined && badRange.entry === null && badRange.needsClarification === true, badRange.message);
  const mixed = parseLocally("my periods started October 2nd and my exam is on November 20th", TODAY, {} as any);
  check("mixed period plus event: old plan-only path kept", mixed.entries === undefined && mixed.entry === null && (mixed.plannedEvents || []).some((e) => e.date === "2026-11-20"), mixed);
}

// --- 13. row helpers ---
{
  const rows = backfillRowsFromEntries([
    { date: "2026-10-02", endDate: "2026-10-06", flow: null, symptoms: [], mood: null, energy: null, sleep: null, notes: null, kind: "period_started" } as any,
    { date: "2026-09-09", endDate: null, flow: null, symptoms: [], mood: null, energy: null, sleep: null, notes: null, kind: "period_started" } as any,
  ]);
  check("rows: built selected with endDate", rows.length === 2 && rows[0].selected === true && rows[0].endDate === "2026-10-06" && rows[1].endDate === "", rows);
  check("duration: 5 days", backfillDurationDays(rows[0]) === 5, backfillDurationDays(rows[0]));
  check("duration: no end means 1", backfillDurationDays(rows[1]) === 1, null);
  check("duration: end before start is null", backfillDurationDays({ key: "x", date: "2026-10-06", endDate: "2026-10-02", selected: true }) === null, null);
  check("validate: empty selection blocked", validateBackfillRows(rows.map((r) => ({ ...r, selected: false })), TODAY) === "Select at least one period to save.", null);
  check("validate: future blocked", (validateBackfillRows([{ key: "x", date: "2026-12-01", endDate: "", selected: true }], TODAY) || "").indexOf("future") !== -1, null);
  check("validate: end before start blocked", (validateBackfillRows([{ key: "x", date: "2026-10-06", endDate: "2026-10-02", selected: true }], TODAY) || "").indexOf("ends before") !== -1, null);
  check("validate: duplicate starts blocked", (validateBackfillRows([{ key: "a", date: "2026-10-02", endDate: "", selected: true }, { key: "b", date: "2026-10-02", endDate: "", selected: true }], TODAY) || "").indexOf("Two rows") !== -1, null);
  check("validate: clean rows pass", validateBackfillRows(rows, TODAY) === null, null);
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  check("gap: Sep 9 to Oct 2 is 23", backfillGapDays(sorted, 1) === 23, null);
  check("gap: first row has none", backfillGapDays(sorted, 0) === null, null);
  const warns = backfillRowWarnings({ key: "x", date: "2026-09-11", endDate: "", selected: true }, [{ key: "p", date: "2026-09-09", endDate: "", selected: true }, { key: "x", date: "2026-09-11", endDate: "", selected: true }], 1, [{ id: 1, startDate: "2026-09-09", endDate: "2026-09-13" } as any]);
  check("warnings: overlap named", warns.some((w) => w.indexOf("Overlaps") !== -1), warns);
  const dupWarns = backfillRowWarnings({ key: "x", date: "2026-10-02", endDate: "", selected: true }, [{ key: "a", date: "2026-10-02", endDate: "", selected: true }, { key: "x", date: "2026-10-02", endDate: "", selected: true }], 1, []);
  check("warnings: same start twice", dupWarns.some((w) => w.indexOf("Same start") !== -1), dupWarns);
  const gapWarns = backfillRowWarnings(sorted[1], sorted, 1, []);
  const banned = ["irregular", "normal", "healthy", "abnormal", "unhealthy"];
  check("no health interpretation anywhere", banned.every((w) => gapWarns.every((m) => m.toLowerCase().indexOf(w) === -1)), gapWarns);
  const tightWarns = backfillRowWarnings({ key: "x", date: "2026-09-15", endDate: "", selected: true }, [{ key: "p", date: "2026-09-09", endDate: "", selected: true }, { key: "x", date: "2026-09-15", endDate: "", selected: true }], 1, []);
  check("warnings: gap under 15 flagged", tightWarns.some((w) => w.indexOf("Only 6 days") !== -1), tightWarns);
  const longWarns = backfillRowWarnings({ key: "x", date: "2026-10-02", endDate: "2026-10-20", selected: true }, [{ key: "x", date: "2026-10-02", endDate: "2026-10-20", selected: true }], 0, []);
  check("warnings: long period flagged", longWarns.some((w) => w.indexOf("Longer than 10 days") !== -1), longWarns);
}

// --- 14. atomic save through the period model ---
resetVault();
{
  const n = saveBackfillRows([
    { key: "a", date: "2026-08-14", endDate: "", selected: true },
    { key: "b", date: "2026-09-09", endDate: "", selected: true },
    { key: "c", date: "2026-10-02", endDate: "", selected: true },
  ], TODAY, false);
  const data = loadCycleData();
  check("atomic: 3 saved", n === 3 && data.periods.length === 3, data.periods.map((p) => p.startDate));
  const stats = computeCycleStats(data.periods, data.logs);
  check("engine: 2 completed cycles", stats.statistics && stats.statistics.completedCycleCount === 2, stats.statistics);
  const records: PeriodRecord[] = data.periods.map((p) => ({
    id: String(p.id), startDate: p.startDate, endDate: p.endDate || undefined, confirmed: true, source: "manual",
    landmarkName: null, startEarliest: null, startLatest: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }));
  const overlap = evaluateEventOverlap("2026-11-28", records, TODAY);
  check("overlap: no longer unknown", overlap.status !== "unknown", overlap);
}

// --- 15. one invalid row means none are saved ---
{
  const before = loadCycleData();
  let threw = "";
  try {
    saveBackfillRows([
      { key: "a", date: "2026-10-05", endDate: "", selected: true },
      { key: "b", date: "2026-12-01", endDate: "", selected: true },
    ], TODAY, false);
  } catch (err: any) { threw = err?.message || "threw"; }
  const after = loadCycleData();
  check("atomic invalid: throws", threw.indexOf("future") !== -1, threw);
  check("atomic invalid: vault untouched", after.periods.length === before.periods.length && after.logs.length === before.logs.length, after.periods.map((p) => p.startDate));
}

// --- 16. mid-batch failure rolls everything back ---
{
  saveCycleData({ periods: [{ id: 50, startDate: "2026-09-09", endDate: "2026-09-20" } as any], logs: [] });
  let threw = "";
  try {
    saveBackfillRows([
      { key: "a", date: "2026-08-20", endDate: "", selected: true },
      { key: "b", date: "2026-09-07", endDate: "", selected: true },
    ], TODAY, false);
  } catch (err: any) { threw = err?.message || "threw"; }
  const after = loadCycleData();
  check("rollback: throws on long confirm", threw.length > 0, threw);
  check("rollback: first row also gone", after.periods.length === 1 && after.periods[0].startDate === "2026-09-09", after.periods.map((p) => p.startDate));
}

// --- 17. live path: mocked model makes 3 log_entry calls ---
async function liveTests() {
  process.env.META_API_KEY = "test-key";
  process.env.META_BASE_URL = "https://mock.meta.test/v1";
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) return { ok: true, json: async () => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: [
      { id: "c1", function: { name: "log_entry", arguments: JSON.stringify({ date: "2026-10-02", kind: "period_started" }) } },
      { id: "c2", function: { name: "log_entry", arguments: JSON.stringify({ date: "2026-09-09", kind: "period_started" }) } },
      { id: "c3", function: { name: "log_entry", arguments: JSON.stringify({ date: "2026-08-14", kind: "period_started" }) } },
    ] } }] }) };
    return { ok: true, json: async () => ({ choices: [{ message: { role: "assistant", content: "Logged all three." } }] }) };
  }) as any;
  const live = await runLavenderAgent("my periods started October 2nd, September 9th and August 14th", { currentDate: TODAY });
  check("live: 3 entries collected", !!live.entries && live.entries.length === 3, live.entries);
  check("live: entry is entries[0]", !!live.entries && live.entry === live.entries[0], live.entry);
  check("live: meta-model executed all", (live.toolCalls || []).filter((c) => c.toolName === "log_entry").length === 3, live.toolCalls);
  globalThis.fetch = originalFetch;
  delete process.env.META_API_KEY;
}

await liveTests();

console.log("Backfill Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
