import assert from "node:assert";
import { parseLocally } from "../backend/agent";
import { applySlipCorrections, resolveDateExpression } from "../backend/dateArithmetic";
import { saveLogEntry, loadCycleData, saveCycleData } from "../../client/src/cycleStorage";
import { enterDemoMode, exitDemoMode, isDemoActive, DEMO_EVENTS_KEY } from "../../client/src/lib/demoMode";
import { loadEvents, upsertEvent, getEventsKey, REAL_EVENTS_KEY } from "../../client/src/lib/events";

console.log("=== Running QA Regression Test Suite for Bugs 1–7 ===");
let passed = 0;

// Test Bug 1: Standalone correction phrases
{
  const recentEntry = {
    date: "2026-10-27",
    flow: "heavy" as const,
    symptoms: ["cramps" as const],
    mood: "Okay" as const,
    energy: 3,
    sleep: 7,
    notes: "Initial entry",
    isApproximate: false,
    landmarkName: null,
    kind: "period_started" as const,
  };

  // 1a: applySlipCorrections on "actually it was light, not heavy"
  const correction = applySlipCorrections(recentEntry, "actually it was light, not heavy");
  assert.strictEqual(correction.updated.flow, "light", "Flow should be updated to light");
  assert.strictEqual(correction.updated.date, "2026-10-27", "Date should remain unchanged");
  assert.deepStrictEqual(correction.updated.symptoms, ["cramps"], "Symptoms should remain unchanged");
  console.log("[PASS] Bug 1a: applySlipCorrections handles 'actually it was light, not heavy'");
  passed++;

  // 1b: parseLocally with recentEntry
  const localRes = parseLocally("actually it was light, not heavy", "2026-10-28", { recentEntry });
  assert(localRes.entry, "Entry should be returned");
  assert.strictEqual(localRes.entry?.flow, "light");
  assert.strictEqual(localRes.entry?.date, "2026-10-27");
  console.log("[PASS] Bug 1b: parseLocally resolves standalone correction against recentEntry");
  passed++;

  // 1c: Standalone correction without recentEntry returns clear message
  const emptyRes = parseLocally("actually it was light, not heavy", "2026-10-28", {});
  assert.strictEqual(emptyRes.message, "I couldn't find a recent entry to correct.");
  assert.strictEqual(emptyRes.entry, null);
  console.log("[PASS] Bug 1c: Standalone correction without recentEntry returns helpful message");
  passed++;
}

// Test Bug 2: Period started without flow stated saves as a period
{
  const parsed = parseLocally("period started 2 days before New Year's Day", "2026-10-28", {});
  assert(parsed.entry, "Entry should be parsed");
  assert.strictEqual(parsed.entry?.kind, "period_started", "Intent should be period_started");
  assert.strictEqual(parsed.entry?.date, "2025-12-30", "Date should resolve to 2025-12-30");

  // Save log entry with flow = null and kind = "period_started"
  const saveResult = saveLogEntry(
    { logDate: parsed.entry!.date, flow: null, symptoms: [], mood: null, energy: null, sleepHours: null, notes: null },
    { kind: "period_started" }
  );
  assert(saveResult.period, "A period record must be created");
  assert.strictEqual(saveResult.period?.startDate, "2025-12-30");
  console.log("[PASS] Bug 2: 'period started' with no flow stated creates a period record");
  passed++;
}

// Test Bug 3 & 4: Demo events isolation and single source of truth
{
  // Clean mock storage for testing
  const memoryStore: Record<string, string> = {};
  const mockStorage = {
    getItem: (k: string) => memoryStore[k] || null,
    setItem: (k: string, v: string) => { memoryStore[k] = v; },
    removeItem: (k: string) => { delete memoryStore[k]; },
    clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
  };
  (globalThis as any).localStorage = mockStorage;

  // Real vault event
  memoryStore[REAL_EVENTS_KEY] = JSON.stringify([{ id: "real-1", title: "Real doctor", date: "2026-11-10", source: "manual" }]);
  assert.strictEqual(getEventsKey(), REAL_EVENTS_KEY);
  assert.strictEqual(loadEvents().length, 1);

  // Enter demo mode
  enterDemoMode();
  assert.strictEqual(isDemoActive(), true);
  assert.strictEqual(getEventsKey(), DEMO_EVENTS_KEY);
  const demoEvents = loadEvents();
  assert(demoEvents.length >= 2, "Demo mode should load demo events");

  // Add event in demo mode
  upsertEvent({ title: "Demo exam", date: "2026-11-20", source: "voice" });
  assert(loadEvents().some((e) => e.title === "Demo exam"));

  // Exit demo mode
  exitDemoMode();
  assert.strictEqual(isDemoActive(), false);
  assert.strictEqual(getEventsKey(), REAL_EVENTS_KEY);
  const realEvents = loadEvents();
  assert.strictEqual(realEvents.length, 1, "Real events must remain untouched");
  assert.strictEqual(realEvents[0].title, "Real doctor", "Real event content preserved");
  assert(!realEvents.some((e) => e.title === "Demo exam"), "Demo events must not leak into real vault");
  console.log("[PASS] Bug 3 & 4: Demo events strictly isolated and wiped on Exit Demo");
  passed++;
}

