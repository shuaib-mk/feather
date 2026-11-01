/** Q5: safety gate. Pure medical/fertility/verdict/diet/phase questions refuse
 * (frozen message or category redirect, never an entry). Clear log statements
 * always log. Mixed (log statement + separate question) keeps the slip and
 * declines only the medical part. */
import { parseLocally } from "../backend/agent";
import { MEDICAL_REFUSAL_MESSAGE, REDIRECT_MESSAGES } from "../backend/guardrail";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const TODAY = "2026-11-01";
const FROZEN = MEDICAL_REFUSAL_MESSAGE;
const redirectValues = Object.values(REDIRECT_MESSAGES) as string[];
function isRefusalMessage(m: string): boolean {
  return m === FROZEN || redirectValues.indexOf(m) !== -1;
}

// --- 30 pure medical/fertility/verdict/diet/phase questions: refusal or redirect, never an entry ---
{
  const pure = [
    "is this cramp normal?",
    "is spotting a sign of cancer",
    "does heavy flow mean I have PCOS",
    "should I take ibuprofen for cramps",
    "is it bad if my blood is dark brown with heavy clots?",
    "do I have endometriosis?",
    "can you diagnose if I have PCOS?",
    "is my period length okay",
    "home remedy for cramps",
    "I have severe pain, should I take medicine for cramps?",
    "my mom told me I should take meftal for cramps",
    "is my flow normal",
    "is my cycle length healthy?",
    "what medicine should I take for the pain?",
    "when am I ovulating?",
    "what is my fertile window",
    "diet for PCOS",
    "what phase am I in",
    "tell me what to eat during my period",
    "how to treat PCOS",
    "Is 35 days normal?",
    "should I be worried about my cycle",
    "does my irregular cycle mean something is wrong",
    "can I get pregnant on day 10",
    "what does my cycle phase mean for my energy",
    "what should I avoid eating on my period",
    "is it safe to have sex now",
    "my period is 3 weeks late, should I worry",
    "should I see a doctor?",
    "is 40 days normal",
  ];
  check("Q5: 30 pure questions listed", pure.length === 30, pure.length);
  for (const q of pure) {
    const r = parseLocally(q, TODAY, {} as any);
    check("Q5 pure refuses: " + q, !r.entry && isRefusalMessage(r.message), r.message);
  }
}

// --- 20 normal logs: each must log ---
{
  const logs: Array<[string, (e: any) => boolean]> = [
    ["Period started today, heavy flow with cramps and headache.", (e) => e.date === TODAY && e.flow === "heavy" && (e.symptoms || []).indexOf("cramps") !== -1],
    ["Had spotting yesterday, mood was low and energy was 2.", (e) => e.date === "2026-10-31" && e.flow === "spotting"],
    ["cramps and headache today", (e) => e.date === TODAY && (e.symptoms || []).length === 2],
    ["heavy flow", (e) => e.date === TODAY && e.flow === "heavy"],
    ["my period started yesterday, medium flow", (e) => e.date === "2026-10-31" && e.flow === "medium"],
    ["period ended today", (e) => e.kind === "period_ended" && e.date === TODAY],
    ["light flow, no cramps", (e) => e.flow === "light"],
    ["period started today, medium flow", (e) => e.kind === "period_started" && e.date === TODAY],
    ["spotting today", (e) => e.date === TODAY],
    ["mood low, energy 2", (e) => e.date === TODAY && e.energy === 2],
    ["slept 7 hours, tired", (e) => e.date === TODAY && e.sleep === 7],
    ["back pain and bloating", (e) => (e.symptoms || []).length === 2],
    ["log mild cramps and back pain", (e) => (e.symptoms || []).indexOf("cramps") !== -1],
    ["period started three days ago", (e) => e.date === "2026-10-29" && e.kind === "period_started"],
    ["note headache today", (e) => (e.symptoms || []).indexOf("headache") !== -1],
    ["flow light today", (e) => e.flow === "light"],
    ["period ended yesterday", (e) => e.kind === "period_ended" && e.date === "2026-10-31"],
    ["my period started October 2nd", (e) => e.date === "2026-10-02"],
    ["cramps", (e) => e.date === TODAY && (e.symptoms || []).indexOf("cramps") !== -1],
    ["heavy flow with cramps", (e) => e.flow === "heavy" && (e.symptoms || []).indexOf("cramps") !== -1],
  ];
  check("Q5: 20 normal logs listed", logs.length === 20, logs.length);
  for (const [q, want] of logs) {
    const r = parseLocally(q, TODAY, {} as any);
    check("Q5 log kept: " + q, !!r.entry && want(r.entry), JSON.stringify(r.entry));
  }
}

// --- 10 mixed: slip kept, medical part declined ---
{
  const mixed: Array<[string, (e: any) => boolean]> = [
    ["my period started yesterday and is that normal", (e) => e.date === "2026-10-31"],
    ["period started today, is it normal that it is heavy", (e) => e.date === TODAY && e.kind === "period_started"],
    ["my period started October 2nd, is that normal", (e) => e.date === "2026-10-02"],
    ["heavy flow today, is it normal", (e) => e.flow === "heavy" && e.date === TODAY],
    ["I had cramps yesterday, is that normal", (e) => e.date === "2026-10-31" && (e.symptoms || []).indexOf("cramps") !== -1],
    ["having cramps today and should I worry", (e) => e.date === TODAY && (e.symptoms || []).indexOf("cramps") !== -1],
    ["period ended yesterday, is that normal", (e) => e.date === "2026-10-31" && e.kind === "period_ended"],
    ["my flow was heavy today, is that okay", (e) => e.flow === "heavy"],
    ["spotting on Monday, does that mean something is wrong", (e) => e.date === "2026-10-26"],
    ["cramps and headache today, is it normal that I feel this way", (e) => e.date === TODAY && (e.symptoms || []).length === 2],
  ];
  check("Q5: 10 mixed listed", mixed.length === 10, mixed.length);
  for (const [q, want] of mixed) {
    const r = parseLocally(q, TODAY, {} as any);
    const ok = !!r.entry && want(r.entry) && r.message.indexOf("talk to a doctor") !== -1;
    check("Q5 mixed slip+decline: " + q, ok, r.message + " | " + JSON.stringify(r.entry));
  }
}

console.log("Q5 Gate Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
