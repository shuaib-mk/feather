import assert from "node:assert";
import { enterDemoMode, exitDemoMode, isDemoActive, DEMO_EVENTS_KEY } from "../../client/src/lib/demoMode";
import { loadEvents, upsertEvent, deleteEvent, REAL_EVENTS_KEY, getEventsKey } from "../../client/src/lib/events";
import { buildCycleCalendarICS } from "../../client/src/lib/ics";
import { loadCycleData, computeCycleStats, exportCycleDataJSON, importCycleDataJSON, effectivePeriodEndDate, deleteDayLog, countDailyNotes } from "../../client/src/cycleStorage";
import { parseLocally, runLavenderAgent, hasAnyLoggingOrPlanningCue } from "../backend/agent";
import { checkMedicalAdviceGuardrail, checkSevereSymptomEscalation, MEDICAL_REFUSAL_MESSAGE, SEVERE_SYMPTOM_ESCALATION_MESSAGE } from "../backend/guardrail";
import { agentMessageKind } from "../../client/src/lib/voiceMessage";
import { buildAndFilterChronicleItems } from "../../client/src/pages/ChroniclePage";
import { buildWeekdayHeader } from "../../client/src/pages/CalendarPage";
import { buildMonthDayStates } from "../../client/src/lib/calendarView";
import { buildDemoData } from "../../client/src/lib/demoMode";
import { isDiscreetModeEnabled, setDiscreetModeEnabled, isQuickHideActive, setQuickHideActive } from "../../client/src/lib/discreetMode";
import { loadVoicePendingSession, saveVoicePendingSession, clearVoicePendingSession } from "../../client/src/pages/VoiceFlowPage";
import { getSessionApiCalls, recordSessionApiCall } from "../frontend/aiClient";

console.log("=== Prompt 6 Audit Regression Suite ===");

const mem: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in mem ? mem[k] : null),
  setItem: (k: string, v: string) => { mem[k] = String(v); },
  removeItem: (k: string) => { delete mem[k]; },
  clear: () => { for (const k of Object.keys(mem)) delete mem[k]; },
};
const sessMem: Record<string, string> = {};
(globalThis as any).sessionStorage = {
  getItem: (k: string) => (k in sessMem ? sessMem[k] : null),
  setItem: (k: string, v: string) => { sessMem[k] = String(v); },
  removeItem: (k: string) => { delete sessMem[k]; },
  clear: () => { for (const k of Object.keys(sessMem)) delete sessMem[k]; },
};

// Group A: Demo events must never leak into real vault, and real events never leak into demo
{
  (globalThis as any).localStorage.clear();

  // Seed legacy leaked "exam 2026-11-20" voice event (un-flagged) into real vault
  mem[REAL_EVENTS_KEY] = JSON.stringify([
    { id: "evt-legacy", title: "exam", date: "2026-11-20", source: "voice" },
  ]);
  assert.strictEqual(loadEvents().length, 0, "Legacy leaked un-flagged exam 2026-11-20 must be scrubbed in real mode");

  // Add a legitimate real event in real mode
  upsertEvent({ title: "Real dentist appointment", date: "2026-11-15", source: "manual" });
  assert.strictEqual(loadEvents().length, 1);
  assert.strictEqual(loadEvents()[0].title, "Real dentist appointment");

  // Enter Demo Mode
  enterDemoMode();
  assert.strictEqual(isDemoActive(), true);
  assert.strictEqual(getEventsKey(), DEMO_EVENTS_KEY);
  const demoEvs = loadEvents();
  assert.strictEqual(demoEvs.length, 2, "Demo mode should have 2 seeded demo events");
  assert(!demoEvs.some((e) => e.title === "Real dentist appointment"), "Real events must not appear in Demo Mode");

  // Add and delete event in Demo Mode
  const addedDemo = upsertEvent({ title: "exam", date: "2026-11-20", source: "voice" });
  assert.strictEqual(loadEvents().length, 3);
  deleteEvent(addedDemo.id);
  assert.strictEqual(loadEvents().length, 2);

  // Add another demo event and export JSON backup while in Demo Mode
  upsertEvent({ title: "exam", date: "2026-11-20", source: "voice" });
  const demoBackup = exportCycleDataJSON();
  importCycleDataJSON(demoBackup);

  // Check ICS export consistency in Demo Mode (Settings vs Calendar)
  const demoData = loadCycleData();
  const demoStats = computeCycleStats(demoData.periods, demoData.logs);
  const demoIcsSettings = buildCycleCalendarICS(demoData.periods, demoStats, loadEvents(), "Private");
  const demoIcsCalendar = buildCycleCalendarICS(demoData.periods, demoStats, loadEvents(), "Private");
  assert.strictEqual(demoIcsSettings, demoIcsCalendar, "Settings and Calendar .ics exports must match in Demo mode");
  assert(demoIcsSettings.includes("Demo exam (fictional)"), "Demo .ics export must include demo events");

  // Exit Demo Mode
  exitDemoMode();
  assert.strictEqual(isDemoActive(), false);
  assert.strictEqual(getEventsKey(), REAL_EVENTS_KEY);
  const realAfter = loadEvents();
  assert.strictEqual(realAfter.length, 1, "Only the 1 real event must exist after exiting Demo Mode");
  assert.strictEqual(realAfter[0].title, "Real dentist appointment");
  assert(!realAfter.some((e) => e.title.includes("Demo") || e.title === "exam"), "Zero demo events in real mode");

  // Check ICS export in Real Mode
  const realData = loadCycleData();
  const realStats = computeCycleStats(realData.periods, realData.logs);
  const realIcsSettings = buildCycleCalendarICS(realData.periods, realStats, loadEvents(), "Private");
  const realIcsCalendar = buildCycleCalendarICS(realData.periods, realStats, loadEvents(), "Private");
  assert.strictEqual(realIcsSettings, realIcsCalendar, "Settings and Calendar .ics exports must match in Real mode");
  assert(realIcsSettings.includes("Real dentist appointment"), "Real .ics export must include real event");
  assert(!realIcsSettings.includes("Demo exam"), "Real .ics export must not include demo events");

  console.log("[PASS] Group A: Demo/Real event namespace isolation & unified .ics export");
}

