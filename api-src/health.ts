import { getConfig } from "../ai/backend/config";
import { corsAllowOrigin } from "../ai/backend/protection";
export function healthPayload() {
  const c = getConfig();
  const sha = (typeof process !== "undefined" && process.env ? String(process.env.VERCEL_GIT_COMMIT_SHA || "") : "").slice(0, 7);
  return { metaKeyConfigured: !!c.metaApiKey, voiceModel: c.museVoiceModel, sparkModel: c.museSparkModel, baseUrl: c.metaBaseUrl, basetenConfigured: !!c.basetenApiKey, buildId: sha || null };
}
/** Group 15.3: unauthenticated callers get status only. The detailed payload
 * (key configured, model ids, base URL, build) needs the DIAGNOSTICS_TOKEN
 * header, so it never leaks configuration to the public. */
export function publicHealthPayload(): { status: "ok" } { return { status: "ok" }; }
export function healthPayloadFor(req: any): any {
  const token = typeof process !== "undefined" && process.env ? process.env.DIAGNOSTICS_TOKEN || "" : "";
  const sent = req?.headers?.["x-feather-diagnostics"];
  return token && sent && String(sent) === token ? healthPayload() : publicHealthPayload();
}
export async function handler(req: any, res?: any) {
  const payload = healthPayloadFor(req);
  if (res?.setHeader) { const aco = corsAllowOrigin(req); if (aco) res.setHeader("Access-Control-Allow-Origin", aco); res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); }
  if (typeof res?.status === "function") return res.status(200).json(payload);
  if (!res && req?.httpMethod) return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
  if (res?.writeHead) { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(payload)); }
  return payload;
}
export default handler;
