
import { runLavenderAgent } from "../backend/agent";
import { resolveDateExpression } from "../backend/dateArithmetic";
let passed=0, failed=0; const failures:string[]=[];
function check(n:string,c:boolean){ if(c) passed++; else {failed++; failures.push(n); console.log("FAIL:",n);} }
const CTX={ currentDate:"2026-10-28" } as any;
async function main(){
  // 1. Day-first plan phrases must not throw and must produce planned events
  for(const [phrase,date] of [["exam on 3rd November","2026-11-03"],["wedding on 3rd November","2026-11-03"],["exam on 20 November","2026-11-20"]] as const){
    let threw=false; let res:any=null;
    try { res=await runLavenderAgent(phrase, CTX); } catch { threw=true; }
    check(`${phrase} does not throw`, !threw);
    check(`${phrase} -> ${date}`, res?.plannedEvents?.[0]?.date===date);
    check(`${phrase} -> no log entry`, !res?.entry);
  }
  // 2. Possessive title, next occurrence, no log entry
  const anu:any=await runLavenderAgent("Anu's wedding is on Nov 20", CTX);
  check("Anu's wedding plannedEvents", JSON.stringify(anu.plannedEvents)==JSON.stringify([{title:"Anu's wedding",date:"2026-11-20"}]));
  check("Anu's wedding no log entry", !anu.entry);
  const past:any=await runLavenderAgent("exam on Nov 20", { currentDate:"2026-12-01" } as any);
  check("plan resolves next occurrence, never past", past.plannedEvents?.[0]?.date==="2027-11-20");
  // 3. Dinner is a plan event
  const dinner:any=await runLavenderAgent("dinner on Nov 3", CTX);
  check("dinner on Nov 3 is a plan event", dinner.plannedEvents?.[0]?.date==="2026-11-03" && !dinner.entry);
  // Bad plan date asks, never throws
  let badThrew=false; let bad:any=null; try { bad=await runLavenderAgent("exam on Feb 30", CTX); } catch { badThrew=true; }
  check("bad plan date -> clarification, not throw", !badThrew && bad?.needsClarification===true && !bad?.entry);
  // 4. Log mode: bare month-day > 6 months past asks instead of high-confidence old date
  const old = resolveDateExpression("period started on 3rd January", "2026-10-28");
  check("bare month-day >6mo past needsClarification", old.needsClarification===true && old.date===null && old.confidence!=="high");
  const rolled = resolveDateExpression("period started on 3rd November", "2026-10-28");
  check("rolled-back 11-month date needsClarification", rolled.needsClarification===true && rolled.date===null);
  const recent = resolveDateExpression("period started on 15 August", "2026-10-28");
  check("recent bare month-day still resolves", recent.date==="2026-08-15" && !recent.needsClarification);
  const viaAgent:any=await runLavenderAgent("period started on 3rd January, heavy flow", CTX);
  check("agent log with old bare date asks, no entry", viaAgent.needsClarification===true && !viaAgent.entry);
  console.log(`ParserFixes: ${passed} passed, ${failed} failed`);
  if(failures.length) console.log(failures.join("\n"));
  if(failed) process.exit(1);
}
main().catch((e)=>{ console.error(e); process.exit(1); });
