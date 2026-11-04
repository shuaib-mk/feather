// Prompt 13 Group 3: a pending slip survives failed follow-ups; corrections reach it.
import fs from "node:fs";
import { parseLocally, runLavenderAgent } from "../backend/agent";
import { nextPendingSlip } from "../../client/src/lib/conversation";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const T = "2026-11-04";
const slip: any = { date: T, flow: "medium", symptoms: ["cramps", "headache"], mood: null, energy: null, sleep: null, notes: null, kind: "period_started", slipId: "slip-2026-11-04-period_started" };

async function main() {
  // (a) main chat correction with a slip pending
  const a: any = parseLocally("Make the flow heavy", T, { pendingEntry: slip });
  check("G3a: 'Make the flow heavy' updates the pending slip (no 'which date')", a.entry?.flow === "heavy" && a.entry?.slipId === slip.slipId && a.replacesExisting === true && !a.needsClarification, a);
  check("G3a: reply says what changed", /flow is now heavy/.test(a.message), a.message);

  // (b) slip update field date correction
  const b: any = parseLocally("Actually, it started yesterday", T, { pendingEntry: slip });
  check("G3b: 'Actually, it started yesterday' moves the slip to yesterday", b.entry?.date === "2026-11-03" && b.entry?.slipId === slip.slipId, b);
  for (const t of ["it began 2 days ago", "change it to yesterday", "no, it was the day before yesterday"]) {
    const r: any = parseLocally(t, T, { pendingEntry: slip });
    check(`G3b: date correction '${t}'`, !!r.entry && r.entry.date < T && r.entry.slipId === slip.slipId, r.entry);
  }
  const fut: any = parseLocally("change it to tomorrow", T, { pendingEntry: slip });
  check("G3b: never moves a slip into the future", !fut.entry || fut.entry.date <= T, fut.entry);

  // (c) undo with a slip pending reports the truth
  const c: any = parseLocally("undo that", T, { pendingEntry: slip });
  check("G3c: 'undo that' discards the pending slip and says so", c.discardedSlip === true && c.entry == null && /discarded/.test(c.message), c);
  for (const t of ["don't save that", "discard", "never mind", "scrap that", "cancel the slip"]) {
    const r: any = parseLocally(t, T, { pendingEntry: slip });
    check(`G3c: '${t}' discards`, r.discardedSlip === true, r.message);
  }
  const noSlip: any = parseLocally("undo that", T, {});
  check("G3c: with no slip pending, says there is none", !noSlip.discardedSlip && /no pending slip/i.test(noSlip.message), noSlip.message);
  const rem: any = parseLocally("remove the headache", T, { pendingEntry: slip });
  check("G3: 'remove the headache' removes it (and is not a cancel)", !rem.discardedSlip && rem.entry && !rem.entry.symptoms.includes("headache") && rem.entry.symptoms.includes("cramps"), rem.entry);
  const add: any = parseLocally("add bloating", T, { pendingEntry: slip });
  check("G3: 'add bloating' adds to the slip", add.entry?.symptoms.includes("bloating") && add.entry?.symptoms.includes("cramps"), add.entry);

  // A follow-up that changes nothing never clears or replaces the slip
  const same: any = parseLocally("add cramps", T, { pendingEntry: slip });
  check("G3: no-op follow-up returns no entry and flags slipUnchanged", same.entry == null && same.slipUnchanged === true && !same.discardedSlip, same);
  check("G3: client keeps the slip on a no-op reply", nextPendingSlip(slip, same) === slip);
  const junk: any = parseLocally("hmm let me think", T, { pendingEntry: slip });
  check("G3: unintelligible follow-up keeps the slip and says so", junk.entry == null && !junk.discardedSlip && /still there unchanged/.test(junk.message) && nextPendingSlip(slip, junk) === slip, junk.message);

  // Correction after an unrelated question in between
  const q: any = parseLocally("how many cycles have I logged?", T, { pendingEntry: slip, periods: [] } as any);
  const kept = nextPendingSlip(slip, q);
  check("G3: an unrelated question in between leaves the slip in place", q.entry == null && kept === slip, q.message);
  const after: any = parseLocally("make it light", T, { pendingEntry: kept });
  check("G3: correction after the question still reaches the slip", after.entry?.flow === "light" && after.entry?.slipId === slip.slipId, after.entry);

  // Two corrections in a row accumulate on one slip
  const one: any = parseLocally("make the flow heavy", T, { pendingEntry: slip });
  const two: any = parseLocally("also add bloating", T, { pendingEntry: nextPendingSlip(slip, one) });
  check("G3: two corrections accumulate", two.entry?.flow === "heavy" && two.entry?.symptoms.includes("bloating") && two.entry?.symptoms.includes("headache") && two.entry?.slipId === slip.slipId, two.entry);

  // Live path: cancel resolved before any model call, with truthful status
  process.env.META_API_KEY = "test-key";
  const orig = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { role: "assistant", content: "ok" } }] }) }; }) as any;
  try {
    const lc: any = await runLavenderAgent("don't save that", { currentDate: T, pendingEntry: slip });
    check("G3: live 'don't save that' discards without a model call", lc.discardedSlip === true && calls === 0, { calls, m: lc.message });
  } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }

  // Client wiring: every send carries the slip on screen
  const src = fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8");
  check("G3: VoiceFlowPage sends the on-screen slip with main-chat messages", /activePendingEntry !== undefined \? activePendingEntry : \(confirmEntry \?\? null\)/.test(src));
}

main().then(() => { console.log(`\nP13 Group 3: ${passed} passed, ${failed} failed.`); process.exit(failed > 0 ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
