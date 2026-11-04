import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  loadCycleData,
  saveCycleData,
  addOrUpdatePeriod,
  deletePeriodEntry,
  saveLogEntry,
  type SaveLogEntryOptions,
  type SaveLogEntryResult,
  deleteDayLog,
  computeCycleStats,
  exportCycleDataJSON,
  describeSkipped,
  importCycleDataJSON,

  isExportOverdue,
  getEntriesSinceExport,
  type Period,
  type DayLog,
  type CycleStats,
  recordExportTimestamp,
} from "../cycleStorage";
import { todayLocal } from "../lib/localDate";
import { enterDemoMode, exitDemoMode, isDemoActive as isDemoModeActive } from "../lib/demoMode";
import { saveEvents } from "../lib/events";
import { forgetPassphrase } from "../lib/appLock";
import { ENCRYPTED_VAULT_KEY } from "../lib/vaultCrypto";
import { DEMO_KEY, DEMO_ACTIVE_KEY, DEMO_EVENTS_KEY } from "../lib/demoMode";

interface CycleContextValue {
  data: { periods: Period[]; logs: DayLog[] };
  stats: CycleStats;
  refreshData: () => void;
  savePeriod: (p: Omit<Period, "id"> & { id?: number }) => Period | null;
  removePeriod: (id: number) => void;
  saveLog: (l: Omit<DayLog, "id"> & { id?: number }, opts?: SaveLogEntryOptions) => SaveLogEntryResult | null;
  errorToast: string | null;
  dismissErrorToast: () => void;
  removeLog: (date: string) => void;
  clearAllVaultData: () => void;

  // Demo State
  isDemoActive: boolean;
  loadDemo: () => void;
  clearDemo: () => void;

  // Export & Backup
  exportBackup: () => void;
  importBackup: (jsonContent: string) => { success: boolean; message: string };
  showOverdueBanner: boolean;
  dismissOverdueBanner: () => void;
  backupToast: boolean;
  dismissBackupToast: () => void;
  triggerBackupToast: () => void;

}

const CycleContext = createContext<CycleContextValue | null>(null);


/** Q4.6: purge everything recoverable (vault, encrypted blob, lock, consent,
 * packs, export counters, demo namespace), then refresh. Exported for tests. */
export function purgeVaultStorage(refresh: () => void): void {
  try { forgetPassphrase(); } catch {}
  try {
    const ls = localStorage;
    ls.removeItem(ENCRYPTED_VAULT_KEY);
    ls.removeItem("feather_app_lock_enabled");
    ls.removeItem("feather_allow_matched_events");
    ls.removeItem("feather_landmark_packs");
    ls.removeItem("feather_entries_since_export");
    ls.removeItem("feather_last_export_ts");
    ls.removeItem(DEMO_KEY);
    ls.removeItem(DEMO_ACTIVE_KEY);
    ls.removeItem(DEMO_EVENTS_KEY);
    try { exitDemoMode(); } catch {}
  } catch {}
  try { saveCycleData({ periods: [], logs: [] }); } catch {}
  try { saveEvents([]); } catch {}
  try { refresh(); } catch {}
}

