import React, { useState, useEffect, useRef } from "react";
import { useAudioRecorder } from "../../ai/frontend/useAudioRecorder";
import { sendAgentMessage, transcribeAudioBlob, fetchDeepCycleSynthesis } from "../../ai/frontend/aiClient";
import { PaperDiaryImportModal } from "../../ai/frontend/PaperDiaryImportModal";
import { LiquidGlassSidebar } from "./LiquidGlassSidebar";
import { DeveloperDocsModal } from "./DeveloperDocsModal";
import { CreditsModal } from "./CreditsModal";
import type { ActivityStep, StructuredEntry, ValidSymptom } from "../../ai/backend/agent";
import { VALID_SYMPTOMS } from "../../ai/backend/agent";
import type { DeepCycleSynthesis, FestivalForecast, PhaseCorrelation } from "../../ai/backend/synthesis";
import { getBaselineSynthesis } from "../../ai/backend/synthesis";
import {
  loadCycleData,
  saveCycleData,
  addOrUpdateLog,
  addOrUpdatePeriod,
  deleteDayLog,
  deletePeriodEntry,
  computeCycleStats,
  evaluateOverlaps,
  todayStr,
  prettyDate,
  OVERLAP_DISCLAIMER,
  isExportOverdue,
  getEntriesSinceExport,
  incrementEntriesSinceExport,
  recordExportTimestamp,
  exportCycleDataJSON,
  importCycleDataJSON,
} from "./cycleStorage";
import type { Period, DayLog, CycleStats } from "./cycleStorage";

const SYMPTOM_LABELS: Record<ValidSymptom, string> = {
  cramps: "Cramps",
  headache: "Headache",
  backache: "Back pain",
  bloating: "Bloating",
  breast_tenderness: "Breast tenderness",
  acne: "Breakouts",
  fatigue: "Fatigue",
  cravings: "Cravings",
  nausea: "Nausea",
  mood_swings: "Mood swings",
  anxiety: "Anxiety",
  insomnia: "Trouble sleeping",
  dizziness: "Dizziness",
  appetite_change: "Appetite changes",
};

const FLOW_OPTIONS = [
  { key: "none", label: "None" },
  { key: "spotting", label: "Spotting" },
  { key: "light", label: "Light" },
  { key: "medium", label: "Medium" },
  { key: "heavy", label: "Heavy" },
] as const;

const MOOD_OPTIONS = ["Great", "Good", "Okay", "Low", "Irritable", "Anxious", "Emotional", "Calm"];

const LIFE_EVENT_SUGGESTIONS = [
  { label: "New Year's Recall", query: "Logged period 2 days before New Year's, heavy flow." },
  { label: "Women's Day Recall", query: "Period started around International Women's Day with medium flow." },
  { label: "Marathon & Flight", query: "Check cycle: marathon on Nov 15, flight to London on Dec 4." },
  { label: "Summer Vacation", query: "Beach vacation planned for July 12, check cycle overlap." },
  { label: "Exam & Presentation", query: "Certification exam on Oct 10, presentation on Oct 24." },
];

