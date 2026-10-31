import React, { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { LiquidGlassFilter } from "./LiquidGlassFilter";
import { useCycle } from "../context/CycleContext";
import { isDemoActive as isDemoModeActive } from "../lib/demoMode";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const {
    showOverdueBanner,
    dismissOverdueBanner,
    backupToast,
    dismissBackupToast,
    exportBackup,
    isDemoActive,
    clearDemo,
  } = useCycle();

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden feather-aura-bg text-[#1a1718] antialiased selection:bg-stone-200 selection:text-stone-900 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] md:pt-[calc(2rem+env(safe-area-inset-top,0px))] pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] md:pb-12">
      <LiquidGlassFilter />
      {/* Non-Blocking Backup Toast (After every 5 confirmed entries) */}
      {backupToast && (
        <div className="fixed top-[calc(3.5rem+env(safe-area-inset-top,0px))] md:top-[calc(1.5rem+env(safe-area-inset-top,0px))] left-3 right-3 sm:left-auto sm:right-8 z-50 flex items-center gap-2.5 sm:gap-3 rounded-[20px] liquid-glass-island px-3.5 sm:px-4 py-2.5 font-sans text-xs font-medium text-stone-900 shadow-xl border border-white animate-in fade-in slide-in-from-top-3 max-w-sm sm:max-w-md mx-auto sm:mx-0">
          <div className="size-7 rounded-full liquid-glass-pill text-stone-900 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <span className="block font-bold text-stone-900 truncate">Back up your data</span>
            <span className="text-[11px] text-stone-600 block truncate sm:whitespace-normal">Your entries live only on this device.</span>
          </div>
          <button
            type="button"
            onClick={exportBackup}
            className="liquid-glass-button rounded-full px-3.5 py-1 text-xs font-sans font-semibold shrink-0 cursor-pointer shadow-sm"
          >
            Export
          </button>
          <button
            type="button"
            onClick={dismissBackupToast}
            className="text-stone-400 hover:text-stone-800 p-1 cursor-pointer shrink-0 inline-flex items-center justify-center"
            aria-label="Close toast"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Navigation Sidebar & Mobile Bar */}
      <Sidebar />

      {/* Main Spacious Canvas (Accessible Main Landmark) */}
      <main
        id="main-content"
        className="min-h-[85vh] w-full max-w-5xl mx-auto px-3.5 sm:px-6 py-1 sm:py-4 md:pl-24 lg:pl-28 md:pr-8 space-y-5 overflow-x-hidden pb-24 md:pb-8"
      >
        {/* Persistent Demo Mode Banner */}
        {(isDemoActive || isDemoModeActive()) && (
          <div role="status" className="rounded-[20px] liquid-glass-card p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans text-stone-900 shadow-sm border border-violet-300 bg-violet-50/80">
            <div className="flex items-center gap-2.5">
              <div className="size-6 rounded-full bg-violet-200 text-violet-800 flex items-center justify-center shrink-0 font-bold text-xs">
                ✦
              </div>
              <div className="leading-tight">
                <span className="font-semibold text-stone-900">Demo Mode Active:</span>{" "}
                <span className="text-stone-700">Fictional demonstration data. Your real vault is untouched.</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={clearDemo}
                className="liquid-glass-button rounded-full px-4 py-1.5 font-sans text-xs font-semibold cursor-pointer shadow-xs"
              >
                Exit demo
              </button>
            </div>
          </div>
        )}
        {/* Gentle 14-Day Export Overdue Reminder Banner */}
        {showOverdueBanner && (
          <div className="rounded-[20px] liquid-glass-card p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans text-stone-800 shadow-xs border border-amber-200/80 bg-amber-50/40">
            <div className="flex items-center gap-2.5">
              <div className="size-6 rounded-full bg-amber-200/40 border border-amber-300/40 flex items-center justify-center shrink-0 text-amber-800">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="leading-tight">
                <span className="font-semibold text-stone-900">Backup Recommended:</span>{" "}
                <span className="text-stone-700">14 days since your last local JSON export.</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={exportBackup}
                className="liquid-glass-button rounded-full px-3.5 py-1 font-sans text-xs font-semibold cursor-pointer shadow-xs"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={dismissOverdueBanner}
                className="text-stone-600 hover:text-stone-900 text-xs px-2 py-1 cursor-pointer font-sans font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <div className="animate-in fade-in duration-200">
          {children}
        </div>

        {/* Minimal Editorial Footer */}
        <footer className="pt-8 pb-4 text-center border-t border-stone-200/40 text-[11px] text-stone-600 font-sans space-y-1">
          <p className="flex items-center justify-center gap-2 flex-wrap">
            <span>Feather · Voice-First Menstrual Companion</span>
            <span>·</span>
            <Link to="/vault" className="underline hover:text-stone-900">Local Vault</Link>
            <span>·</span>
            <Link to="/settings" className="underline hover:text-stone-900">Settings &amp; Architecture</Link>
          </p>
          <p className="text-[10px] text-stone-500 font-sans">
            Meta Global AI Dev Hackathon · Muse Voice Transcribe 1.0 &amp; Muse Spark 1.3 · 100% On-Device Storage
          </p>
        </footer>
      </main>
    </div>
  );
}
