
import { encryptJSON, decryptJSON, isEncryptedPayload, encryptVaultToStorage, decryptVaultFromStorage, PBKDF2_ITERATIONS } from "../../client/src/lib/vaultCrypto";
let passed=0,failed=0; function check(n:string,c:boolean,x=""){ if(c){console.log(`[PASS] ${n}`);passed++;} else {console.error(`[FAIL] ${n} ${x}`);failed++;} }
class MemStorage { m=new Map<string,string>(); getItem(k:string){return this.m.get(k)??null;} setItem(k:string,v:string){this.m.set(k,v);} removeItem(k:string){this.m.delete(k);} }
async function main(){
  check("PBKDF2 iterations >= 600k", PBKDF2_ITERATIONS>=600000);
  const payload = await encryptJSON("correct horse battery staple", {periods:[{startDate:"2026-01-01"}]});
  check("encrypted payload shape", isEncryptedPayload(payload) && payload.kdf==="PBKDF2-SHA-256");
  const back:any = await decryptJSON("correct horse battery staple", payload);
  check("encrypt/decrypt roundtrip", back.periods[0].startDate==="2026-01-01");
  let wrongFailed=false; try{ await decryptJSON("wrong passphrase", payload); }catch{ wrongFailed=true; }
  check("wrong key fails", wrongFailed);
  const tampered={...payload, ciphertext: payload.ciphertext.slice(0,-4)+"AAAA"}; let tamperFailed=false; try{ await decryptJSON("correct horse battery staple", tampered); }catch{ tamperFailed=true; }
  check("tamper detection (GCM)", tamperFailed);
  const storage:any=new MemStorage(); storage.setItem("feather_cycle_vault_v1", JSON.stringify({periods:[1]}));
  await encryptVaultToStorage("pass phrase one two", storage);
  check("migration to encrypted removes plaintext", storage.getItem("feather_cycle_vault_v1")===null && !!storage.getItem("feather_encrypted_vault_v1"));
  await decryptVaultFromStorage("pass phrase one two", storage);
  check("migration back decrypts", JSON.parse(storage.getItem("feather_cycle_vault_v1")).periods[0]===1 && storage.getItem("feather_encrypted_vault_v1")===null);
  console.log(`\nBatch6 Results: ${passed} passed, ${failed} failed.`); if(failed) process.exit(1);
}
main().catch(e=>{console.error(e);process.exit(1);});
