/** Q6.8: build id in /api/health (short sha, no secrets). */
import { healthPayload } from "../../api-src/health";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
{
  delete process.env.VERCEL_GIT_COMMIT_SHA;
  const h: any = healthPayload();
  check("Q6.8: no sha configured gives null", h.buildId === null, h.buildId);
  check("Q6.8: no secrets leak", !JSON.stringify(h).match(/sk-|META_API_KEY.*[A-Za-z0-9]{8}|BASETEN_API_KEY/), JSON.stringify(h));
  process.env.VERCEL_GIT_COMMIT_SHA = "abc1234def5678";
  const h2: any = healthPayload();
  check("Q6.8: short sha shown", h2.buildId === "abc1234", h2.buildId);
  delete process.env.VERCEL_GIT_COMMIT_SHA;
}
console.log("Q6 Build Results: " + passed + " passed, " + failed + " failed.");
if (failed > 0) process.exit(1);
