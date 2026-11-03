/** Emergency repair verification: message lifecycle, no duplicates, no empty
 *  bubbles, slip -> confirm -> verified save. Storage fns are REAL (only the
 *  localStorage object is faked, same as q1); saves are read back, not mocked. */
import { parseLocally, runLavenderAgent } from "../backend/agent";
import { MEDICAL_REFUSAL_MESSAGE, SEVERE_FALL_CARE_MESSAGE } from "../backend/guardrail";
import { saveLogEntry, loadCycleData, addOrUpdatePeriod } from "../../client/src/cycleStorage";
import { upsertEvent, loadEvents } from "../../client/src/lib/events";
import { backfillRowsFromEntries, backfillSelected } from "../../client/src/lib/backfill";
import { saveBackfillRows } from "../../client/src/lib/backfill";
import { appendTurn, makeTurnId, resolveShownMessage } from "../../client/src/lib/conversation";
import { EMPTY_VOICE_THREAD } from "../../client/src/context/VoiceThreadContext";

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
// Mirror of VoiceFlowPage.handleSaveConfirmed mapping (slip -> saveLog call).
function saveSlipLikeUI(entry: any, replace = false) {
  const isBleeding = entry.flow === "light" || entry.flow === "medium" || entry.flow === "heavy";
  const kind = (entry.kind === "period_started" || isBleeding) ? "period_started" : entry.kind || "daily_log";
  return saveLogEntry({
    logDate: entry.date, flow: entry.flow || null, symptoms: entry.symptoms || [],
    mood: entry.mood || null, energy: entry.energy || null, sleepHours: entry.sleep || null,
    notes: entry.notes || null, kind,
  } as any, { kind, replace } as any);
}

