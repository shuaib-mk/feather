
import { encryptVaultToStorage, decryptVaultFromStorage, ENCRYPTED_VAULT_KEY } from "./vaultCrypto";
// The passphrase (and therefore the derived key) exists only in this in-memory variable. It is never written to storage.
let sessionPassphrase: string | null = null;
let locked = false;
export function isAppLockEnabled(): boolean { try { return !!localStorage.getItem(ENCRYPTED_VAULT_KEY); } catch { return false; } }
export function isLocked(): boolean { return isAppLockEnabled() && locked; }
export function needsUnlockOnLoad(): boolean { return isAppLockEnabled(); }
export async function enableAppLock(passphrase:string): Promise<void> { await encryptVaultToStorage(passphrase, localStorage); sessionPassphrase = passphrase; locked = false; try{ localStorage.setItem("feather_app_lock_enabled","1"); }catch{} }
export async function unlockApp(passphrase:string): Promise<void> { await decryptVaultFromStorage(passphrase, localStorage); sessionPassphrase = passphrase; locked = false; }
export async function lockNow(): Promise<void> { if (!sessionPassphrase) throw new Error("Enter your passphrase to lock."); await encryptVaultToStorage(sessionPassphrase, localStorage); locked = true; window.location.reload(); }
export async function disableAppLock(passphrase:string): Promise<void> { if (isAppLockEnabled()) await decryptVaultFromStorage(passphrase, localStorage); sessionPassphrase=null; locked=false; try{ localStorage.removeItem("feather_app_lock_enabled"); }catch{} }
export function markLockedOnLoad(): void { locked = isAppLockEnabled(); }
