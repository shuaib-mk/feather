/** Batch-2 follow-up tests: Item 1 (message outcomes render) + Item 2 (contrast targeting). */
import React from "react";
import { renderToString } from "react-dom/server";
import { parseLocally } from "../backend/agent";
import { AgentMessageCard } from "../../client/src/components/AgentMessageCard";
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
  check("1c placed facts still place (entry + 2 events)", r.entry?.date === "2026-10-28" && ((r as any).plannedEvents || []).length === 2, JSON.stringify(r.entry));
  check("1c couldn't-place disclosure is rendered", html.includes("couldn") && html.includes("place:") && html.includes("2026-10-30"), html);
  check("1c disclosure is a message outcome (not a refusal)", agentMessageKind(r.message) === "message");
} catch (e: any) { check("1c", false, e.message); }

// Guardrail path untouched: refusal wording exact, and the message card does NOT render it.
try {
  const r = parseLocally("I have severe pain, should I take medicine for cramps?", "2026-10-31", {});
  check("guardrail exact refusal, no entry", r.message === "I can only help with logging and planning. For health questions, please talk to a doctor." && !r.entry, r.message);
  check("refusal is not rendered by the message card", cardHtml(r.message) === "", cardHtml(r.message));
} catch (e: any) { check("guardrail", false, e.message); }

console.log(`\nQABatch2Followup Results: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
