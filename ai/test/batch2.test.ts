// Batch 2 tests: intent, lexicon parser, date resolver, live agent (mocked Meta)
import { parseLocally, runLavenderAgent } from "../backend/agent";
import { classifyIntent } from "../backend/intent";
import { resolveDateExpression } from "../backend/dateArithmetic";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log(`[PASS] ${name}`); passed++; }
  else { console.error(`[FAIL] ${name}`, extra ?? ""); failed++; }
}
const TODAY = "2026-10-28"; // Wednesday
const ctx = { currentDate: TODAY };

// --- 2.1 intent ---
check("intent period_start", classifyIntent("my period started today") === "period_start");
check("intent period_end", classifyIntent("my period ended today") === "period_end");
check("intent daily_log", classifyIntent("heavy flow with cramps") === "daily_log");
check("intent plan_event", classifyIntent("exam on Nov 20") === "plan_event");
check("intent correction", classifyIntent("actually make it light", true) === "correction");
check("intent medical", classifyIntent("should I take ibuprofen for cramps?") === "medical_question");
check("intent late is other", classifyIntent("my period is late") === "other");

// --- 2.1 no slip for non-loggable / late / plan-only ---
const hello = parseLocally("hello there", TODAY, ctx);
check("no loggable content -> no entry", !hello.entry && hello.needsClarification === true, hello);
const late = parseLocally("my period is late", TODAY, ctx);
check("period is late -> asks, no entry", !late.entry && late.needsClarification === true, late);
const planOnly = parseLocally("exam on Nov 20", TODAY, ctx);
check("plan-only -> no log entry", !planOnly.entry, planOnly);
check("plan-only -> planned event captured", !!planOnly.plannedEvents && planOnly.plannedEvents.length === 1 && planOnly.plannedEvents[0].date === "2026-11-20", planOnly.plannedEvents);
check("plan-only -> overlap evaluated", !!planOnly.planOverlaps && planOnly.planOverlaps.length === 1, planOnly);
const noDate = parseLocally("period started", TODAY, ctx);
check("past log without date -> Which date?", !noDate.entry && /Which date/.test(noDate.clarificationQuestion || ""), noDate);

// --- 2.2 parser regressions ---
const r1 = parseLocally("heavy flow with cramps", TODAY, ctx);
check("heavy flow with cramps -> mood null", !!r1.entry && r1.entry.flow === "heavy" && r1.entry.mood === null && r1.entry.symptoms.includes("cramps"), r1.entry);
const r2 = parseLocally("flow is light today", TODAY, ctx);
check("flow is light today -> mood null", !!r2.entry && r2.entry.flow === "light" && r2.entry.mood === null, r2.entry);
const r3 = parseLocally("slight headache", TODAY, ctx);
check("slight headache -> flow null", !!r3.entry && r3.entry.flow === null && r3.entry.symptoms.includes("headache"), r3.entry);
const r4 = parseLocally("आज कमर दर्द है", TODAY, ctx);
check("Hindi backache only, flow null", !!r4.entry && JSON.stringify(r4.entry.symptoms) === JSON.stringify(["backache"]) && r4.entry.flow === null, r4.entry);
const r5 = parseLocally("feeling tired, no flow", TODAY, ctx);
check("tired+no flow -> fatigue, flow none, energy null", !!r5.entry && r5.entry.symptoms.includes("fatigue") && r5.entry.flow === "none" && r5.entry.energy === null, r5.entry);
const r6 = parseLocally("no cramps, light flow today", TODAY, ctx);
check("negation: no cramps", !!r6.entry && !r6.entry.symptoms.includes("cramps") && r6.entry.flow === "light", r6.entry);
const r7 = parseLocally("medium flow today, without headache", TODAY, ctx);
check("negation: without headache", !!r7.entry && !r7.entry.symptoms.includes("headache") && r7.entry.flow === "medium", r7.entry);
const r8 = parseLocally("feeling calm today, slept 7 hours, energy 4", TODAY, ctx);
check("explicit mood/energy/sleep only", !!r8.entry && r8.entry.mood === "Calm" && r8.entry.energy === 4 && r8.entry.sleep === 7, r8.entry);
const r9 = parseLocally("tired today", TODAY, ctx);
check("tired does not set energy", !!r9.entry && r9.entry.energy === null && r9.entry.symptoms.includes("fatigue"), r9.entry);
check("offline tool calls executedBy", (r1.toolCalls || []).every((c) => c.executedBy === "offline-rule-engine"), r1.toolCalls);
check("offline mode flagged", r1.mode === "offline" && !!r1.modeReason, r1);

