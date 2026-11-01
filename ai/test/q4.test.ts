/** Q4: Feather knows the user's own data. */
import { parseLocally, runLavenderAgent } from "../backend/agent";
import { isOwnEventsQuestion } from "../backend/intent";
import { resolveLandmarkExpression } from "../backend/dateArithmetic";
import { saveCycleData, loadCycleData, importCycleDataJSON, exportCycleDataJSON } from "../../client/src/cycleStorage";
import { saveEvents } from "../../client/src/lib/events";
import { loadEvents, upsertEvent } from "../../client/src/lib/events";
import { purgeVaultStorage } from "../../client/src/context/CycleContext";
import { enableAppLock, isAppLockEnabled, needsUnlockOnLoad } from "../../client/src/lib/appLock";
import { ENCRYPTED_VAULT_KEY } from "../../client/src/lib/vaultCrypto";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const TODAY = "2026-11-01";
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
function resetVault() { for (const k in store) delete store[k]; }

const EVTS = [
  { title: "exam", date: "2026-11-20" },
  { title: "wedding", date: "2026-12-05" },
  { title: "dentist", date: "2026-10-10" },
];
const THREE = [{ startDate: "2026-08-14" }, { startDate: "2026-09-09" }, { startDate: "2026-10-02" }];
function evtCtx(extra: any = {}) {
  return { events: EVTS, periods: THREE, cycleStats: {}, currentDate: TODAY, ...extra };
}

// --- Q4.1: 20 phrasings, local answers ---
{
  const cases: Array<[string, (m: string) => boolean]> = [
    ["is there any exam coming", (m) => m.indexOf("exam on Nov 20") !== -1],
    ["do I have anything this week", (m) => m.indexOf("Nothing this week") !== -1 && m.indexOf("You have 2 upcoming events") !== -1],
    ["do I have anything tomorrow", (m) => m.indexOf("Nothing tomorrow") !== -1],
    ["do I have anything next month", (m) => m.indexOf("wedding on Dec 5") !== -1],
    ["what's on my calendar", (m) => m.indexOf("exam on Nov 20") !== -1 && m.indexOf("wedding on Dec 5") !== -1],
    ["what is on my calendar", (m) => m.indexOf("exam on Nov 20") !== -1],
    ["when is my exam", (m) => m.indexOf("exam on Nov 20") !== -1],
    ["when is my next event", (m) => m.indexOf("Your next event is exam on Nov 20") !== -1],
    ["how many events do I have", (m) => m.indexOf("You have 2 upcoming events") !== -1],
    ["will my period clash with my exam", (m) => m.indexOf("exam on Nov 20") !== -1 && /overlap/i.test(m) && m.indexOf("Estimates based on your logged cycles") !== -1],
    ["does my wedding overlap my period", (m) => m.indexOf("wedding on Dec 5") !== -1 && m.indexOf("Estimates based on your logged cycles") !== -1],
    ["will my period clash with my wedding", (m) => m.indexOf("wedding on Dec 5") !== -1],
    ["do I have an exam coming up", (m) => m.indexOf("exam on Nov 20") !== -1],
    ["what do I have tomorrow", (m) => m.indexOf("Nothing tomorrow") !== -1],
    ["what do I have next week", (m) => m.indexOf("Nothing next week") !== -1],
    ["is there anything on my calendar", (m) => m.indexOf("exam on Nov 20") !== -1],
    ["when's my wedding", (m) => m.indexOf("wedding on Dec 5") !== -1],
    ["exam kab hai", (m) => m.indexOf("exam on Nov 20") !== -1],
    ["calendar mein kya hai", (m) => m.indexOf("exam on Nov 20") !== -1],
    ["is there any wedding coming", (m) => m.indexOf("wedding on Dec 5") !== -1],
  ];
  for (const [q, want] of cases) {
    const r = parseLocally(q, TODAY, evtCtx());
    check("Q4.1 local: " + q, r.entry === null && want(r.message), r.message);
  }
  const noQ = parseLocally("is there any concert coming", TODAY, evtCtx());
  check("Q4.1 no-match message", noQ.message === "I don't see an event matching 'concert' in your calendar. Add one by saying 'concert on Nov 20'. You have 2 upcoming events.", noQ.message);
  const empty = parseLocally("what's on my calendar", TODAY, { events: [], periods: [], currentDate: TODAY });
  check("Q4.1 zero events", empty.message === "Nothing coming up in your calendar.", empty.message);
  const pastOnly = parseLocally("what's on my calendar", TODAY, { events: [{ title: "dentist", date: "2026-10-10" }], periods: [], currentDate: TODAY });
  check("Q4.1 past only", pastOnly.message.indexOf("Nothing coming up") !== -1 && pastOnly.message.indexOf("1 past event") !== -1, pastOnly.message);
  const dated = parseLocally("exam on Nov 20", TODAY, evtCtx());
  check("Q4.1 dated phrase still creates (not local)", (dated as any).plannedEvents?.length === 1 && (dated as any).plannedEvents[0].title === "exam", JSON.stringify((dated as any).plannedEvents));
  check("Q4.1 intent flags local questions", isOwnEventsQuestion("when is my exam") && isOwnEventsQuestion("will my period clash with my exam") && !isOwnEventsQuestion("exam on Nov 20") && !isOwnEventsQuestion("cramps today"), "intent");
}

