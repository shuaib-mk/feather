import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useCycle } from "../context/CycleContext";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { prettyDate } from "../cycleStorage";

export function VaultPage() {
  const {
    data,
    stats,
    exportBackup,
    importBackup,
    clearAllVaultData,
    isDemoActive,
    loadDemo,
    clearDemo,
  } = useCycle();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [importPendingContent, setImportPendingContent] = useState<string | null>(null);
  const [importStatusMessage, setImportStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const periodsCount = data.periods.length;
  const logsCount = data.logs.length;

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportPendingContent(content);
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = "";
  };

  const handleConfirmImport = () => {
    if (!importPendingContent) return;
    const res = importBackup(importPendingContent);
    setImportStatusMessage({
      text: res.message,
      isError: !res.success,
    });
    setImportPendingContent(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Local Vault &amp; Privacy"
        subtitle="Your cycle history lives exclusively in your browser's encrypted localStorage. Zero tracking, zero cloud databases."
        badge="100% On-Device"
      />

      {/* Privacy Guarantee Card */}
      <div className="liquid-glass-card rounded-[24px] p-6 space-y-3 border border-emerald-200/80 bg-emerald-50/40">
        <div className="flex items-center gap-2.5 text-emerald-900 font-bold text-sm">
          <div className="size-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <span className="font-serif text-lg">Zero-Cloud Privacy Architecture</span>
        </div>
        <p className="font-sans text-xs text-stone-700 leading-relaxed max-w-2xl">
          Feather never transmits your cycle data or personal health dates to remote databases. Audio recordings are sent in-memory over HTTPS solely for transcription and discarded immediately. All confirmed dates, notes, and symptoms remain in <code className="bg-white/80 px-1.5 py-0.5 rounded text-emerald-900 font-mono text-[11px]">feather_cycle_vault_v1</code> on this device.
        </p>
      </div>

      {/* Vault Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="liquid-glass-card rounded-[20px] p-4 space-y-1">
          <span className="font-sans text-xs font-medium text-stone-500 block">
            Confirmed Periods
          </span>
          <div className="font-serif text-2xl font-semibold text-stone-900">{periodsCount}</div>
          <span className="text-[11px] text-stone-500 font-sans">Historical cycles</span>
        </div>

        <div className="liquid-glass-card rounded-[20px] p-4 space-y-1">
          <span className="font-sans text-xs font-medium text-stone-500 block">
            Daily Symptom Logs
          </span>
          <div className="font-serif text-2xl font-semibold text-stone-900">{logsCount}</div>
          <span className="text-[11px] text-stone-500 font-sans">Logged daily notes</span>
        </div>

        <div className="liquid-glass-card rounded-[20px] p-4 space-y-1">
          <span className="font-sans text-xs font-medium text-stone-500 block">
            Average Cycle
          </span>
          <div className="font-serif text-2xl font-semibold text-stone-900">{stats.avgCycleLength} days</div>
          <span className="text-[11px] text-stone-500 font-sans">
            {stats.isDefaultCycle ? "Default estimate" : "From history"}
          </span>
        </div>

        <div className="liquid-glass-card rounded-[20px] p-4 space-y-1">
          <span className="font-sans text-xs font-medium text-stone-500 block">
            Demo Mode
          </span>
          <div className="font-serif text-2xl font-semibold text-stone-900">
            {isDemoActive ? "Active" : "Normal"}
          </div>
          <span className="text-[11px] text-stone-500 font-sans">
            {isDemoActive ? "Synthetic test data" : "Personal vault"}
          </span>
        </div>
      </div>

      {/* Backup Import & Export Section */}
      <div className="liquid-glass-card rounded-[24px] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/50 pb-3">
          <div>
            <span className="font-sans text-xs font-semibold text-violet-700 block">
              Data Portability
            </span>
            <h3 className="font-serif text-xl font-semibold text-stone-900">
              JSON Backup &amp; Device Transfer
            </h3>
          </div>
          <span className="text-xs text-stone-500 font-sans">
            Because storage is local, export regularly.
          </span>
        </div>

        <p className="text-xs text-stone-600 leading-relaxed max-w-xl font-sans">
          Download a complete snapshot of all confirmed period records and symptom logs. You can import this file anytime to restore or migrate to another device.
        </p>

        {importStatusMessage && (
          <div className={`p-3 rounded-xl text-xs font-sans ${
            importStatusMessage.isError ? "bg-rose-50 text-rose-800 border border-rose-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
          }`}>
            {importStatusMessage.text}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap pt-1">
          <button
            type="button"
            onClick={exportBackup}
            disabled={periodsCount === 0 && logsCount === 0}
            className="liquid-glass-button-dark rounded-full px-5 py-2.5 font-sans text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download Backup (JSON)</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelected}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="liquid-glass-pill px-5 py-2.5 font-sans text-xs font-medium text-stone-800 hover:text-stone-950 flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Import Backup</span>
          </button>
        </div>
      </div>

      {/* Advanced Data Management: Reset & Demo Mode */}
      <div className="liquid-glass-card rounded-[24px] p-6 space-y-4">
        <div className="border-b border-stone-200/50 pb-3">
          <span className="font-sans text-xs font-semibold text-stone-600 block">
            Vault Operations
          </span>
          <h3 className="font-serif text-lg font-semibold text-stone-900">
            Data Management &amp; Hackathon Demo
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
          {/* Hackathon Reviewer Demo State */}
          <div className="p-4 rounded-[18px] bg-white/70 border border-stone-200/70 space-y-2">
            <span className="font-bold text-stone-900 block">Reviewer Synthetic Demo</span>
            <p className="text-stone-600 leading-relaxed text-[11px]">
              Load 4 historical cycles and 5 symptom logs to test landmark recalls, overlap forecasts, and foresight matrices immediately.
            </p>
            {isDemoActive ? (
              <button
                type="button"
                onClick={clearDemo}
                className="liquid-glass-pill px-4 py-2 font-sans text-xs text-amber-800 border border-amber-300 font-semibold hover:bg-amber-50 cursor-pointer"
              >
                Clear Demo Data
              </button>
            ) : (
              <button
                type="button"
                onClick={loadDemo}
                className="liquid-glass-button-dark rounded-full px-4 py-2 font-sans text-xs font-semibold cursor-pointer"
              >
                ✨ Load Synthetic Demo
              </button>
            )}
          </div>

          {/* Purge Local Storage */}
          <div className="p-4 rounded-[18px] bg-rose-50/50 border border-rose-200/70 space-y-2">
            <span className="font-bold text-rose-900 block">Purge Local Vault</span>
            <p className="text-stone-600 leading-relaxed text-[11px]">
              Erase all periods and logs from this browser's localStorage. This cannot be undone unless you have a backup.
            </p>
            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="px-4 py-2 rounded-full font-sans text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-xs"
            >
              Reset All Vault Data
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Import Overwrite */}
      <ConfirmDialog
        isOpen={Boolean(importPendingContent)}
        title="Confirm Backup Import"
        message="Importing this JSON backup will merge new entries into your local vault. Are you sure you wish to continue?"
        confirmLabel="Import Data"
        cancelLabel="Cancel"
        onConfirm={handleConfirmImport}
        onCancel={() => setImportPendingContent(null)}
      />

      {/* Confirmation Modal for Clearing Vault */}
      <ConfirmDialog
        isOpen={isClearModalOpen}
        title="Clear All Vault Data?"
        message="This will completely erase all your logged cycles and symptom entries from your device's browser memory. Make sure to download a JSON backup first if you need your data."
        confirmLabel="Erase Everything"
        cancelLabel="Keep My Data"
        isDestructive={true}
        onConfirm={() => {
          clearAllVaultData();
          setIsClearModalOpen(false);
        }}
        onCancel={() => setIsClearModalOpen(false)}
      />
    </div>
  );
}