// --- 2.3 date resolver (>=40 cases) ---
type Case = [string, string | "ASK" | "NONE"];
const cases: Case[] = [
  ["today", TODAY], ["this morning", TODAY], ["tonight", TODAY], ["now", TODAY],
  ["yesterday", "2026-10-27"], ["last night", "2026-10-27"], ["day before yesterday", "2026-10-26"],
  ["3 days ago", "2026-10-25"], ["two days ago", "2026-10-26"], ["one day ago", "2026-10-27"],
  ["1 week ago", "2026-10-21"], ["2 weeks ago", "2026-10-14"], ["ten days ago", "2026-10-18"],
  ["3 days back", "2026-10-25"], ["तीन days ago", "2026-10-25"], ["രണ്ട് days ago", "2026-10-26"],
  ["last Tuesday", "2026-10-27"], ["last Monday", "2026-10-26"], ["last Wednesday", "2026-10-21"],
  ["this Tuesday", "2026-10-27"], ["last Friday", "2026-10-23"], ["last Sunday", "2026-10-25"],
  ["3rd November", "2025-11-03"], ["3 Nov", "2025-11-03"], ["Nov 3", "2025-11-03"],
  ["3rd November 2025", "2025-11-03"], ["25th December", "2025-12-25"], ["1st January", "2026-01-01"],
  ["15 August", "2026-08-15"], ["31st December 2025", "2025-12-31"],
  ["Diwali", "2025-10-20"], ["last Diwali", "2025-10-20"],
  ["2 days before New Year's Day", "2025-12-30"], ["2 days after Christmas", "2025-12-27"],
  ["the Monday before Women's Day", "2026-03-02"],
  ["after Christmas", "ASK"], ["3rd November 2027", "ASK"], ["3/4", "ASK"], ["13/4", "2026-04-13"], ["4/13", "2026-04-13"],
  ["2026-10-05", "NONE"],
];
for (const [text, expected] of cases) {
  const res = resolveDateExpression(text, TODAY);
  if (expected === "ASK") check(`resolver "${text}" asks`, res.needsClarification === true && res.date === null, res);
  else if (expected === "NONE") check(`resolver "${text}" no false resolution`, res.date === null || res.confidence === "none", res);
  else check(`resolver "${text}" = ${expected}`, res.date === expected, res);
}
const around = resolveDateExpression("around Christmas", TODAY);
check("around Christmas window", !!around.window && around.window.start === "2025-12-22" && around.window.end === "2025-12-28", around);
const range = resolveDateExpression("from the 3rd to the 7th", TODAY);
check("range 3rd to 7th window", !!range.window && range.window.start === "2026-10-03" && range.window.end === "2026-10-07", range);
const expl = resolveDateExpression("2 days before New Year's Day", TODAY);
check("explanation human readable", /2025/.test(expl.explanation) && /Dec/.test(expl.explanation), expl);
check("case count >=40", cases.length + 3 >= 40, cases.length);

// --- 2.4 live agent with mocked Meta endpoint ---
async function liveTests() {
  process.env.META_API_KEY = "test-key";
  process.env.META_BASE_URL = "https://mock.meta.test/v1";
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) return { ok: true, json: async () => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "c1", function: { name: "log_entry", arguments: JSON.stringify({ date: "2027-01-01", flow: "heavy" }) } }] } }] }) };
    if (calls === 2) return { ok: true, json: async () => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "c2", function: { name: "log_entry", arguments: JSON.stringify({ date: TODAY, flow: "heavy", symptoms: ["cramps"], kind: "daily_log" }) } }] } }] }) };
    return { ok: true, json: async () => ({ choices: [{ message: { role: "assistant", content: "Logged with the live model." } }] }) };
  }) as any;
  const live = await runLavenderAgent("heavy flow with cramps today", { currentDate: TODAY, locale: "en-IN" });
  check("live mode flagged", live.mode === "live", live);
  check("live tool loop entry from model only", !!live.entry && live.entry.date === TODAY && live.entry.flow === "heavy", live.entry);
  check("invalid args retried then valid", calls >= 3 && (live.toolCalls || []).some((c) => !!(c.result as any)?.error), { calls, toolCalls: live.toolCalls });
  check("live executedBy meta-model", (live.toolCalls || []).every((c) => c.executedBy === "meta-model"), live.toolCalls);
  check("no blending: live message only", live.message === "Logged with the live model.", live.message);

  globalThis.fetch = (async () => ({ ok: false, status: 500, text: async () => "server error" })) as any;
  const failed = await runLavenderAgent("heavy flow with cramps today", { currentDate: TODAY });
  check("API 500 -> offline flagged with reason", failed.mode === "offline" && /500/.test(failed.modeReason || ""), failed);
  globalThis.fetch = originalFetch;
  delete process.env.META_API_KEY;
}

await liveTests();
console.log(`\nBatch 2 Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
