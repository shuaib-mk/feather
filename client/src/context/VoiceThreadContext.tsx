import React, { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { StructuredEntry } from "../../../ai/backend/agent";
import type { BackfillRow } from "../lib/backfill";

/** In-memory voice conversation thread. Never written to any storage, so a
 * reload always starts empty while navigating inside the session keeps it. */
export interface VoiceThreadState {
  transcript: string;
  agentMessage: string;
  confirmEntry: StructuredEntry | null;
  backfillRows: BackfillRow[] | null;
  plannedEventsState: any[];
  planOverlaps: any[] | null;
  agentMode: any;
  isOfflineFallback: boolean;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string; id?: string }>;
}

export const EMPTY_VOICE_THREAD: VoiceThreadState = {
  transcript: "",
  agentMessage: "",
  confirmEntry: null,
  backfillRows: null,
  plannedEventsState: [],
  planOverlaps: null,
  agentMode: null,
  isOfflineFallback: false,
  conversationHistory: [],
};

export function applyThreadPatch(
  prev: VoiceThreadState,
  patch: Partial<VoiceThreadState> | ((prev: VoiceThreadState) => Partial<VoiceThreadState>),
): VoiceThreadState {
  const part = typeof patch === "function" ? (patch as (p: VoiceThreadState) => Partial<VoiceThreadState>)(prev) : patch;
  return { ...prev, ...part };
}

interface VoiceThreadValue {
  thread: VoiceThreadState;
  setThread: (patch: Partial<VoiceThreadState> | ((prev: VoiceThreadState) => Partial<VoiceThreadState>)) => void;
  clearThread: () => void;
}

const VoiceThreadContext = createContext<VoiceThreadValue>({
  thread: EMPTY_VOICE_THREAD,
  setThread: () => {},
  clearThread: () => {},
});

export function VoiceThreadProvider({ children }: { children: ReactNode }) {
  const [thread, setThreadState] = useState<VoiceThreadState>(EMPTY_VOICE_THREAD);
  const value = useMemo<VoiceThreadValue>(
    () => ({
      thread,
      setThread: (patch) => setThreadState((prev) => applyThreadPatch(prev, patch)),
      clearThread: () => setThreadState(EMPTY_VOICE_THREAD),
    }),
    [thread],
  );
  return <VoiceThreadContext.Provider value={value}>{children}</VoiceThreadContext.Provider>;
}

export function useVoiceThread(): VoiceThreadValue {
  return useContext(VoiceThreadContext);
}
