
import React, { useEffect, useMemo, useState } from "react";
import { useCycle } from "../context/CycleContext";
import { loadEvents, upcomingEvents, type CalendarEvent } from "../lib/events";
import { buildSingleEventICS } from "../lib/ics";
import { toEngineRecords } from "../lib/calendarView";
import { evaluateEventOverlap } from "../lib/periodEngine";
import { todayLocal } from "../lib/localDate";
import { OVERLAP_DISCLAIMER } from "../cycleStorage";
const LABELS: Record<string,string> = { logged:"Logged period", likely:"Likely overlap", possible:"Possible overlap", unlikely:"Unlikely to overlap (estimate)", past:"Past", unknown:"Unknown — log more cycles" };
export function PlanAroundIt({ events: eventsProp }: { events?: CalendarEvent[] } = {}) {
  const { data } = useCycle();
  const [internalEvents, setInternalEvents] = useState(() => loadEvents());
  const today = todayLocal();

  useEffect(() => {
    const handler = () => setInternalEvents(loadEvents());
    window.addEventListener("feather_events_changed", handler);
    return () => window.removeEventListener("feather_events_changed", handler);
  }, []);

  const events = eventsProp !== undefined ? eventsProp : internalEvents;
  const rows = useMemo(()=> upcomingEvents(events, today, 120).map((e)=>{ const r = evaluateEventOverlap(e.date, toEngineRecords(data.periods), today); return {e, r}; }), [events, data.periods, today]);
  if (!rows.length) return <div className="liquid-glass-card rounded-[24px] p-5 text-xs text-stone-600">No upcoming events in the next 120 days. Add an event from the calendar to check overlap. <p className="mt-2">{OVERLAP_DISCLAIMER}</p></div>;
  return <div className="liquid-glass-card rounded-[24px] p-5 space-y-3"><h3 className="font-serif text-lg font-semibold">Plan Around It</h3>
    {rows.map(({e,r})=> <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/50 pb-2 text-xs"><div><span className="font-semibold">{e.title}</span> <span className="text-stone-500">{e.date}</span><span className="block text-stone-600">{LABELS[r.status]||r.status}{r.window?` · window ${r.window.start} to ${r.window.end}`:""} · {(r.note || "").replace(/^(Likely overlap|Possible overlap|Unlikely to overlap \(estimate\)):\s*/i, "")}</span></div>
    <button type="button" className="liquid-glass-button rounded-full px-3 py-1.5 min-h-[44px]" onClick={()=>{ const blob=new Blob([buildSingleEventICS(e.title,e.date)],{type:"text/calendar"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="feather-event.ics"; a.click(); URL.revokeObjectURL(url); }}>Add to calendar</button></div>)}
    <p className="text-[11px] text-stone-500">{OVERLAP_DISCLAIMER}</p></div>;
}