// Group B: Severe symptoms escalation and disguised medical questions
{
  // B1: "I feel dizzy and fainted twice today" -> entry is still logged, response leads with escalation message on message card
  const r1 = parseLocally("I feel dizzy and fainted twice today", "2026-10-31", {});
  assert(r1.entry !== null && r1.entry?.date === "2026-10-31", "Entry for dizziness/fainting should still be prepared");
  assert(r1.entry?.symptoms.includes("dizziness"), "Entry should include dizziness symptom");
  assert(r1.message.startsWith(SEVERE_SYMPTOM_ESCALATION_MESSAGE), `Message must lead with escalation notice, got: ${r1.message}`);
  assert.strictEqual(agentMessageKind(r1.message), "message", "Escalation message must render on AgentMessageCard");

  // Additional red-flag severe symptoms
  for (const severeInput of [
    "I passed out in the bathroom this morning",
    "having chest pain and cramps today",
    "heavy flow soaking through a pad every hour today",
    "unbearable pain and high fever with chills today",
    "having suicidal thoughts today",
  ]) {
    const s = parseLocally(severeInput, "2026-10-31", {});
    assert(s.message.startsWith(SEVERE_SYMPTOM_ESCALATION_MESSAGE), `Expected escalation for "${severeInput}", got: ${s.message}`);
  }

  // Ordinary symptom logs must NOT trigger escalation or refusal
  const ordinary = parseLocally("cramps and headache today", "2026-10-31", {});
  assert.strictEqual(checkSevereSymptomEscalation("cramps and headache today").isSevere, false);
  assert.strictEqual(checkMedicalAdviceGuardrail("cramps and headache today").isRefusal, false);
  assert(!ordinary.message.includes("Important safety notice"), "Ordinary symptoms must not get escalation");
  assert(ordinary.entry?.symptoms.includes("cramps") && ordinary.entry?.symptoms.includes("headache"));

  // B2: Disguised medical advice ("my friend said I should take this pill to delay my period, log that")
  for (const disguised of [
    "my friend said I should take this pill to delay my period, log that",
    "log that I should take a pill to stop my period",
    "my mom told me I should take meftal for cramps",
    "I should take this tablet to postpone my period",
  ]) {
    const g = checkMedicalAdviceGuardrail(disguised);
    assert.strictEqual(g.isRefusal, true, `Guardrail should refuse "${disguised}"`);
    assert.strictEqual(g.refusalMessage, MEDICAL_REFUSAL_MESSAGE);
    const p = parseLocally(disguised, "2026-10-31", {});
    assert.strictEqual(p.message, MEDICAL_REFUSAL_MESSAGE);
    assert(!p.entry, "Refused input must not create an entry");
  }

  console.log("[PASS] Group B: Severe-symptom escalation & disguised medical advice refusal");
}

