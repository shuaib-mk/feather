
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
  check("passed plan date asks this-year vs next-year (A3)", past.needsClarification===true && /2026-11-20/.test(past.clarificationQuestion||past.message||"") && /2027-11-20/.test(past.clarificationQuestion||past.message||"") && !past.entry && !(past.plannedEvents?.length));
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

  // A1: mixed log + plan in one sentence keeps both
  const mixed:any=await runLavenderAgent("I have an exam on 2026-11-20 and my period started 3 days ago", CTX);
  check("A1 mixed returns period_started log 3 days ago", mixed.entry?.kind==="period_started" && mixed.entry?.date==="2026-10-25");
  check("A1 mixed keeps plannedEvents", JSON.stringify(mixed.plannedEvents)===JSON.stringify([{title:"exam",date:"2026-11-20"}]));
  // A2: explicit-year plan phrases in both orders
  const a2a:any=await runLavenderAgent("trip on 15th December 2027", CTX);
  check("A2 D Month YYYY plan", a2a.plannedEvents?.[0]?.date==="2027-12-15" && !a2a.entry && !a2a.needsClarification);
  const a2b:any=await runLavenderAgent("trip on December 15th 2027", CTX);
  check("A2 Month D YYYY plan", a2b.plannedEvents?.[0]?.date==="2027-12-15" && !a2b.entry);
  // A3: date already passed this year asks; future date this year does not
  const a3:any=await runLavenderAgent("exam on Oct 3", { currentDate:"2026-10-30" } as any);
  check("A3 passed-this-year asks", a3.needsClarification===true && /2026-10-03/.test(a3.clarificationQuestion||"") && /2027-10-03/.test(a3.clarificationQuestion||"") && !a3.entry);
  const a3f:any=await runLavenderAgent("exam on Nov 20", { currentDate:"2026-10-30" } as any);
  check("A3 future plan date unchanged", a3f.plannedEvents?.[0]?.date==="2026-11-20" && !a3f.needsClarification);
  // A4: api-src handlers never forward upstream error detail to the client
  const { readFileSync } = await import("node:fs"); const { join } = await import("node:path");
  for(const f of ["api-src/transcribe.ts","api-src/agent.ts","api-src/vision.ts"]){
    const src=readFileSync(join(process.cwd(),f),"utf8");
    check(`A4 ${f} does not forward err.message`, !src.includes("error: err.message") && !src.includes("error: err?.message"));
    check(`A4 ${f} logs detail server-side`, src.includes("console.error"));
  }
  const transcribeSrc=readFileSync(join(process.cwd(),"api-src/transcribe.ts"),"utf8");
  check("A4 transcribe generic client message", transcribeSrc.includes("Couldn't hear that — try again or type it"));

  console.log(`ParserFixes: ${passed} passed, ${failed} failed`);
  if(failures.length) console.log(failures.join("\n"));
  if(failed) process.exit(1);
}
main().catch((e)=>{ console.error(e); process.exit(1); });
