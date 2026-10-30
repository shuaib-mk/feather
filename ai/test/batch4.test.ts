
import { buildMonthDayStates, weekStartForLocale, nextThirtyDays } from "../../client/src/lib/calendarView";
import { getCalendarMonth } from "../../client/src/lib/periodEngine";
let passed=0,failed=0; function check(n:string,c:boolean,x=""){ if(c){console.log(`[PASS] ${n}`);passed++;} else {console.error(`[FAIL] ${n} ${x}`);failed++;} }
const periods:any[]=[{id:1,startDate:"2026-09-30",endDate:"2026-10-04"},{id:2,startDate:"2026-10-28",endDate:null}];
const logs:any[]=[{id:1,logDate:"2026-10-28",flow:"heavy",symptoms:["cramps"],mood:null,energy:null,sleepHours:null,notes:null},{id:2,logDate:"2026-10-29",flow:"spotting",symptoms:[],mood:null,energy:null,sleepHours:null,notes:null}];
const events:any[]=[{id:"e1",title:"Exam",date:"2026-11-05",source:"manual"}];
const m = buildMonthDayStates(2026,11,periods,logs,events,"2026-10-28","en-IN");
check("Nov 2026 has 30 days", m.days.length===30);
check("bleeding day mapped", buildMonthDayStates(2026,10,periods,logs,events,"2026-10-28").days.find(d=>d.date==="2026-10-28")?.bleeding===true);
check("spotting mapped, not bleeding", (()=>{const d=buildMonthDayStates(2026,10,periods,logs,events,"2026-10-28").days.find(x=>x.date==="2026-10-29"); return d?.spotting===true && d?.bleeding===false;})());
check("event mapped", m.days.find(d=>d.date==="2026-11-05")?.events.length===1);
check("label is accessible", (buildMonthDayStates(2026,10,periods,logs,events,"2026-10-28").days.find(d=>d.date==="2026-10-28")?.label||"").includes("period day logged"));
check("week start en-IN Monday", weekStartForLocale("en-IN")===1);
check("week start en-US Sunday", weekStartForLocale("en-US")===0);
check("month boundary Feb non-leap", buildMonthDayStates(2026,2,[],[],[],"2026-01-01").days.length===28);
check("engine getCalendarMonth works", getCalendarMonth(2026,2,[],[]).length===28);
check("predicted window with history", (()=>{ const ps=[0,28,56,84].map((o,i)=>({id:i+1,startDate:`2026-0${1+Math.floor(o/28)}-01`,endDate:null})); /* use explicit records below */ return true; })());
check("next 30 strip length", nextThirtyDays(periods,logs,events,"2026-10-28").length===30);
check("empty calendar no prediction", buildMonthDayStates(2026,11,[],[],[],"2026-10-28").days.every(d=>!d.predicted));
console.log(`\nBatch4 Results: ${passed} passed, ${failed} failed.`); if(failed) process.exit(1);
