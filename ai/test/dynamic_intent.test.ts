/** Dynamic intent understanding: unseen phrasings, mixed intents, follow-ups, typos.
 *  Mocked-model tests prove the pipeline (Muse decides -> backend validates ->
 *  structured slip); only a live keyed run proves Muse itself. Offline tests
 *  prove the deterministic floor never invents records. */
import { parseLocally, runLavenderAgent, isConversationalMessage } from "../backend/agent";
import { MEDICAL_REFUSAL_MESSAGE, SEVERE_FALL_CARE_MESSAGE } from "../backend/guardrail";
import { saveLogEntry, loadCycleData, addOrUpdatePeriod } from "../../client/src/cycleStorage";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const TODAY = "2026-11-03";
const toolMsg = (calls: any[]) => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: calls } }] });
const textMsg = (content: string) => ({ choices: [{ message: { role: "assistant", content } }] });
const logCall = (id: string, args: any) => ({ id, function: { name: "log_entry", arguments: JSON.stringify(args) } });
async function withLive(responses: any[], fn: () => Promise<void>) {
  process.env.META_API_KEY = "test-key";
  process.env.META_BASE_URL = "https://mock.meta.test/v1";
  const orig = globalThis.fetch;
  let i = 0;
  globalThis.fetch = (async () => {
    const r = responses[Math.min(i++, responses.length - 1)];
    return { ok: true, status: 200, json: async () => r };
  }) as any;
  try { await fn(); } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }
}
function mockStorage() {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
  return store;
}

