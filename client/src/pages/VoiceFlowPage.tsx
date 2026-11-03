import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loadEvents, fuzzyMatchEvents, upsertEvent } from "../lib/events";
import { useCycle } from "../context/CycleContext";
import { useVoiceThread } from "../context/VoiceThreadContext";
import { PageHeader } from "../components/PageHeader";
import { AgentMessageCard } from "../components/AgentMessageCard";
import { UserBubble, FeatherTurn, SystemBubble } from "../components/ConversationThread";
import { useAudioRecorder } from "../../../ai/frontend/useAudioRecorder";
import { sendAgentMessage, transcribeAudioBlob, type ClientAgentResult } from "../../../ai/frontend/aiClient";
import type { StructuredEntry, ToolCallRecord, ActivityStep, ValidSymptom } from "../../../ai/backend/agent";
import { SEVERE_SYMPTOM_ESCALATION_MESSAGE, SEVERE_FALL_CARE_MESSAGE } from "../../../ai/backend/guardrail";
import { prettyDate, todayStr, addDays, loadCycleData, addOrUpdatePeriod, findShortGapStarts } from "../cycleStorage";
import { backfillRowsFromEntries, backfillSelected, validateBackfillRows, backfillRowWarnings, backfillGapDays, backfillDurationDays, saveBackfillRows, type BackfillRow } from "../lib/backfill";

/** Prompt 12 (Group B): voice round-trip instrumentation. Marks live in
 * window.featherVoicePerf.marks for before/after measurement; no UI effect. */
function markVoiceTiming(key: string): void {
  try {
    const w = window as any;
    w.featherVoicePerf = w.featherVoicePerf || { marks: {} };
    w.featherVoicePerf.marks[key] = Math.round(performance.now());
  } catch {}
}

export const VOICE_PENDING_SESSION_KEY = "feather_voice_pending_v1";

export interface VoicePendingSession {
  transcript: string;
  agentMessage: string;
  confirmEntry: StructuredEntry | null;
  backfillRows?: BackfillRow[] | null;
  plannedEventsState: Array<{ title: string; date: string }>;
  planOverlaps: any[] | null;
  agentMode: any;
  isOfflineFallback: boolean;
}

export function loadVoicePendingSession(): VoicePendingSession | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(VOICE_PENDING_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VoicePendingSession;
  } catch {
    return null;
  }
}

export function saveVoicePendingSession(session: VoicePendingSession): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    const hasAnyState =
      Boolean(session.transcript) ||
      Boolean(session.agentMessage) ||
      Boolean(session.confirmEntry) ||
      Boolean(session.backfillRows && session.backfillRows.length > 0) ||
      (session.plannedEventsState && session.plannedEventsState.length > 0) ||
      (session.planOverlaps && session.planOverlaps.length > 0);
    if (!hasAnyState) {
      sessionStorage.removeItem(VOICE_PENDING_SESSION_KEY);
    } else {
      sessionStorage.setItem(VOICE_PENDING_SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore storage errors
  }
}

