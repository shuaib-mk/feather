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
  check("P12: three attempts configured", AGENT_ATTEMPTS === 3, String(AGENT_ATTEMPTS));
  check("P12: generous per-attempt timeout", AGENT_TIMEOUT_MS === 30000, String(AGENT_TIMEOUT_MS));
  {
    const seen: Array<[number, number]> = [];
    const m = mockFetch(async (_u, _i, n) => (n < 3 ? fail(n === 1 ? 500 : 503) : okEntry("2026-11-02")));
    const r: any = await sendAgentMessage("period started Nov 2", { currentDate: "2026-11-02" }, [], (a, t) => { seen.push([a, t]); });
    check("P12: fail, fail, succeed gives the LIVE result", r.isOfflineFallback === false && r.entry && r.entry.date === "2026-11-02", JSON.stringify(r.entry) + "/" + r.isOfflineFallback);
    check("P12: three attempts made", m.calls() === 3, String(m.calls()));
    check("P12: retry callback reports attempts", JSON.stringify(seen) === JSON.stringify([[2, 3], [3, 3]]), JSON.stringify(seen));
    m.restore();
  }
  {
    const m = mockFetch(async () => fail(500));
    const r: any = await sendAgentMessage("hello there", { currentDate: "2026-11-02" }, []);
    check("P12: always fail falls back only after all attempts", m.calls() === 3 && r.isOfflineFallback === true, m.calls() + "/" + r.isOfflineFallback);
    check("P12: exhausted retries produce no slip and no success wording", r.entry == null && !/logged|saved|prepared|done/i.test(r.message || ""), r.message);
    m.restore();
  }
  {
    const m = mockFetch(async (_u, _i, n) => {
      if (n === 1) return new Promise((res, rej) => {
        const t = setTimeout(() => res(okEntry("2026-11-02")), 150);
        if (init && init.signal) init.signal.addEventListener("abort", () => { clearTimeout(t); const e: any = new Error("aborted"); e.name = "AbortError"; rej(e); });
      });
      return okEntry("2026-11-03");
    });
    const seen: Array<[number, number]> = [];
    const r: any = await sendAgentMessage("period started", { currentDate: "2026-11-02" }, [], (a, t) => { seen.push([a, t]); }, 60);
    await new Promise((res) => setTimeout(res, 300));
    check("P12: slow attempt-1 success racing a retry yields exactly one slip", r.isOfflineFallback === false && r.entry && r.entry.date === "2026-11-03" && m.calls() === 2, JSON.stringify(r.entry) + "/" + m.calls());
    check("P12: retry fired once for the aborted attempt", JSON.stringify(seen) === JSON.stringify([[2, 3]]), JSON.stringify(seen));
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
  console.log("P12 Retry Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
}
main();
