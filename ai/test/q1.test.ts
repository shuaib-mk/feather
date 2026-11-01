/** Q1: data integrity + app lock. */
import { saveCycleData, loadCycleData, addOrUpdatePeriod, bulkSavePeriods, saveLogEntry, importCycleDataJSON } from "../../client/src/cycleStorage";
import { saveEvents, loadEvents } from "../../client/src/lib/events";
import { enableAppLock, unlockApp, lockNow, disableAppLock, isAppLockEnabled, needsUnlockOnLoad, forgetPassphrase } from "../../client/src/lib/appLock";
import { buildICS, parseICS } from "../../client/src/lib/ics";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}

const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
function resetVault() { for (const k in store) delete store[k]; }

// --- Q1.1 unique IDs ---
{
  resetVault();
  const ids: number[] = [];
  for (let i = 0; i < 20; i++) {
    const d = "2026-01-" + String(i + 1).padStart(2, "0");
    ids.push(addOrUpdatePeriod({ startDate: d, endDate: d }).id);
  }
  const data = loadCycleData();
  check("Q1.1: 20 rapid periods stored", data.periods.length === 20, data.periods.length);
  check("Q1.1: all 20 ids unique", new Set(ids).size === 20, ids);
  check("Q1.1: ids stay numeric", ids.every((x) => typeof x === "number"), ids.slice(0, 3));
}


// --- Q1.2 diary bulk import: one atomic save with skipped reasons ---
{
  resetVault();
  saveCycleData({ periods: [{ id: 1, startDate: "2026-09-01", endDate: "2026-09-05" } as any], logs: [] });
  let vaultWrites = 0;
  const rawSet = (globalThis as any).localStorage.setItem;
  (globalThis as any).localStorage.setItem = (k: string, v: string) => { if (k === "feather_cycle_vault_v1") vaultWrites++; return rawSet(k, v); };
  const res = bulkSavePeriods([
    { startDate: "2026-10-02", endDate: null },
    { startDate: "not-a-date", endDate: null },
    { startDate: "2026-10-06", endDate: "2026-10-02" },
    { startDate: "2026-09-01", endDate: null },
    { startDate: "2026-09-03", endDate: "2026-09-10" },
    { startDate: "2026-10-09", endDate: null },
    { startDate: "2026-10-09", endDate: null },
  ]);
  (globalThis as any).localStorage.setItem = rawSet;
  check("Q1.2: 2 saved", res.saved === 2, res);
  check("Q1.2: 5 skipped with reasons", res.skipped.length === 5, res.skipped);
  const reasons = res.skipped.map((s) => s.reason).sort().join("|");
  check("Q1.2: reasons cover invalid/duplicate/overlap/end", reasons.indexOf("invalid date") !== -1 && reasons.indexOf("duplicate start date") !== -1 && reasons.indexOf("overlaps an existing period") !== -1 && reasons.indexOf("end date precedes start date") !== -1, reasons);
  check("Q1.2: single vault write", vaultWrites === 1, vaultWrites);
  const data = loadCycleData();
  check("Q1.2: existing period intact plus 2 new", data.periods.length === 3 && data.periods.some((p) => p.startDate === "2026-10-02") && data.periods.some((p) => p.startDate === "2026-10-09"), data.periods.map((p) => p.startDate));
  const empty = bulkSavePeriods([]);
  check("Q1.2: empty batch saves nothing", empty.saved === 0 && empty.skipped.length === 0, empty);
}

