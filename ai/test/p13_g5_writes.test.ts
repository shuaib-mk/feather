// Prompt 13 Group 5: no log without a confirmed slip; no slip-less "logged" claims.
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
import fs from "node:fs";
import path from "node:path";
import { runLavenderAgent, parseLocally } from "../backend/agent";
import { saveLogEntry } from "../../client/src/cycleStorage";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const T = "2026-11-04";
const snapshot = () => JSON.stringify(Object.keys(store).filter((k) => /vault|events|demo_v1/.test(k)).sort().map((k) => [k, store[k]]));
const prose = (content: string) => ({ choices: [{ message: { role: "assistant", content } }] });
const tool = (name: string, args: any) => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name, arguments: JSON.stringify(args) } }] } }] });

async function withModel(reply: any, fn: () => Promise<void>) {
  process.env.META_API_KEY = "k";
  const orig = globalThis.fetch;
  let n = 0;
  globalThis.fetch = (async () => { const r = Array.isArray(reply) ? reply[Math.min(n++, reply.length - 1)] : reply; return { ok: true, status: 200, json: async () => r, text: async () => "" }; }) as any;
  try { await fn(); } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }
}

async function main() {
  // Seed a real vault so the invariant compares non-trivial bytes.
  saveLogEntry({ logDate: "2026-11-02", flow: "medium", symptoms: ["cramps", "headache"] as any, mood: null, energy: null, sleepHours: null, notes: "seed", kind: "daily_log" });
  const before = snapshot();

  // (a) prose-only live reply that asserts a log -> real slip from the on-device parser, honest wording
  await withModel(prose("It looks like your period started today with heavy flow and cramps — all logged!"), async () => {
    const r: any = await runLavenderAgent("I started my period today, the flow is heavy and I have cramps", { currentDate: T });
    check("G5a: an unbacked 'all logged' claim is replaced by an honest reply", !r.entry && !/all logged/i.test(r.message) && /nothing was saved/i.test(r.message), r.message);
  });
  // (a, reproduction wording) neutral prose with no slip -> the on-device slip is shown, confirm-gated
  await withModel(prose("It looks like your period started today, with heavy flow and cramps."), async () => {
    const r: any = await runLavenderAgent("I started my period today, the flow is heavy and I have cramps", { currentDate: T });
    check("G5a: prose-only live reply still yields a confirm-gated slip", !!r.entry && r.entry.date === T && r.entry.flow === "heavy" && r.entry.symptoms.includes("cramps"), r.entry);
    check("G5a: the reply says where the slip came from and that nothing is saved yet", /nothing is saved until you do/i.test(r.message), r.message);
  });
  // (b) the slip contains only facts from THIS message (nothing pulled from history)
  await withModel(prose("Got it, your period started this morning."), async () => {
    const r: any = await runLavenderAgent("I got my period this morning", { currentDate: T, conversationHistory: [{ role: "user", content: "the flow is heavy and I have cramps" }] } as any);
    check("G5b: recovered slip has no facts that were not in the message", !!r.entry && r.entry.flow == null && (r.entry.symptoms || []).length === 0, r.entry);
  });
  // Prose that claims a log for a message with nothing loggable -> honest, no slip
  await withModel(prose("Done, I've logged that for you."), async () => {
    const r: any = await runLavenderAgent("hello there feather", { currentDate: T });
    check("G5: a 'logged' claim with nothing to log is never relayed", !r.entry && !/I've logged that/i.test(r.message || ""), r.message);
  });

  // Send matrix: no send writes storage, whatever the model does.
  const sends = ["I started my period today, heavy flow", "make it light", "undo that", "exam on Nov 20", "what's my average cycle?", "my period started 2 days before New Year's", "cramps and a headache today", "how many cycles have I logged"];
  const replies = [prose("Logged!"), tool("log_entry", { date: T, flow: "heavy", kind: "period_started", symptoms: ["cramps"] }), { choices: [{ message: { role: "assistant", content: "" } }] }, tool("log_entry", { date: "2026-12-30", flow: "heavy" })];
  for (const reply of replies) {
    await withModel(reply, async () => {
      for (const t of sends) { await runLavenderAgent(t, { currentDate: T, pendingEntry: { date: T, flow: "medium", symptoms: [], mood: null, energy: null, sleep: null, notes: null } as any }); }
    });
  }
  for (const t of sends) parseLocally(t, T, {});
  check("G5: storage is byte-identical after every send in the matrix (live + offline)", snapshot() === before);

  // Static audit: storage writes exist only on explicit user actions.
  const root = "client/src";
  const files: string[] = [];
  const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f)) files.push(p); } };
  walk(root); walk("ai/frontend");
  const WRITE_RE = /\b(saveLog|saveLogEntry|addOrUpdateLog|addOrUpdatePeriod|bulkSavePeriods|saveBackfillRows|saveCycleData|importCycleDataJSON)\s*\(/g;
  const found: Record<string, number> = {};
  for (const f of files) {
    if (f.endsWith("cycleStorage.ts") || f.endsWith(path.join("lib", "backfill.ts"))) continue; // storage layer itself
    const src = fs.readFileSync(f, "utf8").replace(/export function \w+\(/g, "");
    const n = (src.match(WRITE_RE) || []).length;
    if (n) found[f.split(path.sep).join("/")] = n;
  }
  const ALLOWED: Record<string, number> = {
    "client/src/pages/VoiceFlowPage.tsx": 3,      // confirm button (saveLog + end date), backfill save button
    "client/src/pages/DiaryScannerPage.tsx": 1,   // scanner import button
    "client/src/components/PrivacySettings.tsx": 2, // backup import
    "client/src/App.tsx": 1,                      // restore from backup while locked
    "client/src/context/CycleContext.tsx": 4,     // wrappers + erase-all + import
    "client/src/pages/CalendarPage.tsx": 1,       // flow dropdown on a saved day (explicit edit, all fields kept)
  };
  check("G5: the set of storage-write call sites matches the audited allowlist", JSON.stringify(found, Object.keys(found).sort()) === JSON.stringify(ALLOWED, Object.keys(ALLOWED).sort()), found);
  const vf = fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8");
  const a = vf.indexOf("const handleSaveConfirmed"), b = vf.indexOf("const handleSaveBackfill"), c = vf.indexOf("saveLog(");
  check("G5: the voice page's only log write is inside the confirm handler", a > 0 && c > a && c < b);
  const runStart = vf.indexOf("const runAgentPipeline"), runEnd = vf.indexOf("const handleSaveConfirmed");
  const pipeline = vf.slice(runStart, runEnd);
  check("G5: the send pipeline contains no storage write", !WRITE_RE.test(pipeline));
}

main().then(() => { console.log(`\nP13 Group 5: ${passed} passed, ${failed} failed.`); process.exit(failed > 0 ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
