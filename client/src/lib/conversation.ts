/** Conversation message lifecycle: stable ids, no duplicates, no empty bubbles.
 *  Pure helpers shared by VoiceFlowPage and unit tests. Frontend-only. */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  id?: string;
}

let turnCounter = 0;
export function makeTurnId(): string {
  turnCounter += 1;
  try {
    const rand = Math.random().toString(36).slice(2, 8);
    return "turn-" + Date.now().toString(36) + "-" + turnCounter + "-" + rand;
  } catch {
    return "turn-" + turnCounter;
  }
}

/** Append one user+assistant exchange. Same ids are never added twice, and an
 *  empty assistant message is never stored (the card or an error carries it). */
export function appendTurn(
  history: ChatTurn[],
  user: ChatTurn,
  assistant: ChatTurn,
  cap: number = 200,
): ChatTurn[] {
  const ids = new Set(history.map((t) => t.id).filter(Boolean));
  const next = [...history];
  if (user.id && ids.has(user.id)) return next;
  next.push(user);
  if (user.id) ids.add(user.id);
  const text = (assistant.content || "").trim();
  if (!text) return capHistory(next, cap);
  if (assistant.id && ids.has(assistant.id)) return capHistory(next, cap);
  next.push({ ...assistant, content: assistant.content });
  return capHistory(next, cap);
}

function capHistory(history: ChatTurn[], cap: number): ChatTurn[] {
  if (history.length <= cap) return history;
  return history.slice(history.length - cap);
}

/** What the UI should display for an agent result. A blank model reply with
 *  nothing to confirm and nothing to clarify becomes a useful error instead
 *  of an empty bubble; slips and real questions pass through untouched. */
export function resolveShownMessage(
  message: string | null | undefined,
  hasSlip: boolean,
  needsClarification: boolean,
): string {
  const clean = (message || "").trim();
  if (clean) return message as string;
  if (hasSlip || needsClarification) return message as string;
  return "I didn't get a clear answer \u2014 please try again or type it.";
}
