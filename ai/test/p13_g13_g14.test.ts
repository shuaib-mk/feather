// Prompt 13 Groups 13-14: contradictions ask; demo data survives a refresh.
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
import fs from "node:fs";
import { parseLocally, runLavenderAgent } from "../backend/agent";
import { applyDemoUrlParam, resetDemoData, enterDemoMode, exitDemoMode, isDemoActive, isStorageVolatile } from "../../client/src/lib/demoMode";
import { saveLogEntry, loadCycleData } from "../../client/src/cycleStorage";
import { upsertEvent, loadEvents } from "../../client/src/lib/events";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const T = "2026-11-04";

async function main() {
  // ---------- Group 13 ----------
  const a: any = parseLocally("I have heavy flow but no bleeding", T, {});
  check("G13 repro: 'heavy flow but no bleeding' -> focused question, no slip", !a.entry && a.needsClarification === true && /heavy flow and no bleeding — which should I record\?/.test(a.message), a.message);
  for (const t of ["light flow, no flow today", "medium flow today but I'm not bleeding", "heavy bleeding but I haven't bled"]) {
    const r: any = parseLocally(t, T, {});
    check(`G13: contradiction '${t}' asks first`, !r.entry && r.needsClarification === true && /which should I record/.test(r.message), r.message);
  }
  for (const [t, flow] of [["heavy flow today", "heavy"], ["no bleeding today", "none"]] as const) {
    const r: any = parseLocally(t, T, {});
    check(`G13: non-contradictory '${t}' still logs ${flow}`, r.entry?.flow === flow, r.entry);
  }
  const pend: any = { date: T, flow: "heavy", symptoms: [], mood: null, energy: null, sleep: null, notes: null, kind: "daily_log" };
  const corr: any = parseLocally("light, not heavy", T, { pendingEntry: pend });
  check("G13: a 'light, not heavy' correction is not treated as a contradiction", corr.entry?.flow === "light", corr);
  const fri: any = parseLocally("log it for Friday", T, {});
  check("G13: 'log it for Friday' does not guess a date", !fri.entry, fri.entry);
  process.env.META_API_KEY = "k";
  const orig = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { role: "assistant", content: "Logged none." } }] }) }; }) as any;
  try {
    const lv: any = await runLavenderAgent("I have heavy flow but no bleeding", { currentDate: T });
    check("G13 live: contradiction is asked about before any model call", !lv.entry && /which should I record/.test(lv.message) && calls === 0, { calls, m: lv.message });
  } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }

  // ---------- Group 14 ----------
  for (const k in store) delete store[k];
  check("G14: ?demo=1 enters demo mode", applyDemoUrlParam("?demo=1", T) === true && isDemoActive());
  const baseline = loadCycleData().logs.length;
  saveLogEntry({ logDate: T, flow: "light", symptoms: ["cramps"] as any, mood: null, energy: null, sleepHours: null, notes: "judge test", kind: "daily_log" });
  upsertEvent({ title: "judge exam", date: "2026-12-01", source: "voice" });
  // A refresh re-runs the URL handling (second ?demo=1 visit) and the Try Demo button.
  applyDemoUrlParam("?demo=1", T);
  enterDemoMode(T);
  const afterReload = loadCycleData();
  check("G14 repro: a saved demo log survives a refresh of the demo URL", afterReload.logs.some((l) => l.notes === "judge test") && afterReload.logs.length === baseline + 1, afterReload.logs.length);
  check("G14: a saved demo event survives a refresh", loadEvents().some((e) => e.title === "judge exam"));
  resetDemoData(T);
  check("G14: explicit 'Reset demo' restores the baseline", loadCycleData().logs.length === baseline && !loadCycleData().logs.some((l) => l.notes === "judge test") && !loadEvents().some((e) => e.title === "judge exam"));
  saveLogEntry({ logDate: T, flow: "light", symptoms: [] as any, mood: null, energy: null, sleepHours: null, notes: "again", kind: "daily_log" });
  store["feather_cycle_vault_v1"] = JSON.stringify({ periods: [], logs: [{ id: 1, logDate: "2026-10-01", flow: "heavy", symptoms: [], mood: null, energy: null, sleepHours: null, notes: "REAL" }] });
  exitDemoMode();
  check("G14: 'Exit demo' discards demo data and leaves the real vault untouched", !isDemoActive() && store["feather_demo_v1"] == null && JSON.parse(store["feather_cycle_vault_v1"]).logs[0].notes === "REAL");
  check("G14: working storage is not reported as volatile", isStorageVolatile() === false);
  const app = fs.readFileSync("client/src/App.tsx", "utf8");
  check("G14: App uses the idempotent demo URL handler", /applyDemoUrlParam\(window\.location\.search\)/.test(app));
  const layout = fs.readFileSync("client/src/components/AppLayout.tsx", "utf8");
  check("G14 UI: banner offers 'Reset demo' and warns when storage is volatile", /data-testid="reset-demo"/.test(layout) && /data-testid="storage-volatile"/.test(layout));
}

main().then(() => { console.log(`\nP13 Groups 13-14: ${passed} passed, ${failed} failed.`); process.exit(failed > 0 ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
