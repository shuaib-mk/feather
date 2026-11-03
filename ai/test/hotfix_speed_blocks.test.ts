/** Hotfix: live speed (retry/timeout/max_tokens) + fall/heavy-bleed severe tier. */
import { parseLocally, runLavenderAgent } from "../backend/agent";
import { MEDICAL_REFUSAL_MESSAGE, REDIRECT_MESSAGES, SEVERE_FALL_CARE_MESSAGE, SEVERE_SYMPTOM_ESCALATION_MESSAGE } from "../backend/guardrail";
import { AGENT_ATTEMPTS, AGENT_TIMEOUT_MS, sendAgentMessage } from "../frontend/aiClient";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}

const TODAY = "2026-11-03";
const EXACT = "i had my first period today uh it was kind of painful and a lot of blood came I do not know what to do but it was so painful and like I fell down on the ground and like that";
const toolMsg = (calls: any[]) => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: calls } }] });
const textMsg = (content: string) => ({ choices: [{ message: { role: "assistant", content } }] });
const logCall = (id: string, args: any) => ({ id, function: { name: "log_entry", arguments: JSON.stringify(args) } });

async function withLive(responses: any[], fn: () => Promise<void>) {
  process.env.META_API_KEY = "test-key";
  process.env.META_BASE_URL = "https://mock.meta.test/v1";
  const orig = globalThis.fetch;
  let i = 0; const seen: any[] = [];
  globalThis.fetch = (async (_u: any, init: any) => {
    seen.push(init && init.body ? JSON.parse(init.body) : {});
    const r = responses[Math.min(i++, responses.length - 1)];
    if (r && r.__reject) throw r.__reject;
    if (r && r.__status) return { ok: false, status: r.__status, text: async () => "err", json: async () => ({}) };
    return { ok: true, status: 200, json: async () => r };
  }) as any;
  try { await fn(); } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }
  return seen;
}

