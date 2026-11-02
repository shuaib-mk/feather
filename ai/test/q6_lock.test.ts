/** Q6.1: App Lock lockout. enable -> lock -> reload -> wrong -> correct must
 * unlock with data intact and never strand the user on the error screen. */
import { saveCycleData, loadCycleData } from "../../client/src/cycleStorage";
import { enableAppLock, unlockApp, lockNow, isLocked, forgetPassphrase, getLockState, eraseLockAndStartFresh } from "../../client/src/lib/appLock";
import { ENCRYPTED_VAULT_KEY, decryptJSON, VAULT_PLAINTEXT_KEYS } from "../../client/src/lib/vaultCrypto";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
function resetVault() { for (const k in store) delete store[k]; }

{
  resetVault();
  saveCycleData({ periods: [{ id: 1, startDate: "2026-10-02", endDate: "2026-10-06" } as any], logs: [{ id: 1, logDate: "2026-10-02", flow: "heavy", symptoms: ["cramps"], mood: null, energy: null, sleepHours: null, notes: null } as any] });
  const before: Record<string, string | null> = {};
  for (const k of VAULT_PLAINTEXT_KEYS) before[k] = store[k] ?? null;
  await enableAppLock("correct-horse-12");
  check("Q6.1: enable sets flag and blob, clears plaintext", store["feather_app_lock_enabled"] === "1" && store[ENCRYPTED_VAULT_KEY] != null && store["feather_cycle_vault_v1"] == null, Object.keys(store));
  const payload = JSON.parse(store[ENCRYPTED_VAULT_KEY]);
  const back: any = await decryptJSON("correct-horse-12", payload);
  check("Q6.1: blob decrypt-and-compares to pre-enable plaintext", JSON.stringify((back && back.keys) || null) === JSON.stringify(before), "decrypt-compare");
  await lockNow();
  check("Q6.1: locked after lockNow", isLocked() && getLockState() === "locked", getLockState());
  forgetPassphrase();
  check("Q6.1: reload asks (locked, not error)", isLocked() && getLockState() === "locked", getLockState());
  let wrongErr = "";
  try { await unlockApp("wrong-pass-1"); } catch (e: any) { wrongErr = String((e && e.message) || e); }
  check("Q6.1: wrong passphrase rejected, blob intact", wrongErr !== "" && store[ENCRYPTED_VAULT_KEY] != null && getLockState() === "locked", wrongErr.slice(0, 40));
  await unlockApp("correct-horse-12");
  const data = loadCycleData();
  check("Q6.1: correct passphrase unlocks with data back", data.periods.length === 1 && data.logs.length === 1 && !isLocked(), JSON.stringify(data.periods.length));
  forgetPassphrase();
  check("Q6.1: post-unlock reload shows app, never the error screen", getLockState() === "open", getLockState());
}

{
  resetVault();
  store["feather_app_lock_enabled"] = "1";
  check("Q6.1: genuine corruption (flag, no blob, no data) is error state", getLockState() === "error", getLockState());
  saveCycleData({ periods: [{ id: 2, startDate: "2026-09-01", endDate: "2026-09-05" } as any], logs: [] });
  await enableAppLock("another-good-pass");
  check("Q6.1: flag+blob is locked state", getLockState() === "locked", getLockState());
  eraseLockAndStartFresh();
  check("Q6.1: erase clears flag and blob (locked blob is discarded with it)", store["feather_app_lock_enabled"] == null && store[ENCRYPTED_VAULT_KEY] == null && getLockState() === "open", Object.keys(store));
  resetVault();
}

console.log("Q6 Lock Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
