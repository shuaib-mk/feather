// Prompt 13 Group 12: offline corpus regressions and the faint+backfill path.
import fs from "node:fs";
import { parseLocally, runLavenderAgent } from "../backend/agent";
import { MEDICAL_REFUSAL_MESSAGE } from "../backend/guardrail";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const T = "2026-11-04";
const REFUSAL = "I can only help with logging and planning. For health questions, please talk to a doctor.";

async function main() {
  // 12.1 faint + period start
  const f: any = parseLocally("I fainted yesterday and my period started today", T, {});
  check("G12.1: escalation first", /^Important safety notice/.test(f.message), f.message);
  check("G12.1: at most one period start, and it is today", (f.entries || []).length <= 1 && f.entry?.date === T && f.entry?.kind === "period_started", { e: f.entry, n: f.entries });

  // 12.2 explicit days win over 'which day'
  const a: any = parseLocally("I got my period on October 20", T, {});
  check("G12.2: 'I got my period on October 20' -> Oct 20, no 'which day'", a.entry?.date === "2026-10-20" && !a.needsClarification, a.message);
  const b: any = parseLocally("period started Oct 2 and it ended Oct 6", T, {});
  check("G12.2: 'started Oct 2 and it ended Oct 6' -> one period Oct 2..Oct 6", b.entry?.date === "2026-10-02" && b.entry?.endDate === "2026-10-06" && (b.entries || []).length === 1 && !b.needsClarification, { e: b.entry, n: b.entries });
  const c: any = parseLocally("my periods started October 2 and September 5", T, {});
  check("G12.2: two fully dated periods -> both, no 'which day'", (c.entries || []).map((e: any) => e.date).join() === "2026-09-05,2026-10-02" && !c.needsClarification, c.entries);

  // 12.3 bleeding ranges never become events
  const d: any = parseLocally("I bled from October 2 to October 6", T, {});
  check("G12.3: 'I bled from October 2 to October 6' -> period range, no event", d.entry?.date === "2026-10-02" && d.entry?.endDate === "2026-10-06" && (d.plannedEvents || []).length === 0, { e: d.entry, ev: d.plannedEvents });
  const ev: any = parseLocally("I have a trip from December 2 to December 6", T, {});
  check("G12.3: a real event range still becomes an event", (ev.plannedEvents || []).some((x: any) => x.date === "2026-12-02" && x.endDate === "2026-12-06"), ev.plannedEvents);

  // 12.4 severe + refusal-shaped
  for (const t of ["I fainted and want to know what medicine to take", "I passed out, should I take ibuprofen?"]) {
    const r: any = parseLocally(t, T, {});
    check(`G12.4 offline: '${t}' -> exact refusal + care signpost`, r.message === REFUSAL && /Important safety notice|Please/.test(r.careSignpost || ""), r);
  }
  delete process.env.META_API_KEY;
  const lv: any = await runLavenderAgent("I passed out, should I take ibuprofen?", { currentDate: T });
  check("G12.4 live: exact refusal + care signpost", lv.message === REFUSAL && !!lv.careSignpost, lv);
  const plain: any = parseLocally("should I take ibuprofen for cramps?", T, {});
  check("G12.4: a non-severe medical question keeps the bare refusal", plain.message === REFUSAL && !plain.careSignpost, plain);
  check("G12.4: refusal constant unchanged", MEDICAL_REFUSAL_MESSAGE === REFUSAL);
  const vf = fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8");
  check("G12.4 UI: the care signpost is shown as its own card", /data-testid="care-signpost"/.test(vf));

  // 12.5 overlap prose from the live model
  process.env.META_API_KEY = "k";
  const orig = globalThis.fetch;
  const periods = [{ startDate: "2026-08-05" }, { startDate: "2026-09-03" }, { startDate: "2026-10-02" }, { startDate: "2026-11-01" }];
  const tool = { choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "check_overlap", arguments: JSON.stringify({ events: [{ name: "trip", date: "2026-12-20" }] }) } }] } }] };
  try {
    for (const prose of ["Your trip on Dec 20 looks safe from any overlap with your period. Have fun!", "Good news: you are in the clear for your trip.", "Your period won't clash with the trip."]) {
      let i = 0;
      globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => (i++ === 0 ? tool : { choices: [{ message: { role: "assistant", content: prose } }] }) })) as any;
      const r: any = await runLavenderAgent("trip on Dec 20, will my period overlap?", { currentDate: T, periods } as any);
      check(`G12.5: model overlap claim replaced by engine wording ('${prose.slice(0, 30)}...')`, !/safe|in the clear|won't clash/i.test(r.message) && /Unlikely to overlap \(estimate\)|Possible overlap|Likely overlap/.test(r.message) && /not a guarantee/.test(r.message), r.message);
    }
  } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }
}

main().then(() => { console.log(`\nP13 Group 12: ${passed} passed, ${failed} failed.`); process.exit(failed > 0 ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