export function CycleProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<{ periods: Period[]; logs: DayLog[] }>(() => loadCycleData());
  const [stats, setStats] = useState<CycleStats>(() => computeCycleStats(data.periods, data.logs));
  const [isDemoActive, setIsDemoActive] = useState<boolean>(() => isDemoModeActive());

  // Backup & Privacy Notifications
  const [overdueDismissed, setOverdueDismissed] = useState<boolean>(false);
  const [backupToast, setBackupToast] = useState<boolean>(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const location = useLocation();
  useEffect(() => { setErrorToast(null); }, [location.pathname]);


  const refreshData = useCallback(() => {
    const loaded = loadCycleData();
    setData(loaded);
    const newStats = computeCycleStats(loaded.periods, loaded.logs);
    setStats(newStats);
    setIsDemoActive(isDemoModeActive());
  }, []);
  const clearAllVaultData = useCallback(() => {
    // Q4.6: purge everything recoverable, then reload to a clean first-run state.
    purgeVaultStorage(refreshData);
    try { if (typeof window !== "undefined" && window.location) window.location.reload(); } catch {}
  }, [refreshData]);


  useEffect(() => {
    const newStats = computeCycleStats(data.periods, data.logs);
    setStats(newStats);
  }, [data]);

  const savePeriod = useCallback((p: Omit<Period, "id"> & { id?: number }): Period | null => {
    try {
      const saved = addOrUpdatePeriod(p);
      refreshData();
      const count = getEntriesSinceExport();
      if (count >= 5) {
        setBackupToast(true);
      }
      return saved;
    } catch (err: any) {
      setErrorToast(err?.message || "Could not save that period. Nothing was changed.");
      return null;
    }
  }, [refreshData]);

  const removePeriod = useCallback((id: number) => {
    try { deletePeriodEntry(id); refreshData(); } catch (err: any) { setErrorToast(err?.message || "Could not delete that period."); }
  }, [refreshData]);

  const saveLog = useCallback((l: Omit<DayLog, "id"> & { id?: number }, opts?: SaveLogEntryOptions): SaveLogEntryResult | null => {
    try {
      const result = saveLogEntry(l, opts);
      if (!result) {
        setErrorToast("Nothing was saved because it could not be written.");
        return null;
      }
      if (result.needsConfirmation) {
        return result;
      }
      if (result.saved === false) {
        setErrorToast("Nothing was saved because " + (result.error || "it could not be written."));
        return null;
      }
      refreshData();
      const count = getEntriesSinceExport();
      if (count >= 5) {
        setBackupToast(true);
      }
      return result;
    } catch (err: any) {
      setErrorToast(err?.message || "Could not save that entry. Nothing was changed.");
      return null;
    }
  }, [refreshData]);

  const removeLog = useCallback((date: string) => {
    try { deleteDayLog(date); refreshData(); } catch (err: any) { setErrorToast(err?.message || "Could not delete that log."); }
  }, [refreshData]);


  const loadDemo = useCallback(() => { enterDemoMode(); refreshData(); }, [refreshData]);

  const clearDemo = useCallback(() => { exitDemoMode(); refreshData(); }, [refreshData]);

  const exportBackup = useCallback(() => {
    const jsonStr = exportCycleDataJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feather-backup-${todayLocal()}.json`;
    // Group 16.4: the reminder counters reset only once the download has
    // actually been handed to the browser; a failure leaves them untouched.
    try {
      a.click();
      recordExportTimestamp();
      setBackupToast(false);
      setOverdueDismissed(true);
    } catch (err: any) {
      setErrorToast("The backup download did not start, so your backup reminder stays on." + (err?.message ? " (" + err.message + ")" : ""));
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }, []);

  const importBackup = useCallback((jsonContent: string) => {
    const result = importCycleDataJSON(jsonContent);
    const skippedNote = result.skipped.length > 0
      ? " Skipped " + result.skipped.length + ": " + describeSkipped(result.skipped) + "."
      : "";
    if (result.success) {
      refreshData();
      setBackupToast(false);
      setOverdueDismissed(true);
      const parts = result.added.periods + " periods, " + result.added.logs + " logs, " + result.added.events + " events";
      return { success: true, message: "Imported " + result.count + " records (" + parts + ")." + skippedNote, count: result.count };
    }
    return { success: false, message: (result.error || "Failed to import JSON backup.") + skippedNote, count: 0 };
  }, [refreshData]);

  const showOverdueBanner = !overdueDismissed && isExportOverdue(14) && (data.periods.length + data.logs.length) > 0;

  return (
    <CycleContext.Provider
      value={{
        data,
        stats,
        refreshData,
        savePeriod,
        removePeriod,
        saveLog,
        removeLog,
        clearAllVaultData,
        isDemoActive,
        loadDemo,
        clearDemo,
        exportBackup,
        importBackup,
        showOverdueBanner,
        dismissOverdueBanner: () => setOverdueDismissed(true),
        backupToast,
        dismissBackupToast: () => setBackupToast(false),
        triggerBackupToast: () => setBackupToast(true),
        errorToast,
        dismissErrorToast: () => setErrorToast(null),
      }}
    >
      {errorToast && (
        <div role="alert" className="fixed top-4 left-3 right-3 sm:left-auto sm:right-8 z-[60] max-w-md ml-auto rounded-[20px] liquid-glass-card border border-rose-200/80 bg-rose-50/70 px-4 py-3 font-sans text-xs text-rose-950 shadow-xl flex items-start gap-2.5">
          <span className="flex-1">{errorToast}</span>
          <button type="button" onClick={() => setErrorToast(null)} aria-label="Dismiss error" className="liquid-glass-pill size-6 rounded-full flex items-center justify-center font-bold text-xs text-stone-700 cursor-pointer">×</button>
        </div>
      )}
      {children}
    </CycleContext.Provider>
  );
}

export function useCycle() {
  const context = useContext(CycleContext);
  if (!context) {
    throw new Error("useCycle must be used within a CycleProvider");
  }
  return context;
}
