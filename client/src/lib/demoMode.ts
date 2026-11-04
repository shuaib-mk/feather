import { addDays } from "./periodEngine";
import { todayLocal } from "./localDate";
import type { Period, DayLog } from "../cycleStorage";
export const DEMO_KEY = "feather_demo_v1";
export const DEMO_ACTIVE_KEY = "feather_demo_active";
export const DEMO_EVENTS_KEY = "feather_demo_events_v1";

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) return (globalThis as any).localStorage;
  } catch {}
  return null;
}

export function buildDemoData(today = todayLocal()): { periods: Period[]; logs: DayLog[]; events: any[] } {
  const lengths = [38, 26, 33, 29, 36, 28, 31];
  const starts: string[] = [];
  let cursor = addDays(today, -221);
  for (const len of lengths) { starts.push(cursor); cursor = addDays(cursor, len); }
  const periods = starts.map((s, i) => ({ id: 9000 + i, startDate: s, endDate: addDays(s, 4), isApproximate: false }));
  const logs: DayLog[] = [];
  let id = 9000;
  for (const s of starts) {
    logs.push({ id: id++, logDate: s, flow: "heavy" as const, symptoms: ["cramps"], mood: "Okay", energy: 3, sleepHours: 7, notes: "Demo log (fictional)" });
    logs.push({ id: id++, logDate: addDays(s, 1), flow: "medium" as const, symptoms: ["fatigue"], mood: null, energy: null, sleepHours: null, notes: null });
  }
  const events = [
    { id: "demo-event-1", title: "Demo exam (fictional)", date: addDays(today, 20), source: "manual", demo: true },
    { id: "demo-event-2", title: "Demo trip (fictional)", date: addDays(today, 45), source: "manual", demo: true },
  ];
  return { periods, logs, events };
}

export function isDemoActive(): boolean {
  try {
    return getStorage()?.getItem(DEMO_ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

export function enterDemoMode(today = todayLocal()): void {
  try {
    const ls = getStorage();
    const demo = buildDemoData(today);
    if (ls) {
      if (!ls.getItem(DEMO_KEY)) {
        ls.setItem(DEMO_KEY, JSON.stringify({ periods: demo.periods, logs: demo.logs }));
      }
      if (!ls.getItem(DEMO_EVENTS_KEY)) {
        ls.setItem(DEMO_EVENTS_KEY, JSON.stringify(demo.events));
      }
      ls.setItem(DEMO_ACTIVE_KEY, "1");
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("feather_events_changed"));
    }
  } catch {}
}

/** Group 14: the ?demo=1 entry point. Entering is idempotent: an existing demo
 * vault (with everything the visitor saved) is NEVER re-seeded by a reload, a
 * second ?demo=1 visit or a second "Try Demo" tap. Returns true when the URL
 * asked for demo mode. */
export function applyDemoUrlParam(search: string, today = todayLocal()): boolean {
  try {
    if (new URLSearchParams(search).get("demo") !== "1") return false;
    enterDemoMode(today);
    return true;
  } catch {
    return false;
  }
}

/** Group 14: the ONLY way to restore the demo baseline (explicit user action). */
export function resetDemoData(today = todayLocal()): void {
  try {
    const ls = getStorage();
    if (ls) { ls.removeItem(DEMO_KEY); ls.removeItem(DEMO_EVENTS_KEY); }
  } catch {}
  enterDemoMode(today);
}

/** Group 14: true when this browser will not keep data across a refresh
 * (private window, blocked storage, sandboxed preview). */
export function isStorageVolatile(): boolean {
  try {
    const ls = getStorage();
    if (!ls) return true;
    const k = "feather_storage_probe";
    ls.setItem(k, "1");
    const ok = ls.getItem(k) === "1";
    ls.removeItem(k);
    return !ok;
  } catch {
    return true;
  }
}

export function exitDemoMode(): void {
  try {
    const ls = getStorage();
    if (ls) {
      ls.removeItem(DEMO_ACTIVE_KEY);
      ls.removeItem(DEMO_EVENTS_KEY);
      ls.removeItem(DEMO_KEY);
      ls.removeItem("feather_last_export_ts");
      ls.removeItem("feather_entries_since_export");
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("feather_events_changed"));
    }
  } catch {}
}