async function main() {
  // --- 1. conversation: no log, no event, friendly reply (offline floor) ---
  for (const t of ["Hi, how are you?", "What can you do?", "Thank you.", "Explain how Feather works.", "Good morning", "Who are you?", "bye!", "help"]) {
    const r: any = parseLocally(t, TODAY, {});
    check("convo offline: " + t, r.entry == null && !(r.plannedEvents && r.plannedEvents.length) && r.responseType === "conversation" && r.message.indexOf("didn't catch") === -1, r.message.slice(0, 60));
  }
  // --- 1b. conversation reaches Muse live (mocked): natural reply, no tools fired ---
  await withLive([textMsg("Hi there! I'm doing well. I can help you log periods, track symptoms, or plan around events. What would you like to do?")], async () => {
    const r: any = await runLavenderAgent("Hi, how are you?", { currentDate: TODAY });
    check("convo live: natural reply, no entry", r.entry == null && (r.toolCalls || []).length === 0 && r.message.indexOf("Hi there") !== -1, r.message);
  });
  await withLive([textMsg("I can log your periods and symptoms, answer questions from your history, and help with planning. Just tell me what you need.")], async () => {
    const r: any = await runLavenderAgent("What can you do?", { currentDate: TODAY });
    check("convo live capabilities: no slip", r.entry == null && r.entries == null, r.message.slice(0, 60));
  });
  // --- 2. unseen typo, live pipeline validates into a slip ---
  await withLive([toolMsg([logCall("u1", { date: "2026-11-02", flow: "medium", kind: "period_started" })]), textMsg("Noted.")], async () => {
    const r: any = await runLavenderAgent("My peroid started yestrday", { currentDate: TODAY });
    check("typo live: validated slip, never invented date", !!r.entry && r.entry.date === "2026-11-02" && r.entry.kind === "period_started", r.entry);
    check("typo live: intentions recorded", (r.intentions || []).some((s: string) => s.indexOf("log_entry:period_started:2026-11-02") !== -1), r.intentions);
  });
  { // offline floor for the same typo: no entry, asks (never silently re-dates)
    const r: any = parseLocally("My peroid started yestrday", TODAY, {});
    check("typo offline: no invented record", r.entry == null, JSON.stringify(r.entry));
  }
  // --- 2b. indirect phrasing, live pipeline ---
  await withLive([toolMsg([logCall("u2", { date: "2026-11-02", kind: "period_started" })]), textMsg("Noted.")], async () => {
    const r: any = await runLavenderAgent("Aunt Flo came to visit yesterday", { currentDate: TODAY });
    check("indirect live: validated slip", !!r.entry && r.entry.date === "2026-11-02", r.entry);
  });
  { const r: any = parseLocally("Aunt Flo came to visit yesterday", TODAY, {});
    check("indirect offline: no false record", r.entry == null, JSON.stringify(r.entry)); }
  // --- 3. mixed conversation + log + plan, live does each part ---
  await withLive([
    toolMsg([logCall("m1", { date: TODAY, flow: "medium", kind: "period_started" }), { id: "m2", function: { name: "check_overlap", arguments: JSON.stringify({ events: [{ name: "wedding", date: "2026-11-20" }] }) } }]),
    textMsg("All set!"),
  ], async () => {
    const r: any = await runLavenderAgent("hi! my period started today and I have a wedding on Nov 20, will they overlap?", { currentDate: TODAY });
    check("mixed live: slip present", !!r.entry && r.entry.date === TODAY, r.entry);
    check("mixed live: overlap answered", !!(r.planOverlaps && r.planOverlaps.length === 1), r.planOverlaps);
    check("mixed live: intentions list both actions", (r.intentions || []).some((s: string) => s.indexOf("log_entry") === 0) && (r.intentions || []).indexOf("check_overlap") !== -1, r.intentions);
  });
  { // offline floor for the same mixed message: slip AND overlap (no dropped part)
    const r: any = parseLocally("my period started today, will it overlap with my wedding on Nov 20?", TODAY, { events: [] });
    check("mixed offline: slip kept", !!r.entry && r.entry.date === TODAY, r.entry);
    check("mixed offline: overlap kept", !!(r.planOverlaps && r.planOverlaps.length === 1), r.planOverlaps);
  }
  // --- 4. ambiguous: no date anywhere -> clarification, never today's silent default ---
  {
    const r: any = parseLocally("it started", TODAY, {});
    check("ambiguous offline: asks, no entry", r.entry == null && r.needsClarification === true, r.message);
  }
  await withLive([textMsg("Which day did it start?")], async () => {
    const r: any = await runLavenderAgent("it started", { currentDate: TODAY });
    check("ambiguous live: asks, no slip", r.entry == null, r.message);
  });
  // --- 5. exact date handling (offline; live mirrors via validated tools) ---
  const dates: Array<[string, string | null, string?]> = [
    ["I had my period on 30th August.", "2026-08-30", "period_started"],
    ["My period started yesterday.", "2026-11-02", "period_started"],
    ["I got my period today.", TODAY, "period_started"],
    ["My period started on November 1st.", "2026-11-01", "period_started"],
    ["I have cramps today.", TODAY, "daily_log"],
  ];
  for (const [t, d, k] of dates) {
    const r: any = parseLocally(t, TODAY, {});
    check("date offline: " + t, !!r.entry && r.entry.date === d && r.entry.kind === k, JSON.stringify(r.entry && r.entry.date));
  }
  await withLive([toolMsg([logCall("d1", { date: "2026-08-30", kind: "period_started" })]), textMsg("Noted.")], async () => {
    const r: any = await runLavenderAgent("I had my period on 30th August.", { currentDate: TODAY });
    check("date live: 30th August kept, not today", !!r.entry && r.entry.date === "2026-08-30", r.entry);
  });
  // future period start is never created
  {
    const r: any = parseLocally("my period starts tomorrow", TODAY, {});
    check("future: no period entry", !(r.entry && r.entry.kind === "period_started" && r.entry.date > TODAY), JSON.stringify(r.entry));
  }
  // --- 6. corrections (offline fixed + live replace) ---
  {
    const pend: any = { date: TODAY, flow: "heavy", symptoms: [], mood: null, energy: null, sleep: null, notes: null, kind: "daily_log" };
    const r: any = parseLocally("My flow was actually light.", TODAY, { pendingEntry: pend });
    check("correction offline: flow light, mood untouched", !!r.entry && r.entry.flow === "light" && r.entry.mood == null && r.replacesExisting === true, r.entry);
    check("correction offline: typed", r.responseType === "correction", r.responseType);
  }
  await withLive([
    toolMsg([{ id: "u9", function: { name: "update_entry", arguments: JSON.stringify({ flow: "light" }) } }]),
    textMsg("Updated."),
  ], async () => {
    const pend: any = { date: TODAY, flow: "heavy", symptoms: [], mood: null, energy: null, sleep: null, notes: null, kind: "daily_log" };
    const r: any = await runLavenderAgent("My flow was actually light.", { currentDate: TODAY, pendingEntry: pend });
    check("correction live: slip patched, replace flagged", !!r.entry && r.entry.flow === "light" && r.replacesExisting === true, r.entry);
  });
  // --- 7. event confirmation data present ---
  {
    const r: any = parseLocally("My wedding is on November 20.", TODAY, {});
    check("event offline: planned event returned", !!(r.plannedEvents && r.plannedEvents.length === 1 && r.plannedEvents[0].date === "2026-11-20") && r.entry == null, JSON.stringify(r.plannedEvents));
    check("event offline: typed event/plan", r.responseType === "event" || r.responseType === "plan", r.responseType);
  }
  // --- 8. safety + logging together ---
  {
    const r: any = parseLocally("I had my first period today. It was painful and I fell down.", TODAY, {});
    check("safety+log offline: slip kept", !!r.entry && r.entry.date === TODAY && r.entry.kind === "period_started", r.entry);
    check("safety+log offline: care shown, no diagnosis", typeof r.message === "string" && r.message.indexOf(SEVERE_FALL_CARE_MESSAGE) !== -1 && !/diagnos|take .*pill|dosage/i.test(r.message), r.message.slice(0, 80));
  }
  await withLive([toolMsg([logCall("s1", { date: TODAY, flow: "heavy", kind: "period_started" })]), textMsg("Take care and rest.")], async () => {
    const r: any = await runLavenderAgent("I had my first period today. It was painful and I fell down.", { currentDate: TODAY });
    check("safety+log live: slip kept", !!r.entry && r.entry.date === TODAY, r.entry);
    check("safety+log live: care leads", typeof r.message === "string" && r.message.indexOf(SEVERE_FALL_CARE_MESSAGE) === 0, r.message.slice(0, 60));
  });
  // --- 9-12. storage honesty (no browser needed: agent never writes; save is explicit) ---
  mockStorage();
  {
    const r: any = parseLocally("my period started today", TODAY, {});
    check("cancel contract: agent result writes nothing", !!r.entry, r.entry);
    const before = JSON.stringify(loadCycleData());
    check("cancel contract: store untouched without save", before === JSON.stringify({ periods: [], logs: [] }), before.slice(0, 80));
  }
  {
    let writes = 0;
    const raw = (globalThis as any).localStorage.setItem;
    (globalThis as any).localStorage.setItem = (k: string, v: string) => { writes++; return raw(k, v); };
    const res: any = saveLogEntry({ logDate: TODAY, flow: "heavy", symptoms: [], mood: null, energy: null, sleepHours: null, notes: "x", kind: "period_started" } as any, { kind: "period_started" } as any);
    (globalThis as any).localStorage.setItem = raw;
    const data = loadCycleData();
    const todays = data.logs.filter((l: any) => l.logDate === TODAY);
    check("confirm contract: saved once", res && res.saved !== false && todays.length === 1, { saved: res && res.saved, n: todays.length, writes });
  }
  {
    const working = (globalThis as any).localStorage;
    (globalThis as any).localStorage = {
      getItem: working.getItem, removeItem: working.removeItem, clear: working.clear,
      setItem: (_k: string, _v: string) => { throw new Error("QuotaExceededError"); },
    };
    let res: any = null; let threw = false;
    try { res = saveLogEntry({ logDate: "2026-11-01", flow: "light", symptoms: [], mood: null, energy: null, sleepHours: null, notes: null, kind: "daily_log" } as any, {} as any); }
    catch { threw = true; }
    (globalThis as any).localStorage = working;
    check("failure contract: saved:false with reason, no throw-out", !threw && res && res.saved === false && typeof res.error === "string", res);
  }
  {
    const data = loadCycleData();
    check("reload contract: saved data persists", data.logs.some((l: any) => l.logDate === TODAY), data.logs.length);
  }
  // --- refusal + type spot checks ---
  {
    const r: any = parseLocally("is this cramp normal?", TODAY, {});
    check("pure question still refuses", r.message === MEDICAL_REFUSAL_MESSAGE && r.entry == null && r.responseType === "refusal", r.message);
  }
  console.log("DynamicIntent Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
}
main();
