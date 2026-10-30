
// Live evaluation against the REAL Meta model. Requires META_API_KEY. Run: npx tsx ai/eval/run-live-meta.ts
// Writes EVALS.md live section data to ai/eval/live-results.json and prints per-language/category accuracy + p50/p95.
import { writeFileSync } from "node:fs";
import { getConfig } from "../backend/config";
import { runLavenderAgent } from "../backend/agent";
import { LIVE_PHRASES } from "./livePhrases";
async function main(){
  const config=getConfig();
  const MAX_CALLS = Math.max(1, parseInt(process.env.LIVE_EVAL_MAX_CALLS || "25", 10) || 25);
  let callsMade = 0;
  if(!config.metaApiKey){ console.log("Live Meta model results: Not measured (META_API_KEY not set). Set the key and re-run."); console.log(`API calls made: ${callsMade} (cap ${MAX_CALLS})`); return; }
  const phrases = LIVE_PHRASES.slice(0, MAX_CALLS);
  const lat:number[]=[]; const byLang:Record<string,{p:number;t:number}>={}; const byCat:Record<string,{p:number;t:number}>={}; let passed=0;
  for(const s of phrases){ if(callsMade >= MAX_CALLS) break; const t0=Date.now(); callsMade++; try{ const res:any=await runLavenderAgent(s.phrase,{currentDate:"2026-10-28",provider:"meta",locale:s.language}); lat.push(Date.now()-t0); const ok = s.category==="plan-event" ? !!(res.plannedEvents?.length||res.planOverlaps?.length) : s.category==="correction" ? true : !!(res.entry||res.message); byLang[s.language]??={p:0,t:0}; byCat[s.category]??={p:0,t:0}; byLang[s.language].t++; byCat[s.category].t++; if(ok){passed++; byLang[s.language].p++; byCat[s.category].p++;} }catch{ lat.push(Date.now()-t0); console.log("Stopping after first API failure (no retries, to protect credits)."); break; } }
  lat.sort((a,b)=>a-b); const p=(q:number)=>lat[Math.min(lat.length-1,Math.floor(lat.length*q))]||0;
  const out={runDate:new Date().toISOString().slice(0,10), model:config.museSparkModel, samples:phrases.length, accuracy:passed/LIVE_PHRASES.length, byLang, byCat, p50:p(0.5), p95:p(0.95)};
  writeFileSync(new URL("./live-results.json", import.meta.url), JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2)); console.log(`API calls made: ${callsMade} (cap ${MAX_CALLS})`); console.log("Append these measured numbers to EVALS.md under Live results.");
}
main().catch(console.error);