async function main() {
  // --- Exact sentence: offline ---
  {
    const r: any = parseLocally(EXACT, TODAY, {});
    check("exact: care message leads", typeof r.message === "string" && r.message.startsWith(SEVERE_FALL_CARE_MESSAGE), r.message.slice(0, 80));
    check("exact: period_started slip for today", !!r.entry && r.entry.date === TODAY && r.entry.kind === "period_started", r.entry);
    check("exact: heavy flow from 'a lot of blood'", r.entry && r.entry.flow === "heavy", r.entry && r.entry.flow);
    check("exact: no bare refusal", r.message !== MEDICAL_REFUSAL_MESSAGE && r.message !== REDIRECT_MESSAGES.verdict, r.message.slice(0, 80));
  }
  // --- Exact sentence: mocked live model that logs ---
  await withLive([toolMsg([logCall("a1", { date: TODAY, flow: "heavy", kind: "period_started" })]), textMsg("Noted.")], async () => {
    const r: any = await runLavenderAgent(EXACT, { currentDate: TODAY });
    check("exact live-log: slip kept", !!r.entry && r.entry.date === TODAY, r.entry);
    check("exact live-log: care leads", typeof r.message === "string" && r.message.startsWith(SEVERE_FALL_CARE_MESSAGE), r.message.slice(0, 80));
    check("exact live-log: mode live (chip may claim Live)", r.mode === "live", r.mode);
  });
  // --- Exact sentence: mocked live model answers text-only (verdict) ---
  await withLive([textMsg("I am so sorry that happened. Falling down with a lot of blood and pain is not normal, please see a doctor right away."), toolMsg([logCall("c1", { date: TODAY, flow: "heavy", kind: "period_started" })])], async () => {
    const r: any = await runLavenderAgent(EXACT, { currentDate: TODAY });
    check("exact text-only: corrective slip produced", !!r.entry && r.entry.date === TODAY, r.entry);
    check("exact text-only: care leads, no bare refusal", typeof r.message === "string" && r.message.startsWith(SEVERE_FALL_CARE_MESSAGE) && r.message !== MEDICAL_REFUSAL_MESSAGE, r.message.slice(0, 80));
    check("exact text-only: chip may claim Live", r.mode === "live", r.mode);
  });
  // --- 15 paraphrases (dated so each is loggable) ---
  const paras: Array<[string, string, "fall" | "classic" | "plain", string?]> = [
    ["I fainted when my period started today", TODAY, "classic"],
    ["so much blood and I fell down today", TODAY, "fall", "daily_log"],
    ["my first period came today and I am scared, there is so much blood, what do I do", TODAY, "fall"],
    ["I had my first period today", TODAY, "plain"],
    ["I got my first period just now, I fell on the ground and it hurts", TODAY, "fall"],
    ["period started today, a lot of blood came and it is so painful", TODAY, "fall"],
    ["I collapsed today when my period started", TODAY, "fall"],
    ["blacked out for a second, period started today", TODAY, "classic"],
    ["bahut khoon aaya, period started today, so painful", TODAY, "fall"],
    ["gir gayi, my period started today", TODAY, "fall"],
    ["bleeding a lot today, period started, I am scared", TODAY, "fall"],
    ["my period started today and I fell down", TODAY, "fall"],
    ["first period today, fell and hurt myself", TODAY, "fall"],
    ["period started just now, so much blood, I do not know what to do", TODAY, "fall"],
    ["I had my period today and there is a lot of blood, I feel dizzy", TODAY, "fall"],
  ];
  for (const [text, wantDate, tier, wantKind] of paras) {
    const r: any = parseLocally(text, TODAY, {});
    const wantCare = tier === "fall" ? SEVERE_FALL_CARE_MESSAGE : tier === "classic" ? SEVERE_SYMPTOM_ESCALATION_MESSAGE : null;
    check("para slip: " + text.slice(0, 42), !!r.entry && r.entry.date === wantDate && r.entry.kind === (wantKind || "period_started"), r.entry);
    if (wantCare) check("para care: " + text.slice(0, 42), typeof r.message === "string" && r.message.startsWith(wantCare), r.message.slice(0, 60));
    else check("para plain log: " + text.slice(0, 42), r.message !== MEDICAL_REFUSAL_MESSAGE && !r.message.startsWith(SEVERE_FALL_CARE_MESSAGE), r.message.slice(0, 60));
  }
  // --- 4 pure questions still refuse exactly (live pre-check) ---
  for (const q of ["is this cramp normal?", "what medicine should I take?", "when am I ovulating?", "is 35 days normal?"]) {
    const r: any = await runLavenderAgent(q, { currentDate: TODAY });
    const frozen = q === "when am I ovulating?" ? REDIRECT_MESSAGES.fertility : q === "is 35 days normal?" ? REDIRECT_MESSAGES.verdict : MEDICAL_REFUSAL_MESSAGE;
    check("pure refuses: " + q, r.message === frozen && r.entry == null, r.message);
  }
  // --- 25 normal logs still log (offline) ---
  const normals: Array<[string, string, string?]> = [
    ["I have cramps today", TODAY],
    ["heavy flow, period started yesterday", "2026-11-02"],
    ["I took a painkiller for my cramps today", TODAY],
    ["I went to the doctor yesterday about my period", "2026-11-02"],
    ["cramps and headache today", TODAY],
    ["my period started October 2nd", "2026-10-02"],
    ["period ended today", TODAY],
    ["light flow today", TODAY],
    ["spotting today", TODAY],
    ["mood low, energy 2", TODAY],
    ["slept 7 hours, tired", TODAY],
    ["back pain and bloating", TODAY],
    ["note headache today", TODAY],
    ["Had spotting yesterday, mood was low and energy was 2.", "2026-11-02"],
    ["Period started today, heavy flow with cramps and headache.", TODAY],
    ["my flow was heavy today", TODAY],
    ["flow light today", TODAY],
    ["I have a headache today", TODAY],
    ["bloating and cravings today", TODAY],
    ["nausea this morning", TODAY],
    ["fatigue today, energy 2", TODAY],
    ["my period started three days ago", "2026-10-31"],
    ["period started October 29th", "2026-10-29"],
    ["mild cramps today", TODAY],
    ["tender breasts today", TODAY],
  ];
  for (const [text, wantDate] of normals) {
    const r: any = parseLocally(text, TODAY, {});
    check("normal logs: " + text.slice(0, 40), !!r.entry && r.entry.date === wantDate, JSON.stringify(r.entry && r.entry.date) + " " + text);
  }
  // --- mixed log + medical keeps slip, declines medical part ---
  {
    const r: any = parseLocally("period started today, is it normal that it is heavy", TODAY, {});
    check("mixed: slip kept", !!r.entry && r.entry.date === TODAY, r.entry);
    check("mixed: medical part declined", typeof r.message === "string" && r.message.indexOf("talk to a doctor") !== -1, r.message.slice(0, 120));
  }
  await withLive([toolMsg([logCall("m1", { date: TODAY, flow: "medium", kind: "period_started" })]), textMsg("Yes, that is completely normal for you.")], async () => {
    const r: any = await runLavenderAgent("period started today", { currentDate: TODAY });
    check("mixed live: slip kept", !!r.entry && r.entry.date === TODAY, r.entry);
    check("mixed live: verdict replaced, no normal-claim", typeof r.message === "string" && r.message.indexOf("normal") === -1 && r.message.indexOf("Prepared your log") !== -1, r.message);
  });
  // --- retry policy (A1) ---
  check("A1: two attempts", AGENT_ATTEMPTS === 2, AGENT_ATTEMPTS);
  check("A1: 45s timeout", AGENT_TIMEOUT_MS === 45000, AGENT_TIMEOUT_MS);
  {
    const orig = globalThis.fetch; let calls = 0;
    globalThis.fetch = (async () => { calls++; if (calls === 1) return { ok: false, status: 502, json: async () => ({}) }; return { ok: true, status: 200, json: async () => ({ message: "ok", entry: null, needsClarification: false, activityTrail: [], toolCalls: [], mode: "live", modeReason: null }) }; }) as any;
    const r: any = await sendAgentMessage("hello there", { currentDate: TODAY }, []);
    check("A1: 502 retried once", calls === 2 && r.isOfflineFallback === false, calls);
    globalThis.fetch = orig;
  }
  {
    const orig = globalThis.fetch; let calls = 0;
    globalThis.fetch = (async () => { calls++; return { ok: false, status: 504, json: async () => ({}), text: async () => "" }; }) as any;
    const r: any = await sendAgentMessage("hello there", { currentDate: TODAY }, []);
    check("A1: 504 never retried", calls === 1 && r.isOfflineFallback === true, calls);
    globalThis.fetch = orig;
  }
  // --- timeout + max_tokens (A2) ---
  await withLive([{ __reject: Object.assign(new Error("aborted"), { name: "AbortError" }) }], async () => {
    const r: any = await runLavenderAgent("period started October 29", { currentDate: "2026-11-01" });
    check("A2: abort maps to timeout message", r.message === "The AI took too long, please try again" && r.entry == null, r.message);
  });
  {
    const seen = await withLive([toolMsg([logCall("n1", { date: "2026-10-29", flow: "medium", kind: "period_started" })]), textMsg("Done.")], async () => {
      const r: any = await runLavenderAgent("period started October 29", { currentDate: "2026-11-01" });
      check("A2: normal result identical", !!r.entry && r.entry.date === "2026-10-29" && r.entry.flow === "medium" && r.entry.kind === "period_started" && r.mode === "live", r.entry);
    });
    check("A2: max_tokens 600 sent", (seen[0] as any)?.max_tokens === 600, (seen[0] as any)?.max_tokens);
  }
  // --- honest reply: model claims logged with no valid entry ---
  await withLive([textMsg("All logged for today!")], async () => {
    const r: any = await runLavenderAgent("cramps today", { currentDate: TODAY });
    check("honest: no phantom logged claim", typeof r.message === "string" && r.message.indexOf("logged") === -1 && r.entry == null, r.message);
  });
  // --- mocked timing numbers for the report ---
  await withLive([toolMsg([logCall("t1", { date: TODAY, flow: "heavy", kind: "period_started" })]), textMsg("Saved.")], async () => {
    const r: any = await runLavenderAgent("period started today", { currentDate: TODAY });
    const trail = (r.activityTrail || []).filter((a: any) => /Model Call|Total Model Time/.test(a.step)).map((a: any) => a.step + ": " + a.detail);
    console.log("TIMINGS-MOCKED: " + JSON.stringify(trail));
    check("A5: trail shows per-call ms and total", trail.length >= 2, trail);
  });
  console.log("Hotfix Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
}
main();
