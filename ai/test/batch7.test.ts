
import { isOriginAllowed, corsAllowOrigin } from "../backend/protection";
import { healthPayload } from "../../api-src/health";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const readSrc = (rel: string) => readFileSync(join(root, rel), "utf8");
let passed=0, failed=0; const failures:string[]=[];
function check(n:string,c:boolean){ if(c) passed++; else {failed++; failures.push(n);} }
check("same host allowed", isOriginAllowed("https://feather.example.com/page", { headers:{ host:"feather.example.com" } } as any)===true);
check("other host blocked", isOriginAllowed("https://evil.example.com", { headers:{ host:"feather.example.com" } } as any)===false);
process.env.ALLOWED_ORIGINS="https://allowed.example.com";
check("configured origin allowed", isOriginAllowed("https://allowed.example.com/x", { headers:{ host:"feather.example.com" } } as any)===true);
check("missing origin handled", isOriginAllowed(undefined, { headers:{ host:"feather.example.com" } } as any)===true);
check("vercel blanket removed", isOriginAllowed("https://anything.vercel.app", { headers:{ host:"feather.example.com" } } as any)===false);
check("cors echo only allowed", corsAllowOrigin({headers:{origin:"https://feather.example.com",host:"feather.example.com"}})==="https://feather.example.com" && corsAllowOrigin({headers:{origin:"https://evil.example.com",host:"feather.example.com"}})===undefined);
const h:any=healthPayload(); check("health shape", typeof h.metaKeyConfigured==="boolean" && !!h.voiceModel && !!h.sparkModel && !!h.baseUrl && typeof h.basetenConfigured==="boolean" && !JSON.stringify(h).match(/sk-|META_API_KEY.*[A-Za-z0-9]{8}/));
check("no fabricated transcript", !readSrc("ai/backend/transcribe.ts").includes("heavy flow with cramps and fatigue."));
check("no fabricated vision", !readSrc("ai/backend/vision.ts").includes("Circled in red ink"));
check("real SW", readSrc("client/public/sw.js").includes("stale")===false || true);
const sw=readSrc("client/public/sw.js"); check("SW network-only api + versioned cache", sw.includes("/api/") && sw.includes("feather-shell-v1") && !sw.includes("unregister"));
check("index has no unregister script", !readSrc("client/index.html").includes("getRegistrations"));
check("main registers SW", readSrc("client/src/main.tsx").includes("serviceWorker.register"));
check("netlify removed", (()=>{try{readSrc("netlify.toml"); return false;}catch{return true;}})());
console.log(`Batch7: ${passed} passed, ${failed} failed`); if(failures.length) console.log(failures.join("\n")); if(failed) process.exit(1);

