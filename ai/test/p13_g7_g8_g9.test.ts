// Prompt 13 Groups 7-9: multi-intent turns, deterministic own-data answers, one prediction window.
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
import { parseLocally, runLavenderAgent, extractWithLexicon } from "../backend/agent";
import { buildOwnDataAnswer } from "../backend/ownDataAnswer";
import { getPrediction, getCycleStatistics, evaluateEventOverlap } from "../../client/src/lib/periodEngine";
import { buildMonthDayStates, toEngineRecords } from "../../client/src/lib/calendarView";
import { computeCycleStats } from "../../client/src/cycleStorage";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const T = "2026-11-04";
const periods: any[] = [
  { id: 1, startDate: "2026-08-05", endDate: "2026-08-09" }, { id: 2, startDate: "2026-09-03", endDate: "2026-09-07" },
  { id: 3, startDate: "2026-10-02", endDate: "2026-10-06" }, { id: 4, startDate: "2026-11-01", endDate: "2026-11-04" },
];
const logs: any[] = [
  { logDate: "2026-10-02", flow: "heavy", symptoms: ["cramps", "headache"] }, { logDate: "2026-10-03", flow: "medium", symptoms: ["cramps"] },
  { logDate: "2026-09-03", flow: "heavy", symptoms: ["headache"] },
];
const ctx: any = { periods, logs, currentDate: T };

