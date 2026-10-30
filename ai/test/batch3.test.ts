
import { LANDMARKS } from "../backend/landmarks";
import { resolveLandmarkExpression } from "../backend/dateArithmetic";
import { toStatsView } from "../../client/src/lib/statsView";
let passed=0, failed=0; function check(name:string, cond:boolean, extra=""){ if(cond){console.log(`[PASS] ${name}`); passed++;} else {console.error(`[FAIL] ${name} ${extra}`); failed++;} }
async function main(){
  // 3.5 landmarks: verified packs only, no invented seasonal items
  check("global pack has 6 verified landmarks", LANDMARKS.filter(l=>l.pack==="global").length===6);
  check("india pack includes Diwali/Onam/Vishu only (unverified omitted)", LANDMARKS.filter(l=>l.pack==="india").map(l=>l.id).sort().join(",")==="diwali,onam,vishu", LANDMARKS.filter(l=>l.pack==="india").map(l=>l.id).join(","));
  check("no invented seasonal landmarks", !LANDMARKS.some(l=>/solstice|equinox|marathon|vacation|getaway/i.test(l.names.en)));
  check("every landmark has source and verifiedOn", LANDMARKS.every(l=>l.source.startsWith("http") && !!l.verifiedOn));
  check("Diwali 2025 verified date", LANDMARKS.find(l=>l.id==="diwali")?.dates["2025"]==="2025-10-20");
  check("resolver still resolves Diwali", resolveLandmarkExpression("last Diwali","2026-10-28").baseDate==="2025-10-20" || resolveLandmarkExpression("Diwali","2026-10-28").found);
  check("resolver still resolves Women's Day", resolveLandmarkExpression("International Women's Day","2026-10-28").found);
  // 3.2 stats view: real data only, no scores
  const empty = toStatsView({ completedCycleCount:0, medianCycleLength:null, shortestCycle:null, longestCycle:null, allCycleLengths:[], averageBleedingDuration:null } as any);
  check("stats empty state flagged", empty.hasEnoughData===false && empty.completedCycles===0);
  const real = toStatsView({ completedCycleCount:3, medianCycleLength:30, shortestCycle:26, longestCycle:38, allCycleLengths:[26,30,38], averageBleedingDuration:5 } as any);
  check("stats real median/min/max", real.median===30 && real.min===26 && real.max===38 && real.last12Lengths.length===3);
  check("stats view has no score field", !("score" in real) && !("regularityScore" in real));
  // 3.1 transcription: failing fetch must return error, never a fabricated transcript
  const originalFetch = globalThis.fetch; const originalKey = process.env.META_API_KEY;
  process.env.META_API_KEY="test-key";
  (globalThis as any).fetch = async () => { throw new Error("network down"); };
  (globalThis as any).FileReader = class { onloadend:any=null; onerror:any=null; result="data:audio/webm;base64,eA=="; readAsDataURL(){ this.onloadend?.(); } };
  try {
    const mod = await import("../frontend/aiClient");
    const fn:any = (mod as any).transcribeAudio || (mod as any).transcribeAudioBlob || (mod as any).default;
    check("aiClient exports a transcription function", typeof fn==="function", Object.keys(mod).join(","));
    if (typeof fn==="function"){ const res:any = await fn(new Blob(["x"],{type:"audio/webm"})); check("transcription failure returns error, no transcript", !!res?.error && !(res?.text||res?.transcript), JSON.stringify(res)); check("no fabricated fallback text", !JSON.stringify(res).includes("Period started today")); }
  } catch(e:any){ check("transcription module loads", false, e?.message||String(e)); }
  (globalThis as any).fetch = originalFetch; if(originalKey===undefined) delete process.env.META_API_KEY; else process.env.META_API_KEY=originalKey;
  console.log(`\nBatch3 Results: ${passed} passed, ${failed} failed.`); if(failed) process.exit(1);
}
main().catch(e=>{console.error(e); process.exit(1);});
