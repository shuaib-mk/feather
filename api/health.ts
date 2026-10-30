// Generated self-contained serverless bundle (Vercel & Netlify compatible)

// ai/backend/config.ts
function getConfig() {
  if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile();
    } catch {
    }
  }
  const env = typeof process !== "undefined" && process?.env ? process.env : {};
  const useBaseten = env.USE_BASETEN === "true";
  const metaApiKey = env.META_API_KEY || "";
  const basetenApiKey = env.BASETEN_API_KEY || "";
  return {
    metaApiKey,
    metaBaseUrl: env.META_BASE_URL || "https://api.meta.ai/v1",
    museVoiceModel: env.MUSE_VOICE_MODEL || "muse-voice-transcribe-1.0",
    museSparkModel: env.MUSE_SPARK_MODEL || "muse-spark-1.3",
    basetenApiKey,
    basetenBaseUrl: env.BASETEN_BASE_URL || "https://bridge.baseten.co/v1",
    useBaseten,
    port: parseInt(env.PORT || "3001", 10)
  };
}

// client/src/lib/localDate.ts
function formatDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function toLocalKey(date) {
  return formatDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}
function todayLocal(now = /* @__PURE__ */ new Date()) {
  return toLocalKey(now);
}

// ai/backend/protection.ts
var globalDailyTracker = { count: 0, day: todayLocal() };
function requestHost(req) {
  const h = req && req.headers || {};
  const raw = h["x-forwarded-host"] || h["host"] || "";
  return String(Array.isArray(raw) ? raw[0] : raw).split(",")[0].trim().toLowerCase();
}
function configuredAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function isOriginAllowed(originOrReferer, reqOrHost) {
  if (!originOrReferer) return true;
  let originHost = "";
  try {
    originHost = new URL(originOrReferer).host.toLowerCase();
  } catch {
    return false;
  }
  const ownHost = typeof reqOrHost === "string" ? reqOrHost.toLowerCase() : reqOrHost ? requestHost(reqOrHost) : "";
  if (ownHost && originHost === ownHost) return true;
  return configuredAllowedOrigins().some((entry) => {
    try {
      return new URL(entry.includes("://") ? entry : `https://${entry}`).host.toLowerCase() === originHost;
    } catch {
      return entry === originHost;
    }
  });
}
function corsAllowOrigin(req) {
  const origin = req?.headers?.origin;
  if (!origin) return void 0;
  return isOriginAllowed(origin, req) ? origin : void 0;
}

// api-src/health.ts
function healthPayload() {
  const c = getConfig();
  return { metaKeyConfigured: !!c.metaApiKey, voiceModel: c.museVoiceModel, sparkModel: c.museSparkModel, baseUrl: c.metaBaseUrl, basetenConfigured: !!c.basetenApiKey };
}
async function handler(req, res) {
  const payload = healthPayload();
  if (res?.setHeader) {
    const aco = corsAllowOrigin(req);
    if (aco) res.setHeader("Access-Control-Allow-Origin", aco);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  }
  if (typeof res?.status === "function") return res.status(200).json(payload);
  if (!res && req?.httpMethod) return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
  if (res?.writeHead) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(payload));
  }
  return payload;
}
var health_default = handler;
export {
  health_default as default,
  handler,
  healthPayload
};
