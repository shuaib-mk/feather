// Prompt 13 Group 11: a send can never hang silently.
const mk = () => { const st: Record<string, string> = {}; return { getItem: (k: string) => (k in st ? st[k] : null), setItem: (k: string, v: string) => { st[k] = String(v); }, removeItem: (k: string) => { delete st[k]; }, clear: () => { for (const k in st) delete st[k]; } }; };
(globalThis as any).localStorage = mk(); (globalThis as any).sessionStorage = mk();
import fs from "node:fs";
import { sendAgentMessage, getWatchdogActivations, WATCHDOG_MS, AGENT_TIMEOUT_MS, AGENT_ATTEMPTS } from "../frontend/aiClient";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const T = "2026-11-04";

async function main() {
  const orig = globalThis.fetch;
  const bodies: string[] = [];
  try {
    // Never-resolving fetch -> watchdog fires, lands on the fallback state with the real reason
    globalThis.fetch = ((_: any, init: any) => { bodies.push(init.body); return new Promise(() => {}); }) as any;
    const before = getWatchdogActivations();
    const t0 = Date.now();
    const r: any = await sendAgentMessage("period started today, heavy flow", { currentDate: T }, [], undefined, 60000, 300);
    check("G11: never-resolving fetch -> watchdog fires within its budget", r.watchdogFired === true && Date.now() - t0 < 2000, Date.now() - t0);
    check("G11: fallback state carries the real reason and offers a retry", r.isOfflineFallback === true && r.canRetryLive === true && /didn't answer within/.test(r.fallbackReason), r.fallbackReason);
    check("G11: the user still gets a usable on-device result", r.entry?.flow === "heavy" && r.entry?.date === T, r.entry);
    check("G11: watchdog activations are counted for Diagnostics", getWatchdogActivations() === before + 1);

    // Hung BODY (headers arrive, body never does) is caught too
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) })) as any;
    const hb: any = await sendAgentMessage("cramps today", { currentDate: T }, [], undefined, 60000, 300);
    check("G11: a reply body that never finishes still lands on the fallback", hb.isOfflineFallback === true && hb.canRetryLive === true, hb);

    // Retry re-sends the identical message
    globalThis.fetch = ((_: any, init: any) => { bodies.push(init.body); return Promise.resolve({ ok: true, status: 200, json: async () => ({ message: "Prepared.", entry: { date: T, flow: "heavy", symptoms: [], mood: null, energy: null, sleep: null, notes: null, kind: "period_started" }, mode: "live" }) }); }) as any;
    const again: any = await sendAgentMessage("period started today, heavy flow", { currentDate: T }, [], undefined, 60000, 300);
    const sent = bodies.map((b) => JSON.parse(b).message);
    check("G11: retry sends the identical message and reaches the live AI", again.isOfflineFallback === false && again.mode === "live" && sent[0] === sent[sent.length - 1], sent);

    // Slow-but-successful inside the envelope -> no watchdog
    globalThis.fetch = (() => new Promise((res) => setTimeout(() => res({ ok: true, status: 200, json: async () => ({ message: "Prepared.", mode: "live", needsClarification: true }) }), 150))) as any;
    const n0 = getWatchdogActivations();
    const slow: any = await sendAgentMessage("hello", { currentDate: T }, [], undefined, 60000, 1000);
    check("G11: slow-but-successful reply inside the envelope -> no watchdog", !slow.watchdogFired && slow.isOfflineFallback === false && getWatchdogActivations() === n0, slow);

    // Network failure -> plain-words reason, retry offered
    globalThis.fetch = (async () => { throw new TypeError("fetch failed"); }) as any;
    const net: any = await sendAgentMessage("cramps today", { currentDate: T }, [], undefined, 60000, 5000);
    check("G11: unreachable live AI -> plain-words reason + retry", net.canRetryLive === true && /couldn't be reached/.test(net.fallbackReason), net.fallbackReason);
  } finally { globalThis.fetch = orig; }

  check("G11: the default watchdog covers the full p12 retry envelope", WATCHDOG_MS >= AGENT_ATTEMPTS * AGENT_TIMEOUT_MS, WATCHDOG_MS);
  const vf = fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8");
  check("G11 UI: fallback card shows the reason and a 'Try the AI again' button that re-sends the same text", /data-testid="live-fallback-card"/.test(vf) && /runAgentPipeline\(f\.text, f\.pending, f\.source\)/.test(vf) && /Try the AI again/.test(vf));
  const sp = fs.readFileSync("client/src/pages/SettingsPage.tsx", "utf8");
  check("G11 UI: Diagnostics shows the watchdog counter", /data-testid="watchdog-count"/.test(sp));
  const ag = fs.readFileSync("ai/backend/agent.ts", "utf8");
  check("G11 server: the model abort timer stays armed until the body is read", /data = await res\.json\(\);\s*\} catch \(bodyErr: any\) \{\s*clearTimeout\(callTimer\);/.test(ag));
}

main().then(() => { console.log(`\nP13 Group 11: ${passed} passed, ${failed} failed.`); process.exit(failed > 0 ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
