// Prompt 13 Group 6: corrections of SAVED entries and event cancellation by reference.
import fs from "node:fs";
import { parseLocally, runLavenderAgent } from "../backend/agent";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const T = "2026-11-04";
const recent: any[] = [
  { date: T, flow: "medium", symptoms: ["cramps", "headache"], mood: null, energy: null, sleep: null, notes: "kept note", kind: "daily_log" },
  { date: "2026-11-03", flow: "heavy", symptoms: ["bloating"], mood: null, energy: null, sleep: null, notes: null, kind: "period_started" },
];
const events: any[] = [{ id: "e1", title: "Anu's wedding", date: "2026-12-12", source: "voice" }, { id: "e2", title: "exam", date: "2026-11-20", source: "voice" }];
const ctx: any = { recentEntries: recent, recentEntry: recent[0], events };

async function main() {
  // Saved-entry correction (reproduction)
  const r: any = parseLocally("Remove the headache from today's entry", T, ctx);
  check("G6 repro: 'Remove the headache from today's entry' loads today's saved entry with headache removed", r.entry && r.entry.date === T && !r.entry.symptoms.includes("headache") && r.entry.symptoms.includes("cramps"), r.entry);
  check("G6: the loaded slip keeps the saved facts (flow, notes)", r.entry?.flow === "medium" && r.entry?.notes === "kept note", r.entry);
  check("G6: it is marked as a saved-entry edit and stays confirm-gated", r.entry?.editsSavedEntry === true && /Confirm below/.test(r.message), r.message);
  const y: any = parseLocally("change yesterday's entry to light flow", T, ctx);
  check("G6: yesterday's entry can be edited", y.entry?.date === "2026-11-03" && y.entry?.flow === "light" && y.entry?.kind === "period_started" && y.entry?.editsSavedEntry === true, y.entry);
  const miss: any = parseLocally("remove headache from yesterday's entry", T, ctx);
  check("G6: removing a symptom the entry doesn't have says so", !miss.entry && /doesn't have headache/.test(miss.message), miss.message);
  const none: any = parseLocally("remove the cramps from yesterday's entry", T, { recentEntries: [recent[0]], events });
  check("G6: no saved entry for that day -> honest 'couldn't find'", !none.entry && /couldn't find a saved entry/.test(none.message), none.message);

  // Event cancellation (reproductions)
  for (const t of ["Cancel the wedding event", "cancel the wedding"]) {
    const c: any = parseLocally(t, T, ctx);
    check(`G6 repro: '${t}' resolves the single matching event (no 'which date')`, c.eventDeletion?.id === "e1" && !/which date/i.test(c.message) && /nothing is deleted until you do/.test(c.message), c);
  }
  const two: any = parseLocally("cancel the wedding", T, { events: [...events, { id: "e3", title: "Riya's wedding", date: "2027-01-20", source: "manual" }] });
  check("G6: two weddings -> asks WHICH EVENT, listing both", !two.eventDeletion && two.eventDeletionCandidates?.length === 2 && /Which event/.test(two.message) && /Anu's wedding/.test(two.message) && /Riya's wedding/.test(two.message), two.message);
  const zero: any = parseLocally("cancel the trip", T, ctx);
  check("G6: zero matches -> honest 'I couldn't find'", !zero.eventDeletion && /couldn't find a saved event/.test(zero.message), zero.message);
  const sym: any = parseLocally("remove the headache", T, ctx);
  check("G6: symptom removal is never treated as an event cancel", !sym.eventDeletion && !sym.eventDeletionCandidates, sym);

  // Live path: stored records are never changed by the model
  process.env.META_API_KEY = "k";
  const orig = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { role: "assistant", content: "Which date?" } }] }) }; }) as any;
  try {
    const lc: any = await runLavenderAgent("cancel the wedding", { currentDate: T, events } as any);
    check("G6: live 'cancel the wedding' resolves on device without a model call", lc.eventDeletion?.id === "e1" && calls === 0, { calls, m: lc.message });
    const le: any = await runLavenderAgent("Remove the headache from today's entry", { currentDate: T, recentEntries: recent, recentEntry: recent[0] } as any);
    check("G6: live saved-entry edit resolves on device", le.entry?.editsSavedEntry === true && calls === 0, { calls, e: le.entry });
  } finally { globalThis.fetch = orig; delete process.env.META_API_KEY; }

  // UI: deletion happens only in the Remove button handler
  const src = fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8");
  const del = src.indexOf("deleteEvent(ev.id)");
  check("G6: VoiceFlowPage deletes an event only inside the Remove button's onClick", del > 0 && src.lastIndexOf("onClick", del) > src.lastIndexOf("data-testid=\"event-removal-card\"", del) && (src.match(/deleteEvent\(/g) || []).length === 1);
}

main().then(() => { console.log(`\nP13 Group 6: ${passed} passed, ${failed} failed.`); process.exit(failed > 0 ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
