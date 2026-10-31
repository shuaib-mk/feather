
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCycle } from "../context/CycleContext";
import { PageHeader } from "../components/PageHeader";
import { buildMonthDayStates, nextThirtyDays } from "../lib/calendarView";
import { loadEvents, saveEvents, upsertEvent, deleteEvent, type CalendarEvent } from "../lib/events";
import { buildICS, parseICS } from "../lib/ics";
import { PlanAroundIt } from "../components/PlanAroundIt";
import { todayLocal } from "../lib/localDate";
import { addDays } from "../lib/periodEngine";

export function CalendarPage(){
  const { data, stats, saveLog, removeLog } = useCycle();
  const today = todayLocal();
  const [cursor, setCursor] = useState(()=>{ const [y,m]=today.split("-").map(Number); return {y,m}; });
  const [selected, setSelected] = useState<string>(today);
  const [events, setEvents] = useState<CalendarEvent[]>(()=>loadEvents());
  useEffect(() => { const handler = () => setEvents(loadEvents()); window.addEventListener("feather_events_changed", handler); return () => window.removeEventListener("feather_events_changed", handler); }, []);
  const [newTitle, setNewTitle] = useState("");
  const [icsTitle, setIcsTitle] = useState("Private");
  const [importPreview, setImportPreview] = useState<CalendarEvent[]|null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const touchX = useRef<number|null>(null);
  const locale = typeof navigator!=="undefined" ? navigator.language : "en-US";
  const month = useMemo(()=>buildMonthDayStates(cursor.y,cursor.m,data.periods,data.logs,events,today,locale),[cursor,data,events,today,locale]);
  const sel = month.days.find(d=>d.date===selected) || buildMonthDayStates(Number(selected.slice(0,4)),Number(selected.slice(5,7)),data.periods,data.logs,events,today,locale).days.find(d=>d.date===selected);
  const monthName = new Date(Date.UTC(cursor.y,cursor.m-1,1)).toLocaleDateString(locale,{month:"long",year:"numeric",timeZone:"UTC"});
  const move=(n:number)=>{ const d=new Date(Date.UTC(cursor.y,cursor.m-1+n,1)); setCursor({y:d.getUTCFullYear(),m:d.getUTCMonth()+1}); };
  const onKey=(e:React.KeyboardEvent, date:string)=>{ let next:string|null=null; if(e.key==="ArrowRight") next=addDays(date,1); if(e.key==="ArrowLeft") next=addDays(date,-1); if(e.key==="ArrowDown") next=addDays(date,7); if(e.key==="ArrowUp") next=addDays(date,-7); if(next){ e.preventDefault(); setSelected(next); const [y,m]=next.split("-").map(Number); setCursor({y,m}); setTimeout(()=>document.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus(),0); } };
  const downloadICS=()=>{ const predicted:any[]=[]; if(stats.earliestNextDate && stats.latestNextDate) predicted.push({id:"pred-1",title:icsTitle,date:stats.earliestNextDate,endDate:stats.latestNextDate,source:"manual",private:icsTitle==="Private"}); const periodEvents=data.periods.map(p=>({id:`p-${p.id}`,title:icsTitle,date:p.startDate,endDate:p.endDate||p.startDate,source:"manual" as const,private:icsTitle==="Private"})); const blob=new Blob([buildICS([...periodEvents,...predicted],{title:icsTitle})],{type:"text/calendar"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="feather-calendar.ics"; a.click(); URL.revokeObjectURL(url); };
  const onImportFile=async (f:File)=>{ const text=await f.text(); const res=parseICS(text, addDays(today,-540), addDays(today,365)); setImportPreview(res.events); setImportWarnings(res.warnings); setChecked(new Set(res.events.map(e=>e.id))); };
  const saveImport=()=>{ if(!importPreview) return; const chosen=importPreview.filter(e=>checked.has(e.id)); const merged=[...events]; for(const e of chosen){ if(!merged.some(x=>(x.uid&&x.uid===e.uid&&x.date===e.date))) merged.push(e); } saveEvents(merged); setEvents(merged); setImportPreview(null); };
  const weekdayNames = Array.from({length:7},(_,i)=>{ const base = month.weekStart===1 ? 1:0; const d=new Date(Date.UTC(2026,0,base+i+ (month.weekStart===1?0:0))); return d.toLocaleDateString(locale,{weekday:"short",timeZone:"UTC"}); });
  return <div className="space-y-5" onTouchStart={(e)=>{touchX.current=e.touches[0].clientX;}} onTouchEnd={(e)=>{ if(touchX.current==null) return; const dx=e.changedTouches[0].clientX-touchX.current; if(Math.abs(dx)>50) move(dx<0?1:-1); touchX.current=null; }}>
    <PageHeader title="Calendar" subtitle="Logged days and estimated windows from your cycles." badge="Calendar" />
    {data.periods.length===0 && <div className="liquid-glass-card rounded-[24px] p-5 text-xs">No cycles logged yet. The calendar still works — log a period to see estimates. <Link className="underline font-semibold" to="/voice">Log by voice</Link></div>}
    <div className="liquid-glass-card rounded-[24px] p-4 sm:p-6 space-y-3">
      <div className="flex items-center justify-between gap-2"><button type="button" aria-label="Previous month" className="liquid-glass-button rounded-full px-4 min-h-[44px]" onClick={()=>move(-1)}>‹</button><h2 className="font-serif text-lg font-semibold">{monthName}</h2><div className="flex gap-2"><button type="button" className="liquid-glass-button rounded-full px-4 min-h-[44px]" onClick={()=>{const [y,m]=today.split("-").map(Number); setCursor({y,m}); setSelected(today);}}>Today</button><button type="button" aria-label="Next month" className="liquid-glass-button rounded-full px-4 min-h-[44px]" onClick={()=>move(1)}>›</button></div></div>
      <div role="grid" aria-label={monthName} className="grid grid-cols-7 gap-1">
        {weekdayNames.map((w,i)=><div key={i} className="text-center text-[11px] font-semibold text-stone-500 min-h-[20px]">{w}</div>)}
        {Array.from({length:month.leadingBlanks},(_,i)=><div key={`b${i}`} />)}
        {month.days.map(d=> <button key={d.date} data-date={d.date} type="button" role="gridcell" aria-label={d.label} onClick={()=>setSelected(d.date)} onKeyDown={(e)=>onKey(e,d.date)} className={`relative min-h-[44px] min-w-[44px] rounded-xl text-sm flex flex-col items-center justify-center transition-all ${d.bleeding?"liquid-glass-day-bleeding font-bold":d.spotting?"liquid-glass-day-spotting":d.predicted?"liquid-glass-day-predicted font-medium":"liquid-glass-day text-stone-800"} ${d.isToday?"ring-2 ring-stone-900/80 shadow-md":""} ${selected===d.date?"outline outline-2 outline-violet-600/85 scale-[1.03] z-10":""}`}>
          <span>{Number(d.date.slice(8,10))}</span>
          <span className="flex gap-0.5">{d.hasLog && <span aria-hidden className="size-1.5 rounded-full bg-current inline-block" />}{d.events.slice(0,3).map((ev,i)=><span key={i} aria-hidden className="size-1.5 rounded-full bg-amber-500 inline-block" />)}{d.events.length>3 && <span className="text-[9px]">+{d.events.length-3}</span>}</span>
        </button>)}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-600">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-md bg-rose-500 inline-block shadow-2xs" /> Logged bleeding day</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-md border-2 border-rose-400 bg-rose-50/60 inline-block" /> Spotting</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-md bg-violet-300/40 border border-violet-400/50 inline-block" /> Shaded = predicted window</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-stone-700 inline-block" /> Log / event</span>
      </div>
      <p className="text-[11px] text-stone-500">Shaded days are estimates from your logged cycles. Not medical advice.</p>
    </div>
    {sel && <div className="liquid-glass-card rounded-[24px] p-5 space-y-3" aria-label="Day details">
      <h3 className="font-serif font-semibold">{sel.label}</h3>
      {sel.log ? <div className="text-xs space-y-2"><p>Flow: {sel.log.flow||"none"} · Symptoms: {sel.log.symptoms.join(", ")||"—"} · Mood: {sel.log.mood||"—"}</p><div className="flex gap-2 flex-wrap items-center"><Link className="liquid-glass-button rounded-full px-4 py-2 min-h-[44px] inline-flex items-center" to={`/voice?date=${sel.date}`}>Log by voice for this day</Link><button type="button" className="liquid-glass-pill rounded-full px-4 py-2 min-h-[44px]" onClick={()=>{ if(confirm("Delete this log?")) removeLog(sel.date); }}>Delete log</button><label className="inline-flex items-center gap-2 text-xs font-medium text-stone-700">Flow <select aria-label="Edit flow" className="liquid-glass-select min-h-[40px] px-3.5 py-1.5 text-xs font-sans font-medium" defaultValue={sel.log.flow||"none"} onChange={(e)=>saveLog({logDate:sel.date, flow:e.target.value as any, symptoms:sel.log!.symptoms, mood:sel.log!.mood, energy:sel.log!.energy, sleepHours:sel.log!.sleepHours, notes:sel.log!.notes})}>{["none","spotting","light","medium","heavy"].map(f=><option key={f} value={f}>{f}</option>)}</select></label></div></div> : <p className="text-xs text-stone-600">No log for this day.</p>}
      <div className="space-y-2"><h4 className="text-xs font-semibold">Events</h4>{sel.events.map(ev=><div key={ev.id} className="flex justify-between text-xs"><span>{ev.title} ({ev.date})</span><button type="button" className="underline" onClick={()=>{ deleteEvent(ev.id); setEvents(loadEvents()); }}>Delete</button></div>)}
      <div className="flex gap-2 flex-wrap"><input aria-label="Event title" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Event title" className="liquid-glass-input rounded-full px-4 py-2 min-h-[44px] text-xs" /><button type="button" className="liquid-glass-button rounded-full px-4 min-h-[44px] text-xs" onClick={()=>{ if(!newTitle.trim()) return; upsertEvent({title:newTitle.trim(), date:sel.date, source:"manual"}); setEvents(loadEvents()); setNewTitle(""); }}>Add event</button></div></div>
    </div>}
    <div className="liquid-glass-card rounded-[24px] p-5 space-y-3 text-xs">
      <h3 className="font-serif text-base font-semibold">Calendar sync (.ics)</h3>
      <p className="text-stone-600">Warning: calendar apps may sync these titles to other people or devices.</p>
      <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-700">Export title <select aria-label="Export title" className="liquid-glass-select min-h-[40px] px-3.5 py-1.5 text-xs font-sans font-medium" value={icsTitle} onChange={e=>setIcsTitle(e.target.value)}><option>Private</option><option>Period (estimate)</option></select></label>
      <div className="flex gap-2 flex-wrap"><button type="button" className="liquid-glass-button rounded-full px-4 min-h-[44px]" onClick={downloadICS}>Download my cycle calendar (.ics)</button>
      <label className="liquid-glass-button rounded-full px-4 min-h-[44px] inline-flex items-center cursor-pointer">Import .ics<input type="file" accept=".ics,text/calendar" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) onImportFile(f);}} /></label></div>
      <p className="text-stone-500">Import processing happens entirely in the browser.</p>
      {importWarnings.map((w,i)=><p key={i} role="alert" className="text-amber-700">{w}</p>)}
      {importPreview && <div className="space-y-2"><p className="font-semibold">Preview — choose events to save ({importPreview.length})</p>{importPreview.slice(0,50).map(e=><label key={e.id} className="flex gap-2 items-center"><input type="checkbox" checked={checked.has(e.id)} onChange={(ev)=>{const n=new Set(checked); ev.target.checked?n.add(e.id):n.delete(e.id); setChecked(n);}} />{e.title} — {e.date}</label>)}<button type="button" className="liquid-glass-button rounded-full px-4 min-h-[44px]" onClick={saveImport}>Save selected events</button></div>}
    </div>
    <PlanAroundIt events={events} />
  </div>;
}
export function NextThirtyDaysStrip(){
  const { data } = useCycle();
  const today = todayLocal();
  const [events, setEvents] = useState(() => loadEvents());

  useEffect(() => {
    const handler = () => setEvents(loadEvents());
    window.addEventListener("feather_events_changed", handler);
    return () => window.removeEventListener("feather_events_changed", handler);
  }, []);

  const days = useMemo(() => nextThirtyDays(data.periods, data.logs, events, today), [data, events, today]);

  return (
    <Link to="/calendar" className="block liquid-glass-card rounded-[24px] p-4 transition-all">
      <span className="text-xs font-semibold block mb-2.5 text-stone-800">Next 30 days — open calendar</span>
      <span className="flex gap-1.5 flex-wrap">
        {days.map((d) => (
          <span
            key={d.date}
            title={d.label}
            className={`size-8 rounded-xl text-[10px] flex items-center justify-center font-medium transition-all ${
              d.bleeding
                ? "liquid-glass-day-bleeding"
                : d.predicted
                ? "liquid-glass-day-predicted"
                : "liquid-glass-day text-stone-700"
            } ${d.isToday ? "ring-2 ring-stone-900 shadow-xs" : ""}`}
          >
            {Number(d.date.slice(8, 10))}
          </span>
        ))}
      </span>
    </Link>
  );
}