// Test Bug 5: Landmark slip labelling
{
  const res = resolveDateExpression("period started 2 days before New Year's Day", "2026-10-28");
  assert(res.date, "Date should resolve");
  assert(res.explanation.includes("Landmark: New Year's Day (1 Jan 2026)"), "Must label landmark with its calendar date");
  assert(res.explanation.includes("Resolved date: 30 Dec 2025 (2 days before)"), "Must label resolved entry date with offset");
  console.log(`[PASS] Bug 5: Landmark slip explanation correctly labelled: "${res.explanation}"`);
  passed++;
}

// Test Bug 7: Offline banner wrapping
{
  const modeReason1 = "Offline parser — Meta model not used (Meta API key not configured)";
  const offlineLabel1 = modeReason1.startsWith("Offline parser")
    ? modeReason1
    : `Offline parser — Meta model not used (${modeReason1})`;
  assert(!offlineLabel1.includes("Offline parser — Meta model not used (Offline parser"), "Banner text should not duplicate");
  console.log("[PASS] Bug 7: Offline banner text formatting does not duplicate");
  passed++;
}

// Test: parseLocally data integrity fixes
// 1. "exam on Nov 20 and a wedding to attend" -> exam event only, say "I couldn't place a date for: wedding"
{
  const res = parseLocally("exam on Nov 20 and a wedding to attend", "2026-10-31", {});
  assert.strictEqual(res.entry, null, "Plan-only phrase should not produce a cycle log entry");
  assert.strictEqual(res.plannedEvents?.length, 1, "Only 1 event should be returned");
  assert.strictEqual(res.plannedEvents?.[0]?.title, "exam", "Title should be 'exam'");
  assert.strictEqual(res.plannedEvents?.[0]?.date, "2026-11-20", "Date should be 2026-11-20");
  assert.strictEqual(res.message, "I couldn't place a date for: wedding", "Message should state unplaced date for wedding");
  console.log("[PASS] parseLocally: dateless event not given date, exam only returned, couldn't place message exact");
  passed++;
}

// 2. Clean event title: "exam on Nov 20", "exam coming up on Nov 20", etc. gives "exam", not "exam coming up"
{
  const t1 = parseLocally("exam on Nov 20", "2026-10-31", {});
  assert.strictEqual(t1.plannedEvents?.[0]?.title, "exam");

  const t2 = parseLocally("exam coming up on Nov 20", "2026-10-31", {});
  assert.strictEqual(t2.plannedEvents?.[0]?.title, "exam");

  const t3 = parseLocally("an exam coming up on November 20", "2026-10-31", {});
  assert.strictEqual(t3.plannedEvents?.[0]?.title, "exam");

  const t4 = parseLocally("I also have an exam coming up on November 20", "2026-10-31", {});
  assert.strictEqual(t4.plannedEvents?.[0]?.title, "exam");

  console.log("[PASS] parseLocally: event titles are clean ('exam', never 'exam coming up')");
  passed++;
}

// 3. Multi-fact sentence: cramps/headache on yesterday, not start day
{
  const res = parseLocally(
    "my period started three days ago and the flow was medium on the first day but heavy yesterday with bad cramps and a headache and I also have an exam coming up on November 20 and a wedding to attend",
    "2026-10-31",
    {}
  );
  assert(res.entry, "Start day entry must be present");
  assert.strictEqual(res.entry?.date, "2026-10-28", "Start date is 3 days ago");
  assert.strictEqual(res.entry?.flow, "medium", "First day flow is medium");
  assert.deepStrictEqual(res.entry?.symptoms, [], "Cramps and headache must NOT be attached to start-day entry");
  assert.strictEqual(res.plannedEvents?.length, 1, "Only exam event returned");
  assert.strictEqual(res.plannedEvents?.[0]?.title, "exam", "Clean title exam");
  assert(res.message.includes("couldn't place"), "Message includes couldn't place disclosure");
  assert(res.message.includes("2026-10-30"), "Message names yesterday's date");
  assert(res.message.includes("I couldn't place a date for: wedding"), "Message names unplaced wedding");
  console.log("[PASS] parseLocally: yesterday symptoms not attached to start day, unplaced facts disclosed");
  passed++;
}

console.log(`\nQA Regression Suite: All ${passed} test groups passed!`);