// --- Q1.3 same-day merge ---
{
  resetVault();
  const mk = (flow: any, symptoms: string[], extra: any = {}) => ({
    logDate: "2026-10-02", flow, symptoms, mood: null, energy: null, sleepHours: null, notes: null, ...extra,
  });
  saveLogEntry(mk("medium", ["cramps"]), { kind: "period_started" });
  saveLogEntry(mk(null, ["headache"], { mood: "Okay", energy: 3, sleepHours: 7, notes: "note one" }), { kind: "daily_log" });
  let log = loadCycleData().logs.find((l) => l.logDate === "2026-10-02")!;
  check("Q1.3: symptoms union", JSON.stringify(log.symptoms) === JSON.stringify(["cramps", "headache"]), log.symptoms);
  check("Q1.3: flow kept when new is null", log.flow === "medium", log.flow);
  check("Q1.3: mood/energy/sleep replaced when non-null", log.mood === "Okay" && log.energy === 3 && log.sleepHours === 7, [log.mood, log.energy, log.sleepHours]);
  check("Q1.3: kind period_started preserved", log.kind === "period_started", log.kind);
  check("Q1.3: still one period and one log", loadCycleData().periods.length === 1 && loadCycleData().logs.length === 1, loadCycleData().periods.length);
  const idBefore = log.id;
  saveLogEntry(mk(null, ["headache"], { notes: "note one" }), { kind: "daily_log" });
  log = loadCycleData().logs.find((l) => l.logDate === "2026-10-02")!;
  check("Q1.3: notes not duplicated", log.notes === "note one", log.notes);
  check("Q1.3: id stable across merges", log.id === idBefore, log.id);
  saveLogEntry(mk("light", ["nausea"], { mood: "Good" }), { kind: "daily_log" });
  log = loadCycleData().logs.find((l) => l.logDate === "2026-10-02")!;
  check("Q1.3: explicit flow wins, symptoms grow", log.flow === "light" && log.symptoms.includes("nausea") && log.symptoms.includes("cramps"), [log.flow, log.symptoms]);
  saveLogEntry(mk("heavy", ["fatigue"], { mood: "Low", energy: 2, sleepHours: 6, notes: "fresh" }), { kind: "period_started", replace: true });
  log = loadCycleData().logs.find((l) => l.logDate === "2026-10-02")!;
  check("Q1.3: replace:true restores overwrite", log.flow === "heavy" && JSON.stringify(log.symptoms) === JSON.stringify(["fatigue"]) && log.mood === "Low" && log.notes === "fresh", log);
}

