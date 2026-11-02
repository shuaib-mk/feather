/** Q6.6: negations never store, ask before touching today's note. */
import { parseLocally } from "../backend/agent";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const TODAY = "2026-11-01";
const mk = (date: string, symptoms: string[]) => ({ date, flow: null, symptoms, mood: null, energy: null, sleep: null, notes: "x", landmarkName: null, isApproximate: false, kind: "daily_log" });
{
  const r = parseLocally("no cramps today", TODAY, { recentEntry: mk(TODAY, ["cramps"]) } as any);
  check("Q6.6: on-note symptom asks first", r.entry === null && r.message === "Remove cramps from today''s note?".replace("''", "'"), r.message);
  const r2 = parseLocally("no cramps today", TODAY, { recentEntry: mk(TODAY, []) } as any);
  check("Q6.6: absent symptom is noted, nothing to log", r2.entry === null && r2.message === "Noted, nothing to log.", r2.message);
  const r3 = parseLocally("no headache today", TODAY, { recentEntry: mk(TODAY, ["headache", "fatigue"]) } as any);
  check("Q6.6: headache on note asks", r3.entry === null && r3.message === "Remove headache from today''s note?".replace("''", "'"), r3.message);
  const r4 = parseLocally("no breast tenderness today", TODAY, { recentEntries: [mk(TODAY, ["breast_tenderness"])] } as any);
  check("Q6.6: multiword symptom asks", r4.entry === null && r4.message === "Remove breast tenderness from today".concat(String.fromCharCode(39), "s note?"), r4.message);
  const r5 = parseLocally("no cramps today", TODAY, {} as any);
  check("Q6.6: no note, nothing to log", r5.entry === null && r5.message === "Noted, nothing to log.", r5.message);
  const r6 = parseLocally("not heavy today, just spotting", TODAY, { recentEntry: mk(TODAY, ["cramps"]) } as any);
  check("Q6.6: positive content still logs", !!r6.entry && (r6.entry as any).flow === "spotting", JSON.stringify((r6.entry as any) || null));
}
console.log("Q6 Negation Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
