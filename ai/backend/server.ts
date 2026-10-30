// Backend HTTP server hosting serverless-style endpoints:
// /api/transcribe, /api/agent, /api/vision, /api/health
// Built with native Node.js HTTP for zero-friction local and cloud execution.

import http from "node:http";
import { getConfig } from "./config";
import { transcribeAudio } from "./transcribe";
import { runLavenderAgent } from "./agent";
import { extractDiaryDates } from "./vision";
import { corsAllowOrigin } from "./protection";
import { healthPayload } from "../../api-src/health";

const config = getConfig();

// Simple in-memory sliding rate-limiter (e.g. 60 requests per minute per IP)
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 60;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = ipHits.get(ip);
  if (!record || now > record.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  record.count++;
  return record.count > MAX_REQUESTS_PER_WINDOW;
}

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  const body = JSON.stringify(data);
  const _aco = corsAllowOrigin((res as any).req);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...(_aco ? { "Access-Control-Allow-Origin": _aco } : {}),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(body);
}

function parseBody(req: http.IncomingMessage): Promise<{ raw: Buffer; json: any }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks);
      let json = {};
      if (req.headers["content-type"]?.includes("application/json")) {
        try {
          json = JSON.parse(raw.toString("utf8"));
        } catch {
          json = {};
        }
      }
      resolve({ raw, json });
    });
    req.on("error", reject);
  });
}

export function createAiServer() {
  const server = http.createServer(async (req, res) => {
    // CORS Preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": corsAllowOrigin(req) || "null",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      return res.end();
    }

    const clientIp = req.socket.remoteAddress || "unknown";
    if (isRateLimited(clientIp)) {
      return sendJson(res, 429, { error: "Rate limit exceeded. Please wait a moment." });
    }

    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
      // 1. Health check
      if (req.method === "GET" && pathname === "/api/health") { return sendJson(res, 200, healthPayload()); }

      // 2. Audio transcription endpoint (/api/transcribe)
      if (req.method === "POST" && pathname === "/api/transcribe") {
        const { raw, json } = await parseBody(req);
        let audioBuffer: Buffer;
        let mimeType = "audio/webm";
        let languageHint: string | undefined;

        if (json && json.audioBase64) {
          audioBuffer = Buffer.from(json.audioBase64, "base64");
          mimeType = json.mimeType || mimeType;
          languageHint = json.languageHint;
        } else {
          audioBuffer = raw;
          mimeType = (req.headers["content-type"] as string) || mimeType;
        }

        const result = await transcribeAudio(audioBuffer, mimeType, languageHint);
        return sendJson(res, 200, result);
      }

      // 3. Agent Tool-Calling Endpoint (/api/agent)
      if (req.method === "POST" && pathname === "/api/agent") {
        const { json } = await parseBody(req);
        const { message, context, conversationHistory } = json;

        if (!message || typeof message !== "string") {
          return sendJson(res, 400, { error: "Missing or invalid 'message' parameter." });
        }

        const result = await runLavenderAgent(message, context || {}, conversationHistory || []);
        return sendJson(res, 200, result);
      }

      // 4. Vision Paper Diary Extraction (/api/vision)
      if (req.method === "POST" && pathname === "/api/vision") {
        const { json } = await parseBody(req);
        const { imageBase64, mimeType } = json;

        if (!imageBase64 || typeof imageBase64 !== "string") {
          return sendJson(res, 400, { error: "Missing 'imageBase64' image string." });
        }

        const result = await extractDiaryDates(imageBase64, mimeType || "image/jpeg");
        return sendJson(res, 200, result);
      }

      

      // 404 for unknown routes
      return sendJson(res, 404, { error: "Endpoint not found." });
    } catch (err: any) {
      console.error(`[Server Error] ${pathname}:`, err);
      return sendJson(res, 500, {
        error: "Internal server error",
        message: err.message || "An unexpected error occurred",
      });
    }
  });

  return server;
}

// Standalone execution
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  const server = createAiServer();
  server.listen(config.port, () => {
    console.log(`[Lavender Voice AI Server] Listening on http://localhost:${config.port}`);
  });
}
