
import { getCalendarMonth, getPrediction, addDays, type PeriodRecord, type DailyObservation } from "./periodEngine";
import type { Period, DayLog } from "../cycleStorage";
import type { CalendarEvent } from "./events";
import { eventsOnDate } from "./events";
export function weekStartForLocale(locale: string): 0|1 { return /(^|-)IN\b/i.test(locale) || locale.toLowerCase().startsWith("en-in") ? 1 : locale.toLowerCase().startsWith("en-us") ? 0 : 1; }
export function toEngineRecords(periods: Period[]): PeriodRecord[] { return periods.map((p)=>({ id:String(p.id), startDate:p.startDate, endDate:p.endDate||undefined, confirmed:true, source:"manual", landmarkName:p.landmarkName||null, startEarliest:p.startEarliest||null, startLatest:p.startLatest||null, createdAt:"", updatedAt:"" })); }
export function toObservations(logs: DayLog[]): DailyObservation[] { return logs.map((l)=>({ date:l.logDate, bleeding: l.flow==="light"||l.flow==="medium"||l.flow==="heavy", flow: (l.flow==="spotting"||l.flow==="light"||l.flow==="medium"||l.flow==="heavy") ? l.flow : undefined, symptoms:l.symptoms, mood:l.mood, energy:l.energy, sleepHours:l.sleepHours, notes:l.notes||undefined })); }
export interface CalendarDayState { date: string; bleeding: boolean; spotting: boolean; predicted: boolean; isToday: boolean; hasLog: boolean; log: DayLog|null; events: CalendarEvent[]; label: string; }
export function buildMonthDayStates(year:number, month:number, periods:Period[], logs:DayLog[], events:CalendarEvent[], today:string, locale="en-US"): { weekStart: 0|1; days: CalendarDayState[]; leadingBlanks: number } {
  const records = toEngineRecords(periods); const obs = toObservations(logs);
  const cal = getCalendarMonth(year, month, records, obs, today);
  const prediction = getPrediction(records, today);
  const first = `${year}-${String(month).padStart(2,"0")}-01`;
  const firstDow = new Date(Date.UTC(year, month-1, 1)).getUTCDay();
  const weekStart = weekStartForLocale(locale);
  const leadingBlanks = (firstDow - weekStart + 7) % 7;
  const days = cal.map((d)=>{
    const log = logs.find((l)=>l.logDate===d.date) || null;
    const bleeding = log ? (log.flow==="light"||log.flow==="medium"||log.flow==="heavy") : !!d.bleeding;
    const spotting = log?.flow==="spotting";
    const predicted = !!(prediction.earliestStart && prediction.latestStart && d.date >= prediction.earliestStart && d.date <= addDays(prediction.latestStart, 4) && d.date >= today);
    const evs = eventsOnDate(events, d.date);
    const nice = new Date(Date.UTC(year, month-1, Number(d.date.slice(8,10)))).toLocaleDateString(locale,{weekday:"long", day:"numeric", month:"long", timeZone:"UTC"});
    const label = `${nice}${bleeding?", period day logged":spotting?", spotting logged":predicted?", predicted period window (estimate)":""}${log?.symptoms?.length?", symptom log":""}${evs.length?`, ${evs.length} event${evs.length>1?"s":""}`:""}`;
    return { date:d.date, bleeding, spotting, predicted, isToday:d.date===today, hasLog:!!log && !!(log.symptoms?.length||log.mood||log.notes), log, events:evs, label };
  });
  return { weekStart, days, leadingBlanks };
}
export function nextThirtyDays(periods:Period[], logs:DayLog[], events:CalendarEvent[], today:string): CalendarDayState[] {
  const out: CalendarDayState[] = [];
  for (let i=0;i<30;i++){ const date = addDays(today,i); const y=Number(date.slice(0,4)), m=Number(date.slice(5,7)); const monthStates = buildMonthDayStates(y,m,periods,logs,events,today); const st = monthStates.days.find((d)=>d.date===date); if (st) out.push(st); }
  return out;
}
