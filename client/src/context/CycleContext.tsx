import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
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
  importCycleDataJSON,
  loadSyntheticDemoData,
  clearSyntheticDemoData,
  isDemoDataLoaded,
  isExportOverdue,
  getEntriesSinceExport,
  type Period,
  type DayLog,
  type CycleStats,
} from "../cycleStorage";
import { getBaselineSynthesis, type DeepCycleSynthesis } from "../../../ai/backend/synthesis";
import { todayLocal } from "../lib/localDate";
import { fetchDeepCycleSynthesis } from "../../../ai/frontend/aiClient";

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

  // Synthesis & Chronobiology
  synthesisResult: DeepCycleSynthesis;
  isSynthesizing: boolean;
  runSynthesis: () => Promise<void>;

  // Export & Backup
  exportBackup: () => void;
  importBackup: (jsonContent: string) => { success: boolean; message: string };
  showOverdueBanner: boolean;
  dismissOverdueBanner: () => void;
  backupToast: boolean;
  dismissBackupToast: () => void;
  triggerBackupToast: () => void;

  // Speech Preference
  useBrowserSpeech: boolean;
  setUseBrowserSpeech: (enabled: boolean) => void;
}

const CycleContext = createContext<CycleContextValue | null>(null);

export function CycleProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<{ periods: Period[]; logs: DayLog[] }>(() => loadCycleData());
  const [stats, setStats] = useState<CycleStats>(() => computeCycleStats(data.periods, data.logs));
  const [isDemoActive, setIsDemoActive] = useState<boolean>(() => isDemoDataLoaded());

  // Backup & Privacy Notifications
  const [overdueDismissed, setOverdueDismissed] = useState<boolean>(false);
  const [backupToast, setBackupToast] = useState<boolean>(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [useBrowserSpeech, setUseBrowserSpeechState] = useState<boolean>(() => {
    try {
      return localStorage.getItem("feather_use_web_speech") === "true";
    } catch {
      return false;
    }
  });

  // Deep Synthesis State
  const [synthesisResult, setSynthesisResult] = useState<DeepCycleSynthesis>(() =>
    getBaselineSynthesis(data.periods, stats, 2026),
  );
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  const refreshData = useCallback(() => {
    const loaded = loadCycleData();
    setData(loaded);
    const newStats = computeCycleStats(loaded.periods, loaded.logs);
    setStats(newStats);
    setIsDemoActive(isDemoDataLoaded());
    setSynthesisResult(getBaselineSynthesis(loaded.periods, newStats, 2026));
  }, []);

  useEffect(() => {
    const newStats = computeCycleStats(data.periods, data.logs);
    setStats(newStats);
    setSynthesisResult(getBaselineSynthesis(data.periods, newStats, 2026));
  }, [data.periods.length, data.logs.length]);

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
      if (result.saved) {
        refreshData();
        const count = getEntriesSinceExport();
        if (count >= 5) {
          setBackupToast(true);
        }
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

  const clearAllVaultData = useCallback(() => {
    saveCycleData({ periods: [], logs: [] });
    refreshData();
  }, [refreshData]);

  const loadDemo = useCallback(() => {
    const demo = loadSyntheticDemoData();
    setData(demo);
    setIsDemoActive(true);
    const newStats = computeCycleStats(demo.periods, demo.logs);
    setStats(newStats);
    setSynthesisResult(getBaselineSynthesis(demo.periods, newStats, 2026));
  }, []);

  const clearDemo = useCallback(() => {
    clearSyntheticDemoData();
    refreshData();
  }, [refreshData]);

  const runSynthesis = useCallback(async () => {
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
  }, [data.periods, data.logs, stats]);

  const exportBackup = useCallback(() => {
    const jsonStr = exportCycleDataJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feather-backup-${todayLocal()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupToast(false);
    setOverdueDismissed(true);
  }, []);

  const importBackup = useCallback((jsonContent: string) => {
    const result = importCycleDataJSON(jsonContent);
    if (result.success) {
      refreshData();
      setBackupToast(false);
      setOverdueDismissed(true);
      return { success: true, message: `Imported ${result.count} records successfully.`, count: result.count };
    }
    return { success: false, message: result.error || "Failed to import JSON backup.", count: 0 };
  }, [refreshData]);

  const setUseBrowserSpeech = useCallback((enabled: boolean) => {
    setUseBrowserSpeechState(enabled);
    try {
      localStorage.setItem("feather_use_web_speech", enabled ? "true" : "false");
    } catch {
      // ignore
    }
  }, []);

  const showOverdueBanner = !overdueDismissed && isExportOverdue(14) && data.periods.length > 0;

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
        synthesisResult,
        isSynthesizing,
        runSynthesis,
        exportBackup,
        importBackup,
        showOverdueBanner,
        dismissOverdueBanner: () => setOverdueDismissed(true),
        backupToast,
        dismissBackupToast: () => setBackupToast(false),
        triggerBackupToast: () => setBackupToast(true),
        useBrowserSpeech,
        setUseBrowserSpeech,
        errorToast,
        dismissErrorToast: () => setErrorToast(null),
      }}
    >
      {errorToast && (
        <div role="alert" className="fixed top-4 left-3 right-3 sm:left-auto sm:right-8 z-[60] max-w-md ml-auto rounded-[16px] bg-rose-50 border border-rose-300 px-4 py-3 font-sans text-xs text-rose-900 shadow-xl flex items-start gap-2">
          <span className="flex-1">{errorToast}</span>
          <button type="button" onClick={() => setErrorToast(null)} aria-label="Dismiss error" className="font-semibold cursor-pointer">x</button>
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
