
import { addDays } from "./periodEngine";
import { todayLocal } from "./localDate";
import type { Period, DayLog } from "../cycleStorage";
export const DEMO_KEY = "feather_demo_v1"; export const DEMO_ACTIVE_KEY = "feather_demo_active";
export function buildDemoData(today = todayLocal()): { periods: Period[]; logs: DayLog[]; events: any[] } {
  const lengths=[38,26,33,29,36,28,31]; const starts:string[]=[]; let cursor = addDays(today,-221);
  for(const len of lengths){ starts.push(cursor); cursor = addDays(cursor, len); }
  const periods = starts.map((s,i)=>({ id: 9000+i, startDate:s, endDate:addDays(s,4), isApproximate:false }));
  const logs: DayLog[] = []; let id=9000;
  for(const s of starts){ logs.push({id:id++, logDate:s, flow:"heavy", symptoms:["cramps"], mood:"Okay", energy:3, sleepHours:7, notes:"Demo log (fictional)"}); logs.push({id:id++, logDate:addDays(s,1), flow:"medium", symptoms:["fatigue"], mood:null, energy:null, sleepHours:null, notes:null}); }
  const events=[{id:"demo-event-1", title:"Demo exam (fictional)", date:addDays(today,20), source:"manual"},{id:"demo-event-2", title:"Demo trip (fictional)", date:addDays(today,45), source:"manual"}];
  return { periods, logs, events };
}
export function isDemoActive(): boolean { try { return localStorage.getItem(DEMO_ACTIVE_KEY)==="1"; } catch { return false; } }
export function enterDemoMode(): void { try { if(!localStorage.getItem(DEMO_KEY)) localStorage.setItem(DEMO_KEY, JSON.stringify(buildDemoData())); localStorage.setItem(DEMO_ACTIVE_KEY,"1"); } catch {} }
export function exitDemoMode(): void { try { localStorage.removeItem(DEMO_ACTIVE_KEY); } catch {} }