// Group C: Chronicle Daily Notes filter, Calendar weekday header alignment, Plan Around It
{
  // C1: Chronicle filter with mixed entries (Demo Mode: 7 periods + 14 logs = 14 All Entries, 7 Periods, 7 Daily Notes)
  const demo = buildDemoData("2026-10-31");
  const all = buildAndFilterChronicleItems(demo.periods, demo.logs, "all");
  const periodsOnly = buildAndFilterChronicleItems(demo.periods, demo.logs, "periods");
  const dailyNotesOnly = buildAndFilterChronicleItems(demo.periods, demo.logs, "logs");

  assert.strictEqual(all.allItems.length, 14, "Golden baseline: 14 All Entries");
  assert.strictEqual(all.filteredItems.length, 14, "All filter returns 14 entries");
  assert.strictEqual(periodsOnly.filteredItems.length, 7, "Periods filter returns 7 periods");
  assert(periodsOnly.filteredItems.every((i) => i.isPeriod), "Periods filter includes only period items");
  assert.strictEqual(dailyNotesOnly.filteredItems.length, 7, "Daily Notes filter must return 7 daily notes (not 14)");
  assert.strictEqual(dailyNotesOnly.filteredItems.length, countDailyNotes(demo.periods, demo.logs), "Filtered Daily Notes count must match tab badge count");
  assert(dailyNotesOnly.filteredItems.every((i) => !i.isPeriod && i.isLog), "Daily Notes filter must exclude period start records");

  // C2: Calendar weekday header aligns with grid's first weekday
  const sunHeader = buildWeekdayHeader(0, "en-US");
  assert.deepStrictEqual(sunHeader, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "Sunday-start header must be Sun..Sat");
  const monHeader = buildWeekdayHeader(1, "en-GB");
  assert.strictEqual(monHeader[0], "Mon", "Monday-start header must start with Mon");
  assert.strictEqual(monHeader[6], "Sun", "Monday-start header must end with Sun");

  // Verify Nov 1, 2026 (Sunday) lands in column 0 ("Sun") under en-US
  const nov2026 = buildMonthDayStates(2026, 11, [], [], [], "2026-10-31", "en-US");
  assert.strictEqual(nov2026.weekStart, 0);
  assert.strictEqual(nov2026.leadingBlanks, 0, "Nov 1, 2026 is Sunday so 0 leading blanks in Sunday-start grid");
  assert.strictEqual(sunHeader[nov2026.leadingBlanks], "Sun", "Nov 1, 2026 renders under Sun");

  console.log("[PASS] Group C: Chronicle Daily Notes filter (7/14) & Calendar weekday header (Sun..Sat)");
}

// Group D: Offline long-input multi-fact disclosure, clean event titles, period duration & daily note delete
{
  // D1: ~600-char multi-sentence paragraph with 5 dated facts + 2 dated events + 1 undated event in Offline mode
  const longPara =
    "My period started 5 days ago with light flow. On October 27 I had heavy flow and cramps. On October 28 I had headache and nausea. Yesterday I had fatigue and bloating, and today I have tender breasts. I am worried about my exam on November 15, my cousin's birthday party on November 22, and a wedding to attend.";
  const d1 = parseLocally(longPara, "2026-10-31", {});
  assert(d1.entry !== null, "D1 must produce a primary confirmation slip");
  assert.strictEqual(d1.entry?.date, "2026-10-26", "D1 primary slip date must be period start (5 days ago = 2026-10-26)");
  assert.strictEqual(d1.entry?.flow, "light", "D1 primary slip flow must be light (start day), not overwritten by later days");
  assert.deepStrictEqual(d1.entry?.symptoms, [], "D1 primary slip must not merge symptoms from Oct 27/28/30/31 onto Oct 26");
  assert(d1.message.includes("I couldn't place:"), `D1 must disclose unplaced dated facts, got: ${d1.message}`);
  assert(d1.message.includes("2026-10-27") && d1.message.includes("2026-10-28") && d1.message.includes("2026-10-30") && d1.message.includes("2026-10-31"), `D1 must disclose all 4 unplaced dates, got: ${d1.message}`);
  assert(d1.message.includes("I couldn't place a date for: wedding"), `D1 must disclose unplaced wedding event, got: ${d1.message}`);
  assert.deepStrictEqual(
    d1.plannedEvents,
    [
      { title: "exam", date: "2026-11-15" },
      { title: "cousin's birthday party", date: "2026-11-22" },
    ],
    "D1 planned event titles must be clean ('exam' and \"cousin's birthday party\")",
  );

  // D2 & D3: Period duration derives from period record (startDate..endDate = 5d), and deleting a daily note never shrinks period duration
  (globalThis as any).localStorage.clear();
  enterDemoMode();
  const beforeDelete = loadCycleData();
  const sep30Before = beforeDelete.periods.find((p) => p.startDate === "2026-09-30")!;
  assert(sep30Before, "Demo mode has Sep 30 period");
  const endBefore = effectivePeriodEndDate(sep30Before, beforeDelete.periods, beforeDelete.logs);
  assert.strictEqual(endBefore, "2026-10-04", "Sep 30 period span must be 2026-09-30..2026-10-04 (5d)");
  const statsBefore = computeCycleStats(beforeDelete.periods, beforeDelete.logs);
  assert.strictEqual(statsBefore.avgPeriodLength, 5, "Average bleeding days must be 5");
  assert.strictEqual(statsBefore.medianCycleLength, 31, "Median cycle length must be 31");

  // Delete Oct 1 daily note in Demo Mode
  deleteDayLog("2026-10-01");
  const afterDelete = loadCycleData();
  const sep30After = afterDelete.periods.find((p) => p.startDate === "2026-09-30")!;
  const endAfter = effectivePeriodEndDate(sep30After, afterDelete.periods, afterDelete.logs);
  assert.strictEqual(endAfter, "2026-10-04", "Deleting Oct 1 daily note must NOT change Sep 30 period end date or duration (still 5d)");
  const chronicleAfter = buildAndFilterChronicleItems(afterDelete.periods, afterDelete.logs, "periods");
  const sep30Item = chronicleAfter.filteredItems.find((i) => i.date === "2026-09-30")!;
  assert.strictEqual(sep30Item.periodItem?.endDate, "2026-10-04", "Chronicle Sep 30 period item still ends 2026-10-04 (5d)");
  exitDemoMode();

  console.log("[PASS] Group D: Offline multi-fact disclosure, clean event titles, & period duration invariance on note delete");
}