async function main() {
  // ---------- Group 7 ----------
  const a: any = parseLocally("Log yesterday's heavy flow and tell me when my next period is expected", T, ctx);
  check("G7: log + prediction -> slip AND answer", a.entry?.date === "2026-11-03" && a.entry?.flow === "heavy" && /estimated window/.test(a.message), a);
  const b: any = parseLocally("log cramps today and tell me my average cycle length", T, ctx);
  check("G7: log + statistics -> slip AND answer", b.entry?.symptoms.includes("cramps") && /median \d+ days/.test(b.message), b.message);
  const c: any = parseLocally("I have headaches and cramps. Have I experienced this before?", T, ctx);
  check("G7: 'headaches' (plural) is caught", c.entry?.symptoms.includes("headache") && c.entry?.symptoms.includes("cramps"), c.entry);
  check("G7: the history question is answered from logs", /cramps on Oct 3, Oct 2/.test(c.message) && /headache on Oct 2, Sep 3/.test(c.message), c.message);
  const d: any = parseLocally("log cramps today and I have an exam on Nov 20", T, ctx);
  check("G7: log + plan combination keeps both", d.entry?.symptoms.includes("cramps") && (d.plannedEvents || []).some((e: any) => e.date === "2026-11-20"), d);
  const pend: any = { date: T, flow: "light", symptoms: [], mood: null, energy: null, sleep: null, notes: null, kind: "period_started", slipId: "s1" };
  const e: any = parseLocally("when is my next period? also make it heavy", T, { ...ctx, pendingEntry: pend });
  check("G7: question + correction -> correction applied AND question answered", e.entry?.flow === "heavy" && e.entry?.slipId === "s1" && /estimated window/.test(e.message), e);
  const f: any = parseLocally("when is my next period? also make it heavy", T, ctx);
  check("G7: a part that can't be handled is disclosed, never silently dropped", !f.entry && /estimated window/.test(f.message) && /couldn't prepare the log part/.test(f.message), f.message);
  check("G7: plurals in the lexicon", JSON.stringify(extractWithLexicon("backaches and headaches").symptoms.sort()) === JSON.stringify(["backache", "headache"]));
  process.env.META_API_KEY = "k";
  const orig = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { role: "assistant", content: "Your next period is around Dec 1." } }] }) }; }) as any;
  try {
    const lv: any = await runLavenderAgent("Log yesterday's heavy flow and tell me when my next period is expected", { ...ctx });
    check("G7: live path keeps both halves too", lv.entry?.flow === "heavy" && /estimated window/.test(lv.message) && calls === 0, { calls, m: lv.message });
  } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }

  // ---------- Group 8 ----------
  const own = (q: string, c: any = ctx) => buildOwnDataAnswer(q, c)?.message || "";
  check("G8: last cycle length (Oct 2 -> Nov 1 = 30 days)", /last completed cycle was 30 days \(Oct 2 to Nov 1\)/.test(own("how long was my last cycle?")), own("how long was my last cycle?"));
  const w = getPrediction(toEngineRecords(periods), T);
  const du = own("how many days until my next period?");
  const d1 = Math.round((Date.parse(w.earliestStart!) - Date.parse(T)) / 86400000), d2 = Math.round((Date.parse(w.latestStart!) - Date.parse(T)) / 86400000);
  check("G8: days until next period matches the stated window", du.includes(`About ${d1} to ${d2} days`), { du, w });
  check("G8: 'Is that date guaranteed?' -> estimate disclaimer", /not a guarantee/.test(own("Is that date guaranteed?")) && /Estimates based on your logged cycles/.test(own("Is that date guaranteed?")));
  check("G8: 'how accurate is that?' answered deterministically", /not a guarantee/.test(own("how accurate is that?")));
  check("G8: symptom history in last cycle (yes)", /cramps on Oct 3, Oct 2/.test(own("did I have cramps last cycle?")), own("did I have cramps last cycle?"));
  check("G8: symptom history in last cycle (honest no record)", /no record of nausea in your last cycle/.test(own("did I have nausea last cycle?")), own("did I have nausea last cycle?"));
  const empty: any = { periods: [], logs: [], currentDate: T };
  for (const q of ["how long was my last cycle?", "how many days until my next period?", "Is that date guaranteed?", "did I have cramps last cycle?"]) {
    const r: any = parseLocally(q, T, empty);
    check(`G8: empty vault, '${q}' -> honest answer, never the log fallback`, !r.entry && !/didn't catch anything/i.test(r.message) && r.message.length > 10, r.message);
  }
  const offline: any = parseLocally("Is that date guaranteed?", T, ctx);
  check("G8: offline path answers 'Is that date guaranteed?' (no generic fallback)", /not a guarantee/.test(offline.message), offline.message);

  // ---------- Group 9 ----------
  // Vault with anomalous cycles (12 d and 95 d) where old code disagreed.
  const anom: any[] = ["2026-01-01", "2026-04-06", "2026-04-18", "2026-05-17", "2026-06-15", "2026-07-15", "2026-08-13", "2026-09-12", "2026-10-11"].map((s, i) => ({ id: i + 1, startDate: s, endDate: null }));
  const today9 = "2026-10-20";
  const recs = toEngineRecords(anom);
  const pred = getPrediction(recs, today9);
  const stats = getCycleStatistics(recs);
  check("G9: anomalous cycles are excluded from the summary median (single eligibility rule)", stats.excludedForEstimationCount === 2 && stats.medianCycleLength === pred.cycleLengthDays, { stats: [stats.medianCycleLength, stats.excludedForEstimationCount], pred: pred.cycleLengthDays });
  const ov = evaluateEventOverlap(pred.expectedStart!, recs, today9);
  check("G9: Plan's cycle-1 window starts exactly at the predicted window start", ov.window?.start === pred.earliestStart && ov.expectedStart === pred.expectedStart, { ov: ov.window, pred: [pred.earliestStart, pred.latestStart] });
  check("G9: Plan labels its window as the wider per-event window", /wider window for this event/.test(evaluateEventOverlap("2027-03-01", recs, today9).note), evaluateEventOverlap("2027-03-01", recs, today9).note);
  const ownW = buildOwnDataAnswer("when is my next period", { periods: anom, currentDate: today9 } as any)!.message;
  const lbl = (k: string) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+k.slice(5, 7) - 1] + " " + +k.slice(8, 10);
  check("G9: voice answer (no client stats) states the same base window", ownW.includes(`between ${lbl(pred.earliestStart!)} and ${lbl(pred.latestStart!)}`), { ownW, pred: [pred.earliestStart, pred.latestStart] });
  const month = buildMonthDayStates(+pred.earliestStart!.slice(0, 4), +pred.earliestStart!.slice(5, 7), anom, [], [], today9);
  const shaded = month.days.filter((d) => d.predicted).map((d) => d.date);
  check("G9: Calendar shading starts at the same base window start", shaded[0] === pred.earliestStart, { shaded: shaded.slice(0, 2), pred: pred.earliestStart });
  const cs = computeCycleStats(anom as any, []);
  check("G9: Dashboard cycle-length tile uses the prediction engine's median", cs.medianCycleLength === pred.cycleLengthDays, { median: cs.medianCycleLength, predLen: pred.cycleLengthDays });
}

main().then(() => { console.log(`\nP13 Groups 7-9: ${passed} passed, ${failed} failed.`); process.exit(failed > 0 ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
