
import { buildICS, parseICS, stableUID } from "../../client/src/lib/ics";
import { fuzzyMatchEvents, type CalendarEvent } from "../../client/src/lib/events";
let passed=0,failed=0; function check(n:string,c:boolean,x=""){ if(c){console.log(`[PASS] ${n}`);passed++;} else {console.error(`[FAIL] ${n} ${x}`);failed++;} }
const ics = buildICS([{id:"1",title:"Private, test; x",date:"2026-11-05",source:"manual"}], {dtstamp:"20260101T000000Z"});
check("CRLF endings", ics.includes("\r\n") && !/[^\r]\n/.test(ics));
check("exclusive DTEND next day", ics.includes("DTEND;VALUE=DATE:20261106"));
check("escaping commas/semicolons", ics.includes("Private\\, test\\; x"));
check("stable UID", stableUID("a|2026-01-01")===stableUID("a|2026-01-01"));
check("folding at 75 octets", ics.split("\r\n").every(l=>new TextEncoder().encode(l).length<=75));
const long = buildICS([{id:"2",title:"x".repeat(120),date:"2026-11-05",source:"manual"}]);
check("long lines folded", long.split("\r\n").every(l=>new TextEncoder().encode(l).length<=75) && long.includes("\r\n "));
const sample = ["BEGIN:VCALENDAR","VERSION:2.0","BEGIN:VEVENT","UID:u1","SUMMARY:Exam","DTSTART;VALUE=DATE:20261105","DTEND;VALUE=DATE:20261106","END:VEVENT","BEGIN:VEVENT","UID:u2","SUMMARY:Weekly","DTSTART:20261102T100000Z","RRULE:FREQ=WEEKLY;COUNT=3","EXDATE:20261109T100000Z","END:VEVENT","END:VCALENDAR"].join("\r\n");
const parsed = parseICS(sample,"2025-01-01","2027-12-31");
check("import all-day", parsed.events.some(e=>e.title==="Exam" && e.date==="2026-11-05"), JSON.stringify(parsed));
check("RRULE COUNT + EXDATE (3-1=2)", parsed.events.filter(e=>e.title==="Weekly").length===2, JSON.stringify(parsed.events));
check("malformed warns", parseICS("not a calendar","2025-01-01","2027-01-01").warnings.length>0);
const timed = parseICS("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:t1\r\nSUMMARY:TZ\r\nDTSTART;TZID=Asia/Kolkata:20261105T100000\r\nEND:VEVENT\r\nEND:VCALENDAR","2025-01-01","2027-01-01");
check("TZID event parsed", timed.events.length===1);
const evts:CalendarEvent[]=[{id:"1",title:"Anu's wedding",date:"2026-12-01",source:"manual"},{id:"2",title:"Dentist",date:"2026-11-01",source:"manual"}];
check("fuzzy match personal event", fuzzyMatchEvents("the week of Anu's wedding", evts)[0]?.title==="Anu's wedding");
check("fuzzy no match returns none", fuzzyMatchEvents("exam results day", evts).length===0 || fuzzyMatchEvents("zzzz qqqq", evts).length===0);
console.log(`\nBatch5 Results: ${passed} passed, ${failed} failed.`); if(failed) process.exit(1);
