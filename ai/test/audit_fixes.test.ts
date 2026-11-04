// Audit fixes (Nov 4): festival pack default, event-name matching, readable overlap dates.
import fs from "node:fs";
import { parseLocally } from "../backend/agent";
import { buildDemoData } from "../../client/src/lib/demoMode";
import { loadLandmarkPacks, DEFAULT_LANDMARK_PACKS } from "../../client/src/lib/landmarkPacks";
import { evaluateEventOverlap, noteDate, noteRange } from "../../client/src/lib/periodEngine";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const T = "2026-11-04";
const mem = (v: string | null) => ({ getItem: (_k: string) => v });

// 1. India festivals are on by default, whatever the browser locale
check("packs: no saved prefs -> India pack ON", loadLandmarkPacks(mem(null)).india === true && DEFAULT_LANDMARK_PACKS.india === true);
check("packs: user's explicit OFF is respected", loadLandmarkPacks(mem(JSON.stringify({ global: true, india: false }))).india === false);
check("packs: unreadable prefs fall back to ON", loadLandmarkPacks(mem("{not json")).india === true);
check("packs: no page gates the default on navigator.language any more",
  !/endsWith\("-IN"\)/.test(fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8")) && !/endsWith\("-IN"\)/.test(fs.readFileSync("client/src/pages/SettingsPage.tsx", "utf8")));
const demo = buildDemoData(T);
const demoCtx: any = { currentDate: T, landmarkPacks: loadLandmarkPacks(mem(null)), periods: demo.periods, logs: demo.logs, events: demo.events };
for (const ph of ["two days before Onam", "period started two days before Onam", "My period started 2 days before Onam"]) {
  const r: any = parseLocally(ph, T, demoCtx);
  check(`Onam with demo data + default packs: "${ph}" -> Aug 24`, r.entry?.date === "2026-08-24", r.message);
}

// 2. "cancel the exam" matches only the exam, even when titles end in punctuation
const evs: any[] = [
  { id: "demo-event-1", title: "Demo exam (fictional)", date: "2026-11-24" },
  { id: "demo-event-2", title: "Demo trip (fictional)", date: "2026-12-19" },
];
const ex: any = parseLocally("cancel the exam", T, { events: evs } as any);
check("cancel: 'cancel the exam' proposes only the exam", ex.eventDeletion?.id === "demo-event-1" && !ex.eventDeletionCandidates, ex.eventDeletion || ex.eventDeletionCandidates);
const tr: any = parseLocally("cancel the trip", T, { events: evs } as any);
check("cancel: 'cancel the trip' proposes only the trip", tr.eventDeletion?.id === "demo-event-2", tr.eventDeletion || tr.eventDeletionCandidates);
const both: any = parseLocally("cancel the demo event", T, { events: evs } as any);
check("cancel: a phrase matching both still asks which", !both.eventDeletion && both.eventDeletionCandidates?.length === 2, both.message);
const dot: any = parseLocally("cancel the dinner", T, { events: [{ id: "x", title: "Team offsite.", date: "2026-11-30" }] } as any);
check("cancel: an unrelated title ending in '.' never matches", !dot.eventDeletion && !(dot.eventDeletionCandidates || []).length, dot);
check("cancel: card header no longer repeats the question",
  !/Which event should I remove\?/.test(fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8")));

// 4. overlap notes use readable dates
check("dates: noteDate formats a key", noteDate("2026-12-05") === "Sat, Dec 5", noteDate("2026-12-05"));
check("dates: noteRange adds years only across a year boundary", noteRange("2026-12-28", "2027-01-03") === "Mon, Dec 28, 2026 to Sun, Jan 3, 2027" && noteRange("2026-11-26", "2026-12-18") === "Thu, Nov 26 to Fri, Dec 18", noteRange("2026-12-28", "2027-01-03"));
const recs: any[] = demo.periods.map((p: any, i: number) => ({ id: String(i), startDate: p.startDate, endDate: p.endDate, confirmed: true, source: "manual", createdAt: "", updatedAt: "" }));
for (const d of ["2026-11-24", "2026-12-05", "2026-12-19", "2027-03-01"]) {
  const n = evaluateEventOverlap(d, recs, T).note || "";
  check(`dates: overlap note for ${d} has no raw ISO date`, n.length > 0 && !/\d{4}-\d{2}-\d{2}/.test(n), n);
}
check("dates: event cards no longer print '(YYYY-MM-DD)' after the pretty date",
  !/prettyDate\((ev|e)\.date\)\} \(\{(ev|e)\.date\}\)/.test(fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8")) && !/\(\{ev\.date\}\)/.test(fs.readFileSync("client/src/pages/CalendarPage.tsx", "utf8")));

console.log(`\nAudit fixes: ${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
