import { encryptVaultToStorage, decryptVaultFromStorage, ENCRYPTED_VAULT_KEY, hasPlaintextVault } from "./vaultCrypto";
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
  sessionPassphrase = passphrase; locked = false;
  try { localStorage.setItem("feather_app_lock_enabled","1"); } catch {}
}
export async function unlockApp(passphrase:string): Promise<void> { await decryptVaultFromStorage(passphrase, localStorage); sessionPassphrase = passphrase; locked = false; }
export async function lockNow(): Promise<void> {
  if (!sessionPassphrase) throw new Error("Enter your passphrase to lock.");
  if (hasPlaintextVault(localStorage)) await encryptVaultToStorage(sessionPassphrase, localStorage);
  locked = true;
  if (typeof window !== "undefined" && window.location) window.location.reload();
}
export async function disableAppLock(passphrase:string): Promise<void> { let hasBlob = false; try { hasBlob = !!localStorage.getItem(ENCRYPTED_VAULT_KEY); } catch {} if (isAppLockEnabled() && hasBlob) await decryptVaultFromStorage(passphrase, localStorage); sessionPassphrase = null; locked = false; try { localStorage.removeItem("feather_app_lock_enabled"); } catch {} }
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
  try { if (hasPlaintextVault(localStorage)) return "open"; } catch {}
  return "error";
}
/** Q6.1: erase the lock flag and the encrypted blob (data itself is untouched).
 * Used after explicit confirmation on the lock/error screens. */
export function eraseLockAndStartFresh(): void {
  try { localStorage.removeItem("feather_app_lock_enabled"); } catch {}
  try { localStorage.removeItem(ENCRYPTED_VAULT_KEY); } catch {}
  sessionPassphrase = null; locked = false;
}
