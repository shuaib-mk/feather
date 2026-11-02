/** Q7.3: honest negation replies + success-claim guard + failure wording. */
import { parseLocally, runLavenderAgent } from "../backend/agent";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const TODAY = "2026-11-02";
const mk = (date: string, symptoms: string[]) => ({ date, flow: null, symptoms, mood: null, energy: null, sleep: null, notes: "x", landmarkName: null, isApproximate: false, kind: "daily_log" });
const textMsg = (content: string) => ({ choices: [{ message: { role: "assistant", content } }] });
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
async function main() {
  const r = parseLocally("no cramps today", TODAY, {} as any);
  check("Q7.3 STEP0: negation-only replies Noted, nothing to log.",
    r.entry === null && r.message === "Noted, nothing to log.", r.message);
  const r2 = parseLocally("no headache today", TODAY, { recentEntry: mk(TODAY, ["headache"]) } as any);
  check("Q7.3: on-note negation still asks first, no logged wording",
    r2.entry === null && r2.message.indexOf("logged") === -1 && r2.needsClarification === true, r2.message);
  await withMock([textMsg("logged for today")], async () => {
    const live: any = await runLavenderAgent("no cramps today", { currentDate: TODAY, periods: [], logs: [] } as any);
    check("Q7.3 STEP0: live negation-only never claims a save",
      live.entry == null && live.message === "Noted, nothing to log.", live.message);
  });
  await withMock([textMsg("All prepared!")], async () => {
    const live: any = await runLavenderAgent("cramps update", { currentDate: TODAY, periods: [], logs: [] } as any);
    check("Q7.3 STEP0: prepared with no entry is not relayed",
      live.entry == null && live.message.indexOf("prepared") === -1, live.message);
  });
  const fs = await import("node:fs");
  const voice = fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8");
  check("Q7.3: failed save shows specific reason",
    voice.indexOf("Nothing was saved because") !== -1, "voice wording");
  const ctx = fs.readFileSync("client/src/context/CycleContext.tsx", "utf8");
  check("Q7.3: error banner clears on navigation",
    ctx.indexOf("useLocation") !== -1 && ctx.indexOf("pathname") !== -1, "banner clear");
}
main().then(() => {
  console.log("Q7 Negation Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
});
