
import type { CalendarEvent } from "./events";
import { addDays } from "./periodEngine";
export function escapeICSText(s:string): string { return s.replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n"); }
export function foldICSLine(line:string): string { const enc = new TextEncoder(); const out:string[]=[]; let cur=""; for (const ch of line){ const cand=cur+ch; if (enc.encode(cand).length>75){ out.push(cur); cur=" "+ch; } else cur=cand; } out.push(cur); return out.join("\r\n"); }
export function icsDate(d:string): string { return d.replace(/-/g,""); }
export function stableUID(seed:string): string { let h=0; for (let i=0;i<seed.length;i++) h=(h*31 + seed.charCodeAt(i))|0; return `feather-${Math.abs(h).toString(36)}-${seed.replace(/[^a-z0-9]/gi,"").slice(0,24)}@feather.local`; }
export interface ICSBuildOptions { title?: string; dtstamp?: string; }
export function buildICS(events: CalendarEvent[], options: ICSBuildOptions={}): string {
  const stamp = options.dtstamp || new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Feather//Cycle Calendar//EN","CALSCALE:GREGORIAN"];
  for (const e of events){ const title = options.title ?? (e.private ? "Private" : e.title); lines.push("BEGIN:VEVENT", `UID:${e.uid || stableUID(`${e.id}|${e.date}|${e.title}`)}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(e.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(e.endDate||e.date,1))}`, `SUMMARY:${escapeICSText(title)}`, "END:VEVENT"); }
  lines.push("END:VCALENDAR");
  return lines.map(foldICSLine).join("\r\n")+"\r\n";
}
export function buildSingleEventICS(title:string, date:string): string { return buildICS([{id:stableUID(title+date), title, date, source:"manual"}]); }
export function buildCycleCalendarICS(
  periods: Array<{ id: number; startDate: string; endDate?: string | null }>,
  stats: { earliestNextDate?: string | null; latestNextDate?: string | null },
  events: CalendarEvent[],
  cycleTitle = "Private",
): string {
  const periodEvents: CalendarEvent[] = periods.map((p) => ({
    id: `p-${p.id}`,
    title: cycleTitle,
    date: p.startDate,
    endDate: p.endDate || p.startDate,
    source: "manual" as const,
    private: cycleTitle === "Private",
  }));
  const predicted: CalendarEvent[] =
    stats.earliestNextDate && stats.latestNextDate
      ? [
          {
            id: "pred-1",
            title: cycleTitle,
            date: stats.earliestNextDate,
            endDate: stats.latestNextDate,
            source: "manual" as const,
            private: cycleTitle === "Private",
          },
        ]
      : [];
  return buildICS([...periodEvents, ...predicted, ...events]);
}
function unfold(text:string): string[] { return text.replace(/\r\n[ \t]/g,"").replace(/\n[ \t]/g,"").split(/\r?\n/); }
function unescapeText(s:string): string { return s.replace(/\\n/gi,"\n").replace(/\\,/g,",").replace(/\\;/g,";").replace(/\\\\/g,"\\"); }
function parseICSDate(v:string, params:string): string|null {
  try {
    if (/^\d{8}$/.test(v)) return `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`;
    const m=v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/); if(!m) return null;
    if (m[7]==="Z" || /TZID=/i.test(params)) { const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])); return d.toISOString().slice(0,10); }
    return `${m[1]}-${m[2]}-${m[3]}`;
  } catch { return null; }
}
export interface ICSImportResult { events: CalendarEvent[]; warnings: string[]; }
export function parseICS(text:string, windowStart:string, windowEnd:string): ICSImportResult {
  const warnings:string[]=[]; const raw:any[]=[]; let cur:any=null;
  for (const line of unfold(text)){ if(line==="BEGIN:VEVENT") cur={}; else if(line==="END:VEVENT"){ if(cur) raw.push(cur); cur=null; } else if(cur){ const idx=line.indexOf(":"); if(idx<0) continue; const left=line.slice(0,idx), value=line.slice(idx+1); const [name,...params]=left.split(";"); cur[name.toUpperCase()]={value, params:params.join(";")}; } }
  if (!raw.length && !/BEGIN:VCALENDAR/i.test(text)) warnings.push("No calendar events found. The file may be malformed.");
  const events: CalendarEvent[]=[]; const seen=new Set<string>();
  for (const r of raw){
    const start = r.DTSTART ? parseICSDate(r.DTSTART.value, r.DTSTART.params) : null; if(!start){ warnings.push("Skipped an event with an unsupported or missing start date."); continue; }
    let end = r.DTEND ? parseICSDate(r.DTEND.value, r.DTEND.params) : null; if(end) end = addDays(end,-1); if(end && end<start) end=start;
    const title = r.SUMMARY ? unescapeText(r.SUMMARY.value) : "Untitled event"; const uid = r.UID?.value;
    const dates = expandRRULE(start, r.RRULE?.value, r.EXDATE, windowStart, windowEnd, warnings);
    for (const date of dates){ const key=`${uid||title}|${date}`; if(seen.has(key)) continue; seen.add(key); if(events.length>=2000){ warnings.push("Import capped at 2000 events."); break; } events.push({ id:`ics-${stableUID(key)}`, title, date, endDate: end && date===start ? end : undefined, source:"ics", uid }); }
  }
  const kept = events.filter((e)=>e.date>=windowStart && e.date<=windowEnd);
  const dropped = events.length - kept.length;
  if (dropped > 0) warnings.push(dropped + " imported event" + (dropped === 1 ? "" : "s") + " fell outside the import window (" + windowStart + " to " + windowEnd + ") and " + (dropped === 1 ? "was" : "were") + " not imported.");
  return { events: kept, warnings };
}
function expandRRULE(start:string, rrule:string|undefined, exdate:any, windowStart:string, windowEnd:string, warnings:string[]): string[] {
  const ex = new Set<string>(); if(exdate){ for(const part of String(exdate.value).split(",")){ const d=parseICSDate(part.trim(), exdate.params); if(d) ex.add(d); } }
  if(!rrule) return ex.has(start)?[]:[start];
  const parts:Record<string,string>={}; for(const kv of rrule.split(";")){ const [k,v]=kv.split("="); parts[k]=v; }
  const freq=parts.FREQ; if(!["DAILY","WEEKLY","MONTHLY","YEARLY"].includes(freq)){ warnings.push(`Skipped unsupported recurrence rule: ${rrule}`); return [start]; }
  const interval=parseInt(parts.INTERVAL||"1",10)||1; const count=parts.COUNT?parseInt(parts.COUNT,10):Infinity; const until=parts.UNTIL?parseICSDate(parts.UNTIL,""):windowEnd;
  const out:string[]=[]; let cur=start; let n=0;
  // Group 16.6: WEEKLY;BYDAY=MO,WE,FR expands to every listed weekday, not only the start weekday.
  const unsupportedBy = Object.keys(parts).filter((k) => k.startsWith("BY") && !(freq==="WEEKLY" && k==="BYDAY"));
  if (unsupportedBy.length) warnings.push(`Recurrence ${unsupportedBy.join(", ")} is not supported; only the start date's pattern was imported for: ${rrule}`);
  if (freq==="WEEKLY" && parts.BYDAY) {
    const map:Record<string,number>={SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6};
    const want = parts.BYDAY.split(",").map((d)=>d.trim().replace(/^[+-]?\d+/,"").toUpperCase()).filter((d)=>d in map).map((d)=>map[d]).sort((a,b)=>a-b);
    if (want.length === 0) { warnings.push(`Could not read BYDAY in: ${rrule}; imported the start date only.`); return ex.has(start)?[]:[start]; }
    const dow = (k:string)=> new Date(k+"T00:00:00Z").getUTCDay();
    let weekStart = addDays(start, -dow(start));
    let week = 0;
    outer: while (weekStart <= windowEnd && out.length < 2000 && week < 2000) {
      for (const wd of want) {
        const d = addDays(weekStart, wd);
        if (d < start) continue;
        if ((until && d > until) || d > windowEnd || n >= count) break outer;
        n++;
        if (d >= windowStart && !ex.has(d)) out.push(d);
      }
      week++; weekStart = addDays(weekStart, 7*interval);
    }
    return out;
  }
  if (freq==="DAILY" || freq==="WEEKLY") {
    while(cur<=windowEnd && n<count && out.length<2000){ if(cur>=windowStart && !ex.has(cur)) out.push(cur); n++; if(freq==="DAILY") cur=addDays(cur,interval); else cur=addDays(cur,7*interval); if(until && cur>until) break; }
    return out;
  }
  // MONTHLY / YEARLY step calendar months from the start date. Months
  // without the start day-of-month are skipped per RFC 5545 (never rolled
  // over into the next month) and do not count toward COUNT.
  const startDay = +start.slice(8,10);
  const daysIn = (y:number, m:number):number => new Date(Date.UTC(y, m, 0)).getUTCDate();
  let step = 0; let guard = 0;
  while(n<count && out.length<2000 && guard<2400){
    guard++;
    const total = step*interval;
    const y0=+start.slice(0,4), m0=+start.slice(5,7);
    const nm = (m0-1) + (freq==="MONTHLY" ? total : total*12);
    const yy = y0 + Math.floor(nm/12);
    const mm = ((nm%12)+12)%12 + 1;
    step++;
    if(startDay > daysIn(yy,mm)) continue;
    const cand = yy + "-" + String(mm).padStart(2,"0") + "-" + String(startDay).padStart(2,"0");
    if(until && cand>until) break;
    if(cand>windowEnd) break;
    if(cand>=windowStart && !ex.has(cand)) out.push(cand);
    n++;
  }
  return out;
}
