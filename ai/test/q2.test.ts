/** Q2: live path honesty. */
import { runLavenderAgent } from "../backend/agent";
import { REDIRECT_MESSAGES } from "../backend/guardrail";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}

const TODAY = "2026-11-01";
const CTX: any = { currentDate: TODAY, periods: [{ startDate: "2026-08-14" }, { startDate: "2026-09-09" }, { startDate: "2026-10-02" }] };
const toolMsg = (calls: any[]) => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: calls } }] });
const textMsg = (content: string) => ({ choices: [{ message: { role: "assistant", content } }] });
const logCall = (id: string, args: any) => ({ id, function: { name: "log_entry", arguments: JSON.stringify(args) } });

async function withMock(responses: any[], fn: () => Promise<void>) {
  process.env.META_API_KEY = "test-key";
  process.env.META_BASE_URL = "https://mock.meta.test/v1";
  const orig = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    const r = responses[Math.min(calls, responses.length - 1)];
    calls++;
    return { ok: true, json: async () => r };
  }) as any;
  try { await fn(); } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }
}

// --- Q2.1 output guard keeps structured results ---
async function q21() {
  await withMock([
    toolMsg([logCall("a1", { date: "2026-10-29", flow: "medium", kind: "period_started" })]),
    textMsg("Logged. Your normal flow pattern is saved."),
  ], async () => {
    const r: any = await runLavenderAgent("period started October 29", CTX);
    check("Q2.1: log plus normal keeps the entry", !!r.entry && r.entry.date === "2026-10-29", r.entry);
    check("Q2.1: non-verdict normal is not replaced", typeof r.message === "string" && r.message.indexOf("normal flow") !== -1, r.message);
  });
  await withMock([
    toolMsg([{ id: "b1", function: { name: "check_overlap", arguments: JSON.stringify({ events: [{ name: "trip", date: "2026-11-28" }] }) } }]),
    textMsg("Your trip is completely safe, guaranteed."),
  ], async () => {
    const r: any = await runLavenderAgent("trip on Nov 28", CTX);
    check("Q2.1: overlap survives verdict prose", !!(r.planOverlaps && r.planOverlaps.length === 1), r.planOverlaps);
    check("Q2.1: event survives verdict prose", !!(r.plannedEvents && r.plannedEvents.length === 1), r.plannedEvents);
    check("Q2.1: verdict words replaced with neutral summary", typeof r.message === "string" && r.message.indexOf("safe") === -1 && r.message.indexOf("Overlap checked") !== -1, r.message);
    check("Q2.1: guard step flagged", (r.activityTrail || []).some((a: any) => a.step === "Output Guard"), r.activityTrail);
  });
  await withMock([textMsg("35 days is completely normal for you.")], async () => {
    const r: any = await runLavenderAgent("heavy flow with cramps today", CTX);
    check("Q2.1: pure verdict replaced by refusal", r.message === REDIRECT_MESSAGES.verdict, r.message);
  });
}

// --- Q2.2 no phantom success claims ---
async function q22() {
  await withMock([
    toolMsg([logCall("c1", { date: "2026-12-25", kind: "period_started" })]),
    textMsg("All logged!"),
  ], async () => {
    const r: any = await runLavenderAgent("period started December 25", { currentDate: "2026-11-01" });
    check("Q2.2: future date has no entry", !r.entry, r.entry);
    check("Q2.2: failure names the reason", typeof r.message === "string" && r.message.indexOf("I could not save that:") === 0 && r.message.indexOf("Which date did you mean?") !== -1, r.message);
  });
  await withMock([
    toolMsg([logCall("d1", { date: "2026-02-30", kind: "period_started" })]),
    textMsg("Done, saved!"),
  ], async () => {
    const r: any = await runLavenderAgent("period started February 30", { currentDate: "2026-11-01" });
    check("Q2.2: impossible date has no entry", !r.entry, r.entry);
    check("Q2.2: impossible date explains", typeof r.message === "string" && r.message.indexOf("I could not save that:") === 0, r.message);
  });
  await withMock([textMsg("Done, all logged!")], async () => {
    const r: any = await runLavenderAgent("cramps today", { currentDate: "2026-11-01" });
    check("Q2.2: success prose with nothing saved is replaced", typeof r.message === "string" && r.message.indexOf("no valid entry or event") !== -1, r.message);
  });
}

await q21();
await q22();
console.log("Q2 part 1 Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
