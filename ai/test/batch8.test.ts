
import { buildDemoData, DEMO_KEY } from "../../client/src/lib/demoMode";
let passed=0, failed=0; const failures:string[]=[];
function check(n:string,c:boolean){ if(c) passed++; else {failed++; failures.push(n);} }
const d=buildDemoData("2026-10-30");
check("demo key separate", DEMO_KEY==="feather_demo_v1");
check("7 fictional cycles", d.periods.length===7);
const lens=d.periods.slice(1).map((p,i)=> Math.round((Date.parse(p.startDate)-Date.parse(d.periods[i].startDate))/86400000));
check("lengths 26-38", lens.every((n)=>n>=26&&n<=38));
check("fictional events labelled", d.events.every((e:any)=>/fictional/i.test(e.title)));
// isolation: in-memory storage shim
const store=new Map<string,string>(); (globalThis as any).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v)},removeItem:(k:string)=>{store.delete(k)}};
store.set("feather_cycle_vault_v1", JSON.stringify({periods:[{id:1,startDate:"2026-01-01"}],logs:[]}));
const { enterDemoMode, exitDemoMode, isDemoActive } = await import("../../client/src/lib/demoMode");
enterDemoMode(); check("demo active", isDemoActive()===true && !!store.get(DEMO_KEY));
exitDemoMode(); check("exit leaves real vault untouched", store.get("feather_cycle_vault_v1")!.includes("2026-01-01") && !isDemoActive());
console.log(`Batch8: ${passed} passed, ${failed} failed`); if(failures.length) console.log(failures.join("\n")); if(failed) process.exit(1);
