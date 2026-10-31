// Fact-coverage: disclosure must be computed from structured output (slips/events), never model prose.
import { runLavenderAgent } from "../backend/agent";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log(`[PASS] ${name}`); passed++; }
  else { console.error(`[FAIL] ${name}`, extra ?? ""); failed++; }
}
const TODAY = "2026-10-31";
const SENTENCE = "my period started three days ago and the flow was medium on the first day but heavy yesterday with bad cramps and a headache and I also have an exam coming up on November 20 and a wedding to attend";
const DISCLOSURE = "I couldn't place: heavy flow yesterday (2026-10-30) as a separate day \u2014 log that day separately if you want it saved.";

function mockModel(responses: any[]) {
  let calls = 0;
  globalThis.fetch = (async () => {
    const r = responses[Math.min(calls, responses.length - 1)];
    calls++;
    return { ok: true, json: async () => r };
  }) as any;
}
const toolMsg = (toolCalls: any[]) => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: toolCalls } }] });
const textMsg = (content: string) => ({ choices: [{ message: { role: "assistant", content } }] });
const logCall = (id: string, args: any) => ({ id, function: { name: "log_entry", arguments: JSON.stringify(args) } });

async function main() {
  process.env.META_API_KEY = "test-key";
  process.env.META_BASE_URL = "https://mock.meta.test/v1";
  const originalFetch = globalThis.fetch;
  try {
    // Fixture A: prose claims the heavy-yesterday note was added; structured output has only the Oct 28 slip.
    mockModel([
      toolMsg([logCall("a1", { date: "2026-10-28", flow: "medium", symptoms: ["cramps", "headache"], kind: "period_started" })]),
      textMsg("Logged your period start for October 28th with medium flow, plus cramps and headache noted \u2014 and I added your note about heavy flow yesterday. When is the wedding?"),
    ]);
    const a: any = await runLavenderAgent(SENTENCE, { currentDate: TODAY });
    check("A: live mode", a.mode === "live", a.mode);
    check("A: structured entry is only Oct 28 medium", !!a.entry && a.entry.date === "2026-10-28" && a.entry.flow === "medium", a.entry);
    check("A: false prose claim is NOT edited out", typeof a.message === "string" && a.message.includes("I added your note about heavy flow yesterday"), a.message);
    check("A: disclosure appended despite prose claim", typeof a.message === "string" && a.message.includes(DISCLOSURE), a.message);

    // Fixture B: prose claims placement AND structured output contains the Oct 30 heavy entry -> no disclosure.
    mockModel([
      toolMsg([
        logCall("b1", { date: "2026-10-28", flow: "medium", symptoms: ["cramps", "headache"], kind: "period_started" }),
        logCall("b2", { date: "2026-10-30", flow: "heavy", symptoms: ["cramps", "headache"], kind: "daily_log" }),
        { id: "b3", function: { name: "check_overlap", arguments: JSON.stringify({ events: [{ name: "exam", date: "2026-11-20" }] }) } },
      ]),
      textMsg("Logged your period start for October 28th with medium flow, and your heavy flow yesterday too."),
    ]);
    const b: any = await runLavenderAgent(SENTENCE, { currentDate: TODAY });
    check("B: rendered slip is the Oct 30 heavy entry", !!b.entry && b.entry.date === "2026-10-30" && b.entry.flow === "heavy", b.entry);
    check("B: no disclosure appended (no false alarm)", typeof b.message === "string" && !b.message.includes("couldn't place"), b.message);

    // Fixture B2: Oct 30 heavy exists only in tool-call history (model logged it first,
    // then overwrote the rendered slip with Oct 28) -> NOT placed, disclosure appended.
    mockModel([
      toolMsg([
        logCall("d1", { date: "2026-10-30", flow: "heavy", symptoms: ["cramps", "headache"], kind: "daily_log" }),
        logCall("d2", { date: "2026-10-28", flow: "medium", symptoms: ["cramps", "headache"], kind: "period_started" }),
      ]),
      textMsg("Logged both days for you."),
    ]);
    const d: any = await runLavenderAgent(SENTENCE, { currentDate: TODAY });
    check("B2: tool history contains Oct 30 heavy but rendered slip is Oct 28", (d.toolCalls || []).some((c: any) => c.result?.entry?.date === "2026-10-30") && !!d.entry && d.entry.date === "2026-10-28", d.entry);
    check("B2: disclosure appended (tool-history-only entry is not placed)", typeof d.message === "string" && d.message.includes(DISCLOSURE), d.message);

    // Fixture C: prose says nothing about the fact; structured output lacks it -> disclosure appended.
    mockModel([
      toolMsg([logCall("c1", { date: "2026-10-28", flow: "medium", symptoms: ["cramps", "headache"], kind: "period_started" })]),
      textMsg("Done, logged."),
    ]);
    const c: any = await runLavenderAgent(SENTENCE, { currentDate: TODAY });
    check("C: disclosure appended when prose is silent", typeof c.message === "string" && c.message.includes(DISCLOSURE), c.message);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.META_API_KEY;
  }
  console.log(`\nFactCoverage Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}
await main();
