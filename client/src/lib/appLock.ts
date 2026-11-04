import { encryptVaultToStorage, decryptVaultFromStorage, ENCRYPTED_VAULT_KEY, hasPlaintextVault, encryptJSON, decryptJSON } from "./vaultCrypto";

/** Group 15.5 storage keys (no secret is ever stored: the verifier is an
 * AES-GCM blob that only the right passphrase can open). */
export const UNLOCK_FAILURES_KEY = "feather_unlock_failures";
export const UNLOCK_BLOCKED_UNTIL_KEY = "feather_unlock_blocked_until";
export const LOCK_VERIFIER_KEY = "feather_lock_verifier";
export const UNLOCKED_AT_KEY = "feather_unlocked_at";
/** Group 15.5c: how long an unlocked-but-not-re-encrypted vault stays open across reloads. */
export const RECOVERY_GRACE_MS = 10 * 60 * 1000;
const ls = (): Storage | null => { try { return localStorage; } catch { return null; } };
const now = () => Date.now();

/** Group 15.5a: enforced backoff. Seconds left before another attempt is allowed. */
export function unlockWaitSeconds(): number {
  const until = parseInt(ls()?.getItem(UNLOCK_BLOCKED_UNTIL_KEY) || "0", 10) || 0;
  return Math.max(0, Math.ceil((until - now()) / 1000));
}
function recordUnlockFailure(): number {
  const n = (parseInt(ls()?.getItem(UNLOCK_FAILURES_KEY) || "0", 10) || 0) + 1;
  // Two free attempts (typos happen), then an enforced wait: 2, 4, ... 10 s,
  // then doubling to a 5-minute cap. Stored, so a reload does not reset it.
  const wait = n <= 2 ? 0 : n <= 7 ? 2 * (n - 2) : Math.min(300, 10 * 2 ** (n - 7));
  try { ls()?.setItem(UNLOCK_FAILURES_KEY, String(n)); ls()?.setItem(UNLOCK_BLOCKED_UNTIL_KEY, String(now() + wait * 1000)); } catch {}
  return wait;
}
function clearUnlockFailures(): void { try { ls()?.removeItem(UNLOCK_FAILURES_KEY); ls()?.removeItem(UNLOCK_BLOCKED_UNTIL_KEY); } catch {} }
async function writeVerifier(passphrase: string): Promise<void> {
  const v = await encryptJSON(passphrase, { feather: "lock-verifier" });
  try { ls()?.setItem(LOCK_VERIFIER_KEY, JSON.stringify(v)); } catch {}
}
function markUnlocked(): void { try { ls()?.setItem(UNLOCKED_AT_KEY, String(now())); } catch {} }

/** Group 15.5b: check a passphrase WITHOUT changing anything (encrypted blob
 * first, else the verifier). Wrong guesses count toward the enforced backoff. */
