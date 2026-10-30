
// Audio transcription check. Record 5 clips per language into ai/eval/audio/<lang>/clip1.wav ... clip5.wav
// Run with META_API_KEY set: npx tsx ai/eval/run-audio-test.ts  — prints transcripts for manual pass/fail. Never fabricates results.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { transcribeAudio } from "../backend/transcribe";
async function main(){
  const base=new URL("./audio/", import.meta.url).pathname;
  if(!existsSync(base)){ console.log("Not measured: create ai/eval/audio/<lang>/ with 5 recorded clips per language first."); return; }
  for(const lang of readdirSync(base)){ const dir=join(base,lang); for(const f of readdirSync(dir)){ const r=await transcribeAudio(readFileSync(join(dir,f)),"audio/wav",lang); console.log(`[${lang}] ${f}: "${r.text}" ${r.error?`ERROR ${r.error}`:""}  (manual pass/fail: ____)`); } }
}
main().catch(console.error);
