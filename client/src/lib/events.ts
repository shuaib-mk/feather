
import { isDemoActive, DEMO_EVENTS_KEY } from "./demoMode";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  source: "manual" | "ics" | "voice";
  uid?: string;
  private?: boolean;
}

export const REAL_EVENTS_KEY = "feather_events_v1";

export function getEventsKey(): string {
  return isDemoActive() ? DEMO_EVENTS_KEY : REAL_EVENTS_KEY;
}

function store(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadEvents(): CalendarEvent[] {
  try {
    const raw = store()?.getItem(getEventsKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((e: any) => e && typeof e.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date))
      : [];
  } catch {
    return [];
  }
}

export function saveEvents(events: CalendarEvent[]): void {
  try {
    store()?.setItem(getEventsKey(), JSON.stringify(events));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("feather_events_changed"));
    }
  } catch {}
}

export function upsertEvent(event: Omit<CalendarEvent, "id"> & { id?: string }): CalendarEvent {
  const events = loadEvents();
  const saved: CalendarEvent = {
    ...event,
    id: event.id || `evt-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  };
  const i = events.findIndex((e) => e.id === saved.id);
  if (i >= 0) events[i] = saved;
  else events.push(saved);
  saveEvents(events);
  return saved;
}

export function deleteEvent(id: string): void {
  saveEvents(loadEvents().filter((e) => e.id !== id));
}
export function eventsOnDate(events: CalendarEvent[], date: string): CalendarEvent[] { return events.filter((e)=> e.date<=date && date <= (e.endDate||e.date)); }
export function upcomingEvents(events: CalendarEvent[], today: string, days = 120): CalendarEvent[] { return events.filter((e)=> (e.endDate||e.date) >= today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,200); }
/** Deterministic fuzzy match of a phrase against stored event titles. Never returns the full calendar unless phrases match. */
export function fuzzyMatchEvents(phrase: string, events: CalendarEvent[]): CalendarEvent[] {
  const stop = new Set(["the","of","my","a","an","week","after","before","on","at","around"]);
  const tokens = (s:string)=> Array.from(new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu," ").split(/\s+/).filter((w)=>w.length>1 && !stop.has(w))));
  const pt = tokens(phrase); if (!pt.length) return [];
  return events.map((e)=>{ const et = tokens(e.title); const score = pt.filter((w)=> et.some((x)=> x===w || x.startsWith(w) || w.startsWith(x))).length; return {e,score}; }).filter((x)=>x.score>0 && x.score >= Math.min(1, pt.length)).sort((a,b)=>b.score-a.score).slice(0,3).map((x)=>x.e);
}