export async function verifyPassphrase(passphrase: string): Promise<boolean> {
  const wait = unlockWaitSeconds();
  if (wait > 0) throw new Error(`Too many attempts. Try again in ${wait} seconds.`);
  const store = ls();
  const blob = store?.getItem(ENCRYPTED_VAULT_KEY);
  const verifier = store?.getItem(LOCK_VERIFIER_KEY);
  try {
    if (blob) await decryptJSON(passphrase, JSON.parse(blob));
    else if (verifier) await decryptJSON(passphrase, JSON.parse(verifier));
    else return false;
  } catch {
    const w = recordUnlockFailure();
    throw new Error(w > 0 ? `Wrong passphrase. Please wait ${w} seconds and try again.` : "Wrong passphrase. Please try again.");
  }
  clearUnlockFailures();
  return true;
}
// The passphrase (and therefore the derived key) exists only in this in-memory variable. It is never written to storage.
let sessionPassphrase: string | null = null;
let locked = false;
/** Enabled follows the explicit flag, never the blob alone: on a new session with the flag set, always ask for the passphrase. */
export function isAppLockEnabled(): boolean { try { return localStorage.getItem("feather_app_lock_enabled") === "1"; } catch { return false; } }
export function isLocked(): boolean { return isAppLockEnabled() && locked; }
export function needsUnlockOnLoad(): boolean { return isAppLockEnabled(); }
/** Forget the in-memory passphrase (simulated reload, purge). The flag stays; unlock will be asked again. */
export function forgetPassphrase(): void { sessionPassphrase = null; locked = true; }
export async function enableAppLock(passphrase:string): Promise<void> {
  if (!passphrase || passphrase.length < 8) throw new Error("Use a passphrase with at least 8 characters (12+ recommended).");
  await encryptVaultToStorage(passphrase, localStorage);
  await writeVerifier(passphrase);
  sessionPassphrase = passphrase; locked = false;
  try { localStorage.setItem("feather_app_lock_enabled","1"); } catch {}
}
export async function unlockApp(passphrase:string): Promise<void> {
  // Group 15.5a: the wait is enforced here, not only shown in the UI.
  const wait = unlockWaitSeconds();
  if (wait > 0) throw new Error(`Too many attempts. Try again in ${wait} seconds.`);
  let hasBlob = false; try { hasBlob = !!localStorage.getItem(ENCRYPTED_VAULT_KEY); } catch {}
  try {
    if (hasBlob) await decryptVaultFromStorage(passphrase, localStorage);
    else await verifyPassphrase(passphrase);
  } catch (e: any) {
    if (hasBlob) { const w = recordUnlockFailure(); throw new Error(w > 0 ? `Wrong passphrase. Please wait ${w} seconds and try again.` : "Wrong passphrase. Please try again."); }
    throw e;
  }
  clearUnlockFailures();
  if (!(ls()?.getItem(LOCK_VERIFIER_KEY))) await writeVerifier(passphrase);
  markUnlocked();
  sessionPassphrase = passphrase; locked = false;
}
export async function lockNow(): Promise<void> {
  if (!sessionPassphrase) throw new Error("Enter your passphrase to lock.");
  if (hasPlaintextVault(localStorage)) await encryptVaultToStorage(sessionPassphrase, localStorage);
  locked = true;
  if (typeof window !== "undefined" && window.location) window.location.reload();
}
export async function disableAppLock(passphrase:string): Promise<void> { let hasBlob = false; try { hasBlob = !!localStorage.getItem(ENCRYPTED_VAULT_KEY); } catch {} if (isAppLockEnabled() && hasBlob) await decryptVaultFromStorage(passphrase, localStorage); sessionPassphrase = null; locked = false; try { localStorage.removeItem("feather_app_lock_enabled"); localStorage.removeItem(LOCK_VERIFIER_KEY); localStorage.removeItem(UNLOCKED_AT_KEY); } catch {} }
export function markLockedOnLoad(): void { locked = isAppLockEnabled(); }
/** Q6.1: lock-gate state. "locked" only when a passphrase can actually be
 * verified (flag + blob). Flag + blob missing but plaintext present means a
 * good unlock already restored the vault: show the app, not the error screen. */
export function getLockState(): "open" | "locked" | "error" {
  let flag = false;
  let blob = false;
  try { flag = localStorage.getItem("feather_app_lock_enabled") === "1"; } catch {}
  try { blob = !!localStorage.getItem(ENCRYPTED_VAULT_KEY); } catch {}
  if (!flag) return "open";
  if (blob) return "locked";
  try {
    if (hasPlaintextVault(localStorage)) {
      // Group 15.5c: the recovery state (flag on, no blob, plaintext present) is
      // open only for a short grace window after a real unlock; after that the
      // passphrase is required again (checked against the verifier). Vaults
      // locked before the verifier existed cannot be checked and stay open.
      if (sessionPassphrase) return "open";
      const at = parseInt(localStorage.getItem(UNLOCKED_AT_KEY) || "0", 10) || 0;
      const hasVerifier = !!localStorage.getItem(LOCK_VERIFIER_KEY);
      if (!hasVerifier) return "open";
      return now() - at <= RECOVERY_GRACE_MS ? "open" : "locked";
    }
  } catch {}
  return "error";
}

/** Group 15.5b: destructive actions on the lock screen. While encrypted data
 * (or a verifier) exists, the passphrase is required; with nothing to protect
 * (the error state) erase proceeds after the on-screen confirmation. */
export async function eraseLockWithPassphrase(passphrase: string): Promise<void> {
  let protectedData = false;
  try { protectedData = !!localStorage.getItem(ENCRYPTED_VAULT_KEY) || (!!localStorage.getItem(LOCK_VERIFIER_KEY) && getLockState() === "locked"); } catch {}
  if (protectedData) {
    const ok = await verifyPassphrase(passphrase);
    if (!ok) throw new Error("Enter your passphrase to erase.");
  }
  eraseLockAndStartFresh();
}
/** Q6.1: erase the lock flag and the encrypted blob (data itself is untouched).
 * Used after explicit confirmation on the lock/error screens. */
export function eraseLockAndStartFresh(): void {
  try { localStorage.removeItem(LOCK_VERIFIER_KEY); localStorage.removeItem(UNLOCKED_AT_KEY); clearUnlockFailures(); } catch {}
  try { localStorage.removeItem("feather_app_lock_enabled"); } catch {}
  try { localStorage.removeItem(ENCRYPTED_VAULT_KEY); } catch {}
  try { localStorage.removeItem("feather_last_export_ts"); } catch {}
  try { localStorage.removeItem("feather_entries_since_export"); } catch {}
  sessionPassphrase = null; locked = false;
}