// --- Q1.4 storage failures are reported, never silent ---
{
  resetVault();
  const working = (globalThis as any).localStorage;
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (_k: string, _v: string) => { throw new Error("QuotaExceededError"); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const res = saveLogEntry({ logDate: "2026-10-02", flow: "medium", symptoms: [], mood: null, energy: null, sleepHours: null, notes: null }, { kind: "period_started" });
  check("Q1.4: saveLogEntry reports saved:false with reason", res.saved === false && typeof res.error === "string" && res.error.length > 0, res);
  check("Q1.4: vault untouched after failed write", loadCycleData().periods.length === 0, loadCycleData().periods.length);
  let threw = "";
  try { addOrUpdatePeriod({ startDate: "2026-10-02", endDate: "2026-10-02" }); } catch (err: any) { threw = err?.message || ""; }
  check("Q1.4: addOrUpdatePeriod throws with reason", threw.indexOf("Could not write") !== -1, threw);
  store["feather_demo_active"] = "1";
  const resD = saveLogEntry({ logDate: "2026-10-03", flow: "medium", symptoms: [], mood: null, energy: null, sleepHours: null, notes: null }, { kind: "period_started" });
  check("Q1.4: demo namespace also reports failure", resD.saved === false, resD);
  delete store["feather_demo_active"];
  (globalThis as any).localStorage = working;
  const ok = saveLogEntry({ logDate: "2026-10-04", flow: "medium", symptoms: [], mood: null, energy: null, sleepHours: null, notes: null }, { kind: "period_started" });
  check("Q1.4: writes work again after restore", ok.saved === true, ok.saved);
}

// --- Q1.5 + Q4.7 backup import: merge, new ids, skip reasons ---
{
  resetVault();
  saveCycleData({ periods: [{ id: 50, startDate: "2026-09-01", endDate: "2026-09-05" } as any], logs: [] });
  const r = importCycleDataJSON(JSON.stringify({
    periods: [{ id: 50, startDate: "2026-10-05", endDate: "2026-10-08" }],
    logs: [],
  }));
  check("Q1.5: colliding id gets a new id", r.success === true && r.added.periods === 1, r);
  const data = loadCycleData();
  const imported = data.periods.find((p) => p.startDate === "2026-10-05");
  check("Q1.5: no overwrite, both present", data.periods.length === 2 && !!imported && imported.id !== 50, data.periods.map((p) => p.id + ":" + p.startDate));
  const allSkip = importCycleDataJSON(JSON.stringify({
    periods: [{ id: 51, startDate: "2026-09-02", endDate: "2026-09-04" }],
    logs: [],
  }));
  check("Q1.5: all skipped means success:false", allSkip.success === false && allSkip.count === 0, allSkip);
  check("Q1.5: skip reasons reported", allSkip.skipped.length === 1 && allSkip.skipped[0].reason.indexOf("verlap") !== -1 && (allSkip.error || "").indexOf("skipped") !== -1, allSkip);
  check("Q1.5: vault unchanged after all-skipped", loadCycleData().periods.length === 2, loadCycleData().periods.length);
  const bad = importCycleDataJSON("not json{{{");
  check("Q1.5: malformed file fails cleanly", bad.success === false && typeof bad.error === "string", bad);
}
{
  resetVault();
  saveEvents([{ id: "evt-1", title: "exam", date: "2026-11-20", source: "manual" } as any]);
  const dup = importCycleDataJSON(JSON.stringify({ periods: [], logs: [], events: [{ id: "evt-1", title: "exam", date: "2026-11-20", source: "manual" }] }));
  check("Q4.7: identical event skipped as duplicate", dup.added.events === 0 && dup.skipped.some((s) => s.kind === "event" && s.reason.indexOf("uplicate") !== -1), dup);
  const upd = importCycleDataJSON(JSON.stringify({ periods: [], logs: [], events: [{ id: "evt-1", title: "final exam", date: "2026-11-20", source: "manual" }] }));
  check("Q4.7: same id new title merges", upd.success === true && upd.added.events === 1, upd);
  check("Q4.7: newer local event keeps its id", loadEvents().some((e) => e.id === "evt-1" && e.title === "final exam"), loadEvents());
  saveEvents([{ id: "evt-9", title: "wedding", date: "2026-12-01", source: "manual" } as any]);
  const keep = importCycleDataJSON(JSON.stringify({ periods: [{ id: 70, startDate: "2026-10-02", endDate: "2026-10-05" }], logs: [] }));
  check("Q4.7: import without events keeps local events", keep.success === true && loadEvents().some((e) => e.id === "evt-9"), loadEvents().map((e) => e.id));
  const badEv = importCycleDataJSON(JSON.stringify({ periods: [], logs: [], events: [{ id: "x", title: "", date: "2026-13-45", source: "manual" }] }));
  check("Q4.7: invalid event skipped with reasons", badEv.success === false && badEv.skipped.length === 1, badEv);
}

// --- Q1.6 App Lock ---
{
  resetVault();
  saveCycleData({ periods: [{ id: 1, startDate: "2026-10-02", endDate: "2026-10-05" } as any], logs: [] });
  let threw = "";
  try { await enableAppLock("short"); } catch (err: any) { threw = err?.message || ""; }
  check("Q1.6: short passphrase rejected", threw.indexOf("8 characters") !== -1, threw);
  await enableAppLock("long-enough-passphrase");
  check("Q1.6: enable encrypts and clears plaintext", loadCycleData().periods.length === 0 && store["feather_encrypted_vault_v1"] !== undefined && store["feather_app_lock_enabled"] === "1", Object.keys(store));
  const blobBefore = store["feather_encrypted_vault_v1"];
  await lockNow();
  check("Q1.6: lockNow does not re-encrypt an empty vault", store["feather_encrypted_vault_v1"] === blobBefore, "blob changed");
  await unlockApp("long-enough-passphrase");
  check("Q1.6: unlock restores data intact", loadCycleData().periods.length === 1 && loadCycleData().periods[0].startDate === "2026-10-02", loadCycleData().periods);
  check("Q1.6: flag-based enabled", isAppLockEnabled() === true, null);
  forgetPassphrase();
  check("Q1.6: reload still asks (flag set)", needsUnlockOnLoad() === true, null);
  delete store["feather_encrypted_vault_v1"];
  check("Q1.6: flag set but blob missing still needs unlock (error state, not no-lock)", needsUnlockOnLoad() === true, null);
  await disableAppLock("long-enough-passphrase");
  check("Q1.6: disable clears flag", isAppLockEnabled() === false, null);
}

// --- Q1.7 ICS: RFC monthly skip, live DTSTAMP, outside-window warning ---
{
  const monthly = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:m1", "SUMMARY:Dues", "DTSTART;VALUE=DATE:20260131", "RRULE:FREQ=MONTHLY;COUNT=5", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const res = parseICS(monthly, "2026-01-01", "2026-12-31");
  const got = res.events.map((e) => e.date);
  check("Q1.7: Jan 31 monthly skips short months", got.length === 5 && got.join(",") === "2026-01-31,2026-03-31,2026-05-31,2026-07-31,2026-08-31", got.join(","));
  check("Q1.7: no rollover dates", got.every((d) => d.slice(8, 10) === "31"), got.join(","));
  const stamped = buildICS([{ id: "1", title: "x", date: "2026-11-05", source: "manual" }]);
  const m = stamped.match(/DTSTAMP:(\d{8}T\d{6}Z)/);
  check("Q1.7: DTSTAMP is export time", !!m && m[1].slice(0, 4) === String(new Date().getUTCFullYear()), m && m[1]);
  const far = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:f1", "SUMMARY:Future", "DTSTART;VALUE=DATE:20300101", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const res2 = parseICS(far, "2026-01-01", "2026-12-31");
  check("Q1.7: outside-window event dropped with count", res2.events.length === 0 && res2.warnings.some((w) => w.indexOf("1 imported event") !== -1 && w.indexOf("outside the import window") !== -1), res2.warnings);
}

console.log("Q1 Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
