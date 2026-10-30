import { getConfig } from "../ai/backend/config";
import { corsAllowOrigin } from "../ai/backend/protection";
export function healthPayload() {
  const c = getConfig();
  return { metaKeyConfigured: !!c.metaApiKey, voiceModel: c.museVoiceModel, sparkModel: c.museSparkModel, baseUrl: c.metaBaseUrl, basetenConfigured: !!c.basetenApiKey };
}
export async function handler(req: any, res?: any) {
  const payload = healthPayload();
  if (res?.setHeader) { const aco = corsAllowOrigin(req); if (aco) res.setHeader("Access-Control-Allow-Origin", aco); res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); }
  if (typeof res?.status === "function") return res.status(200).json(payload);
  if (!res && req?.httpMethod) return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
  if (res?.writeHead) { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(payload)); }
  return payload;
}
export default handler;