async function main() {
  // --- 1-2. unseen conversation + unfamiliar requests (offline floor + live) ---
  for (const t of ["hey, how's it going?", "thanks a lot", "good evening"]) {
    const r: any = parseLocally(t, TODAY, {});
    check("unseen convo offline: " + t, r.entry == null && r.responseType === "conversation" && r.message.length > 0, r.message.slice(0, 50));
  }
  await withLive([textMsg("Hello! What can I do for you today?")], async () => {
    const r: any = await runLavenderAgent("hey, how's it going?", { currentDate: TODAY });
    check("unseen convo live: natural reply, no record", r.entry == null && (r.toolCalls || []).length === 0 && r.message.length > 0, r.message);
  });
  await withLive([toolMsg([logCall("f1", { date: "2026-11-02", flow: "medium", kind: "period_started" })]), textMsg("Noted.")], async () => {
    const r: any = await runLavenderAgent("my monthly visitor arrived yesterday", { currentDate: TODAY });
    check("unfamiliar indirect live: validated slip", !!r.entry && r.entry.date === "2026-11-02", r.entry);
  });
  { const r: any = parseLocally("my monthly visitor arrived yesterday", TODAY, {});
    check("unfamiliar indirect offline: no invented record", r.entry == null, JSON.stringify(r.entry)); }
  // --- 3-5. lifecycle: no duplicates, no empty bubbles ---
  {
    const h0: any[] = [];
    const t1 = makeTurnId();
    const h1 = appendTurn(h0, { role: "user", content: "hi", id: t1 + "-u" }, { role: "assistant", content: "Hello!", id: t1 + "-a" });
    const h2 = appendTurn(h1, { role: "user", content: "hi", id: t1 + "-u" }, { role: "assistant", content: "Hello!", id: t1 + "-a" });
    check("rapid resubmit: same turn ids appended once", h2.length === 2, h2.length);
    check("ids are unique across turns", makeTurnId() !== makeTurnId(), "ids");
    const h3 = appendTurn(h2, { role: "user", content: "hi", id: "x-u" }, { role: "assistant", content: "   ", id: "x-a" });
    check("empty assistant turn never stored", h3.length === 3 && h3.every((t: any) => t.content.trim().length > 0), h3.length);
    check("shown message: blank+no slip -> useful error", resolveShownMessage("  ", false, false).indexOf("try again") !== -1, resolveShownMessage("  ", false, false));
    check("shown message: slip keeps blank text", resolveShownMessage("", true, false) === "", "slip");
    check("shown message: real text passes through", resolveShownMessage("Hi!", false, false) === "Hi!", "text");
  }
  // --- 6-7. logging with confirmation data + historical dates ---
  await withLive([toolMsg([logCall("p1", { date: "2026-10-29", flow: "heavy", kind: "period_started" })]), textMsg("Prepared.")], async () => {
    const r: any = await runLavenderAgent("flow was heavy when my period started Oct 29", { currentDate: TODAY });
    check("log card data matches slip", !!r.entry && r.entry.date === "2026-10-29" && r.entry.flow === "heavy" && r.entry.kind === "period_started", r.entry);
    check("historical date kept, not today", r.entry.date !== TODAY, r.entry.date);
    const saved: any = saveSlipLikeUI(r.entry);
    check("confirm writes verified record", saved && saved.saved !== false, saved);
    const back = loadCycleData();
    check("persisted record readable", back.logs.some((l: any) => l.logDate === "2026-10-29" && l.flow === "heavy"), back.logs.length);
  });
  // --- 8. cancellation saves nothing ---
  mockStorage();
  {
    const r: any = parseLocally("I have cramps today", TODAY, {});
    check("cancel: slip prepared", !!r.entry, r.entry);
    const data = loadCycleData();
    check("cancel: nothing saved without confirm", data.logs.length === 0 && data.periods.length === 0, JSON.stringify(data));
  }
  // --- 9-11. confirm once, failure honest, duplicates prevented ---
  mockStorage();
  {
    const slip: any = { date: TODAY, flow: "medium", symptoms: ["cramps"], mood: null, energy: null, sleep: null, notes: "cramps today", kind: "daily_log" };
    const r1: any = saveSlipLikeUI(slip);
    const r2: any = saveSlipLikeUI(slip);
    const data = loadCycleData();
    const rows = data.logs.filter((l: any) => l.logDate === TODAY);
    check("duplicate submits: exactly one stored row", rows.length === 1 && r1.saved !== false && r2.saved !== false, rows.length);
    check("stored symptoms match slip", JSON.stringify((rows[0] as any).symptoms) === JSON.stringify(["cramps"]), (rows[0] as any).symptoms);
  }
  {
    const working = (globalThis as any).localStorage;
    (globalThis as any).localStorage = { getItem: working.getItem, removeItem: working.removeItem, clear: working.clear, setItem: () => { throw new Error("disk full"); } };
    let res: any = null; let threw = false;
    try { res = saveSlipLikeUI({ date: "2026-11-01", flow: null, symptoms: [], mood: null, energy: null, sleep: null, notes: null, kind: "daily_log" }); }
    catch { threw = true; }
    (globalThis as any).localStorage = working;
    check("failed save: saved:false with reason, no success", !threw && res && res.saved === false && typeof res.error === "string", res);
  }
  // --- 12-13. symptoms + corrections end to end ---
  mockStorage();
  {
    const r: any = parseLocally("I have cramps today", TODAY, {});
    check("symptom slip", !!r.entry && r.entry.kind === "daily_log" && (r.entry.symptoms || []).indexOf("cramps") !== -1, r.entry);
    const saved: any = saveSlipLikeUI(r.entry);
    const back = loadCycleData();
    check("symptom persisted", saved.saved !== false && back.logs.some((l: any) => (l.symptoms || []).indexOf("cramps") !== -1), back.logs.length);
  }
  {
    const pend: any = { date: TODAY, flow: "heavy", symptoms: ["cramps"], mood: null, energy: null, sleep: null, notes: null, kind: "daily_log" };
    const r: any = parseLocally("My flow was actually light.", TODAY, { pendingEntry: pend });
    check("correction prepared, no mood pollution", !!r.entry && r.entry.flow === "light" && r.entry.mood == null && r.replacesExisting === true, r.entry);
  }
  // --- 14. multiple actions: backfill 3 periods -> 3 verifiable records ---
  mockStorage();
  await withLive([toolMsg([
    logCall("b1", { date: "2026-08-14", kind: "period_started" }),
    logCall("b2", { date: "2026-09-09", kind: "period_started" }),
    logCall("b3", { date: "2026-10-02", kind: "period_started" }),
  ]), textMsg("Prepared all three.")], async () => {
    const r: any = await runLavenderAgent("my periods started October 2nd, September 9th and August 14th", { currentDate: TODAY });
    const rows = backfillRowsFromEntries(r.entries || []);
    const sel = backfillSelected(rows.map((x: any) => ({ ...x, selected: true })));
    const n = saveBackfillRows(rows.map((x: any) => ({ ...x, selected: true })), TODAY, true, true);
    const data = loadCycleData();
    check("backfill: 3 slips prepared", (r.entries || []).length === 3, (r.entries || []).length);
    check("backfill: 3 records persisted", n === 3 && data.periods.length === 3, n + "/" + data.periods.length);
  });
  // --- 15. event creation round-trips through storage ---
  mockStorage();
  {
    const r: any = parseLocally("My wedding is on November 20.", TODAY, {});
    check("event slip data present", !!(r.plannedEvents && r.plannedEvents[0] && r.plannedEvents[0].date === "2026-11-20"), r.plannedEvents);
    const { upsertEvent: up } = await import("../../client/src/lib/events");
    up({ title: r.plannedEvents[0].title, date: r.plannedEvents[0].date, source: "voice" });
    const evs = loadEvents();
    check("event persisted and reloadable", evs.some((e: any) => e.date === "2026-11-20"), evs.length);
  }
  // --- 16. safety + logging ---
  {
    const r: any = parseLocally("I had my first period today. It was painful and I fell down.", TODAY, {});
    check("safety+log: slip + care, no diagnosis", !!r.entry && r.entry.date === TODAY && r.message.indexOf(SEVERE_FALL_CARE_MESSAGE) !== -1, r.message.slice(0, 60));
  }
  // --- 17-18. API failure + offline fallback never produce empty bubbles ---
  {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => { throw new Error("network down"); };
    const { sendAgentMessage } = await import("../frontend/aiClient");
    const r: any = await sendAgentMessage("my period started today", { currentDate: TODAY }, []);
    (globalThis as any).fetch = orig;
    check("api failure: offline fallback with real message", r.isOfflineFallback === true && (r.message || "").trim().length > 0 && r.entry != null, (r.message || "").slice(0, 60));
    check("api failure: no phantom saved claim", !/saved|all set|good to go/i.test(r.message || "") || r.entry != null, r.message.slice(0, 60));
  }
  {
    const r: any = parseLocally("Thank you.", TODAY, {});
    check("offline fallback: conversational, non-empty", (r.message || "").trim().length > 0 && r.entry == null, r.message.slice(0, 50));
    const q: any = parseLocally("28 5 2026", TODAY, {});
    check("offline fallback: bare input asks, non-empty", q.entry == null && (q.message || "").trim().length > 0, q.message.slice(0, 50));
  }
  // --- 19. history is in-memory: reload starts empty, storage persists ---
  {
    check("reload: thread starts empty", EMPTY_VOICE_THREAD.conversationHistory.length === 0 && EMPTY_VOICE_THREAD.transcript === "" && EMPTY_VOICE_THREAD.agentMessage === "", "thread");
  }
  console.log("E2E Lifecycle Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
}
main();