// --- Q4.1 demo mode events ---
{
  resetVault();
  store["feather_demo_active"] = "1";
  store["feather_demo_events_v1"] = JSON.stringify([{ id: "demo-event-1", title: "Demo exam (fictional)", date: "2026-11-20", source: "manual", demo: true }]);
  const r = parseLocally("is there any exam coming", TODAY, { periods: [], currentDate: TODAY } as any);
  check("Q4.1 demo events answered", r.message.indexOf("Demo exam (fictional) on Nov 20") !== -1, r.message);
  resetVault();
}

// --- Q4.2 model path: calendarVisible ---
{
  const bodies: any[] = [];
  const orig = globalThis.fetch;
  process.env.META_API_KEY = "test-key";
  process.env.META_BASE_URL = "https://mock.meta.test/v1";
  globalThis.fetch = (async (_url: any, opts: any) => {
    bodies.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({ choices: [{ message: { role: "assistant", content: "ok" } }] }) };
  }) as any;
  try {
    await runLavenderAgent("cramps today", { currentDate: TODAY, calendarVisible: false } as any);
    const sys = bodies.length ? bodies[0].messages[0].content : "";
    check("Q4.2 hidden calendar prompt line", sys.indexOf("You cannot see the user's calendar; never say they have no events. Say you can't see it here.") !== -1, sys.slice(0, 200));
    bodies.length = 0;
    await runLavenderAgent("cramps today", { currentDate: TODAY, calendarVisible: true } as any);
    const sys2 = bodies.length ? bodies[0].messages[0].content : "";
    check("Q4.2 visible calendar omits line", sys2.indexOf("You cannot see the user's calendar") === -1, sys2.slice(0, 200));
  } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }
}

// --- Q4.4 date preset ---
{
  const base: any = { currentDate: TODAY };
  const rPreset = parseLocally("cramps and heavy flow", TODAY, { ...base, defaultDate: "2026-10-20" });
  check("Q4.4 preset used with no stated date", (rPreset.entry as any)?.date === "2026-10-20", JSON.stringify((rPreset.entry as any)?.date));
  const rWin = parseLocally("cramps yesterday", TODAY, { ...base, defaultDate: "2026-10-20" });
  check("Q4.4 stated date wins over preset", (rWin.entry as any)?.date === "2026-10-31", JSON.stringify((rWin.entry as any)?.date));
  const rNone = parseLocally("cramps", TODAY, base);
  check("Q4.4 no preset logs today", (rNone.entry as any)?.date === TODAY, JSON.stringify((rNone.entry as any)?.date));
  const rBad = parseLocally("cramps and heavy flow", TODAY, { ...base, defaultDate: "not-a-date" });
  check("Q4.4 bad preset ignored", (rBad.entry as any)?.date === TODAY, JSON.stringify((rBad.entry as any)?.date));
  const rFuture = parseLocally("cramps and heavy flow", TODAY, { ...base, defaultDate: "2026-12-01" });
  check("Q4.4 future preset ignored", (rFuture.entry as any)?.date === TODAY, JSON.stringify((rFuture.entry as any)?.date));
}

