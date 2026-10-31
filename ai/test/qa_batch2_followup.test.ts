/** Batch-2 follow-up tests: Item 1 (message outcomes render) + Item 2 (contrast targeting). */
import React from "react";
import { renderToString } from "react-dom/server";
import { parseLocally } from "../backend/agent";
import { AgentMessageCard } from "../../client/src/components/AgentMessageCard";
import { saveCycleData, loadCycleData, saveLogEntry } from "../../client/src/cycleStorage";
import { agentMessageKind } from "../../client/src/lib/voiceMessage";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail = "") { if (cond) { console.log(`[PASS] ${name}`); passed++; } else { console.error(`[FAIL] ${name} ${detail}`); failed++; } }
const cardHtml = (message?: string | null) => renderToString(React.createElement(AgentMessageCard, { message }));

// 1a: "my period is late" -> clarifying question rendered, no entry.
try {
  const r = parseLocally("my period is late", "2026-10-31", {});
  const html = cardHtml(r.message);
  check("1a no entry, needs clarification", !r.entry && r.needsClarification === true);
  check("1a clarifying question is rendered", html.includes("can") && html.includes("tell if your period is late") && html.includes("period started today"), html);
} catch (e: any) { check("1a", false, e.message); }

// 1b: gibberish -> "didn't catch" message rendered, no entry.
try {
  const r = parseLocally("asdfgh qwerty banana", "2026-10-31", {});
  const html = cardHtml(r.message);
  check("1b gibberish creates nothing", !r.entry && !(r as any).plannedEvents?.length);
  check("1b didn't-understand message is rendered", html.includes("catch anything I can log"), html);
} catch (e: any) { check("1b", false, e.message); }

// 1c: B2 disclosure renders alongside the slip/events that DID place.
try {
  const r = parseLocally("my period started three days ago and the flow was medium on the first day but heavy yesterday with bad cramps and a headache and I also have an exam coming up on November 20 and a wedding to attend", "2026-10-31", {});
  const html = cardHtml(r.message);
  check("1c placed facts still place (entry + 1 event)", r.entry?.date === "2026-10-28" && ((r as any).plannedEvents || []).length === 1 && (r as any).plannedEvents[0].title === "exam", JSON.stringify(r.entry));
  check("1c couldn't-place disclosure is rendered", html.includes("couldn") && html.includes("place:") && html.includes("2026-10-30"), html);
  check("1c disclosure is a message outcome (not a refusal)", agentMessageKind(r.message) === "message");
} catch (e: any) { check("1c", false, e.message); }

// Guardrail path untouched: refusal wording exact, and the message card does NOT render it.
try {
  const r = parseLocally("I have severe pain, should I take medicine for cramps?", "2026-10-31", {});
  check("guardrail exact refusal, no entry", r.message === "I can only help with logging and planning. For health questions, please talk to a doctor." && !r.entry, r.message);
  check("refusal is not rendered by the message card", cardHtml(r.message) === "", cardHtml(r.message));
} catch (e: any) { check("guardrail", false, e.message); }


// Item 2: contrast correction targets the entry with the negated flow (Oct 30 heavy, not the most recent Oct 31 medium).
try {
  const oct31: any = { date: "2026-10-31", flow: "medium", symptoms: [], mood: null, energy: null, sleep: null, notes: null, landmarkName: null, isApproximate: false, kind: "period_started" };
  const oct30: any = { date: "2026-10-30", flow: "heavy", symptoms: [], mood: null, energy: null, sleep: null, notes: null, landmarkName: null, isApproximate: false, kind: "period_started" };
  const r = parseLocally("actually it was light, not heavy", "2026-10-31", { recentEntry: oct31, recentEntries: [oct31, oct30] });
  check("2 targets the heavy entry (Oct 30), sets light", r.entry?.date === "2026-10-30" && r.entry?.flow === "light", JSON.stringify(r.entry));
  // Save simulation exactly as the confirm flow does: applying the correction must edit Oct 30 in place, leave Oct 31 medium, add nothing.
  saveCycleData({ periods: [], logs: [] });
  saveLogEntry({ logDate: "2026-10-30", flow: "heavy", kind: "period_started", symptoms: [], mood: null, energy: null, sleepHours: null, notes: null });
  saveLogEntry({ logDate: "2026-10-31", flow: "medium", kind: "period_started", symptoms: [], mood: null, energy: null, sleepHours: null, notes: null });
  saveLogEntry({ logDate: r.entry!.date, flow: r.entry!.flow as any, kind: r.entry!.kind, symptoms: r.entry!.symptoms || [], mood: r.entry!.mood || null, energy: r.entry!.energy || null, sleepHours: r.entry!.sleep ?? null, notes: r.entry!.notes || null });
  const d = loadCycleData();
  check("2 save edits Oct 30 to light, Oct 31 stays medium, no duplicate", d.logs.length === 2 && d.logs.find((l:any)=>l.logDate==="2026-10-30")?.flow==="light" && d.logs.find((l:any)=>l.logDate==="2026-10-31")?.flow==="medium", JSON.stringify(d.logs));
  // Fallback: no candidate has the negated value -> most recent entry is corrected.
  const r2 = parseLocally("actually it was light, not heavy", "2026-10-31", { recentEntry: oct31, recentEntries: [oct31] });
  check("2 falls back to most recent when no negated match", r2.entry?.date === "2026-10-31" && r2.entry?.flow === "light", JSON.stringify(r2.entry));
} catch (e: any) { check("2 contrast targeting", false, e.message); }


// Batch-3 diagnostic regression: the live failures were a STALE service-worker
// shell (pre-deploy code served for a whole session), not the card/selector.
// (a) The exact JSON shape the deployed /api/agent returned for case 1 must
//     classify as a renderable message (fixture captured from the live API).
// (b) sw.js must be network-first for navigations under a bumped cache name,
//     so a cached shell can never pin an old bundle after a deploy again.
try {
  const liveApiResponse = { message: "I can't tell if your period is late without a logged start — did it start? Tell me when, or say 'period started today' to log it.", entry: null, needsClarification: true, clarificationQuestion: "I can't tell if your period is late without a logged start — did it start? Tell me when, or say 'period started today' to log it.", activityTrail: [{ step: "Processing Speech", detail: "Extracted keywords from voice transcript", status: "done" }], toolCalls: [], mode: "offline", modeReason: "Offline parser — Meta model not used (late-period question answered directly; no entry created)" };
  check("3a live API response shape renders as a message card", agentMessageKind(liveApiResponse.message) === "message" && cardHtml(liveApiResponse.message).includes("period started today"));
  const fs = await import("node:fs");
  const sw = fs.readFileSync(new URL("../../client/public/sw.js", import.meta.url), "utf-8");
  check("3b SW cache version bumped past v1", !sw.includes('"feather-shell-v1"') && sw.includes("feather-shell-v2"));
  check("3b SW is network-first for navigations", sw.includes('e.request.mode === "navigate"') && sw.indexOf('e.request.mode === "navigate"') < sw.indexOf("caches.match(e.request).then((cached)"));
} catch (e: any) { check("3 stale-shell regression", false, e.message); }

console.log(`\nQABatch2Followup Results: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
