import fs from "node:fs";
/** Prompt 12A: live agent call retries before any offline fallback. */
import { sendAgentMessage, AGENT_ATTEMPTS, AGENT_TIMEOUT_MS } from "../../ai/frontend/aiClient";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
function mockFetch(impl: (url: string, init: any, call: number) => Promise<any>) {
  const orig = globalThis.fetch;
  let calls = 0;
  (globalThis as any).fetch = async (url: string, init: any) => { calls++; return impl(url, init, calls); };
  return { restore: () => { (globalThis as any).fetch = orig; }, calls: () => calls };
}
const okEntry = (date: string) => ({ ok: true, status: 200, json: async () => ({ message: "Prepared your log for review.", entry: { date, kind: "period_started", flow: "heavy", symptoms: [], mood: null, energy: null, sleep: null, notes: null, landmarkName: null, isApproximate: false }, needsClarification: false, activityTrail: [], toolCalls: [], mode: "live", modeReason: null }) });
const fail = (status: number) => ({ ok: false, status, json: async () => ({}), text: async () => "" });
async function main() {
  check("P12: two attempts configured", AGENT_ATTEMPTS === 2, String(AGENT_ATTEMPTS));
  check("P12: longer per-attempt timeout", AGENT_TIMEOUT_MS === 45000, String(AGENT_TIMEOUT_MS));
  {
    const seen: Array<[number, number]> = [];
    const m = mockFetch(async (_u, _i, n) => (n < 2 ? fail(502) : okEntry("2026-11-02")));
    const r: any = await sendAgentMessage("period started Nov 2", { currentDate: "2026-11-02" }, [], (a, t) => { seen.push([a, t]); });
    check("P12: fail, then succeed gives the LIVE result", r.isOfflineFallback === false && r.entry && r.entry.date === "2026-11-02", JSON.stringify(r.entry) + "/" + r.isOfflineFallback);
    check("P12: two attempts made", m.calls() === 2, String(m.calls()));
    check("P12: retry callback reports attempts", JSON.stringify(seen) === JSON.stringify([[2, 2]]), JSON.stringify(seen));
    m.restore();
  }
  {
    const m = mockFetch(async () => fail(502));
    const r: any = await sendAgentMessage("hello there", { currentDate: "2026-11-02" }, []);
    check("P12: always fail falls back only after all attempts", m.calls() === 2 && r.isOfflineFallback === true, m.calls() + "/" + r.isOfflineFallback);
    check("P12: exhausted retries produce no slip and no success wording", r.entry == null && !/logged|saved|prepared|done/i.test(r.message || ""), r.message);
    m.restore();
  }
  {
    const m = mockFetch(async (_url: any, _init: any, n) => {
      if (n === 1) return fail(502);
      return new Promise((res) => { setTimeout(() => res(okEntry("2026-11-03")), 150); });
    });
    const seen: Array<[number, number]> = [];
    const r: any = await sendAgentMessage("period started", { currentDate: "2026-11-02" }, [], (a, t) => { seen.push([a, t]); }, 5000);
    await new Promise((res) => setTimeout(res, 2500));
    check("P12: retry success yields exactly one slip", r.isOfflineFallback === false && r.entry && r.entry.date === "2026-11-03" && m.calls() === 2, JSON.stringify(r.entry) + "/" + m.calls());
    check("P12: retry fired once", JSON.stringify(seen) === JSON.stringify([[2, 2]]), JSON.stringify(seen));
    m.restore();
  }
  {
    const m = mockFetch(async () => fail(504));
    const r504: any = await sendAgentMessage("hello there", { currentDate: "2026-11-02" }, []);
    check("P12: 504 falls back immediately without retries", m.calls() === 1 && r504.isOfflineFallback === true, m.calls() + "/" + r504.isOfflineFallback);
    m.restore();
  }
  {
    const m = mockFetch(async (_url: any, init: any) => new Promise((_res, rej) => {
      if (init && init.signal) init.signal.addEventListener("abort", () => { const e: any = new Error("aborted"); e.name = "AbortError"; rej(e); });
    }));
    const rto: any = await sendAgentMessage("period started", { currentDate: "2026-11-02" }, [], undefined, 60);
    check("P12: timeout never retries", m.calls() === 1 && rto.isOfflineFallback === true, m.calls() + "/" + rto.isOfflineFallback);
    m.restore();
  }
  {
    const m = mockFetch(async () => fail(400));
    const r: any = await sendAgentMessage("hello there", { currentDate: "2026-11-02" }, []);
    check("P12: 4xx falls back immediately without retries", m.calls() === 1 && r.isOfflineFallback === true, m.calls() + "/" + r.isOfflineFallback);
    m.restore();
  }
  {
    const m = mockFetch(async () => ({ ok: false, status: 429, json: async () => ({ error: "Slow down" }) }));
    const r: any = await sendAgentMessage("hello there", { currentDate: "2026-11-02" }, []);
    check("P12: 429 keeps the rate-limit message with no retry and no offline parse", m.calls() === 1 && r.rateLimited === true && (r.message || "").indexOf("Slow down") !== -1, r.message);
    m.restore();
  }
  const vpage = fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8");
  check("P12B: retry progress reuses the thinking line", vpage.indexOf("retryNotice") !== -1 && vpage.indexOf("Reaching the AI") !== -1, "retry ui");
  check("P12B: staged progress labels exist", vpage.indexOf("Transcribing") !== -1 && vpage.indexOf("Preparing your log") !== -1 && vpage.indexOf("Thinking...") !== -1 && vpage.indexOf("pipelineStage") !== -1, "stages");
  check("P12B: round trip is instrumented", vpage.indexOf("featherVoicePerf") !== -1 && vpage.indexOf("markVoiceTiming") !== -1, "marks");
  check("P12B: API path is pre-warmed on Voice open", vpage.indexOf("/api/agent") !== -1 && vpage.indexOf("OPTIONS") !== -1, "prewarm");
    console.log("P12 Retry Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
}
main();
