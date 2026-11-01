/** Q2: live path honesty. */
import { parseLocally, runLavenderAgent } from "../backend/agent";
import { REDIRECT_MESSAGES, MEDICAL_REFUSAL_MESSAGE } from "../backend/guardrail";

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
if (failed > 0) process.exit(1);

// --- Q2.3 multi-date coverage: model logs fewer dates than stated ---
async function q23() {
  await withMock([
    toolMsg([logCall("e1", { date: "2026-10-02", kind: "period_started" })]),
    textMsg("Logged."),
  ], async () => {
    const r: any = await runLavenderAgent("I had my period on October 2nd and September 9th", { currentDate: TODAY });
    check("Q2.3: partial multi-date disclosed", typeof r.message === "string" && r.message.indexOf("I only prepared 1 of 2 dates: 2026-09-09. Say the rest again.") !== -1, r.message);
    check("Q2.3: logged date kept", !!r.entry && r.entry.date === "2026-10-02", r.entry);
  });
  await withMock([
    toolMsg([logCall("e2", { date: "2026-10-02", kind: "period_started" })]),
    textMsg("Logged."),
  ], async () => {
    const r: any = await runLavenderAgent("my period was from October 2 to October 6", { currentDate: TODAY });
    check("Q2.3: range end missing is disclosed", typeof r.message === "string" && r.message.indexOf("I only prepared 1 of 2 dates: 2026-10-06. Say the rest again.") !== -1, r.message);
  });
  await withMock([
    toolMsg([
      logCall("e3", { date: "2026-10-02", kind: "period_started" }),
      logCall("e4", { date: "2026-09-09", kind: "period_started" }),
    ]),
    textMsg("Logged both."),
  ], async () => {
    const r: any = await runLavenderAgent("I had my period on October 2nd and September 9th", { currentDate: TODAY });
    check("Q2.3: all dates logged means silence", typeof r.message === "string" && r.message.indexOf("I only prepared") === -1, r.message);
  });
}


await q23();


// --- Q2.4 questions create no log; own data answered ---
{
  const ctx: any = { currentDate: TODAY, periods: [{ startDate: "2026-08-14" }, { startDate: "2026-09-09" }, { startDate: "2026-10-02" }] };
  const last = parseLocally("when did my last period start", TODAY, ctx);
  check("Q2.4: last start answered", !!last.message && last.message.indexOf("Oct 2") !== -1 && last.entry === null && last.needsClarification === false, last.message);
  const usual = parseLocally("how long are my cycles usually", TODAY, ctx);
  check("Q2.4: cycle length answered from logs", !!usual.message && usual.entry === null && usual.message.indexOf("logged cycles") !== -1, usual.message);
  const longest = parseLocally("what was my longest cycle", TODAY, ctx);
  check("Q2.4: longest answered, no entry", !!longest.message && longest.entry === null, longest.message);
  const many = parseLocally("how many periods have I logged", TODAY, ctx);
  check("Q2.4: count answered, no entry", !!many.message && many.entry === null, many.message);
  const sept = parseLocally("did I log anything in September", TODAY, { currentDate: TODAY, periods: [{ startDate: "2026-09-09" }, { startDate: "2026-10-02" }], logs: [{ logDate: "2026-09-20" }] } as any);
  check("Q2.4: month lookup lists logged dates", !!sept.message && sept.message.indexOf("Sep 9") !== -1 && sept.message.indexOf("Sep 20") !== -1 && sept.entry === null, sept.message);
  const nosept = parseLocally("did I log anything in September", TODAY, { currentDate: TODAY, periods: [{ startDate: "2026-10-02" }], logs: [] } as any);
  check("Q2.4: empty month says so", !!nosept.message && nosept.message.indexOf("Nothing logged in September") !== -1 && nosept.entry === null, nosept.message);
  const plain = parseLocally("will it rain tomorrow", TODAY, ctx);
  check("Q2.4: unrelated question creates no entry", plain.entry === null, plain.entry);
}

// --- Q2.5 mixed log plus medical question ---
{
  const mixed = parseLocally("my period started yesterday and is that normal", TODAY, {} as any);
  check("Q2.5: mixed keeps the slip", !!mixed.entry && mixed.entry.date === "2026-10-31", mixed.entry);
  check("Q2.5: mixed refuses only the medical part", typeof mixed.message === "string" && mixed.message.indexOf("t say whether that") !== -1 && mixed.message.indexOf("talk to a doctor") !== -1, mixed.message);
  const pure = parseLocally("is my flow normal", TODAY, {} as any);
  check("Q2.5: pure verdict refused with fixed message", !pure.entry && pure.message === MEDICAL_REFUSAL_MESSAGE, pure.message);
  await withMock([textMsg("Done.")], async () => {
    const live: any = await runLavenderAgent("my period started yesterday and is that normal", { currentDate: TODAY });
    check("Q2.5: live mixed handled offline with slip", !!live.entry && live.mode === "offline" && typeof live.message === "string" && live.message.indexOf("talk to a doctor") !== -1, live.message);
  });
}
console.log("Q2 Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
