import React from "react";
import { agentMessageKind } from "../lib/voiceMessage";

/**
 * The ONE message-outcome rendering path for the Voice page: any non-refusal
 * agent message is shown as a visible card - alone (clarifying question,
 * "didn't understand") or alongside the slip/event cards (disclosures about
 * facts that could not be placed). Refusals render elsewhere, unchanged.
 */
export function AgentMessageCard({ message }: { message?: string | null }) {
  if (agentMessageKind(message) !== "message") return null;
  return (
    <div role="status" data-testid="agent-message" className="liquid-glass-card rounded-[22px] p-5 space-y-2 shadow-xs">
      <span className="font-sans text-xs font-semibold text-stone-500 block">Feather</span>
      <p className="font-sans text-sm text-stone-800 leading-relaxed">{message}</p>
    </div>
  );
}
