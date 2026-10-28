import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  loadCycleData,
  saveCycleData,
  addOrUpdatePeriod,
  deletePeriodEntry,
  addOrUpdateLog,
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
import { fetchDeepCycleSynthesis } from "../../../ai/frontend/aiClient";

interface CycleContextValue {
  data: { periods: Period[]; logs: DayLog[] };
  stats: CycleStats;
  refreshData: () => void;
  savePeriod: (p: Omit<Period, "id"> & { id?: number }) => void;
  removePeriod: (id: number) => void;
  saveLog: (l: Omit<DayLog, "id"> & { id?: number }) => void;
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
  const [stats, setStats] = useState<CycleStats>(() => computeCycleStats(data.periods));
  const [isDemoActive, setIsDemoActive] = useState<boolean>(() => isDemoDataLoaded());

  // Backup & Privacy Notifications
  const [overdueDismissed, setOverdueDismissed] = useState<boolean>(false);
  const [backupToast, setBackupToast] = useState<boolean>(false);
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
    const newStats = computeCycleStats(loaded.periods);
    setStats(newStats);
    setIsDemoActive(isDemoDataLoaded());
    setSynthesisResult(getBaselineSynthesis(loaded.periods, newStats, 2026));
  }, []);

  useEffect(() => {
    const newStats = computeCycleStats(data.periods);
    setStats(newStats);
    setSynthesisResult(getBaselineSynthesis(data.periods, newStats, 2026));
  }, [data.periods.length, data.logs.length]);

  const savePeriod = useCallback((p: Omit<Period, "id"> & { id?: number }) => {
    addOrUpdatePeriod(p);
    refreshData();
    const count = getEntriesSinceExport();
    if (count >= 5) {
      setBackupToast(true);
    }
  }, [refreshData]);

  const removePeriod = useCallback((id: number) => {
    deletePeriodEntry(id);
    refreshData();
  }, [refreshData]);

  const saveLog = useCallback((l: Omit<DayLog, "id"> & { id?: number }) => {
    addOrUpdateLog(l);
    refreshData();
    const count = getEntriesSinceExport();
    if (count >= 5) {
      setBackupToast(true);
    }
  }, [refreshData]);

  const removeLog = useCallback((date: string) => {
    deleteDayLog(date);
    refreshData();
  }, [refreshData]);

  const clearAllVaultData = useCallback(() => {
    saveCycleData({ periods: [], logs: [] });
    refreshData();
  }, [refreshData]);

  const loadDemo = useCallback(() => {
    const demo = loadSyntheticDemoData();
    setData(demo);
    setIsDemoActive(true);
    const newStats = computeCycleStats(demo.periods);
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
    a.download = `feather-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
      }}
    >
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