export function App() {
  // Cycle Storage State
  const [data, setData] = useState<{ periods: Period[]; logs: DayLog[] }>(() => loadCycleData());
  const stats: CycleStats = computeCycleStats(data.periods);

  // Feather Liquid Glass UI State
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState<boolean>(false);
  const [isDiaryOpen, setIsDiaryOpen] = useState<boolean>(false);
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);

  // Backup & Privacy Notification State
  const [overdueDismissed, setOverdueDismissed] = useState<boolean>(false);
  const [backupToast, setBackupToast] = useState<boolean>(false);
  const [useBrowserSpeech, setUseBrowserSpeech] = useState<boolean>(false);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  // Voice & AI State
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
  const [agentMessage, setAgentMessage] = useState<string>("");
  const [activityTrail, setActivityTrail] = useState<ActivityStep[]>([]);
  const [confirmEntry, setConfirmEntry] = useState<StructuredEntry | null>(null);
  const [planOverlaps, setPlanOverlaps] = useState<any[] | null>(null);
  const [manualText, setManualText] = useState<string>("");

  // Multi-Turn Conversational Memory & Deep Chronobiology Synthesis State
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [synthesisResult, setSynthesisResult] = useState<DeepCycleSynthesis>(() =>
    getBaselineSynthesis(data.periods, stats, 2026),
  );
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [foresightFilter, setForesightFilter] = useState<"all" | "travel" | "energy" | "rest">("all");
  const [foresightView, setForesightView] = useState<"cards" | "table">("cards");

  const handleRunSynthesis = async () => {
    setIsSynthesizing(true);
    try {
      const res = await fetchDeepCycleSynthesis(
        data.periods,
        data.logs,
        {
          avgCycleLength: stats.avgCycleLength,
          avgPeriodLength: stats.avgPeriodLength,
          lastPeriodStart: stats.lastPeriodStart,
        },
        2026,
      );
      setSynthesisResult(res);
    } catch (err) {
      console.error("Synthesis error:", err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Recalculate baseline synthesis synchronously when period records change (0ms, zero lag)
  useEffect(() => {
    setSynthesisResult(getBaselineSynthesis(data.periods, stats, 2026));
  }, [data.periods.length, data.logs.length]);

  // Process captured audio automatically
  useEffect(() => {
    if (audioBlob && !isRecording) {
      handleAudioCaptured(audioBlob);
    }
  }, [audioBlob, isRecording]);

  const handleAudioCaptured = async (blob: Blob) => {
    setIsProcessing(true);
    setActivityTrail([{ step: "Voice Recognition", detail: "Meta Muse Voice Transcribe", status: "pending" }]);
    setConfirmEntry(null);
    setPlanOverlaps(null);

    try {
      const hint = selectedLanguage === "auto" ? undefined : selectedLanguage;
      const res = await transcribeAudioBlob(blob, hint);
      const text = (res.text && res.text.trim()) || "";
      if (text) {
        setTranscript(text);
        await runAgentPipeline(text);
      } else {
        setAgentMessage("No speech was detected in your recording. Please speak clearly into your mic or type below.");
        setActivityTrail([{ step: "Voice Recognition", detail: "No speech detected in audio clip", status: "done" }]);
      }
    } catch (err: any) {
      console.error("Voice processing error:", err);
      setAgentMessage("Could not transcribe audio. Please verify your connection or type below.");
      setActivityTrail([{ step: "Voice Recognition", detail: "Acoustic error", status: "error" }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const runAgentPipeline = async (promptText: string) => {
    setIsProcessing(true);
    setTranscript(promptText);
    setConfirmEntry(null);
    setPlanOverlaps(null);

    try {
      const res = await sendAgentMessage(
        promptText,
        {
          cycleStats: {
            avgCycleLength: stats.avgCycleLength,
            avgPeriodLength: stats.avgPeriodLength,
            lastPeriodStart: stats.lastPeriodStart,
          },
          periods: data.periods,
          currentDate: todayStr(),
        },
        conversationHistory,
      );

      setAgentMessage(res.message);
      setActivityTrail(res.activityTrail || []);

      if (res.entry) {
        setConfirmEntry(res.entry);
      }
      if (res.planOverlaps && res.planOverlaps.length > 0) {
        setPlanOverlaps(res.planOverlaps);
      }

      // Update multi-turn history
      if (!res.message.includes("talk to a doctor")) {
        setConversationHistory((prev) => [
          ...prev,
          { role: "user", content: promptText },
          { role: "assistant", content: res.message },
        ]);
      }
    } catch (err) {
      console.error("Agent error:", err);
      setAgentMessage("Could not process request.");
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
      addOrUpdatePeriod({
        startDate: confirmEntry.date,
        endDate: null,
        startEarliest: confirmEntry.isApproximate ? confirmEntry.date : null,
        startLatest: confirmEntry.isApproximate ? confirmEntry.date : null,
        landmarkName: confirmEntry.landmarkName || null,
      });
    }

    addOrUpdateLog({
      logDate: confirmEntry.date,
      flow: confirmEntry.flow || null,
      symptoms: confirmEntry.symptoms || [],
      mood: confirmEntry.mood || null,
      energy: confirmEntry.energy || null,
      sleepHours: confirmEntry.sleep || null,
      notes: confirmEntry.notes || null,
    });

    const newData = loadCycleData();
    setData(newData);
    setConfirmEntry(null);
    setAgentMessage(`Entry for ${prettyDate(confirmEntry.date)} confirmed and saved to your device.`);

    // Check 5-entry export prompt
    const entriesCount = getEntriesSinceExport();
    if (entriesCount >= 5) {
      setBackupToast(true);
    }
  };

  const handleExportJSON = () => {
    const jsonStr = exportCycleDataJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feather-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupToast(false);
    setOverdueDismissed(true);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const confirmOverwrite = window.confirm(
        "Importing will replace your current local cycle records with the data from the backup file. Proceed?",
      );
      if (!confirmOverwrite) return;

      const res = importCycleDataJSON(content);
      if (res.success) {
        setData(loadCycleData());
        setAgentMessage(`Imported ${res.count} records from backup.`);
      } else {
        alert(res.error || "Could not parse backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDiaryImport = (periods: Array<{ startDate: string; endDate?: string | null; notes?: string }>) => {
    for (const p of periods) {
      addOrUpdatePeriod({
        startDate: p.startDate,
        endDate: p.endDate || null,
        landmarkName: p.notes || "Diary Import",
      });
    }
    setData(loadCycleData());
    setIsDiaryOpen(false);
    setAgentMessage(`Imported ${periods.length} cycle periods from physical diary.`);
  };

  const handleDeleteLog = (date: string) => {
    deleteDayLog(date);
    setData(loadCycleData());
  };

  const toggleSymptom = (sym: ValidSymptom) => {
    if (!confirmEntry) return;
    const current = confirmEntry.symptoms || [];
    const updated = current.includes(sym) ? current.filter((s) => s !== sym) : [...current, sym];
    setConfirmEntry({ ...confirmEntry, symptoms: updated });
  };

  const handleSelectSection = (sectionId: string) => {
    setActiveSection(sectionId);
    if (sectionId === "plate-02") {
      setIsMoreOpen(true);
    }
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleNewChat = () => {
    const input = document.getElementById("process-input");
    if (input) {
      input.focus();
    }
  };

  const showOverdueBanner = !overdueDismissed && isExportOverdue(14) && data.periods.length > 0;

  return (
    <div className="min-h-screen feather-aura-bg text-[#1a1718] antialiased selection:bg-stone-200 selection:text-stone-900 pt-20 sm:pt-24 md:pt-8 pb-36 md:pb-12">
      {/* Non-Blocking Backup Toast (After every 5 confirmed entries) */}
      {backupToast && (
        <div className="fixed top-20 left-4 sm:left-auto right-4 sm:right-8 z-50 flex items-center gap-3 rounded-[20px] liquid-glass-island px-4 py-3 font-sans text-xs font-medium text-stone-900 shadow-2xl border border-white animate-in fade-in slide-in-from-top-3 max-w-sm">
          <div className="size-8 rounded-full bg-stone-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <span className="block font-bold truncate">Back up your data</span>
            <span className="text-[11px] text-stone-600 block">Your entries live only on this device.</span>
          </div>
          <button
            type="button"
            onClick={handleExportJSON}
            className="liquid-glass-button-dark rounded-full px-3 py-1 text-[11px] uppercase font-mono tracking-wider shrink-0 cursor-pointer"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => setBackupToast(false)}
            className="text-stone-400 hover:text-stone-800 text-sm px-1 cursor-pointer shrink-0"
            aria-label="Close toast"
          >
            ✕
          </button>
        </div>
      )}

      {/* Feather Floating Sidebar & Mobile Dock */}
      <LiquidGlassSidebar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        onOpenDocs={() => setIsDocsOpen(true)}
        onOpenCredits={() => setIsCreditsOpen(true)}
        onOpenDiary={() => setIsDiaryOpen(true)}
        onNewChat={handleNewChat}
        isRecording={isRecording}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
      />

      {/* Developer Docs & AI Models Modal */}
      <DeveloperDocsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />

      {/* Personal Vault, Settings & Backup Modal */}
      <CreditsModal
        isOpen={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
        onDataUpdated={() => setData(loadCycleData())}
        useBrowserSpeech={useBrowserSpeech}
        onToggleBrowserSpeech={setUseBrowserSpeech}
      />

      {/* Main Spacious Canvas */}
      <div className="min-h-screen md:pl-28 lg:pl-32 xl:pl-36 md:pr-10 py-2 sm:py-6 px-3 sm:px-6 max-w-[1600px] mx-auto space-y-6">
        
        {/* Gentle 14-Day Export Overdue Reminder Banner */}
        {showOverdueBanner && (
          <div className="rounded-[22px] liquid-glass-island p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans text-stone-800 shadow-sm border border-amber-200 bg-amber-50/60">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="leading-snug">
                <strong>Local Vault Notice:</strong> Your cycle data is saved only on this device. You haven't exported a backup in 14 days.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleExportJSON}
                className="liquid-glass-button-dark rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider cursor-pointer"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => setOverdueDismissed(true)}
                className="text-stone-400 hover:text-stone-700 text-sm px-1.5 cursor-pointer"
                title="Dismiss reminder"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* HERO CONTAINER: Voice-First Menstrual Logging & Landmark Recall */}
        <div id="dashboard" className="liquid-glass-card rounded-[24px] sm:rounded-[36px] overflow-hidden">
          
          {/* Editorial Navigation Header */}
          <header className="hidden md:block border-b border-stone-200/50 px-4 py-4 sm:px-10 bg-white/60 backdrop-blur-md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-8">
                <div>
                  <span className="block font-mono text-xs font-bold tracking-[0.25em] text-[#1a1918]">
                    FEATHER®
                  </span>
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-stone-500">
                    VOICE CYCLE COMPANION · 2026
                  </span>
                </div>
                <nav className="space-x-6 font-mono text-xs text-stone-500 flex">
                  <a href="#process-console" className="hover:text-stone-900 transition-colors">Hero Voice Flow</a>
                  <a href="#backup-vault" className="hover:text-stone-900 transition-colors">Local Vault</a>
                  <a href="#chronicle" className="hover:text-stone-900 transition-colors">Chronicle</a>
                </nav>
              </div>

              {/* Verified Privacy Claim */}
              <div className="flex items-center gap-3">
                <span className="liquid-glass-pill font-mono text-[10px] uppercase tracking-wider text-stone-700 px-3 py-1">
                  On-Device Storage Only
                </span>
                <button
                  type="button"
                  onClick={() => setIsDocsOpen(true)}
                  className="liquid-glass-pill px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-900 hover:bg-stone-900 hover:text-white transition-all"
                >
                  Architecture Docs
                </button>
              </div>
            </div>
          </header>

          {/* HERO SPREAD: Asymmetric Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-140px)]">
            
            {/* LEFT COLUMN: Hero Concept & Minimalist Line Art */}
            <div className="flex flex-col justify-between border-b border-stone-200/50 p-4 sm:p-8 lg:p-12 lg:col-span-6 lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-stone-400">
                <span className="liquid-glass-pill px-2.5 py-0.5 text-stone-700 whitespace-nowrap shrink-0">[ HERO FLOW ]</span>
                <span className="hidden sm:inline whitespace-nowrap">FUZZY LANDMARK RECALL</span>
                <span className="whitespace-nowrap">META MUSE ENGINE</span>
              </div>

              {/* Central Minimalist Vector Art */}
              <div className="my-6 sm:my-8 flex flex-col items-center justify-center">
                <div className="liquid-glass-lens rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 flex items-center justify-center shadow-[0_14px_34px_-6px_rgba(0,0,0,0.04)]">
                  <svg
                    viewBox="0 0 280 260"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full max-w-[220px] sm:max-w-[280px] h-auto drop-shadow-xs"
                  >
                    <line x1="60" y1="70" x2="68" y2="65" stroke="#1a1918" strokeWidth="1.2" strokeLinecap="round" />
                    <line x1="55" y1="88" x2="63" y2="88" stroke="#1a1918" strokeWidth="1.2" strokeLinecap="round" />
                    <line x1="220" y1="75" x2="212" y2="82" stroke="#1a1918" strokeWidth="1.2" strokeLinecap="round" />
                    <line x1="228" y1="95" x2="220" y2="95" stroke="#1a1918" strokeWidth="1.2" strokeLinecap="round" />
                    <circle cx="218" cy="55" r="1.5" fill="#1a1918" />
                    <circle cx="65" cy="110" r="1.5" fill="#1a1918" />
                    <circle cx="140" cy="30" r="2" fill="#1a1918" />
                    <path
                      d="M195 38C191 42 191 49 195 53C198 56 203 56 206 54C203 59 196 61 190 57C184 52 185 43 191 37C192 36 194 37 195 38Z"
                      fill="#1a1918"
                    />
                    <path
                      d="M100 130C95 120 100 105 112 100C122 96 130 102 135 110C132 118 128 126 120 128C112 130 104 135 100 130Z"
                      stroke="#1a1918"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <ellipse cx="140" cy="140" rx="70" ry="60" stroke="#1a1918" strokeWidth="1" strokeDasharray="3 3" />
                  </svg>
                </div>
              </div>

              {/* Hero Title & Pitch */}
              <div className="space-y-3">
                <h2 className="editorial-serif text-3xl sm:text-5xl font-normal tracking-tight text-stone-900 leading-[1.08]">
                  Speak fuzzy memories.<br />
                  Recall past cycles with calendar landmarks.
                </h2>
                <p className="font-sans text-xs sm:text-sm text-stone-600 leading-relaxed max-w-lg">
                  Instead of guessing calendar dates, speak natural recollections like <em>"two days before New Year's"</em> or <em>"day after International Women's Day"</em>. Feather resolves the milestone date, previews your log entry, and checks overlap with upcoming life plans.
                </p>

                {/* Minimal Estimation Banner */}
                <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-mono text-stone-500">
                  <span className="liquid-glass-pill px-3 py-1">
                    Cycle Estimate: {stats.avgCycleLength}d cadence {stats.isDefaultCycle && "(Default)"}
                  </span>
                  <span className="liquid-glass-pill px-3 py-1">
                    Flow Estimate: {stats.avgPeriodLength}d flow {stats.isDefaultPeriod && "(Default)"}
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: The Interactive Voice Capture Console & Hero Actions */}
            <div className="relative bg-[#fafafa]/50 p-3.5 sm:p-6 lg:col-span-6 lg:p-8 flex flex-col justify-start">
              
              <div id="process-console" className="liquid-glass-lens rounded-[28px] sm:rounded-[32px] p-4 sm:p-7 space-y-4 sm:space-y-6">
                
                {/* Console Header */}
                <div className="flex items-baseline justify-between border-b border-stone-200/50 pb-3">
                  <div>
                    <h3 className="editorial-serif text-2xl sm:text-3xl font-normal text-stone-900">
                      Hero Voice Flow
                    </h3>
                    <span className="block font-sans text-xs text-stone-500 mt-0.5">
                      Fuzzy landmark date recall &amp; cycle logging
                    </span>
                  </div>
                  <span className="liquid-glass-pill font-mono text-[10px] uppercase tracking-widest text-stone-600 px-3 py-1">
                    Meta Muse
                  </span>
                </div>

                {/* Visible Medical Guardrail Notice */}
                <div className="rounded-[16px] liquid-glass-pill px-3.5 py-2 text-center text-xs text-stone-700 font-mono">
                  Feather helps with logging and planning only, not medical advice.
                </div>

                {/* Step 1: Speech Recognition Tongue */}
                <div className="liquid-glass-card rounded-[22px] p-3.5 sm:p-4 space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-stone-500">
                    <span>1. Speech Recognition Tongue</span>
                    <span>Meta Muse Voice</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "auto", label: "Auto Detect" },
                      { id: "en", label: "English" },
                      { id: "es", label: "Español" },
                      { id: "fr", label: "Français" },
                    ].map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setSelectedLanguage(l.id)}
                        className={`liquid-glass-pill px-3 py-1 font-sans text-xs font-medium transition-all ${
                          selectedLanguage === l.id
                            ? "bg-stone-900! text-white! shadow-md border-stone-900"
                            : "text-stone-600 hover:text-stone-950"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Voice Capture Centerpiece */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-stone-500">
                    <span>2. Speak or Type Cycle Memory</span>
                    <span>16kHz Mono WAV</span>
                  </div>

                  <div className="liquid-glass-card rounded-[26px] p-6 text-center">
                    {isRecording ? (
                      <div className="flex flex-col items-center gap-3.5">
                        <div className="flex h-12 items-center gap-1.5">
                          {waveformLevels.map((lvl, idx) => (
                            <span
                              key={idx}
                              className="w-1.5 rounded-full bg-stone-900 transition-all duration-75"
                              style={{ height: `${Math.max(10, lvl * 48)}px` }}
                            />
                          ))}
                        </div>

                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-900 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                          Listening... {durationSeconds}s
                        </span>

                        <button
                          type="button"
                          onClick={stopRecording}
                          className="liquid-glass-button-dark rounded-full px-6 py-2.5 font-mono text-xs uppercase tracking-wider cursor-pointer"
                        >
                          Stop &amp; Structure
                        </button>
                      </div>
                    ) : isProcessing ? (
                      <div className="flex flex-col items-center gap-3 py-5 font-sans text-xs text-stone-600">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-900 border-t-transparent" />
                        <span>Transcribing audio &amp; resolving calendar landmark...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-1">
                        <button
                          type="button"
                          onClick={startRecording}
                          className="liquid-glass-lens group flex h-20 w-20 items-center justify-center rounded-full text-stone-900 transition-all hover:scale-105 active:scale-95 mx-auto cursor-pointer shadow-md"
                          aria-label="Click to Speak Cycle Log"
                        >
                          <svg className="h-7 w-7 text-stone-800 group-hover:text-black transition-colors" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        <div className="space-y-0.5 mt-1">
                          <span className="block font-sans text-sm font-semibold text-stone-900">
                            Click to Speak Cycle Memory
                          </span>
                          <span className="block font-sans text-xs text-stone-500">
                            e.g., "Period started 2 days before New Year's, heavy flow"
                          </span>
                        </div>
                      </div>
                    )}

                    {permissionError && (
                      <div className="mt-3 border-t border-stone-200 pt-2 text-xs text-rose-600 font-sans">
                        {permissionError}
                      </div>
                    )}
                  </div>

                  {/* Text Input Fallback */}
                  <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <input
                      id="process-input"
                      type="text"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Type: 'Period 2 days before New Year's' or 'Marathon on Nov 15'..."
                      className="liquid-glass-input flex-1 rounded-full px-5 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    />
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="liquid-glass-pill px-5 py-2.5 font-mono text-[10px] uppercase font-bold text-stone-900 hover:bg-stone-900 hover:text-white disabled:opacity-50 transition-all shadow-xs cursor-pointer"
                    >
                      Resolve →
                    </button>
                  </form>
                </div>

                {/* Step 3: Suggestion Chips */}
                <div className="liquid-glass-card rounded-[22px] p-3.5 space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-stone-500">
                    <span>3. Sample Fuzzy Queries</span>
                    <span>Landmark Recall</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {LIFE_EVENT_SUGGESTIONS.map((eventItem, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => runAgentPipeline(eventItem.query)}
                        className="liquid-glass-pill px-3 py-1 font-sans text-xs text-stone-700 hover:text-stone-950 transition-all cursor-pointer"
                      >
                        {eventItem.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transcript Display */}
                {transcript && (
                  <div className="liquid-glass-card rounded-[22px] p-4">
                    <span className="block font-mono text-[9px] uppercase tracking-widest text-stone-400">
                      Captured Transcript:
                    </span>
                    <p className="mt-1 font-serif text-base italic text-stone-800 leading-relaxed">
                      “{transcript}”
                    </p>
                  </div>
                )}

                {/* Agent Response & Medical Refusal Banner */}
                {agentMessage && (
                  <div
                    className={`liquid-glass-card rounded-[22px] p-4 text-xs font-sans leading-relaxed shadow-xs ${
                      agentMessage.includes("talk to a doctor")
                        ? "border-rose-300! bg-rose-50/80! text-rose-950!"
                        : "text-stone-800"
                    }`}
                  >
                    <span className="block font-mono text-[9px] uppercase tracking-widest text-stone-400 mb-0.5">
                      Agent Response:
                    </span>
                    <p className="leading-relaxed text-sm">{agentMessage}</p>
                  </div>
                )}

                {/* Privacy Guarantee Explainer Banner */}
                <div className="rounded-[18px] liquid-glass-pill p-3 text-[11px] text-stone-600 font-sans leading-relaxed text-center">
                  We never store your audio or your cycle data on our servers. Voice is sent to a speech-to-text service for transcription only, and cycle entries are saved only on your device.
                </div>

              </div>

            </div>

          </div>

          {/* ========================================================
              ACCESSION SLIP PREVIEW & CONFIRMATION CARD (HERO FLOW)
              ======================================================== */}
          {confirmEntry && (
            <section className="border-t border-stone-200/50 p-4 sm:p-8 lg:p-10 bg-white/70 backdrop-blur-md">
              <div className="liquid-glass-lens mx-auto max-w-2xl rounded-[28px] p-6 sm:p-8 shadow-xl border border-white">
                <div className="flex items-baseline justify-between border-b border-stone-200/50 pb-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-stone-400 block mb-1">
                      [ ACCESSION SLIP PREVIEW ]
                    </span>
                    <h4 className="editorial-serif text-3xl font-normal text-stone-900">
                      Confirm Log Entry
                    </h4>
                  </div>
                  {confirmEntry.landmarkName && (
                    <span className="liquid-glass-button-dark font-mono text-[10px] uppercase tracking-wider rounded-full px-3 py-1">
                      Landmark: {confirmEntry.landmarkName}
                    </span>
                  )}
                </div>

                {/* Resolved Date */}
                <div className="mt-5 flex items-center justify-between text-xs font-mono">
                  <span className="text-stone-500 uppercase tracking-wider">Resolved Calendar Date</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={confirmEntry.date}
                      onChange={(e) => setConfirmEntry({ ...confirmEntry, date: e.target.value })}
                      className="liquid-glass-input rounded-full px-3.5 py-1 text-xs font-mono font-bold text-stone-900 focus:outline-none"
                    />
                    {confirmEntry.isApproximate && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 border border-amber-200">
                        Fuzzy Landmark
                      </span>
                    )}
                  </div>
                </div>

                {/* Flow Level */}
                <div className="mt-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 block mb-2">
                    Menstrual Flow Level
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FLOW_OPTIONS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setConfirmEntry({ ...confirmEntry, flow: f.key })}
                        className={`liquid-glass-pill py-2 text-xs font-mono font-semibold transition-all cursor-pointer ${
                          confirmEntry.flow === f.key
                            ? "bg-stone-900! text-white! shadow-md"
                            : "text-stone-700 hover:text-stone-950"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Symptoms Chips */}
                <div className="mt-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 block mb-2">
                    Extracted Symptoms ({confirmEntry.symptoms?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {VALID_SYMPTOMS.map((sym) => {
                      const active = confirmEntry.symptoms?.includes(sym);
                      return (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => toggleSymptom(sym)}
                          className={`liquid-glass-pill px-3 py-1 font-sans text-xs transition-all cursor-pointer ${
                            active
                              ? "bg-stone-900! text-white! font-medium shadow-xs"
                              : "text-stone-600 hover:text-stone-900"
                          }`}
                        >
                          {SYMPTOM_LABELS[sym]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-3 pt-4 border-t border-stone-200/50">
                  <button
                    type="button"
                    onClick={handleSaveConfirmed}
                    className="flex-1 liquid-glass-button-dark rounded-full py-3 text-xs font-mono uppercase tracking-wider cursor-pointer shadow-md"
                  >
                    Confirm &amp; Record Entry →
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmEntry(null)}
                    className="liquid-glass-pill rounded-full px-6 py-3 text-xs font-mono uppercase text-stone-600 hover:text-stone-900 cursor-pointer"
                  >
                    Discard
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ========================================================
              PLAN AROUND IT: OVERLAP FORECAST RESULTS
              ======================================================== */}
          {planOverlaps && planOverlaps.length > 0 && (
            <section className="border-t border-stone-200/50 p-4 sm:p-8 lg:p-10 bg-white/50 backdrop-blur-xs">
              <div className="mx-auto max-w-2xl space-y-4">
                <div className="flex items-baseline justify-between border-b border-stone-200/50 pb-2">
                  <h4 className="editorial-serif text-2xl font-normal text-stone-900">
                    Plan Around It — Overlap Forecast
                  </h4>
                  <span className="font-mono text-[10px] uppercase text-stone-500">
                    {planOverlaps.length} Events Checked
                  </span>
                </div>

                <div className="space-y-3">
                  {planOverlaps.map((ev, i) => {
                    const isLikely = ev.overlap === "likely" || ev.overlapLabel?.includes("Likely");
                    const isPossible = ev.overlap === "possible" || ev.overlapLabel?.includes("Possible");

                    return (
                      <div key={i} className="liquid-glass-card rounded-[22px] p-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <strong className="font-sans text-sm text-stone-900">{ev.name}</strong>
                          <span
                            className={`rounded-full px-3 py-0.5 font-mono text-[10px] uppercase tracking-wider font-bold border ${
                              isLikely
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : isPossible
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {ev.overlapLabel || (isLikely ? "Likely overlap" : isPossible ? "Possible overlap" : "Unlikely to overlap (estimate)")}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-stone-500 block">Date: {prettyDate(ev.eventDate)}</span>
                        <p className="font-sans text-xs text-stone-600 leading-relaxed pt-1">{ev.overlapNote}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Persistent Non-Medical Disclaimer */}
                <p className="font-mono text-[10px] text-stone-500 leading-relaxed pt-2 text-center">
                  {OVERLAP_DISCLAIMER}
                </p>
              </div>
            </section>
          )}

        </div>

        {/* UNMISSABLE DATA BACKUP & LOCAL VAULT CARD */}
        <section id="backup-vault" className="liquid-glass-card rounded-[24px] sm:rounded-[32px] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200/50 pb-5">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-stone-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>On-Device Storage Vault</span>
              </div>
              <h3 className="editorial-serif text-3xl font-normal text-stone-900 mt-1">
                Back Up Your Cycle Data
              </h3>
              <p className="font-sans text-xs text-stone-600 mt-1 max-w-xl leading-relaxed">
                Your menstrual logs and symptom history live strictly inside your browser vault. Clearing website cookies or browser history deletes them. Export regular JSON backups to prevent accidental loss.
              </p>
            </div>

            {/* Quick Export & Import Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportJSON}
                className="liquid-glass-button-dark rounded-full px-5 py-2.5 font-mono text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Export Backup (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                className="liquid-glass-pill rounded-full px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-stone-800 hover:text-black flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Import Backup</span>
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-stone-500">
            <span>Recorded Periods: <strong className="text-stone-900">{data.periods.length}</strong></span>
            <span>Daily Symptom Logs: <strong className="text-stone-900">{data.logs.length}</strong></span>
            <span>Cadence Estimate: <strong className="text-stone-900">{stats.avgCycleLength} days</strong></span>
          </div>
        </section>

        {/* COLLAPSIBLE MORE SECTION: 12-Month Foresight Matrix & Diary Scanner */}
        <section className="liquid-glass-card rounded-[24px] sm:rounded-[32px] overflow-hidden">
          <div className="p-6 sm:p-8 flex items-center justify-between border-b border-stone-200/50">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 block mb-1">
                [ EXTENDED TOOLS ]
              </span>
              <h3 className="editorial-serif text-2xl sm:text-3xl text-stone-900">
                More Tools: 12-Month Foresight Matrix &amp; Diary Scanner
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className="liquid-glass-pill px-4 py-2 font-mono text-xs uppercase tracking-wider text-stone-800 hover:text-black transition-all cursor-pointer"
            >
              {isMoreOpen ? "Hide Tools ▲" : "Show Tools ▼"}
            </button>
          </div>

          {isMoreOpen && (
            <div id="plate-02" className="p-6 sm:p-10 space-y-8 animate-in fade-in duration-200">
              {/* Header & Re-Synthesize */}
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-stone-200/50 pb-6 gap-5">
                <div>
                  <h4 className="editorial-serif text-2xl sm:text-4xl font-normal text-stone-900">
                    Annual Universal Milestones &amp; Life Rhythm Foresight
                  </h4>
                  <p className="mt-1 text-xs text-stone-600 font-sans max-w-2xl leading-relaxed">
                    Personal planning reference projecting estimated cycle intervals across 12 calendar milestones. Cycles fluctuate naturally; use as general estimates.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDiaryOpen(true)}
                    className="liquid-glass-pill px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-stone-900 hover:bg-stone-900 hover:text-white transition-all cursor-pointer"
                  >
                    Scan Physical Diary
                  </button>

                  <button
                    type="button"
                    onClick={handleRunSynthesis}
                    disabled={isSynthesizing}
                    className="liquid-glass-button-dark rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    <span>{isSynthesizing ? "Synthesizing..." : "Re-Synthesize"}</span>
                  </button>
                </div>
              </div>

              {/* Foresight Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(synthesisResult?.milestoneForecastMatrix || []).map((fest, idx) => {
                  const isLikely = fest.overlapRisk.includes("Likely");
                  const isPossible = fest.overlapRisk.includes("Possible");

                  return (
                    <div key={idx} className="liquid-glass-card-interactive rounded-[24px] p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <h5 className="editorial-serif text-2xl text-stone-900">{fest.milestone || fest.festival}</h5>
                          <span className="liquid-glass-pill shrink-0 px-3 py-1 font-mono text-xs text-stone-700">
                            {prettyDate(fest.date)}
                          </span>
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="liquid-glass-pill px-2.5 py-0.5 font-mono text-[10px] text-stone-700">
                            {fest.phaseAtMilestone} Phase
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider border ${
                              isLikely
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : isPossible
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {fest.overlapRisk}
                          </span>
                        </div>
                        <p className="mt-3 font-sans text-xs text-stone-600 leading-relaxed">{fest.note}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Persistent Disclaimer */}
              <p className="font-mono text-[10px] text-stone-500 leading-relaxed text-center pt-2">
                {OVERLAP_DISCLAIMER}
              </p>
            </div>
          )}
        </section>

        {/* CHRONICLE SECTION: Minimalist Confirmed History */}
        <section id="chronicle" className="liquid-glass-card rounded-[24px] sm:rounded-[32px] p-6 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between border-b border-stone-200/50 pb-4 gap-2">
            <div>
              <h3 className="editorial-serif text-3xl font-normal text-stone-900">
                Chronicle
              </h3>
              <p className="font-sans text-xs text-stone-500 mt-0.5">
                Confirmed cycle periods and daily symptom entries
              </p>
            </div>
            <span className="liquid-glass-pill font-mono text-[10px] uppercase tracking-widest text-stone-600 px-3.5 py-1 self-start sm:self-auto">
              {data.logs.length} Recorded Entries · {data.periods.length} Cycles
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {data.logs.length === 0 ? (
              <div className="py-12 text-center font-sans text-sm text-stone-500 liquid-glass-pill rounded-[24px]">
                No entries recorded yet. Use the Hero Voice Flow above to capture your first cycle log.
              </div>
            ) : (
              data.logs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="liquid-glass-card-interactive rounded-[22px] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-sm font-bold text-stone-900">
                        {prettyDate(log.logDate)}
                      </span>
                      {log.flow && (
                        <span className="liquid-glass-button-dark font-mono text-[10px] uppercase tracking-wider rounded-full px-3 py-0.5 font-bold">
                          {log.flow}
                        </span>
                      )}
                    </div>

                    {log.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {log.symptoms.map((s) => (
                          <span key={s} className="liquid-glass-pill px-2.5 py-0.5 font-sans text-[11px] text-stone-700">
                            {SYMPTOM_LABELS[s as ValidSymptom] || s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteLog(log.logDate)}
                    className="liquid-glass-pill self-end sm:self-center font-mono text-[11px] text-stone-400 hover:text-rose-600 transition-colors px-3 py-1 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Paper Diary Scanning Modal */}
        <PaperDiaryImportModal
          isOpen={isDiaryOpen}
          onClose={() => setIsDiaryOpen(false)}
          onImportPeriods={handleDiaryImport}
        />

        {/* Colophon Footer */}
        <footer className="border-t border-stone-200/50 p-6 text-center text-stone-500">
          <div className="liquid-glass-pill inline-flex justify-center items-center gap-3 text-stone-900 font-mono text-xs font-bold tracking-wider px-6 py-2 mb-2">
            <span>FEATHER®</span>
            <span>—</span>
            <span>BUILD FOR YOUR WORLD</span>
            <span>—</span>
            <span>2026</span>
          </div>
          <p className="mt-1 text-xs font-sans text-stone-500">
            Meta Global AI Dev Hackathon (Indie Developer Track) · Powered by Meta Model API (Muse Voice Transcribe 1.0 &amp; Muse Spark 1.3)
          </p>
        </footer>

      </div>
    </div>
  );
}
