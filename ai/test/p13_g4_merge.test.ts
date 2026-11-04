// Prompt 13 Group 4: saving never silently reduces a day's recorded facts.
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
import fs from "node:fs";
import { saveLogEntry, loadCycleData, describeSameDayMerge } from "../../client/src/cycleStorage";
import { parseLocally } from "../backend/agent";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log("[PASS] " + name); passed++; } else { console.error("[FAIL] " + name, extra ?? ""); failed++; } }
const T = "2026-11-04";
const reset = () => { for (const k in store) delete store[k]; };
const dayLog = (d: string) => loadCycleData().logs.find((l) => l.logDate === d);
// Mirrors VoiceFlowPage.handleSaveConfirmed: replace only for explicit saved-entry edits.
const confirmSave = (e: any) => saveLogEntry({ logDate: e.date, flow: e.flow || null, symptoms: e.symptoms || [], mood: e.mood || null, energy: e.energy || null, sleepHours: e.sleep || null, notes: e.notes || null, kind: e.kind || "daily_log" }, { kind: e.kind || "daily_log", replace: e.editsSavedEntry === true });

// Reproduction: Nov 2 has cramps + headache; a new Nov 2 slip with cramps only is saved.
reset();
saveLogEntry({ logDate: "2026-11-02", flow: null, symptoms: ["cramps", "headache"] as any, mood: null, energy: null, sleepHours: null, notes: "rough day", kind: "daily_log" });
const s1: any = parseLocally("cramps on November 2nd", T, {});
const corrected: any = parseLocally("add bloating", T, { pendingEntry: { ...s1.entry, symptoms: ["cramps"] } });
check("G4: correcting an UNSAVED slip is not a saved-entry edit", corrected.entry && corrected.entry.editsSavedEntry !== true, corrected.entry);
confirmSave(corrected.entry);
const after = dayLog("2026-11-02")!;
check("G4 repro: headache survives a later cramps-only save", after.symptoms.includes("headache") && after.symptoms.includes("cramps"), after.symptoms);
check("G4: the new symptom is added (union)", after.symptoms.includes("bloating"), after.symptoms);
check("G4: existing notes are preserved", (after.notes || "").includes("rough day"), after.notes);
check("G4: still one log for the day", loadCycleData().logs.filter((l) => l.logDate === "2026-11-02").length === 1);

// Flow change merge: newest explicit flow wins AND the slip says so before confirming
reset();
saveLogEntry({ logDate: "2026-11-01", flow: "heavy", symptoms: ["cramps"] as any, mood: null, energy: null, sleepHours: null, notes: null, kind: "daily_log" });
const notice = describeSameDayMerge(dayLog("2026-11-01"), { date: "2026-11-01", flow: "light" });
check("G4: flow change shows the 'already has an entry — saving will update it' notice", !!notice && /already has an entry/.test(notice.message) && notice.overwrites.some((o) => /flow heavy → light/.test(o)), notice);
confirmSave({ date: "2026-11-01", flow: "light", symptoms: [], kind: "daily_log" });
check("G4: flow takes the newest explicit value, symptoms kept", dayLog("2026-11-01")!.flow === "light" && dayLog("2026-11-01")!.symptoms.includes("cramps"), dayLog("2026-11-01"));
const addOnly = describeSameDayMerge(dayLog("2026-11-01"), { date: "2026-11-01", flow: null });
check("G4: an add-only save says nothing is removed", !!addOnly && addOnly.overwrites.length === 0 && /Nothing already recorded is removed/.test(addOnly.message), addOnly);
check("G4: empty day -> no notice", describeSameDayMerge(undefined, { date: "2026-10-30", flow: "heavy" }) === null);

// Two saves for one day never drop data
reset();
confirmSave({ date: "2026-10-31", flow: "medium", symptoms: ["cramps"], mood: "Calm", kind: "daily_log" });
confirmSave({ date: "2026-10-31", flow: null, symptoms: ["headache"], kind: "daily_log" });
const d = dayLog("2026-10-31")!;
check("G4: two saves keep everything (flow, mood, both symptoms)", d.flow === "medium" && d.mood === "Calm" && d.symptoms.includes("cramps") && d.symptoms.includes("headache"), d);

// Explicit saved-entry edits are the only replace path, and are labelled as such
const edit = describeSameDayMerge(d, { date: "2026-10-31", editsSavedEntry: true });
check("G4: saved-entry edits are announced as a replace", !!edit && /editing the saved entry/.test(edit.message), edit);
const src = fs.readFileSync("client/src/pages/VoiceFlowPage.tsx", "utf8");
check("G4: VoiceFlowPage replaces only when the slip edits a saved entry", /const replaceExisting = \(confirmEntry as any\)\.editsSavedEntry === true;/.test(src));
check("G4: VoiceFlowPage renders the same-day notice on the slip", /data-testid="same-day-notice"/.test(src));

console.log(`\nP13 Group 4: ${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
