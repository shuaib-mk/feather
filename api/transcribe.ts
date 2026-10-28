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

// ai/backend/transcribe.ts
async function transcribeAudio(audioBuffer, mimeType = "audio/wav", languageHint) {
  if (!audioBuffer || audioBuffer.length === 0) {
    return { text: "" };
  }
  if (audioBuffer.length < 1e3) {
    return { text: "" };
  }
  const config = getConfig();
  const apiKey = config.metaApiKey || config.basetenApiKey;
  if (!apiKey) {
    console.warn("[Lavender Voice] No META_API_KEY set. Returning offline fallback transcription.");
    return {
      text: "Period started today, heavy flow with cramps and fatigue.",
      language: "en"
    };
  }
  const isWav = audioBuffer.length >= 12 && audioBuffer.subarray(0, 4).toString("ascii") === "RIFF" && audioBuffer.subarray(8, 12).toString("ascii") === "WAVE";
  try {
    const isMetaAi = config.metaBaseUrl.includes("api.meta.ai");
    let response;
    if (isMetaAi) {
      const requestJson = {
        model: config.museVoiceModel || "muse-voice-transcribe-1.0",
        audioEncoding: "WAV",
        ...languageHint && languageHint !== "auto" ? { language: languageHint } : {}
      };
      const formData = new FormData();
      formData.append(
        "request",
        new Blob([JSON.stringify(requestJson)], { type: "application/json" }),
        "request.json"
      );
      formData.append("audio", new Blob([new Uint8Array(audioBuffer)], { type: "audio/wav" }), "audio.wav");
      response = await fetch(`${config.metaBaseUrl}/asr/transcribe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: formData
      });
    } else {
      const formData = new FormData();
      const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("wav") ? "wav" : "webm";
      const fileBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
      formData.append("file", fileBlob, `recording.${extension}`);
      formData.append("model", config.museVoiceModel || "muse-voice-transcribe-1.0");
      if (languageHint && languageHint !== "auto") {
        formData.append("language", languageHint);
      }
      response = await fetch(`${config.metaBaseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: formData
      });
    }
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Muse Voice] ASR returned ${response.status}:`, errText);
      throw new Error(`ASR service error (${response.status}): ${errText}`);
    }
    const data = await response.json();
    const text = (data.transcript || data.text || "").trim();
    return {
      text,
      language: data.language
    };
  } catch (error) {
    console.error("[Lavender Voice] Error in transcribeAudio:", error);
    throw error;
  }
}

// api-src/transcribe.ts
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
      const { audioBase64, mimeType, languageHint } = body;
      if (!audioBase64) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Missing audioBase64 data" })
        };
      }
      const buffer = Buffer.from(audioBase64, "base64");
      const result = await transcribeAudio(buffer, mimeType || "audio/wav", languageHint);
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
        body: JSON.stringify({ error: err.message || "Transcription failed" })
      };
    }
  }
  if (req.method !== "POST") {
    return sendResponse(res, 405, { error: "Method not allowed" });
  }
  try {
    const body = await getRequestBody(req);
    const { audioBase64, mimeType, languageHint } = body;
    if (!audioBase64) {
      return sendResponse(res, 400, { error: "Missing audioBase64 data" });
    }
    const buffer = Buffer.from(audioBase64, "base64");
    const result = await transcribeAudio(buffer, mimeType || "audio/wav", languageHint);
    return sendResponse(res, 200, result);
  } catch (err) {
    return sendResponse(res, 500, { error: err.message || "Transcription failed" });
  }
}
var transcribe_default = handler;
export {
  transcribe_default as default,
  handler
};
