import { isDemoActive, DEMO_EVENTS_KEY, buildDemoData } from "./demoMode";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  source: "manual" | "ics" | "voice";
  uid?: string;
  private?: boolean;
  demo?: boolean;
}

export const REAL_EVENTS_KEY = "feather_events_v1";

export function getEventsKey(): string {
  return isDemoActive() ? DEMO_EVENTS_KEY : REAL_EVENTS_KEY;
}

function store(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) return (globalThis as any).localStorage;
  } catch {}
  return null;
}

function isLeakedDemoEventInRealMode(e: any): boolean {
  if (!e) return false;
  if (e.demo === true) return true;
  if (typeof e.id === "string" && e.id.startsWith("demo-event-")) return true;
  if (typeof e.title === "string" && /\(fictional\)/i.test(e.title)) return true;
  // Clean legacy un-flagged "exam 2026-11-20" voice event created before namespace tagging
  if (e.demo === undefined && e.title === "exam" && e.date === "2026-11-20" && e.source === "voice") return true;
  return false;
}

/** Group 2: identity of an event for duplicate prevention. Same normalised
 * title, same start date, same end date (a one-day event's end is its start),
 * and the same ICS uid when there is one. Events whose span or uid differ are
 * different events even if title and start date match. Source is NOT part of
 * the key: the same "exam" on the same day saved by voice and again from Plan
 * Around It is one event, not two. */
export function eventDedupeKey(e: { title: string; date: string; endDate?: string; uid?: string }): string {
  const title = (e.title || "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return [title, e.date, e.endDate || e.date, e.uid || ""].join("|");
}

/** Collapse exact duplicates, keeping the first occurrence (stable order). */
export function dedupeEvents<T extends { title: string; date: string; endDate?: string; uid?: string }>(events: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of events) {
    const k = eventDedupeKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

export function loadEvents(): CalendarEvent[] {
  try {
    const demoMode = isDemoActive();
    const key = demoMode ? DEMO_EVENTS_KEY : REAL_EVENTS_KEY;
    const ls = store();
    let raw = ls?.getItem(key) ?? null;
    if (demoMode && raw === null) {
      const seeded = buildDemoData().events;
      try { ls?.setItem(DEMO_EVENTS_KEY, JSON.stringify(seeded)); } catch {}
      raw = JSON.stringify(seeded);
    }
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (e: any) => e && typeof e.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date),
    );
    // Group 2: heal stored duplicates once, before any caller (and so any render) reads them.
    const healed = dedupeEvents(valid);
    if (healed.length !== valid.length) {
      try { ls?.setItem(key, JSON.stringify(healed)); } catch {}
    }
    if (demoMode) {
      return healed.filter((e: any) => e.demo !== false);
    }
    const cleaned = healed.filter((e: any) => !isLeakedDemoEventInRealMode(e));
    if (cleaned.length !== healed.length) {
      try { ls?.setItem(REAL_EVENTS_KEY, JSON.stringify(cleaned)); } catch {}
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveEvents(events: CalendarEvent[]): void {
  try {
    const demoMode = isDemoActive();
    const tagged = dedupeEvents(events).map((e) => ({ ...e, demo: demoMode }));
    store()?.setItem(getEventsKey(), JSON.stringify(tagged));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("feather_events_changed"));
    }
  } catch {}
}

export function upsertEvent(event: Omit<CalendarEvent, "id"> & { id?: string }): CalendarEvent {
  const demoMode = isDemoActive();
  const events = loadEvents();
  const saved: CalendarEvent = {
    ...event,
    id: event.id || `evt-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    demo: demoMode,
  };
  const i = events.findIndex((e) => e.id === saved.id);
  if (i >= 0) {
    events[i] = saved;
  } else {
    // Group 2: idempotent insert. The duplicate check and the insert happen in the
    // same synchronous read-modify-write, so a double click, a retry or a second
    // component firing the same save returns the existing event instead of adding one.
    const k = eventDedupeKey(saved);
    const existing = events.find((e) => eventDedupeKey(e) === k);
    if (existing) return existing;
    events.push(saved);
  }
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
