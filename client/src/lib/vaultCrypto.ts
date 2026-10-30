
const enc = new TextEncoder(); const dec = new TextDecoder();
function toB64(bytes: Uint8Array): string { let s=""; bytes.forEach((b)=>{ s+=String.fromCharCode(b); }); return btoa(s); }
function fromB64(s:string): Uint8Array { const bin=atob(s); const out=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out; }
export interface EncryptedPayload { version: 1; kdf: "PBKDF2-SHA-256"; iterations: number; salt: string; iv: string; ciphertext: string; }
export const PBKDF2_ITERATIONS = 600000;
export async function deriveKey(passphrase:string, salt:Uint8Array, iterations=PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name:"PBKDF2", salt: salt as BufferSource, iterations, hash:"SHA-256" }, base, { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]);
}
export async function encryptJSON(passphrase:string, data:unknown): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt({name:"AES-GCM", iv: iv as BufferSource}, key, enc.encode(JSON.stringify(data)));
  return { version:1, kdf:"PBKDF2-SHA-256", iterations:PBKDF2_ITERATIONS, salt:toB64(salt), iv:toB64(iv), ciphertext:toB64(new Uint8Array(ct)) };
}
export async function decryptJSON<T=any>(passphrase:string, payload:EncryptedPayload): Promise<T> {
  const key = await deriveKey(passphrase, fromB64(payload.salt), payload.iterations || PBKDF2_ITERATIONS);
  const pt = await crypto.subtle.decrypt({name:"AES-GCM", iv: fromB64(payload.iv) as BufferSource}, key, fromB64(payload.ciphertext) as BufferSource);
  return JSON.parse(dec.decode(pt));
}
export function isEncryptedPayload(x:any): x is EncryptedPayload { return !!x && x.version===1 && typeof x.ciphertext==="string" && typeof x.salt==="string"; }
export const ENCRYPTED_VAULT_KEY = "feather_encrypted_vault_v1";
export const VAULT_PLAINTEXT_KEYS = ["feather_cycle_vault_v1","feather_events_v1","feather_landmark_packs","feather_entries_since_export","feather_last_export_ts"];
export async function encryptVaultToStorage(passphrase:string, storage:Storage): Promise<void> { const data:Record<string,string|null>={}; for(const k of VAULT_PLAINTEXT_KEYS) data[k]=storage.getItem(k); const payload=await encryptJSON(passphrase,{keys:data}); storage.setItem(ENCRYPTED_VAULT_KEY, JSON.stringify(payload)); for(const k of VAULT_PLAINTEXT_KEYS) storage.removeItem(k); }
export async function decryptVaultFromStorage(passphrase:string, storage:Storage): Promise<void> { const raw=storage.getItem(ENCRYPTED_VAULT_KEY); if(!raw) throw new Error("No encrypted vault found."); const data:any=await decryptJSON(passphrase, JSON.parse(raw)); for(const [k,v] of Object.entries(data.keys||{})) { if(typeof v==="string") storage.setItem(k,v); } storage.removeItem(ENCRYPTED_VAULT_KEY); }
