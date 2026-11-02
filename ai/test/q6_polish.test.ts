/** Q6.9 polish: next-weekday ambiguity asks, banner/sticky/thinking pins. */
import { resolveDateExpression } from "../backend/dateArithmetic";
import { parseLocally } from "../backend/agent";
import fs from "node:fs";
import { saveCycleData, loadCycleData, saveLogEntry } from "../../client/src/cycleStorage";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
{
  const r = resolveDateExpression("next Tuesday", "2026-11-02");
  check("Q6.9: next Tuesday asks with both dates", r.date === null && r.needsClarification === true && r.clarificationQuestion === "This coming Tuesday Nov 3, or Tuesday Nov 10?", JSON.stringify(r));
  const r2 = resolveDateExpression("next Tuesday", "2026-11-03");
  check("Q6.9: same-weekday rolls a week forward", r2.clarificationQuestion === "This coming Tuesday Nov 10, or Tuesday Nov 17?", JSON.stringify(r2));
  const r3 = resolveDateExpression("Next Monday", "2026-11-02");
  check("Q6.9: next Monday from Monday skips today", r3.clarificationQuestion === "This coming Monday Nov 9, or Monday Nov 16?", JSON.stringify(r3));
  const r4 = resolveDateExpression("next friday", "2026-11-02");
  check("Q6.9: lowercase weekday", r4.clarificationQuestion === "This coming Friday Nov 6, or Friday Nov 13?", JSON.stringify(r4));
  const r5 = resolveDateExpression("period started next tuesday", "2026-11-02");
  check("Q6.9: inside a log sentence", r5.needsClarification === true && r5.clarificationQuestion === "This coming Tuesday Nov 3, or Tuesday Nov 10?", JSON.stringify(r5));
  const r6 = resolveDateExpression("last Tuesday", "2026-11-02");
  check("Q6.9: last Tuesday still resolves", r6.date === "2026-10-27" && !r6.needsClarification, JSON.stringify(r6));
  const r7 = resolveDateExpression("this Tuesday", "2026-11-02");
  check("Q6.9: this Tuesday unchanged", r7.date === "2026-10-27" && !r7.needsClarification, JSON.stringify(r7));
}
{
  const r = parseLocally("period started next Tuesday", "2026-11-02", {} as any);
  check("Q6.9: no slip, question asked", r.entry === null && r.needsClarification === true && r.message === "This coming Tuesday Nov 3, or Tuesday Nov 10?", r.message);
}
{
  const dash = fs.readFileSync("client/src/pages/DashboardPage.tsx", "utf8");
  check("Q6.9: banner hides once a period exists", dash.includes("!isDemoActive && !hasHistory"), "banner gate missing");
  const voice = fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8");
  check("Q6.9: save actions sticky", voice.includes("sticky bottom-0"), "sticky missing");
  check("Q6.9: thinking status line", voice.includes("role=" + String.fromCharCode(34) + "status" + String.fromCharCode(34)) && voice.includes("Thinking..."), "thinking line missing");
  const agent = fs.readFileSync("ai/backend/agent.ts", "utf8");
  check("Q6.9: live prompt covers next-weekday", agent.includes("Next-weekday ambiguity"), "prompt line missing");
}
{
  const gateStore = {};
  (globalThis as any).localStorage = { getItem: (k) => gateStore[k] ?? null, setItem: (k, v) => { gateStore[k] = String(v); }, removeItem: (k) => { delete gateStore[k]; }, clear: () => { for (const k in gateStore) delete gateStore[k]; } };
  const flowLog = (logDate, flow) => ({ logDate, flow, symptoms: [], mood: null, energy: null, sleepHours: null, notes: null });
  saveCycleData({ periods: [], logs: [] });
  saveLogEntry(flowLog("2026-03-01", "heavy"));
  saveLogEntry(flowLog("2026-03-05", "heavy"));
  check("Q6.9: flow-derived short gap keeps legacy split", loadCycleData().periods.length === 2, loadCycleData().periods.length);
  saveCycleData({ periods: [{ id: 1, startDate: "2026-10-02", endDate: "2026-10-06" }], logs: [] });
  const g = saveLogEntry({ logDate: "2026-10-12", flow: null, symptoms: [], mood: null, energy: null, sleepHours: null, notes: null, kind: "period_started" }, { kind: "period_started" });
  check("Q6.9: explicit start still gates", g.needsConfirmation === true && g.saved === false, g.confirmationReason);
}
console.log("Q6 Polish Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
