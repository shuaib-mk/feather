import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCycle } from "../context/CycleContext";
import { PageHeader } from "../components/PageHeader";
import { useAudioRecorder } from "../../../ai/frontend/useAudioRecorder";
import { sendAgentMessage, transcribeAudioBlob, type ClientAgentResult } from "../../../ai/frontend/aiClient";
import type { StructuredEntry, ToolCallRecord, ActivityStep, ValidSymptom } from "../../../ai/backend/agent";
import { prettyDate, todayStr } from "../cycleStorage";

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
        setAgentMessage(res.error || "No clear speech detected in recording.");
        setActivityTrail([{ step: "Voice Recognition", detail: res.error || "Acoustic detection ended without text", status: "done" }]);
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      setAgentMessage("Could not transcribe audio. Please verify your microphone or type below.");
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

    const pending = activePendingEntry !== undefined ? activePendingEntry : confirmEntry;

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
        },
        conversationHistory,
      );

      setAgentMessage(res.message);
      setActivityTrail(res.activityTrail || []);
      if (res.toolCalls && res.toolCalls.length > 0) {
        setToolCalls(res.toolCalls);
      }
      setIsOfflineFallback(Boolean(res.isOfflineFallback));

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

  const handleSaveConfirmed = () => {
    if (!confirmEntry) return;

    if (confirmEntry.flow && confirmEntry.flow !== "none") {
      savePeriod({
        startDate: confirmEntry.date,
        endDate: null,
        startEarliest: confirmEntry.isApproximate ? confirmEntry.date : null,
        startLatest: confirmEntry.isApproximate ? confirmEntry.date : null,
        landmarkName: confirmEntry.landmarkName || null,
      });
    }

    saveLog({
      logDate: confirmEntry.date,
      flow: confirmEntry.flow || null,
      symptoms: confirmEntry.symptoms || [],
      mood: confirmEntry.mood || null,
      energy: confirmEntry.energy || null,
      sleepHours: confirmEntry.sleep || null,
      notes: confirmEntry.notes || null,
    });

    const confirmedDate = confirmEntry.date;
    setSavedSuccessMessage(`Entry for ${prettyDate(confirmedDate)} saved to your device vault.`);
    setConfirmEntry(null);
    setSlipCorrectionText("");
  };

  const handleDiscard = () => {
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
        subtitle="Speak or type naturally in English, Malayalam, or Hindi. Natural calendar landmarks are resolved instantly."
        badge="Multilingual AI"
      />

      {/* Offline Mode Banner */}
      {isOfflineFallback && (
        <div className="rounded-[16px] bg-amber-50/90 border border-amber-300 px-4 py-2 text-xs text-amber-900 font-mono flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-600 animate-pulse" />
            <span className="font-bold">Offline mode: rules engine, not Muse</span>
          </div>
          <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-sans">Local Fallback</span>
        </div>
      )}

      {/* Rate Limit Notice */}
      {rateLimitNotice && (
        <div className="rounded-[16px] bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-sans flex items-center gap-2 shadow-xs">
          <span>⚠️</span>
          <span>{rateLimitNotice}</span>
        </div>
      )}

      {/* Success Notification */}
      {savedSuccessMessage && (
        <div className="rounded-[16px] bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-900 font-sans flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="font-bold">{savedSuccessMessage}</span>
          </div>
          <Link to="/chronicle" className="font-mono text-[10px] uppercase font-bold underline text-emerald-800">
            View in Chronicle →
          </Link>
        </div>
      )}

      {/* Recording & Input Console */}
      <div className="liquid-glass-card rounded-[26px] p-6 sm:p-8 text-center space-y-6 border border-white/90 shadow-sm relative">
        {/* Language Selection Row */}
        <div className="flex items-center justify-center gap-2 flex-wrap text-xs">
          <span className="text-stone-500 font-mono text-[10px] uppercase tracking-wider">Language:</span>
          <div className="inline-flex rounded-full liquid-glass-pill p-1 gap-1">
            {[
              { id: "auto", label: "Auto Detect" },
              { id: "en", label: "English" },
              { id: "ml", label: "മലയാളം" },
              { id: "hi", label: "हिन्दी" },
            ].map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setSelectedLanguage(lang.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  selectedLanguage === lang.id
                    ? "bg-stone-900 text-white shadow-xs font-bold"
                    : "text-stone-600 hover:text-stone-950"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center Microphone Orb */}
        <div className="flex flex-col items-center justify-center space-y-3 py-2">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            aria-label={isRecording ? "Stop recording voice note" : "Start recording voice note"}
            className={`relative size-20 sm:size-24 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-md ${
              isRecording
                ? "bg-rose-600 text-white scale-105 shadow-rose-200 ring-8 ring-rose-100"
                : "liquid-glass-button-dark hover:scale-102 hover:shadow-lg"
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
            <span className="font-mono text-xs font-bold text-stone-800 block">
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

            {permissionError && (
              <span className="text-xs text-rose-600 block">{permissionError}</span>
            )}
          </div>
        </div>

        {/* Alternative Natural Text Input */}
        <div className="max-w-xl mx-auto pt-2">
          <form onSubmit={handleManualSubmit} className="relative flex items-center">
            <input
              ref={textInputRef}
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Or type naturally (e.g., 'Period started 2 days before Diwali, medium flow')..."
              disabled={isProcessing || isRecording}
              className="w-full liquid-glass-input rounded-full py-3 pl-5 pr-24 text-xs font-sans text-stone-900 placeholder:text-stone-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isProcessing || !manualText.trim()}
              className="absolute right-1.5 liquid-glass-button-dark rounded-full px-4 py-1.5 font-mono text-[10px] uppercase font-bold disabled:opacity-40 cursor-pointer shadow-xs"
            >
              Resolve →
            </button>
          </form>
        </div>
      </div>

      {/* Transcript & Refusal / Agent Output */}
      {transcript && (
        <div className="liquid-glass-card rounded-[20px] p-4 text-xs space-y-1.5 border border-white/80">
          <span className="font-mono text-[9px] uppercase font-bold tracking-wider text-stone-500 block">
            Transcript Received
          </span>
          <p className="font-sans text-stone-800 text-sm font-medium">"{transcript}"</p>
        </div>
      )}

      {/* Medical Guardrail Refusal Alert */}
      {agentMessage && agentMessage.includes("talk to a doctor") && (
        <div className="rounded-[22px] bg-amber-50/90 border border-amber-300 p-5 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <span>🛡️</span>
            <span>Safety Guardrail Intercept</span>
          </div>
          <p className="font-sans text-xs text-amber-950 leading-relaxed">
            {agentMessage}
          </p>
          <span className="font-mono text-[10px] text-amber-700 block pt-1">
            Feather is strictly for cycle date logging and event milestone planning. It does not provide medical advice.
          </span>
        </div>
      )}

      {/* Plan Overlap Alerts */}
      {planOverlaps && planOverlaps.length > 0 && (
        <div className="liquid-glass-card rounded-[22px] p-5 space-y-3">
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-violet-700 block">
            Plan Around It — Overlap Analysis
          </span>
          <div className="space-y-2">
            {planOverlaps.map((item, idx) => (
              <div key={idx} className="p-3 rounded-[16px] bg-white/80 border border-stone-200/60 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-stone-900 block">{item.eventName} ({prettyDate(item.date)})</span>
                  <span className="text-stone-600 text-[11px] block">{item.note}</span>
                </div>
                <span className={`font-mono text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                  item.overlap === "likely" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                }`}>
                  {item.overlap === "likely" ? "Likely Overlap" : "Unlikely Overlap"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accession Slip — Confirmed Entry Preview (Editable) */}
      {confirmEntry && (
        <div className="liquid-glass-card rounded-[26px] p-6 space-y-5 border border-white/95 shadow-md animate-in fade-in">
          <div className="flex items-center justify-between border-b border-stone-200/50 pb-3">
            <div>
              <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-emerald-700 block">
                Accession Slip Preview
              </span>
              <h3 className="font-serif text-xl font-bold text-stone-900">
                Confirm Cycle Entry Details
              </h3>
            </div>
            <span className="font-mono text-[10px] bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full">
              Confirmation Required
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Date Picker */}
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase font-bold text-stone-500 block">
                Entry Date:
              </label>
              <input
                type="date"
                value={confirmEntry.date}
                onChange={(e) => setConfirmEntry({ ...confirmEntry, date: e.target.value })}
                className="w-full liquid-glass-input rounded-xl p-2.5 text-xs font-mono text-stone-900"
              />
              {confirmEntry.landmarkName && (
                <span className="text-[10px] text-violet-700 font-medium block">
                  Resolved landmark: {confirmEntry.landmarkName}
                </span>
              )}
            </div>

            {/* Flow Selector */}
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase font-bold text-stone-500 block">
                Flow Intensity:
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {FLOW_OPTIONS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setConfirmEntry({ ...confirmEntry, flow: f.key })}
                    className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase transition-all cursor-pointer ${
                      confirmEntry.flow === f.key
                        ? "liquid-glass-button-dark font-bold"
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
            <label className="font-mono text-[10px] uppercase font-bold text-stone-500 block">
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
                        ? "bg-violet-600 text-white font-medium shadow-xs"
                        : "liquid-glass-pill text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {sym.label} {isSelected && "✓"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversational Slip Correction Bar */}
          <form onSubmit={handleApplyCorrection} className="pt-2 border-t border-stone-200/40 space-y-1.5">
            <label className="font-mono text-[10px] uppercase text-stone-500 block">
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
                className="liquid-glass-pill px-3 py-2 font-mono text-[10px] uppercase font-bold text-stone-900 hover:bg-stone-900 hover:text-white cursor-pointer"
              >
                Apply
              </button>
            </div>
          </form>

          {/* Save & Discard Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200/50">
            <button
              type="button"
              onClick={handleDiscard}
              className="liquid-glass-pill px-4 py-2 font-mono text-xs uppercase text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSaveConfirmed}
              className="liquid-glass-button-dark rounded-full px-6 py-2.5 font-mono text-xs uppercase tracking-wider font-bold cursor-pointer shadow-sm"
            >
              ✓ Confirm &amp; Save Entry
            </button>
          </div>
        </div>
      )}

      {/* Under The Hood Trace Disclosure */}
      <div className="liquid-glass-card rounded-[22px] p-4 text-xs space-y-2">
        <button
          type="button"
          onClick={() => setIsUnderHoodOpen(!isUnderHoodOpen)}
          className="w-full flex items-center justify-between text-stone-700 hover:text-stone-950 font-mono text-[11px] uppercase tracking-wider cursor-pointer"
        >
          <span className="font-bold flex items-center gap-1.5">
            <span>⚙️</span> Under the Hood (Pipeline &amp; Tool Calls)
          </span>
          <span className="text-stone-400">{isUnderHoodOpen ? "Hide ▲" : "Inspect ▼"}</span>
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
                <div key={idx} className="bg-white/80 rounded-[14px] p-3 border border-stone-200/70 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900 flex items-center gap-1">
                      <span className="text-violet-600">λ</span> {call.toolName}
                    </span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-bold">{call.latencyMs} ms</span>
                      <span className="liquid-glass-pill px-2 py-0.5 text-stone-600">{call.model}</span>
                    </div>
                  </div>
                  <pre className="bg-stone-50 p-2 rounded-lg text-stone-800 text-[10px] overflow-x-auto">
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
