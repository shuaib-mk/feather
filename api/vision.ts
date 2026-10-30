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

// ai/backend/vision.ts
async function extractDiaryDates(imageBase64, mimeType = "image/jpeg") {
  const config = getConfig();
  const apiKey = config.useBaseten ? config.basetenApiKey : config.metaApiKey || config.basetenApiKey;
  const baseUrl = config.useBaseten ? config.basetenBaseUrl : config.metaBaseUrl;
  const model = config.useBaseten ? "meta-models/muse-spark-open-1026" : config.museSparkModel;
  if (!apiKey) {
    const curYear = Number(todayLocal().slice(0, 4));
    return {
      periods: [
        { startDate: `${curYear}-09-02`, endDate: `${curYear}-09-07`, confidence: 0.95, notes: "Circled in red ink" },
        { startDate: `${curYear}-10-01`, endDate: `${curYear}-10-05`, confidence: 0.92, notes: "Marked with dot" }
      ],
      summary: "Detected 2 marked period cycles from calendar photo."
    };
  }
  const prompt = `You are analyzing a photo of a handwritten paper diary or wall calendar to extract marked or circled period dates.
Extract each contiguous sequence of marked dates as a period cycle.
Return ONLY valid JSON in this exact structure:
{
  "periods": [
    {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "notes": "brief description of mark (e.g., circled in red, dotted)",
      "confidence": 0.95
    }
  ],
  "summary": "Short explanation of what was found"
}
If month or year is visible, use it; otherwise assume the current year. Do not provide medical advice.`;
  const payload = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: imageBase64.startsWith("data:") ? imageBase64 : `data:${mimeType};base64,${imageBase64}`
            }
          }
        ]
      }
    ],
    temperature: 0.1
  };
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(`Vision API error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
    const parsed = JSON.parse(jsonMatch[1]);
    return {
      periods: parsed.periods || [],
      summary: parsed.summary || "Extracted period entries from paper diary photo."
    };
  } catch (err) {
    console.error("[Vision Service] Error extracting dates:", err);
    throw err;
  }
}

// ai/backend/protection.ts
var minuteHits = /* @__PURE__ */ new Map();
var dailyHits = /* @__PURE__ */ new Map();
var globalDailyTracker = { count: 0, day: todayLocal() };
var LIMIT_PER_MINUTE = 20;
var LIMIT_PER_DAY_IP = 150;
var DEFAULT_GLOBAL_DAILY_CAP = 500;
function getTodayString() {
  return todayLocal();
}
function extractClientIp(req) {
  if (!req) return "127.0.0.1";
  const headers = req.headers || {};
  const vercelRealIp = headers["x-real-ip"] || headers["x-vercel-forwarded-for"];
  if (vercelRealIp) {
    const ip = typeof vercelRealIp === "string" ? vercelRealIp.split(",")[0].trim() : String(vercelRealIp);
    if (ip) return ip;
  }
  const xForwardedFor = headers["x-forwarded-for"] || headers["client-ip"];
  if (xForwardedFor) {
    const ip = typeof xForwardedFor === "string" ? xForwardedFor.split(",")[0].trim() : String(xForwardedFor);
    if (ip) return ip;
  }
  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress;
  }
  if (req.connection?.remoteAddress) {
    return req.connection.remoteAddress;
  }
  return "127.0.0.1";
}
function isOriginAllowed(originOrReferer) {
  if (!originOrReferer) return true;
  try {
    const url = new URL(originOrReferer);
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return true;
    }
    if (host.endsWith(".vercel.app")) {
      return true;
    }
    const configuredAllowed = process.env.ALLOWED_ORIGIN;
    if (configuredAllowed && (originOrReferer.includes(configuredAllowed) || host.includes(configuredAllowed))) {
      return true;
    }
    return false;
  } catch {
    if (originOrReferer.includes("localhost") || originOrReferer.includes(".vercel.app")) {
      return true;
    }
    return false;
  }
}
function checkStatelessProtection(req, options) {
  const headers = req.headers || {};
  const origin = headers["origin"] || headers["referer"];
  if (!isOriginAllowed(origin)) {
    return {
      allowed: false,
      statusCode: 403,
      error: "Cross-origin request forbidden. Unauthorized origin.",
      code: "ORIGIN_FORBIDDEN"
    };
  }
  const contentLength = parseInt(headers["content-length"] || "0", 10);
  const maxBodyBytes = options.maxBodyBytes || (options.endpointName === "transcribe" || options.endpointName === "vision" ? 4 * 1024 * 1024 : 50 * 1024);
  if (contentLength > maxBodyBytes) {
    return {
      allowed: false,
      statusCode: 413,
      error: `Payload too large (max ${Math.round(maxBodyBytes / 1024)} KB)`,
      code: "PAYLOAD_TOO_LARGE"
    };
  }
  const clientIp = extractClientIp(req);
  const now = Date.now();
  const today = getTodayString();
  if (globalDailyTracker.day !== today) {
    globalDailyTracker = { count: 0, day: today };
  }
  const globalCap = parseInt(process.env.DAILY_REQUEST_CAP || String(DEFAULT_GLOBAL_DAILY_CAP), 10);
  if (globalDailyTracker.count >= globalCap) {
    return {
      allowed: false,
      statusCode: 429,
      error: "Daily demo limit reached (server cap). Please try again tomorrow.",
      code: "DAILY_CAP_EXCEEDED",
      clientIp
    };
  }
  const windowMs = 60 * 1e3;
  let timestamps = minuteHits.get(clientIp) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);
  if (timestamps.length >= LIMIT_PER_MINUTE) {
    return {
      allowed: false,
      statusCode: 429,
      error: "Demo limit reached, try again in a minute.",
      code: "RATE_LIMIT_MINUTE",
      clientIp
    };
  }
  const dailyRecord = dailyHits.get(clientIp);
  if (dailyRecord && dailyRecord.day === today) {
    if (dailyRecord.count >= LIMIT_PER_DAY_IP) {
      return {
        allowed: false,
        statusCode: 429,
        error: "Per-IP daily limit reached (150 requests/day). Please try again tomorrow.",
        code: "RATE_LIMIT_DAILY",
        clientIp
      };
    }
  }
  timestamps.push(now);
  minuteHits.set(clientIp, timestamps);
  if (!dailyRecord || dailyRecord.day !== today) {
    dailyHits.set(clientIp, { count: 1, day: today });
  } else {
    dailyRecord.count += 1;
  }
  globalDailyTracker.count += 1;
  if (minuteHits.size > 2e3) {
    for (const [ip, ts] of minuteHits.entries()) {
      if (ts.every((t) => now - t > windowMs)) {
        minuteHits.delete(ip);
      }
    }
  }
  return { allowed: true, clientIp };
}

// api-src/vision.ts
function sendResponse(res, statusCode, data) {
  if (res.setHeader) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (typeof res.status === "function") {
    const s = res.status(statusCode);
    if (s && typeof s.json === "function") {
      return s.json(data);
    }
    if (s && typeof s.send === "function") {
      return s.send(JSON.stringify(data));
    }
    if (s && typeof s.end === "function") {
      return s.end(JSON.stringify(data));
    }
  }
  if (typeof res.json === "function") {
    return res.json(data);
  }
  if (typeof res.writeHead === "function") {
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    return res.end(JSON.stringify(data));
  }
  if (typeof res.end === "function") {
    return res.end(JSON.stringify(data));
  }
}
async function getRequestBody(req) {
  if (req.body) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const str = Buffer.concat(chunks).toString("utf8");
    return str ? JSON.parse(str) : {};
  } catch {
    return {};
  }
}
async function handler(req, res) {
  if (req.method === "OPTIONS" || req.httpMethod === "OPTIONS") {
    if (res && res.setHeader) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (typeof res.status === "function") return res.status(204).end();
      if (typeof res.writeHead === "function") {
        res.writeHead(204);
        return res.end();
      }
    }
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      },
      body: ""
    };
  }
  const protection = checkStatelessProtection(req, {
    endpointName: "vision",
    maxBodyBytes: 6 * 1024 * 1024
  });
  if (!protection.allowed) {
    const status = protection.statusCode || 429;
    const errorBody = { error: protection.error, code: protection.code };
    if (!res && req && req.httpMethod) {
      return {
        statusCode: status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(errorBody)
      };
    }
    return sendResponse(res, status, errorBody);
  }
  if (!res && req && req.httpMethod) {
    if (req.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const { imageBase64, mimeType } = body;
      if (!imageBase64) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Missing 'imageBase64' field" })
        };
      }
      const result = await extractDiaryDates(imageBase64, mimeType || "image/jpeg");
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify(result)
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: err.message || "Vision extraction failed" })
      };
    }
  }
  if (req.method !== "POST") {
    return sendResponse(res, 405, { error: "Method not allowed" });
  }
  try {
    const body = await getRequestBody(req);
    const { imageBase64, mimeType } = body;
    if (!imageBase64) {
      return sendResponse(res, 400, { error: "Missing 'imageBase64' field" });
    }
    const result = await extractDiaryDates(imageBase64, mimeType || "image/jpeg");
    return sendResponse(res, 200, result);
  } catch (err) {
    return sendResponse(res, 500, { error: err.message || "Vision extraction failed" });
  }
}
var vision_default = handler;
export {
  vision_default as default,
  handler
};