export function clearVoicePendingSession(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(VOICE_PENDING_SESSION_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

const FLOW_OPTIONS = [
  { key: "none", label: "None" },
  { key: "spotting", label: "Spotting" },
  { key: "light", label: "Light" },
  { key: "medium", label: "Medium" },
  { key: "heavy", label: "Heavy" },
] as const;

const COMMON_SYMPTOMS: Array<{ key: ValidSymptom; label: string }> = [
  { key: "cramps", label: "Cramps" },
  { key: "headache", label: "Headache" },
  { key: "bloating", label: "Bloating" },
  { key: "fatigue", label: "Fatigue" },
  { key: "mood_swings", label: "Mood Swings" },
  { key: "backache", label: "Backache" },
  { key: "nausea", label: "Nausea" },
  { key: "acne", label: "Acne" },
  { key: "breast_tenderness", label: "Tender Breasts" },
];

export function VoiceFlowPage() {
  const { data, stats, savePeriod, saveLog, refreshData, isDemoActive } = useCycle();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetDate = searchParams.get("date");
  const allowMatchedCalendar = (() => { try { return typeof localStorage !== "undefined" && localStorage.getItem("feather_allow_matched_events") === "true"; } catch { return false; } })();

  const { thread, setThread, clearThread } = useVoiceThread();
const plannedEventsState = thread.plannedEventsState;
  const setPlannedEventsState = (v: any[] | ((p: any[]) => any[])) =>
    setThread((prev) => ({ plannedEventsState: typeof v === "function" ? (v as (p: any[]) => any[])(prev.plannedEventsState) : v }));
const agentMode = thread.agentMode;
  const setAgentMode = (v: any | ((p: any) => any)) =>
    setThread((prev) => ({ agentMode: typeof v === "function" ? (v as (p: any) => any)(prev.agentMode) : v }));
  const [usedAnchor, setUsedAnchor] = useState(false);

  // Voice recording hook
  const {
    isRecording,
    durationSeconds,
    audioBlob,
    waveformLevels,
    permissionError,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    try {
      return sessionStorage.getItem("feather_voice_lang") || "auto";
    } catch {
      return "auto";
    }
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [processingSecs, setProcessingSecs] = useState(0);
  useEffect(() => {
    if (!isProcessing) return;
    setProcessingSecs(0);
    const t0 = Date.now();
    const id = setInterval(() => setProcessingSecs(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isProcessing]);
  const [pipelineStage, setPipelineStage] = useState<"transcribing" | "thinking" | "preparing">("thinking");
  const [processingSource, setProcessingSource] = useState<"voice" | "text">("voice");
const transcript = thread.transcript;
  const setTranscript = (v: string | ((p: string) => string)) =>
    setThread((prev) => ({ transcript: typeof v === "function" ? (v as (p: string) => string)(prev.transcript) : v }));
  const [manualText, setManualText] = useState<string>("");
const agentMessage = thread.agentMessage;
  const setAgentMessage = (v: string | ((p: string) => string)) =>
    setThread((prev) => ({ agentMessage: typeof v === "function" ? (v as (p: string) => string)(prev.agentMessage) : v }));
  const [activityTrail, setActivityTrail] = useState<ActivityStep[]>([]);
const confirmEntry = thread.confirmEntry;
  const setConfirmEntry = (v: StructuredEntry | null | ((p: StructuredEntry | null) => StructuredEntry | null)) =>
    setThread((prev) => ({ confirmEntry: typeof v === "function" ? (v as (p: StructuredEntry | null) => StructuredEntry | null)(prev.confirmEntry) : v }));
const backfillRows = thread.backfillRows;
  const setBackfillRows = (v: BackfillRow[] | null | ((p: BackfillRow[] | null) => BackfillRow[] | null)) =>
    setThread((prev) => ({ backfillRows: typeof v === "function" ? (v as (p: BackfillRow[] | null) => BackfillRow[] | null)(prev.backfillRows) : v }));
  const [backfillLongWarn, setBackfillLongWarn] = useState<string | null>(null);
  const [backfillShortWarn, setBackfillShortWarn] = useState<string | null>(null);
  const [backfillLongOk, setBackfillLongOk] = useState(false);
  const [backfillShortOk, setBackfillShortOk] = useState(false);
const planOverlaps = thread.planOverlaps;
  const setPlanOverlaps = (v: any[] | null | ((p: any[] | null) => any[] | null)) =>
    setThread((prev) => ({ planOverlaps: typeof v === "function" ? (v as (p: any[] | null) => any[] | null)(prev.planOverlaps) : v }));
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>([]);
  const [isUnderHoodOpen, setIsUnderHoodOpen] = useState<boolean>(false);
const isOfflineFallback = thread.isOfflineFallback;
  const setIsOfflineFallback = (v: boolean | ((p: boolean) => boolean)) =>
    setThread((prev) => ({ isOfflineFallback: typeof v === "function" ? (v as (p: boolean) => boolean)(prev.isOfflineFallback) : v }));
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);
  const [slipCorrectionText, setSlipCorrectionText] = useState<string>("");
  const correctionSaveRef = useRef(false);
  const [longPeriodWarning, setLongPeriodWarning] = useState<string | null>(null);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);
  const [savedLink, setSavedLink] = useState<{ to: string; label: string }>({ to: "/chronicle", label: "View in Chronicle" });
const conversationHistory = thread.conversationHistory;
  const setConversationHistory = (v: Array<{ role: "user" | "assistant"; content: string }> | ((p: Array<{ role: "user" | "assistant"; content: string }>) => Array<{ role: "user" | "assistant"; content: string }>)) =>
    setThread((prev) => ({ conversationHistory: typeof v === "function" ? (v as (p: Array<{ role: "user" | "assistant"; content: string }>) => Array<{ role: "user" | "assistant"; content: string }>)(prev.conversationHistory) : v }));

  const textInputRef = useRef<HTMLInputElement | null>(null);
  const prevDemoRef = useRef<boolean>(isDemoActive);

  useEffect(() => {
    if (prevDemoRef.current !== isDemoActive) {
      prevDemoRef.current = isDemoActive;
      clearThread();
      setBackfillRows(null);
      setBackfillLongWarn(null);
      setBackfillShortWarn(null); setBackfillLongOk(false); setBackfillShortOk(false);
      setConfirmEntry(null);
      setPlannedEventsState([]);
      setPlanOverlaps(null);
      setAgentMessage("");
      setTranscript("");
      setAgentMode(null);
      setIsOfflineFallback(false);
    }
  }, [isDemoActive]);

  // Prompt 12 (Group B): pre-warm the API path when Voice opens so the first
  // real call does not pay setup cost. OPTIONS is cheap and never counted.
  // Hotfix (speed): one tiny GET to /api/health warms the serverless pool for
  // the first real request. Fire and forget: never blocks the UI, never errors.
  useEffect(() => {
    try {
      fetch("/api/agent", { method: "OPTIONS" }).catch(() => {});
      fetch("/api/transcribe", { method: "OPTIONS" }).catch(() => {});
      fetch("/api/health").catch(() => {});
    } catch {}
  }, []);

  // Auto-process captured audio blob
  useEffect(() => {
    if (audioBlob && !isRecording) {
      handleAudioCaptured(audioBlob);
    }
  }, [audioBlob, isRecording]);

  const handleAudioCaptured = async (blob: Blob) => {
    setIsProcessing(true);
    setRateLimitNotice(null);
    setSavedSuccessMessage(null);
    setActivityTrail([{ step: "Voice Recognition", detail: "Uploading audio to Meta Muse Transcribe...", status: "pending" }]);

    try {
      const res = await transcribeAudioBlob(blob, selectedLanguage === "auto" ? undefined : selectedLanguage);

      if (res.rateLimited) {
        setRateLimitNotice(res.error || "Demo rate limit reached.");
      }

      if (res.text && res.text.trim()) {
        setTranscript(res.text);
        markVoiceTiming("transcribed");
        setActivityTrail([{ step: "Voice Recognition", detail: `Transcribed (${res.language || "multilingual"}): "${res.text}"`, status: "done" }]);
        await runAgentPipeline(res.text);
      } else {
        setAgentMessage(res.error || "Couldn't hear that — try again or type it");
        setActivityTrail([{ step: "Voice Recognition", detail: res.error || "Acoustic detection ended without text", status: "done" }]);
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      setAgentMessage("Couldn't hear that — try again or type it");
      setActivityTrail([{ step: "Voice Recognition", detail: "Audio stream error", status: "clarify" }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const runAgentPipeline = async (promptText: string, activePendingEntry?: StructuredEntry | null, source: "voice" | "text" = "voice") => {
    if (promptText.length > 1000) {
      setAgentMessage("Please keep it under 1,000 characters — try splitting it into two entries");
      return;
    }
    setProcessingSource(source);
    setIsProcessing(true);
    setTranscript(promptText);
    setRetryNotice(null);
    setPipelineStage("thinking");
    markVoiceTiming("send");
    setRateLimitNotice(null);
    setSavedSuccessMessage(null);

    const pending = activePendingEntry !== undefined ? activePendingEntry : null;

    // Q4.2/Q4.4: calendar visibility for the model, validated ?date= default, stored events, landmark packs.
    const calendarPresetDate = presetDate && /^\d{4}-\d{2}-\d{2}$/.test(presetDate) ? presetDate : undefined;
    const landmarkPackPrefs = (() => { try { const raw = localStorage.getItem("feather_landmark_packs"); if (raw) return JSON.parse(raw); } catch {} return { global: true, india: typeof navigator !== "undefined" && navigator.language.endsWith("-IN") }; })();

    // Resolve most recent saved entry for standalone corrections
    const sortedLogs = [...data.logs].sort((a, b) => b.logDate.localeCompare(a.logDate));
    const recentLog = sortedLogs[0];
    const recentPeriod = recentLog ? data.periods.find((p) => p.startDate === recentLog.logDate) : data.periods[0];
    const recentEntries: StructuredEntry[] = sortedLogs.slice(0, 10).map((log) => {
      const per = data.periods.find((p) => p.startDate === log.logDate);
      return {
        date: log.logDate,
        flow: log.flow || null,
        symptoms: (log.symptoms || []) as ValidSymptom[],
        mood: log.mood || null,
        energy: log.energy || null,
        sleep: log.sleepHours || null,
        notes: log.notes || null,
        landmarkName: per?.landmarkName || null,
        isApproximate: per?.isApproximate || false,
        kind: log.kind || (per ? "period_started" : "daily_log"),
      };
    });
    const recentEntry: StructuredEntry | null = recentLog
      ? {
          date: recentLog.logDate,
          flow: recentLog.flow || null,
          symptoms: (recentLog.symptoms || []) as ValidSymptom[],
          mood: recentLog.mood || null,
          energy: recentLog.energy || null,
          sleep: recentLog.sleepHours || null,
          notes: recentLog.notes || null,
          landmarkName: recentPeriod?.landmarkName || null,
          isApproximate: recentPeriod?.isApproximate || false,
          kind: recentLog.kind || (recentPeriod ? "period_started" : "daily_log"),
        }
      : recentPeriod
      ? {
          date: recentPeriod.startDate,
          flow: null,
          symptoms: [],
          mood: null,
          energy: null,
          sleep: null,
          notes: null,
          landmarkName: recentPeriod.landmarkName || null,
          isApproximate: recentPeriod.isApproximate || false,
          kind: "period_started",
        }
      : null;

    try {
      const res: ClientAgentResult = await sendAgentMessage(
        promptText,
        {
          cycleStats: {
            avgCycleLength: stats.avgCycleLength,
            avgPeriodLength: stats.avgPeriodLength,
            lastPeriodStart: stats.lastPeriodStart,
            nextPeriodEarliest: stats.earliestNextDate ?? null,
            nextPeriodLatest: stats.latestNextDate ?? null,
          },
          periods: data.periods,
          logs: data.logs,
          currentDate: todayStr(),
          pendingEntry: pending,
          events: (() => { try { return loadEvents(); } catch { return []; } })(),
          calendarVisible: allowMatchedCalendar,
          defaultDate: calendarPresetDate,
          landmarkPacks: landmarkPackPrefs,
          recentEntry,
          recentEntries,
          locale: typeof navigator !== "undefined" ? navigator.language : "en",
          matchedEvents: (() => {
            try {
              if (localStorage.getItem("feather_allow_matched_events") !== "true") return [];
              return fuzzyMatchEvents(promptText, loadEvents()).map((e) => ({ title: e.title, date: e.date }));
            } catch {
              return [];
            }
          })(),
        },
        conversationHistory,
        (attempt, total) => setRetryNotice("Reaching the AI… trying again (attempt " + attempt + " of " + total + ")"),
      );

      setAgentMessage(res.message);
      markVoiceTiming("agentDone");
      setActivityTrail(res.activityTrail || []);
      if (res.toolCalls && res.toolCalls.length > 0) {
        setToolCalls(res.toolCalls);
      }
      setIsOfflineFallback(Boolean(res.isOfflineFallback));
      setAgentMode(res);
      setUsedAnchor(Boolean((res as any).usedPersonalAnchor));
      const extractedEvents = (res as any).plannedEvents?.length
        ? (res as any).plannedEvents
        : res.planOverlaps?.length
        ? res.planOverlaps.map((o: any) => ({ title: o.name || o.eventName, date: o.eventDate || o.date }))
        : [];
      setPlannedEventsState(extractedEvents);

      if (res.rateLimited) {
        setRateLimitNotice(res.message);
      }

      const isMessageOnly = !res.entry && extractedEvents.length === 0 && !(res.planOverlaps && res.planOverlaps.length > 0);
      if (isMessageOnly) {
        setConfirmEntry(null);
        setPlannedEventsState([]);
        setPlanOverlaps(null);
      }

      if (res.entries && res.entries.length > 1) {
        setBackfillRows(backfillRowsFromEntries(res.entries));
        setConfirmEntry(null);
      } else {
        setBackfillRows(null);
      if (res.entry) {
        if (res.entry.date <= todayStr()) setConfirmEntry(res.entry);
        else { setConfirmEntry(null); setAgentMessage("That date is in the future, so there is nothing to confirm yet. Pick a past or today's date."); }
      } else {
        setConfirmEntry(null);
      }
      }

      if (!isMessageOnly) {
        setPipelineStage("preparing");
        markVoiceTiming("slipReady");
        try {
          const w = window as any;
          const m = (w.featherVoicePerf && w.featherVoicePerf.marks) || {};
          const t0 = m.send || m.stop || 0;
          if (t0) console.debug("[feather-voice] slip ready", Math.round(performance.now() - t0) + "ms");
        } catch {}
      }
      correctionSaveRef.current = (res as any).replacesExisting === true && !!res.entry;
      if (res.planOverlaps && res.planOverlaps.length > 0) {
        setPlanOverlaps(res.planOverlaps);
      } else {
        setPlanOverlaps(null);
      }

      if (!res.message.includes("talk to a doctor")) {
        setConversationHistory((prev) => [
          ...prev,
          { role: "user", content: promptText },
          { role: "assistant", content: res.message },
        ]);
      }
    } catch (err: any) {
      console.error("Agent error:", err);
      setAgentMessage(err.message || "Could not process request.");
    } finally {
      setIsProcessing(false);
      setRetryNotice(null);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    if (manualText.trim().length > 1000) {
      setAgentMessage("Please keep it under 1,000 characters — try splitting it into two entries");
      return;
    }
    runAgentPipeline(manualText.trim(), undefined, "text");
    setManualText("");
  };

  const handleSaveConfirmed = (confirmLongPeriod: boolean = false, confirmShortGap: boolean = false) => {
    if (!confirmEntry || confirmEntry.date > todayStr()) {
      if (confirmEntry && confirmEntry.date > todayStr()) {
        setAgentMessage(`Cannot save a log entry for ${confirmEntry.date} because that date is in the future.`);
      }
      return;
    }

    // One atomic save: the log and its period are written together or not at all.
    const isBleeding = confirmEntry.flow === "light" || confirmEntry.flow === "medium" || confirmEntry.flow === "heavy";
    const isPeriod = confirmEntry.kind === "period_started" || isBleeding;
    const kind = isPeriod ? "period_started" : confirmEntry.kind || "daily_log";
    const replaceExisting = correctionSaveRef.current;
    correctionSaveRef.current = false;
    const result = saveLog(
      {
        logDate: confirmEntry.date,
        flow: confirmEntry.flow || null,
        symptoms: confirmEntry.symptoms || [],
        mood: confirmEntry.mood || null,
        energy: confirmEntry.energy || null,
        sleepHours: confirmEntry.sleep || null,
        notes: confirmEntry.notes || null,
        kind,
      },
      {
        kind,
        replace: replaceExisting,
        landmarkName: confirmEntry.landmarkName || null,
        startEarliest: confirmEntry.isApproximate ? addDays(confirmEntry.date, -3) : null,
        startLatest: confirmEntry.isApproximate ? addDays(confirmEntry.date, 3) : null,
        confirmLongPeriod,
        confirmShortGap,
      },
    );

    if (!result) return;
    if (result.needsConfirmation) {
      setLongPeriodWarning(result.confirmationReason || "This would make a period longer than 10 days. Save it anyway?");
      return;
    }
    if (result.saved === false) {
      setAgentMessage("Nothing was saved because " + (result.error || "it could not be written."));
      return;
    }

    if (confirmEntry.endDate) {
      const endPer = loadCycleData().periods.find((p) => p.startDate === confirmEntry.date);
      if (endPer && confirmEntry.endDate >= confirmEntry.date && confirmEntry.endDate <= todayStr()) {
        addOrUpdatePeriod({ ...endPer, endDate: confirmEntry.endDate });
        refreshData();
      }
    }
    const confirmedDate = confirmEntry.date;
    setSavedSuccessMessage(`Entry for ${prettyDate(confirmedDate)} saved to your device vault.`);
    setSavedLink({ to: "/chronicle", label: "View in Chronicle" });
    setConfirmEntry(null);
    setSlipCorrectionText("");
    setLongPeriodWarning(null);
  };

  const handleSaveBackfill = (longConfirmed: boolean = false, shortConfirmed: boolean = false) => {
    if (!backfillRows) return;
    const rows = backfillSelected(backfillRows);
    const problem = validateBackfillRows(backfillRows, todayStr());
    if (problem) {
      setAgentMessage(problem);
      return;
    }
    const hasLongRow = rows.some((r) => {
      const d = backfillDurationDays(r);
      return d !== null && d > 10;
    });
    if (hasLongRow && !longConfirmed) {
      setBackfillLongWarn("One or more periods is longer than 10 days. Save them anyway?");
      return;
    }
    const shorts = findShortGapStarts(rows.map((r) => r.date), data.periods);
    if (shorts.length > 0 && !shortConfirmed) {
      setBackfillShortWarn(shorts.map((s) => s.startDate + ": this starts only " + s.gapDays + " days after your previous period start.").join(" ") + " Save anyway?");
      return;
    }
    setBackfillShortWarn(null);
    let savedCount = 0;
    try {
      savedCount = saveBackfillRows(backfillRows, todayStr(), longConfirmed, shortConfirmed);
    } catch (err: any) {
      refreshData();
      setBackfillLongWarn(null);
      setBackfillShortWarn(null); setBackfillLongOk(false); setBackfillShortOk(false);
      setAgentMessage(err?.message || "Could not save these periods. Nothing was saved.");
      return;
    }
    refreshData();
    setSavedSuccessMessage(savedCount + (savedCount === 1 ? " period" : " periods") + " saved to your device vault.");
    setSavedLink({ to: "/chronicle", label: "View in Chronicle" });
    setBackfillRows(null);
    setBackfillLongWarn(null);
    setBackfillShortWarn(null); setBackfillLongOk(false); setBackfillShortOk(false);
  };

  const handleDiscard = () => {
    clearThread();
    setLongPeriodWarning(null);
    setConfirmEntry(null);
    setBackfillRows(null);
    setBackfillLongWarn(null);
    setBackfillShortWarn(null); setBackfillLongOk(false); setBackfillShortOk(false);
    setSlipCorrectionText("");
    setPlanOverlaps(null);
    setPlannedEventsState([]);
    setAgentMessage("");
    setTranscript("");
    setAgentMode(null);
    setIsOfflineFallback(false);
  };

  const toggleSymptom = (sym: ValidSymptom) => {
    if (!confirmEntry || confirmEntry.date > todayStr()) {
      if (confirmEntry && confirmEntry.date > todayStr()) {
        setAgentMessage(`Cannot save a log entry for ${confirmEntry.date} because that date is in the future.`);
      }
      return;
    }
    const current = confirmEntry.symptoms || [];
    const updated = current.includes(sym) ? current.filter((s) => s !== sym) : [...current, sym];
    setConfirmEntry({ ...confirmEntry, symptoms: updated });
  };

  const handleApplyCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slipCorrectionText.trim() || !confirmEntry) return;
    runAgentPipeline(slipCorrectionText.trim(), confirmEntry, "text");
    setSlipCorrectionText("");
  };

  const technicalEngineString =
    isOfflineFallback || agentMode?.mode === "offline"
      ? agentMode?.modeReason && agentMode.modeReason.startsWith("Offline parser")
        ? agentMode.modeReason
        : `Offline parser — Meta model not used (${agentMode?.modeReason || "offline fallback"})`
      : "Live: Meta Muse Spark";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice Capture"
        subtitle="Speak or type naturally in any language. Natural calendar landmarks are resolved instantly."
        badge="Universal Voice AI"
      />

      {/* Offline Mode Banner */}
      {isOfflineFallback && (
        <div className="rounded-[18px] liquid-glass-card border border-amber-200/80 bg-amber-50/40 px-4 py-2.5 text-xs text-amber-950 font-sans flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-semibold">Offline mode understands English best; other languages need the Meta model.</span>
          </div>
          <span className="liquid-glass-pill rounded-full px-2.5 py-0.5 text-[11px] font-sans font-medium text-amber-900 border border-amber-200/70">On-device</span>
        </div>
      )}

      {/* Rate Limit Notice */}
      {rateLimitNotice && (
        <div className="rounded-[18px] liquid-glass-card border border-rose-200/80 bg-rose-50/40 p-3.5 text-xs text-rose-900 font-sans flex items-center gap-2.5 shadow-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-700 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{rateLimitNotice}</span>
        </div>
      )}

      {/* Recording & Input Console */}
      <div className="liquid-glass-card rounded-[26px] p-6 sm:p-8 text-center space-y-6 border border-white/90 shadow-sm relative">
        {/* Universal Language Selection Row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs w-full max-w-full">
          <span className="text-stone-500 font-sans text-xs font-medium shrink-0">Language:</span>
          <div className="w-full sm:w-auto overflow-x-auto no-scrollbar py-1 flex justify-start sm:justify-center">
            <div className="inline-flex rounded-full liquid-glass-pill p-1 gap-1 min-w-max">
              {[
                { id: "auto", label: "Auto Detect", sub: "" },
                { id: "en", label: "English" },
                { id: "hi", label: "Hindi" },
                { id: "bn", label: "Bengali" },
                { id: "kn", label: "Kannada" },
                { id: "mr", label: "Marathi" },
                { id: "ta", label: "Tamil" },
                { id: "te", label: "Telugu" },
              ].map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => {
                    setSelectedLanguage(lang.id);
                    try {
                      sessionStorage.setItem("feather_voice_lang", lang.id);
                    } catch {}
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    selectedLanguage === lang.id
                      ? "liquid-glass-button font-semibold text-stone-950 shadow-xs"
                      : "text-stone-600 hover:text-stone-950"
                  }`}
                >
                  {lang.label}
                  {lang.sub && <span className="hidden sm:inline">{lang.sub}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-stone-500 font-sans">
          Voice transcription supports English, Hindi, Bengali, Kannada, Marathi, Tamil and Telugu. Malayalam voice is not supported by Meta — Malayalam works when typed (offline parser). Recordings are capped at 60 seconds.
        </p>

        {/* Center Microphone Orb (Authentic Liquid Glass Sphere) */}
        <div className="flex flex-col items-center justify-center space-y-3 py-2">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            aria-label={isRecording ? "Stop recording voice note" : "Start recording voice note"}
            className={`relative size-20 sm:size-24 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-md ${
              isRecording
                ? "bg-rose-500/85 text-white scale-105 shadow-rose-300 ring-8 ring-rose-200/60 backdrop-blur-md animate-pulse"
                : "liquid-glass-orb hover:scale-105 text-stone-900"
            }`}
          >
            {isRecording ? (
              <div className="size-6 bg-white rounded-md animate-pulse" />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            )}
          </button>

          {/* Recording Timer & Status */}
          <div className="space-y-1">
            <span className="font-sans text-xs font-semibold text-stone-800 block">
              {isRecording
                ? `Recording ${durationSeconds}s / 60s`
                : isProcessing
                ? processingSource === "text"
                  ? "Reading your text…"
                  : "Processing voice audio..."
                : "Tap microphone to speak"}
            </span>

            {/* Live Waveform Bar Simulation */}
            {isRecording && (
              <div className="flex items-center justify-center gap-1 h-6 py-1">
                {waveformLevels.slice(0, 16).map((lvl, idx) => (
                  <span
                    key={idx}
                    className="w-1 bg-rose-500 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(4, lvl * 24)}px` }}
                  />
                ))}
              </div>
            )}

            {typeof navigator !== "undefined" && !navigator.onLine && (
              <span role="alert" className="text-xs text-rose-600 block">
                No network — check your connection. You can still type a log.
              </span>
            )}
            {typeof window !== "undefined" && !("MediaRecorder" in window) && (
              <span role="alert" className="text-xs text-rose-600 block">
                Voice recording is not supported in this browser — type your log instead.
              </span>
            )}
            {agentMessage && /429|rate limit/i.test(agentMessage) && (
              <span role="alert" className="text-xs text-rose-600 block">
                Rate limit (429) — please wait and try again.
              </span>
            )}
            {agentMessage && /too large|413/i.test(agentMessage) && (
              <span role="alert" className="text-xs text-rose-600 block">
                That recording or file is too large — try a shorter clip.
              </span>
            )}
            {permissionError && <span className="text-xs text-rose-600 block">{permissionError}</span>}
          </div>
        </div>

        {/* Alternative Natural Text Input */}
        <div className="max-w-xl mx-auto pt-2 w-full">
          <form onSubmit={handleManualSubmit} className="relative flex items-center w-full">
            <input
              ref={textInputRef}
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Or type naturally (e.g. 'Period started 2 days before New Year\'s')..."
              disabled={isProcessing || isRecording}
              className="w-full liquid-glass-input rounded-full py-2.5 sm:py-3 pl-4 sm:pl-5 pr-22 sm:pr-24 text-xs font-sans text-stone-900 placeholder:text-stone-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isProcessing || !manualText.trim()}
              className="absolute right-1 sm:right-1.5 liquid-glass-button rounded-full px-3.5 sm:px-4 py-1.5 font-sans text-xs font-semibold disabled:opacity-40 cursor-pointer shadow-xs whitespace-nowrap"
            >
              Log it →
            </button>
          </form>
          {manualText.length >= 800 && (
            <p className={`text-[11px] mt-1.5 ${manualText.length > 1000 ? "text-rose-600 font-semibold" : "text-stone-500"}`}>
              {manualText.length.toLocaleString()}/1,000 characters
              {manualText.length > 1000 ? " — please shorten it before logging" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Unified conversation: history + current turn in one chat interface */}
      <div role="log" aria-label="Conversation with Feather" className="space-y-3">
        {conversationHistory.map((m, i) => (
          m.role === "user" ? (
            <UserBubble key={"hist-" + i} text={m.content} />
          ) : (
            <FeatherTurn key={"hist-" + i}>
              <p className="font-sans text-sm text-stone-800 leading-relaxed break-words">{m.content}</p>
            </FeatherTurn>
          )
        ))}
        {transcript && <UserBubble text={transcript} />}

        {(agentMessage || isProcessing || (planOverlaps && planOverlaps.length > 0) || plannedEventsState.length > 0 || backfillRows || confirmEntry) && (
          <FeatherTurn>
      {/* Medical Guardrail Refusal Alert */}
      {agentMessage && agentMessage.includes("talk to a doctor") && (
        <div className="rounded-[22px] liquid-glass-card border border-amber-200/80 bg-amber-50/40 p-5 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-800 shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>A note on safety</span>
          </div>
          <p className="font-sans text-xs text-amber-950 leading-relaxed">{agentMessage}</p>
          <span className="font-sans text-[11px] text-amber-800/80 block pt-1">
            Feather is strictly for cycle date logging and event milestone planning. It does not provide medical advice.
          </span>
        </div>
      )}

      {/* Severe care message (classic red-flag or fall/heavy-bleed tier) */}
      {agentMessage && (agentMessage.includes(SEVERE_SYMPTOM_ESCALATION_MESSAGE) || agentMessage.includes(SEVERE_FALL_CARE_MESSAGE)) && (
        <div className="rounded-[22px] liquid-glass-card border border-amber-200/80 bg-amber-50/40 p-5 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-800 shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Please take care</span>
          </div>
          <p className="font-sans text-xs text-amber-950 leading-relaxed">{agentMessage}</p>
          <span className="font-sans text-[11px] text-amber-800/80 block pt-1">
            Feather is strictly for cycle date logging and event milestone planning. It does not provide medical advice.
          </span>
        </div>
      )}

      {/* Agent message outcome (clarifying questions, "didn't understand", unplaced-fact disclosures) */}
      {isProcessing && (
        <p role="status" className="font-sans text-xs text-stone-500">{((retryNotice || "") + (processingSecs >= 1 ? " (Still working\u2026 " + processingSecs + " s)" : "") || (pipelineStage === "transcribing" ? "Transcribing…" : pipelineStage === "preparing" ? "Preparing your log…" : "Thinking..."))}</p>
      )}
      {!(agentMessage && (agentMessage.includes(SEVERE_SYMPTOM_ESCALATION_MESSAGE) || agentMessage.includes(SEVERE_FALL_CARE_MESSAGE))) && (
        <AgentMessageCard message={agentMessage} />
      )}

      {/* Plan Overlap Alerts */}
      {planOverlaps && planOverlaps.length > 0 && (
        <div className="liquid-glass-card rounded-[22px] p-5 space-y-3">
          <span className="font-sans text-xs font-semibold text-violet-700 block">Plan Around It — Overlap Analysis</span>
          <div className="space-y-2">
            {planOverlaps.map((item, idx) => (
              <div key={idx} className="p-3 rounded-[16px] liquid-glass-tile flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-stone-900 block font-sans truncate">
                    {item.name || item.eventName} ({prettyDate(item.eventDate || item.date)})
                  </span>
                  <span className="text-stone-600 text-[11px] block">{item.overlapNote || item.note}</span>
                </div>
                <span
                  className={`liquid-glass-pill font-sans text-[11px] font-semibold px-2.5 py-1 rounded-full self-start sm:self-auto shrink-0 border ${
                    item.overlap === "likely" ? "bg-rose-50/60 text-rose-900 border-rose-200/80" : "bg-emerald-50/60 text-emerald-900 border-emerald-200/80"
                  }`}
                >
                  {item.overlap === "likely"
                    ? "Likely overlap"
                    : item.overlap === "possible"
                    ? "Possible overlap"
                    : item.overlap === "period-day" || item.overlap === "logged"
                    ? "Logged period"
                    : item.overlap === "past"
                    ? "Past"
                    : item.overlap === "unknown"
                    ? "Not enough data yet"
                    : "Unlikely to overlap (estimate)"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Your log — Confirmed Entry Preview (Editable) */}
      {presetDate && (
        <p className="text-xs liquid-glass-card rounded-[16px] p-3">
          Logging for {presetDate} (chosen on the calendar). Mention the date, or confirm the date below after parsing.
        </p>
      )}
      {(agentMode || isOfflineFallback) && (
        <p role="status" className="text-xs liquid-glass-pill rounded-full inline-block px-3 py-1.5">
          {isOfflineFallback || agentMode?.mode === "offline"
            ? "Processed on this device (offline rules)"
            : "Processed with Live AI (Meta Muse Spark)"}
          {usedAnchor ? " · Personal calendar anchor used" : ""}
        </p>
      )}
      <p className="text-xs liquid-glass-pill rounded-full inline-block px-3 py-1.5">
        {allowMatchedCalendar ? "Calendar: matching titles shared with the model" : "Calendar: stays on this device"}
      </p>
      {plannedEventsState.length > 0 && (
        <div className="liquid-glass-card rounded-[24px] p-5 space-y-3 border border-white/95 shadow-md">
          <div className="flex items-center justify-between border-b border-stone-200/50 pb-2">
            <div>
              <span className="font-sans text-xs font-semibold text-emerald-700 block">Plan Around It Event Detected</span>
              <h3 className="font-serif text-lg font-semibold text-stone-900">Save Event to Calendar</h3>
            </div>
            <span className="liquid-glass-pill rounded-full font-sans text-[11px] font-medium text-stone-600 px-2.5 py-1">
              Confirmation Required
            </span>
          </div>
          {plannedEventsState.map((e: any, i: number) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white/40 p-3 rounded-xl border border-white/60">
              <div>
                <span className="font-semibold text-stone-900 block font-sans text-sm">{e.title}</span>
                <span className="text-stone-600 font-sans">
                  {prettyDate(e.date)} ({e.date})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="liquid-glass-button rounded-full px-4 py-2 font-semibold text-xs cursor-pointer shadow-xs"
                  onClick={() => {
                    upsertEvent({ title: e.title, date: e.date, source: "voice" });
                    setPlannedEventsState(plannedEventsState.filter((_: any, j: number) => j !== i));
                    setSavedSuccessMessage(`Event "${e.title}" on ${prettyDate(e.date)} saved to calendar.`);
                    setSavedLink({ to: "/calendar", label: "View in Calendar" });
                  }}
                >
                  Save Event to Calendar
                </button>
                <button
                  type="button"
                  className="liquid-glass-pill rounded-full px-3 py-2 text-xs text-stone-600 cursor-pointer"
                  onClick={() => {
                    setPlannedEventsState(plannedEventsState.filter((_: any, j: number) => j !== i));
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {backfillRows && (
        <div className="liquid-glass-card rounded-[26px] p-6 space-y-5 border border-white/95 shadow-md animate-in fade-in">
          <div className="flex items-center justify-between border-b border-stone-200/50 pb-3">
            <div>
              <span className="font-sans text-xs font-semibold text-emerald-700 block">Backfill review</span>
              <h3 className="font-serif text-xl font-semibold text-stone-900">Confirm Past Periods</h3>
            </div>
            <span className="liquid-glass-pill rounded-full font-sans text-[11px] font-medium text-stone-600 px-2.5 py-1">
              Confirmation Required
            </span>
          </div>
          <p className="font-sans text-xs text-stone-600">One row per period. Nothing is saved until you press Save. Uncheck a row to skip it.</p>
          <div className="space-y-3">
            {[...backfillRows]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((row, idx, sorted) => {
                const gap = backfillGapDays(sorted, idx);
                const warns = row.selected ? backfillRowWarnings(row, sorted, idx, data.periods) : [];
                const dur = backfillDurationDays(row);
                return (
                  <div key={row.key} className="p-3 rounded-[16px] liquid-glass-tile text-xs space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => setBackfillRows(backfillRows.map((r) => (r.key === row.key ? { ...r, selected: e.target.checked } : r)))}
                        aria-label={"Include period starting " + row.date}
                        className="size-4 cursor-pointer"
                      />
                      <span className="font-semibold text-stone-900 font-sans">Period {idx + 1}</span>
                      {gap !== null && <span className="font-sans text-[11px] text-stone-500">{gap} days after previous start</span>}
                      <button
                        type="button"
                        onClick={() => {
                          const next = backfillRows.filter((r) => r.key !== row.key);
                          setBackfillRows(next.length > 0 ? next : null);
                        }}
                        className="liquid-glass-pill rounded-full px-3 py-1 font-sans text-[11px] text-stone-500 hover:text-rose-700 cursor-pointer ml-auto"
                        aria-label={"Delete row " + row.date}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1 block">
                        <span className="font-sans text-[11px] font-medium text-stone-600 block">Start</span>
                        <input
                          type="date"
                          value={row.date}
                          max={todayStr()}
                          onChange={(e) => {
                            if (e.target.value && e.target.value > todayStr()) {
                              setAgentMessage("Cannot select " + e.target.value + " because that date is in the future.");
                              return;
                            }
                            setBackfillRows(backfillRows.map((r) => (r.key === row.key ? { ...r, date: e.target.value } : r)));
                          }}
                          className="w-full liquid-glass-input rounded-xl p-2 text-xs font-sans text-stone-900"
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="font-sans text-[11px] font-medium text-stone-600 block">End (optional)</span>
                        <input
                          type="date"
                          value={row.endDate}
                          min={row.date}
                          max={todayStr()}
                          onChange={(e) => {
                            if (e.target.value && e.target.value > todayStr()) {
                              setAgentMessage("Cannot select " + e.target.value + " because that date is in the future.");
                              return;
                            }
                            setBackfillRows(backfillRows.map((r) => (r.key === row.key ? { ...r, endDate: e.target.value } : r)));
                          }}
                          className="w-full liquid-glass-input rounded-xl p-2 text-xs font-sans text-stone-900"
                        />
                      </label>
                    </div>
                    {dur !== null && row.endDate ? (
                      <span className="font-sans text-[11px] text-stone-600 block">Duration: {dur} days</span>
                    ) : null}
                    {warns.map((w, i) => (
                      <span key={i} className="font-sans text-[11px] text-amber-800 block">
                        {w}
                      </span>
                    ))}
                  </div>
                );
              })}
          </div>
          {backfillLongWarn && (
            <div role="alert" className="rounded-[18px] liquid-glass-card border border-amber-200/80 bg-amber-50/40 px-4 py-3 text-xs text-amber-950 font-sans flex flex-col sm:flex-row sm:items-center gap-2 shadow-xs">
              <span className="flex-1">{backfillLongWarn}</span>
              <button type="button" onClick={() => handleSaveBackfill(true, backfillShortOk)} className="liquid-glass-button rounded-full px-4 py-1.5 font-sans text-xs font-semibold cursor-pointer">
                Save anyway
              </button>
            </div>
          )}
          {backfillShortWarn && (
            <div role="alert" className="rounded-[18px] liquid-glass-card border border-amber-200/80 bg-amber-50/40 px-4 py-3 text-xs text-amber-950 font-sans flex flex-col sm:flex-row sm:items-center gap-2 shadow-xs">
              <span className="flex-1">{backfillShortWarn}</span>
              <button type="button" onClick={() => { setBackfillShortOk(true); handleSaveBackfill(backfillLongOk, true); }} className="liquid-glass-button rounded-full px-4 py-1.5 font-sans text-xs font-semibold cursor-pointer">
                Save anyway
              </button>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-stone-200/50">
            <button
              type="button"
              onClick={() => {
                setBackfillRows(null);
                setBackfillLongWarn(null);
                setBackfillShortWarn(null); setBackfillLongOk(false); setBackfillShortOk(false);
              }}
              className="liquid-glass-pill rounded-full px-4 py-2.5 sm:py-2 font-sans text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer text-center justify-center flex items-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveBackfill(false)}
              className="liquid-glass-button rounded-full px-6 py-2.5 font-sans text-xs font-semibold cursor-pointer shadow-sm text-center justify-center flex items-center"
            >
              Save {backfillSelected(backfillRows).length} periods
            </button>
          </div>
        </div>
      )}
      {!backfillRows && confirmEntry && (
        <div className="liquid-glass-card rounded-[26px] p-6 space-y-5 border border-white/95 shadow-md animate-in fade-in">
          <div className="flex items-center justify-between border-b border-stone-200/50 pb-3">
            <div>
              <span className="font-sans text-xs font-semibold text-emerald-700 block">Your log preview</span>
              <h3 className="font-serif text-xl font-semibold text-stone-900">Confirm Cycle Entry Details</h3>
            </div>
            <span className="liquid-glass-pill rounded-full font-sans text-[11px] font-medium text-stone-600 px-2.5 py-1">
              Confirmation Required
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Date Picker */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-sans text-xs font-medium text-stone-600">Entry Date:</label>
                <span className="font-serif text-sm font-semibold text-stone-900">{prettyDate(confirmEntry.date)}</span>
              </div>
              <input
                type="date"
                value={confirmEntry.date}
                max={todayStr()}
                onChange={(e) => {
                  if (e.target.value && e.target.value > todayStr()) {
                    setAgentMessage(`Cannot select ${e.target.value} because that date is in the future.`);
                    return;
                  }
                  setConfirmEntry({ ...confirmEntry, date: e.target.value });
                }}
                className="w-full liquid-glass-input rounded-xl p-2.5 text-xs font-sans text-stone-900"
              />
              {confirmEntry.dateExplanation ? (
                <span className="text-[11px] text-violet-700 font-medium block" data-testid="date-explanation">
                  {confirmEntry.dateExplanation}
                </span>
              ) : confirmEntry.landmarkName ? (
                <span className="text-[11px] text-violet-700 font-medium block">
                  Landmark: {confirmEntry.landmarkName} → Resolved date: {confirmEntry.date}
                </span>
              ) : null}
            </div>

            {confirmEntry.endDate ? (
              <p className="font-sans text-xs text-stone-600">Period end: {prettyDate(confirmEntry.endDate)} (from your date range).</p>
            ) : null}
            {/* Flow Selector */}
            <div className="space-y-1">
              <label className="font-sans text-xs font-medium text-stone-600 block">Flow Intensity:</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {FLOW_OPTIONS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setConfirmEntry({ ...confirmEntry, flow: f.key })}
                    className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium transition-all cursor-pointer ${
                      confirmEntry.flow === f.key
                        ? "liquid-glass-button font-semibold text-stone-950 shadow-xs"
                        : "liquid-glass-pill text-stone-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Symptom Tag Toggles */}
          <div className="space-y-1.5 text-xs">
            <label className="font-sans text-xs font-medium text-stone-600 block">Symptoms Logged:</label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SYMPTOMS.map((sym) => {
                const isSelected = (confirmEntry.symptoms || []).includes(sym.key);
                return (
                  <button
                    key={sym.key}
                    type="button"
                    onClick={() => toggleSymptom(sym.key)}
                    className={`px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer ${
                      isSelected
                        ? "liquid-glass-button text-violet-950 font-bold shadow-xs border-violet-200"
                        : "liquid-glass-pill text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {sym.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversational Slip Correction Bar */}
          <form onSubmit={handleApplyCorrection} className="pt-2 border-t border-stone-200/40 space-y-1.5">
            <label className="font-sans text-xs font-medium text-stone-600 block">Update your log by typing:</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={slipCorrectionText}
                onChange={(e) => setSlipCorrectionText(e.target.value)}
                placeholder="e.g. 'Actually it was light flow with backache'"
                className="flex-1 liquid-glass-input rounded-xl p-2 text-xs font-sans text-stone-900"
              />
              <button
                type="submit"
                disabled={!slipCorrectionText.trim() || isProcessing}
                className="liquid-glass-button rounded-full px-4 py-2 font-sans text-xs font-semibold text-stone-900 cursor-pointer shadow-xs disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </form>

          {/* Save & Discard Actions */}
          {longPeriodWarning && (
            <div role="alert" className="rounded-[18px] liquid-glass-card border border-amber-200/80 bg-amber-50/40 px-4 py-3 text-xs text-amber-950 font-sans flex flex-col sm:flex-row sm:items-center gap-2 shadow-xs">
              <span className="flex-1">{longPeriodWarning}</span>
              <button type="button" onClick={() => handleSaveConfirmed(true, true)} className="liquid-glass-button rounded-full px-4 py-1.5 font-sans text-xs font-semibold cursor-pointer">
                Save anyway
              </button>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-stone-200/50 sticky bottom-0 z-10">
            <button
              type="button"
              onClick={handleDiscard}
              className="liquid-glass-pill rounded-full px-4 py-2.5 sm:py-2 font-sans text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer text-center justify-center flex items-center"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => handleSaveConfirmed(false)}
              className="liquid-glass-button rounded-full px-6 py-2.5 font-sans text-xs font-semibold cursor-pointer shadow-sm text-center justify-center flex items-center"
            >
              Confirm &amp; Save Entry
            </button>
          </div>
        </div>
      )}

          </FeatherTurn>
        )}
        {savedSuccessMessage && (
          <SystemBubble>
            <div className="rounded-[18px] liquid-glass-card border border-emerald-200/80 bg-emerald-50/40 p-3.5 text-xs text-emerald-950 font-sans flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="font-semibold">{savedSuccessMessage}</span>
              </div>
              <Link to={savedLink.to} className="liquid-glass-pill rounded-full px-3 py-1 font-mono text-[10px] uppercase font-bold text-emerald-900 border border-emerald-200/80 hover:bg-emerald-100/40">
                {savedLink.label} &rarr;
              </Link>
            </div>
          </SystemBubble>
        )}
      </div>

      {/* Under The Hood Trace Disclosure */}
      <div className="liquid-glass-card rounded-[22px] p-4 text-xs space-y-2">
        <button
          type="button"
          onClick={() => setIsUnderHoodOpen(!isUnderHoodOpen)}
          className="w-full flex items-center justify-between text-stone-700 hover:text-stone-950 font-sans text-xs font-medium cursor-pointer"
        >
          <span className="font-semibold flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-600">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span>Under the Hood (Pipeline &amp; Tool Calls)</span>
          </span>
          <span className="text-stone-400">{isUnderHoodOpen ? "Hide" : "Inspect"}</span>
        </button>

        {isUnderHoodOpen && (
          <div className="pt-3 border-t border-stone-200/50 space-y-3 font-mono text-[11px] animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-[10px] text-stone-500 pb-1">
              <span>Pipeline Engine: {technicalEngineString}</span>
              <span>Guardrails: Active</span>
            </div>

            {toolCalls.length === 0 ? (
              <p className="text-stone-500 py-2 text-center text-xs font-sans">
                Run a voice or text query above to inspect model ID, tool calls, and latencies.
              </p>
            ) : (
              toolCalls.map((call, idx) => (
                <div key={idx} className="liquid-glass-card rounded-[14px] p-3 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900 flex items-center gap-1">
                      <span className="text-violet-600">λ</span> {call.toolName}
                    </span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-bold">{call.latencyMs} ms</span>
                      <span className="liquid-glass-pill rounded-full px-2 py-0.5 text-stone-600">{call.model}</span>
                      <span className="liquid-glass-pill rounded-full px-2 py-0.5 text-stone-600">{call.executedBy || call.model}</span>
                    </div>
                  </div>
                  <pre className="bg-stone-50 p-2.5 rounded-lg text-stone-800 text-[10px] overflow-x-auto max-w-full break-all whitespace-pre-wrap font-mono">
                    {JSON.stringify({ args: call.args, result: call.result }, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
