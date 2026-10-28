import React, { useRef, useState } from "react";
import {
  loadCycleData,
  saveCycleData,
  computeCycleStats,
  exportCycleDataJSON,
  importCycleDataJSON,
  OVERLAP_DISCLAIMER,
} from "./cycleStorage";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataUpdated?: () => void;
  useBrowserSpeech?: boolean;
  onToggleBrowserSpeech?: (enabled: boolean) => void;
}

export function CreditsModal({
  isOpen,
  onClose,
  onDataUpdated,
  useBrowserSpeech = false,
  onToggleBrowserSpeech,
}: SettingsModalProps) {
  const [data, setData] = useState(() => loadCycleData());
  const stats = computeCycleStats(data.periods);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleExportJSON = () => {
    const jsonStr = exportCycleDataJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feather-cycle-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus("Backup exported successfully.");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        if (onDataUpdated) onDataUpdated();
        showStatus(`Imported ${res.count} records successfully.`);
      } else {
        alert(res.error || "Could not parse backup file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = "";
  };

  const handleClearData = () => {
    if (window.confirm("Are you sure you want to reset all local cycle records? Make sure you have exported a backup first.")) {
      const empty = { periods: [], logs: [] };
      saveCycleData(empty);
      setData(empty);
      if (onDataUpdated) onDataUpdated();
      showStatus("Local vault reset.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Liquid Glass Modal Card */}
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[28px] liquid-glass-island p-6 sm:p-8 text-stone-900 shadow-2xl border border-white/80">
        <div className="liquid-glass-border" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-black/[0.06] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-xs">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-sans text-xl font-semibold tracking-tight text-stone-900">
                  Settings &amp; Data Backup
                </h3>
                <span className="liquid-glass-pill rounded-full px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-700">
                  On-Device Storage
                </span>
              </div>
              <p className="font-sans text-xs text-stone-500">
                Manage your local records, backups, and speech preferences
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-black/[0.05] hover:text-stone-900 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {statusMessage && (
          <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-medium">
            {statusMessage}
          </div>
        )}

        {/* Unmissable Backup & Restore Card */}
        <div className="mt-5 rounded-[22px] liquid-glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-bold">
              Local Vault Backup
            </span>
            <span className="font-mono text-[10px] text-stone-400">
              {data.periods.length} Periods · {data.logs.length} Logs
            </span>
          </div>
          <p className="font-sans text-xs text-stone-600 leading-relaxed">
            Your entries live exclusively in this browser. Clearing website data deletes them. Export regular JSON backups to keep your data safe.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleExportJSON}
              className="flex-1 liquid-glass-button-dark rounded-full px-4 py-2.5 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export Backup (JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="liquid-glass-pill px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-stone-800 hover:text-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Import</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleClearData}
              className="liquid-glass-pill px-3 py-2 font-mono text-[11px] text-rose-700 hover:bg-rose-50 cursor-pointer"
              title="Reset local storage"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Speech Recognition Engine Preferences */}
        <div className="mt-4 rounded-[22px] liquid-glass-card p-4 space-y-2.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-bold block">
            Speech Recognition Engine
          </span>
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="block font-sans text-xs font-semibold text-stone-900">
                Browser Speech Service (Web Speech API)
              </span>
              <span className="block font-sans text-[11px] text-stone-500 leading-snug">
                Optional alternative using your browser vendor's speech recognition.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useBrowserSpeech}
                onChange={(e) => onToggleBrowserSpeech && onToggleBrowserSpeech(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-stone-900"></div>
            </label>
          </div>
          <span className="block font-mono text-[10px] text-stone-500 pt-0.5">
            Default Path: <strong>Meta Muse Voice Transcribe</strong> (16kHz mono WAV)
          </span>
        </div>

        {/* How Your Voice Is Processed Explainer */}
        <div className="mt-4 rounded-[22px] liquid-glass-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-stone-900">
              How Your Voice Is Processed
            </span>
          </div>

          <p className="text-xs text-stone-700 font-sans leading-relaxed">
            We never store your audio or your cycle data on our servers. Voice is sent to a speech-to-text service for transcription only, and cycle entries are saved only on your device.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
            <div className="rounded-[16px] liquid-glass-pill p-3">
              <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold block mb-1">
                What leaves your device
              </span>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                • 16kHz mono WAV audio sent to <strong>Meta Muse Voice Transcribe</strong> for speech-to-text.<br />
                • Transcribed text sent to <strong>Meta Muse Spark</strong> agent for cycle date &amp; symptom extraction.
              </p>
            </div>
            <div className="rounded-[16px] liquid-glass-pill p-3">
              <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold block mb-1">
                What stays on your device
              </span>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                • All confirmed cycle entries, dates, symptoms, notes, and local calculations remain in your device's browser vault.<br />
                • Zero server-side database and zero tracking analytics.
              </p>
            </div>
          </div>

          {/* Hackathon Free Credits Disclosure */}
          <div className="rounded-[16px] border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 font-sans leading-relaxed">
            <strong>Demo Notice:</strong> While using free hackathon API credits, content sent to the Meta Model API may be used by Meta for product improvement. Do not enter real personal health data in this demo.
          </div>
        </div>

        {/* Non-Medical Disclaimer */}
        <p className="mt-4 font-mono text-[10px] text-stone-500 leading-relaxed text-center px-2">
          {OVERLAP_DISCLAIMER}
        </p>

        {/* Done Button */}
        <div className="mt-5 flex justify-end border-t border-black/[0.05] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="liquid-glass-button-dark rounded-full px-6 py-2 font-mono text-xs uppercase tracking-wider shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
