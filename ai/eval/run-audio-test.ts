
// Audio transcription check. Record 5 clips per language into ai/eval/audio/<lang>/clip1.wav ... clip5.wav
// Run with META_API_KEY set: npx tsx ai/eval/run-audio-test.ts  — prints transcripts for manual pass/fail. Never fabricates results.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { transcribeAudio } from "../backend/transcribe";
async function main(){
  const MAX_CALLS = Math.max(1, parseInt(process.env.AUDIO_EVAL_MAX_CALLS || "25", 10) || 25);
  let callsMade = 0;
  const base=new URL("./audio/", import.meta.url).pathname;
  if(!existsSync(base)){ console.log("Not measured: create ai/eval/audio/<lang>/ with 5 recorded clips per language first."); return; }
  outer: for(const lang of readdirSync(base)){ const dir=join(base,lang); for(const f of readdirSync(dir)){ if(callsMade >= MAX_CALLS) break outer; callsMade++; try { const r=await transcribeAudio(readFileSync(join(dir,f)),"audio/wav",lang); console.log(`[${lang}] ${f}: "${r.text}" ${r.error?`ERROR ${r.error}`:""}  (manual pass/fail: ____)`); } catch (e:any) { console.log(`[${lang}] ${f}: ERROR ${e?.message || e}`); console.log("Stopping after first API failure (no retries, to protect credits)."); break outer; } } }
  console.log(`API calls made: ${callsMade} (cap ${MAX_CALLS})`);
}
main().catch(console.error);
