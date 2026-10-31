/**
 * Voice outcome classification (batch-2 follow-up, Item 1).
 * The agent can return a message with no slip and no event (clarifying
 * questions, "didn't understand", disclosures like "I couldn't place: ...").
 * Those messages must be rendered, not swallowed. Refusals keep their own
 * existing rendering path and wording.
 */
export type AgentMessageKind = "none" | "refusal" | "message";

export function agentMessageKind(message?: string | null): AgentMessageKind {
  if (!message || !message.trim()) return "none";
  if (message.includes("talk to a doctor")) return "refusal";
  return "message";
}

export function shouldRenderAgentMessage(message?: string | null): boolean {
  return agentMessageKind(message) === "message";
}