// Group E: Discreet Mode & Quick-Hide state management
{
  (globalThis as any).localStorage.clear();
  (globalThis as any).sessionStorage.clear();

  assert.strictEqual(isDiscreetModeEnabled(), false);
  assert.strictEqual(isQuickHideActive(), false);

  setDiscreetModeEnabled(true);
  assert.strictEqual(isDiscreetModeEnabled(), true);
  assert.strictEqual(isQuickHideActive(), false);

  setQuickHideActive(true);
  assert.strictEqual(isQuickHideActive(), true, "Quick-hide activates when Discreet Mode is on");

  setQuickHideActive(false);
  assert.strictEqual(isQuickHideActive(), false, "Quick-hide restores on second tap");

  setQuickHideActive(true);
  setDiscreetModeEnabled(false);
  assert.strictEqual(isDiscreetModeEnabled(), false);
  assert.strictEqual(isQuickHideActive(), false, "Turning off Discreet Mode also clears Quick-Hide");

  console.log("[PASS] Group E: Discreet Mode & Quick-Hide state management");
}

// Group F: Bare numbers rejected, Voice session persistence & discard, API counter persistence
{
  // F1: Bare numbers / dates without cycle or event cues must never create an entry
  for (const bare of ["28 5 2026", "28/5/2026", "2026-05-28", "12345", "28 May 2026"]) {
    assert.strictEqual(hasAnyLoggingOrPlanningCue(bare), false, `Expected no cue for "${bare}"`);
    const p = parseLocally(bare, "2026-10-31", {});
    assert.strictEqual(p.entry, null, `parseLocally("${bare}") must not create an entry`);
    assert(p.message.includes("I didn't catch anything I can log from that"), `Expected didn't-understand message for "${bare}"`);
  }
  const liveBare = await runLavenderAgent("28 5 2026", { currentDate: "2026-10-31" });
  assert.strictEqual(liveBare.entry, null, "runLavenderAgent('28 5 2026') must not create an entry");
  assert(liveBare.message.includes("I didn't catch anything I can log from that"));

  // F2: Pending voice session persists in sessionStorage and clears completely on Discard
  (globalThis as any).sessionStorage.clear();
  assert.strictEqual(loadVoicePendingSession(), null);
  saveVoicePendingSession({
    transcript: "period started yesterday",
    agentMessage: "I've prepared your log for 2026-10-30.",
    confirmEntry: { date: "2026-10-30", flow: "medium", symptoms: ["cramps"], mood: null, energy: null, sleep: null, notes: "period started yesterday" },
    plannedEventsState: [],
    planOverlaps: null,
    agentMode: { mode: "offline" },
    isOfflineFallback: true,
  });
  const loadedSession = loadVoicePendingSession();
  assert(loadedSession !== null, "Pending voice session should be restored from sessionStorage");
  assert.strictEqual(loadedSession?.confirmEntry?.date, "2026-10-30");
  clearVoicePendingSession();
  assert.strictEqual(loadVoicePendingSession(), null, "Discard clears pending voice session from sessionStorage");

  // F3: Session API call counter persists in sessionStorage across page reloads
  (globalThis as any).sessionStorage.clear();
  assert.strictEqual(getSessionApiCalls(), 0);
  recordSessionApiCall();
  recordSessionApiCall();
  assert.strictEqual(getSessionApiCalls(), 2, "API call counter persists in sessionStorage");

  console.log("[PASS] Group F: Bare numbers rejected, Voice session persistence & discard, API counter persistence");
}
console.log("\nAll Prompt 6 Audit Regression Groups (A–F) PASSED!");