// --- Q4.5 landmark packs ---
{
  const diwali = resolveLandmarkExpression("last Diwali", TODAY);
  check("Q4.5 Diwali found by default", diwali.found === true, diwali.baseDate);
  const diwaliOff = resolveLandmarkExpression("last Diwali", TODAY, { global: true, india: false });
  check("Q4.5 Diwali unknown with india off", diwaliOff.found === false, JSON.stringify(diwaliOff));
  const xmasOff = resolveLandmarkExpression("Christmas", TODAY, { global: true, india: false });
  check("Q4.5 Christmas kept with india off", xmasOff.found === true, xmasOff.baseDate);
  const rOn = parseLocally("I had cramps last Diwali", TODAY, { landmarkPacks: { global: true, india: true } } as any);
  check("Q4.5 packs on resolve landmark", (rOn.entry as any)?.date === "2025-10-20", JSON.stringify((rOn.entry as any)?.date));
  const rOff = parseLocally("I had cramps last Diwali", TODAY, { landmarkPacks: { global: true, india: false } } as any);
  check("Q4.5 packs off asks for date", rOff.entry === null && rOff.needsClarification === true, rOff.message);
}

// --- Q4.6 purge ---
{
  resetVault();
  saveCycleData({ periods: [{ id: 1, startDate: "2026-10-02", endDate: "2026-10-06" } as any], logs: [{ id: 1, logDate: "2026-10-02", flow: "heavy", symptoms: [], mood: null, energy: null, sleepHours: null, notes: null } as any] });
  saveEvents([{ id: "e1", title: "exam", date: "2026-11-20", source: "manual" } as any]);
  store["feather_allow_matched_events"] = "true";
  store["feather_landmark_packs"] = JSON.stringify({ global: true, india: true });
  store["feather_entries_since_export"] = "7";
  store["feather_last_export_ts"] = "2026-10-30";
  store["feather_demo_active"] = "1";
  store["feather_demo_events_v1"] = "[]";
  await enableAppLock("correct-horse-12");
  check("Q4.6 lock on before purge", isAppLockEnabled() && store[ENCRYPTED_VAULT_KEY] != null, "locked");
  purgeVaultStorage(() => {});
  const gone = [ENCRYPTED_VAULT_KEY, "feather_app_lock_enabled", "feather_allow_matched_events", "feather_landmark_packs", "feather_entries_since_export", "feather_last_export_ts", "feather_demo_active", "feather_demo_events_v1"];
  check("Q4.6 all keys removed", gone.every((k) => store[k] == null), Object.keys(store));
  check("Q4.6 vault empty", loadCycleData().periods.length === 0 && loadCycleData().logs.length === 0 && loadEvents().length === 0, "vault");
  check("Q4.6 lock off after purge", !isAppLockEnabled() && !needsUnlockOnLoad(), "lock state");
  resetVault();
}

// --- Q4.7 import merges events ---
{
  resetVault();
  saveEvents([{ id: "local-1", title: "exam", date: "2026-11-25", source: "voice" } as any]);
  const backup = {
    app: "Feather",
    periods: [],
    logs: [],
    events: [
      { id: "old-1", title: "trip", date: "2026-11-10", source: "manual" },
      { id: "local-1", title: "exam", date: "2026-11-25", source: "voice" },
      { id: "bad-1", title: "broken", date: "not-a-date", source: "manual" },
    ],
  };
  const res = importCycleDataJSON(JSON.stringify(backup));
  check("Q4.7 older backup merged", res.success === true && res.added.events === 1, JSON.stringify(res.added));
  check("Q4.7 duplicate skipped", res.skipped.some((s) => s.kind === "event" && s.reason === "duplicate event"), JSON.stringify(res.skipped));
  check("Q4.7 invalid skipped with count", res.skipped.some((s) => s.kind === "event" && s.reason === "invalid date"), JSON.stringify(res.skipped));
  const evts = loadEvents();
  check("Q4.7 newer local kept plus older added", evts.some((e) => e.title === "exam" && e.date === "2026-11-25") && evts.some((e) => e.title === "trip"), evts.map((e) => e.title + "@" + e.date));
  resetVault();
}

console.log("Q4 Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
