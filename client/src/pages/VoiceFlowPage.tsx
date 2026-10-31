import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loadEvents, fuzzyMatchEvents, upsertEvent } from "../lib/events";
import { useCycle } from "../context/CycleContext";
import { PageHeader } from "../components/PageHeader";
import { useAudioRecorder } from "../../../ai/frontend/useAudioRecorder";
import { sendAgentMessage, transcribeAudioBlob, type ClientAgentResult } from "../../../ai/frontend/aiClient";
import type { StructuredEntry, ToolCallRecord, ActivityStep, ValidSymptom } from "../../../ai/backend/agent";
import { prettyDate, todayStr, addDays } from "../cycleStorage";

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
  const { data, stats, savePeriod, saveLog } = useCycle();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetDate = searchParams.get("date");
  const [plannedEventsState, setPlannedEventsState] = useState<any[]>([]);
  const [agentMode, setAgentMode] = useState<any>(null);
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

  const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [manualText, setManualText] = useState<string>("");
  const [agentMessage, setAgentMessage] = useState<string>("");
  const [activityTrail, setActivityTrail] = useState<ActivityStep[]>([]);
  const [confirmEntry, setConfirmEntry] = useState<StructuredEntry | null>(null);
  const [planOverlaps, setPlanOverlaps] = useState<any[] | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>([]);
  const [isUnderHoodOpen, setIsUnderHoodOpen] = useState<boolean>(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState<boolean>(false);
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);
  const [slipCorrectionText, setSlipCorrectionText] = useState<string>("");
  const [longPeriodWarning, setLongPeriodWarning] = useState<string | null>(null);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);

  const textInputRef = useRef<HTMLInputElement | null>(null);

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

  const runAgentPipeline = async (promptText: string, activePendingEntry?: StructuredEntry | null) => {
    setIsProcessing(true);
    setTranscript(promptText);
    setRateLimitNotice(null);
    setSavedSuccessMessage(null);

    const pending = activePendingEntry !== undefined ? activePendingEntry : null; // B3: only the slip-correction box passes a pending entry; new messages start clean

    // Resolve most recent saved entry for standalone corrections
    const sortedLogs = [...data.logs].sort((a, b) => b.logDate.localeCompare(a.logDate));
    const recentLog = sortedLogs[0];
    const recentPeriod = recentLog ? data.periods.find((p) => p.startDate === recentLog.logDate) : data.periods[0];
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
          },
          periods: data.periods,
          currentDate: todayStr(),
          pendingEntry: pending,
          recentEntry,
          locale: typeof navigator !== "undefined" ? navigator.language : "en",
          matchedEvents: (()=>{ try { if (localStorage.getItem("feather_allow_matched_events")!=="true") return []; return fuzzyMatchEvents(promptText, loadEvents()).map((e)=>({title:e.title,date:e.date})); } catch { return []; } })(),
        },
        conversationHistory,
      );

      setAgentMessage(res.message);
      setActivityTrail(res.activityTrail || []);
      if (res.toolCalls && res.toolCalls.length > 0) {
        setToolCalls(res.toolCalls);
      }
      setIsOfflineFallback(Boolean(res.isOfflineFallback));
      setAgentMode(res);
      setUsedAnchor(Boolean((res as any).usedPersonalAnchor));
      const extractedEvents = (res as any).plannedEvents?.length
        ? (res as any).plannedEvents
        : (res.planOverlaps?.length ? res.planOverlaps.map((o: any) => ({ title: o.name || o.eventName, date: o.eventDate || o.date })) : []);
      if (extractedEvents.length) setPlannedEventsState(extractedEvents);

      if (res.rateLimited) {
        setRateLimitNotice(res.message);
      }

      if (res.entry) {
        setConfirmEntry(res.entry);
      }

      if (res.planOverlaps && res.planOverlaps.length > 0) {
        setPlanOverlaps(res.planOverlaps);
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
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    runAgentPipeline(manualText.trim());
    setManualText("");
  };

  const handleSaveConfirmed = (confirmLongPeriod: boolean = false) => {
    if (!confirmEntry) return;

    // One atomic save: the log and its period are written together or not at all.
    const isBleeding = confirmEntry.flow === "light" || confirmEntry.flow === "medium" || confirmEntry.flow === "heavy";
    const isPeriod = confirmEntry.kind === "period_started" || isBleeding;
    const kind = isPeriod ? "period_started" : (confirmEntry.kind || "daily_log");
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
        landmarkName: confirmEntry.landmarkName || null,
        startEarliest: confirmEntry.isApproximate ? addDays(confirmEntry.date, -3) : null,
        startLatest: confirmEntry.isApproximate ? addDays(confirmEntry.date, 3) : null,
        confirmLongPeriod,
      },
    );

    if (!result) return; // error toast shown by CycleContext; nothing was saved
    if (result.needsConfirmation) {
      setLongPeriodWarning(result.confirmationReason || "This would make a period longer than 10 days. Save it anyway?");
      return;
    }

    const confirmedDate = confirmEntry.date;
    setSavedSuccessMessage(`Entry for ${prettyDate(confirmedDate)} saved to your device vault.`);
    setConfirmEntry(null);
    setSlipCorrectionText("");
    setLongPeriodWarning(null);
  };

  const handleDiscard = () => {
    setLongPeriodWarning(null);
    setConfirmEntry(null);
    setSlipCorrectionText("");
    setPlanOverlaps(null);
    setAgentMessage("");
  };

  const toggleSymptom = (sym: ValidSymptom) => {
    if (!confirmEntry) return;
    const current = confirmEntry.symptoms || [];
    const updated = current.includes(sym) ? current.filter((s) => s !== sym) : [...current, sym];
    setConfirmEntry({ ...confirmEntry, symptoms: updated });
  };

  const handleApplyCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slipCorrectionText.trim() || !confirmEntry) return;
    runAgentPipeline(slipCorrectionText.trim(), confirmEntry);
    setSlipCorrectionText("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice Capture"
        subtitle="Speak or type naturally in any language. Natural calendar landmarks are resolved instantly."
        badge="Universal Voice AI"
      />

      {/* Offline Mode Banner */}
      {isOfflineFallback && (
        <div className="rounded-[18px] liquid-glass-card border border-amber-200/80 bg-amber-50/40 px-4 py-2.5 text-xs text-amber-950 font-mono flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-bold">Offline mode: rules engine, not Muse</span>
          </div>
          <span className="liquid-glass-pill rounded-full px-2.5 py-0.5 text-[11px] font-sans font-medium text-amber-900 border border-amber-200/70">Local Fallback</span>
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

      {/* Success Notification */}
      {savedSuccessMessage && (
        <div className="rounded-[18px] liquid-glass-card border border-emerald-200/80 bg-emerald-50/40 p-3.5 text-xs text-emerald-950 font-sans flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="font-semibold">{savedSuccessMessage}</span>
          </div>
          <Link to="/chronicle" className="liquid-glass-pill rounded-full px-3 py-1 font-mono text-[10px] uppercase font-bold text-emerald-900 border border-emerald-200/80 hover:bg-emerald-100/40">
            View in Chronicle →
          </Link>
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
                  onClick={() => setSelectedLanguage(lang.id)}
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
        <p className="text-[11px] text-stone-500 font-sans">Voice transcription supports English, Hindi, Bengali, Kannada, Marathi, Tamil and Telugu. Malayalam voice is not supported by Meta — Malayalam works when typed (offline parser). Recordings are capped at 60 seconds.</p>

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
                ? `Recording 0:${durationSeconds < 10 ? `0${durationSeconds}` : durationSeconds} / 0:30`
                : isProcessing
                ? "Processing voice audio..."
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

            {typeof navigator !== "undefined" && !navigator.onLine && (<span role="alert" className="text-xs text-rose-600 block">No network — check your connection. You can still type a log.</span>)}{typeof window !== "undefined" && !("MediaRecorder" in window) && (<span role="alert" className="text-xs text-rose-600 block">Voice recording is not supported in this browser — type your log instead.</span>)}{agentMessage && /429|rate limit/i.test(agentMessage) && (<span role="alert" className="text-xs text-rose-600 block">Rate limit (429) — please wait and try again.</span>)}{agentMessage && /too large|413/i.test(agentMessage) && (<span role="alert" className="text-xs text-rose-600 block">That recording or file is too large — try a shorter clip.</span>)}{permissionError && (
              <span className="text-xs text-rose-600 block">{permissionError}</span>
            )}
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
              Resolve →
            </button>
          </form>
        </div>
      </div>

      {/* Transcript & Refusal / Agent Output */}
      {transcript && (
        <div className="liquid-glass-card rounded-[20px] p-4 text-xs space-y-1.5 border border-white/80">
          <span className="font-sans text-xs font-medium text-stone-500 block">
            Transcript Received
          </span>
          <p className="font-sans text-stone-800 text-sm font-medium">"{transcript}"</p>
        </div>
      )}

      {/* Medical Guardrail Refusal Alert */}
      {agentMessage && agentMessage.includes("talk to a doctor") && (
        <div className="rounded-[22px] liquid-glass-card border border-amber-200/80 bg-amber-50/40 p-5 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-800 shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Safety Guardrail Intercept</span>
          </div>
          <p className="font-sans text-xs text-amber-950 leading-relaxed">
            {agentMessage}
          </p>
          <span className="font-sans text-[11px] text-amber-800/80 block pt-1">
            Feather is strictly for cycle date logging and event milestone planning. It does not provide medical advice.
          </span>
        </div>
      )}

      {/* Plan Overlap Alerts */}
      {planOverlaps && planOverlaps.length > 0 && (
        <div className="liquid-glass-card rounded-[22px] p-5 space-y-3">
          <span className="font-sans text-xs font-semibold text-violet-700 block">
            Plan Around It — Overlap Analysis
          </span>
          <div className="space-y-2">
            {planOverlaps.map((item, idx) => (
              <div key={idx} className="p-3 rounded-[16px] liquid-glass-tile flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-stone-900 block font-sans truncate">{item.name || item.eventName} ({prettyDate(item.eventDate || item.date)})</span>
                  <span className="text-stone-600 text-[11px] block">{item.overlapNote || item.note}</span>
                </div>
                <span className={`liquid-glass-pill font-sans text-[11px] font-semibold px-2.5 py-1 rounded-full self-start sm:self-auto shrink-0 border ${
                  item.overlap === "likely" ? "bg-rose-50/60 text-rose-900 border-rose-200/80" : "bg-emerald-50/60 text-emerald-900 border-emerald-200/80"
                }`}>
                  {item.overlap === "likely" ? "Likely overlap" : item.overlap === "possible" ? "Possible overlap" : item.overlap === "period-day" || item.overlap === "logged" ? "Logged period" : item.overlap === "past" ? "Past" : item.overlap === "unknown" ? "Not enough data yet" : "Unlikely to overlap (estimate)"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accession Slip — Confirmed Entry Preview (Editable) */}
      {presetDate && <p className="text-xs liquid-glass-card rounded-[16px] p-3">Logging for {presetDate} (chosen on the calendar). Mention the date, or confirm the slip date after parsing.</p>}
      {(agentMode || isOfflineFallback) && (
        <p role="status" className="text-xs liquid-glass-pill rounded-full inline-block px-3 py-1.5">
          {isOfflineFallback || agentMode?.mode === "offline"
            ? (agentMode?.modeReason && agentMode.modeReason.startsWith("Offline parser")
                ? agentMode.modeReason
                : `Offline parser — Meta model not used (${agentMode?.modeReason || "offline fallback"})`)
            : "Live: Meta Muse Spark"}
          {usedAnchor ? " · Personal calendar anchor used" : ""}
        </p>
      )}
      {plannedEventsState.length > 0 && (
        <div className="liquid-glass-card rounded-[24px] p-5 space-y-3 border border-white/95 shadow-md">
          <div className="flex items-center justify-between border-b border-stone-200/50 pb-2">
            <div>
              <span className="font-sans text-xs font-semibold text-emerald-700 block">
                Plan Around It Event Detected
              </span>
              <h3 className="font-serif text-lg font-semibold text-stone-900">
                Save Event to Calendar
              </h3>
            </div>
            <span className="liquid-glass-pill rounded-full font-sans text-[11px] font-medium text-stone-600 px-2.5 py-1">
              Confirmation Required
            </span>
          </div>
          {plannedEventsState.map((e: any, i: number) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white/40 p-3 rounded-xl border border-white/60">
              <div>
                <span className="font-semibold text-stone-900 block font-sans text-sm">{e.title}</span>
                <span className="text-stone-600 font-sans">{prettyDate(e.date)} ({e.date})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="liquid-glass-button rounded-full px-4 py-2 font-semibold text-xs cursor-pointer shadow-xs"
                  onClick={() => {
                    upsertEvent({ title: e.title, date: e.date, source: "voice" });
                    setPlannedEventsState(plannedEventsState.filter((_: any, j: number) => j !== i));
                    setSavedSuccessMessage(`Event "${e.title}" on ${prettyDate(e.date)} saved to calendar.`);
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
      {confirmEntry && (
        <div className="liquid-glass-card rounded-[26px] p-6 space-y-5 border border-white/95 shadow-md animate-in fade-in">
          <div className="flex items-center justify-between border-b border-stone-200/50 pb-3">
            <div>
              <span className="font-sans text-xs font-semibold text-emerald-700 block">
                Accession Slip Preview
              </span>
              <h3 className="font-serif text-xl font-semibold text-stone-900">
                Confirm Cycle Entry Details
              </h3>
            </div>
            <span className="liquid-glass-pill rounded-full font-sans text-[11px] font-medium text-stone-600 px-2.5 py-1">
              Confirmation Required
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Date Picker */}
            <div className="space-y-1">
              <label className="font-sans text-xs font-medium text-stone-600 block">
                Entry Date:
              </label>
              <input
                type="date"
                value={confirmEntry.date}
                onChange={(e) => setConfirmEntry({ ...confirmEntry, date: e.target.value })}
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

            {/* Flow Selector */}
            <div className="space-y-1">
              <label className="font-sans text-xs font-medium text-stone-600 block">
                Flow Intensity:
              </label>
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
            <label className="font-sans text-xs font-medium text-stone-600 block">
              Symptoms Logged:
            </label>
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
            <label className="font-sans text-xs font-medium text-stone-600 block">
              Slip Correction (Conversation):
            </label>
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
              <button type="button" onClick={() => handleSaveConfirmed(true)} className="liquid-glass-button rounded-full px-4 py-1.5 font-sans text-xs font-semibold cursor-pointer">Save anyway</button>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-stone-200/50">
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
              <span>Pipeline Engine: {isOfflineFallback ? "Offline Rule Engine" : "Meta Muse AI Service"}</span>
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
                      <span className="liquid-glass-pill rounded-full px-2 py-0.5 text-stone-600">{call.model}</span><span className="liquid-glass-pill rounded-full px-2 py-0.5 text-stone-600">{call.executedBy || call.model}</span>
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
