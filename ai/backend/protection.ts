// Stateless in-memory rate limiting and request protection for serverless functions
import { todayLocal } from "../../client/src/lib/localDate";
// Protects API credits and infrastructure against abuse, crawlers, and runaway loops.

export interface ProtectionOptions {
  endpointName: "agent" | "transcribe" | "synthesis" | "vision";
  maxBodyBytes?: number;
  maxTextChars?: number;
  maxAudioSeconds?: number;
}

export interface ProtectionCheckResult {
  allowed: boolean;
  statusCode?: number;
  error?: string;
  code?: string;
  clientIp?: string;
}

// In-memory per-instance tracker
const minuteHits = new Map<string, number[]>(); // ip -> timestamps
const dailyHits = new Map<string, { count: number; day: string }>(); // ip -> { count, day }
let globalDailyTracker = { count: 0, day: todayLocal() };

const LIMIT_PER_MINUTE = 20;
const LIMIT_PER_DAY_IP = 150;
const DEFAULT_GLOBAL_DAILY_CAP = 500;

function getTodayString(): string {
  return todayLocal();
}

export function extractClientIp(req: any): string {
  if (!req) return "127.0.0.1";
  const headers = req.headers || {};
  // Vercel sets x-real-ip and x-vercel-forwarded-for to the authentic client address, preventing client spoofing
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

export function isOriginAllowed(originOrReferer: string | undefined): boolean {
  if (!originOrReferer) return true; // Direct / same-origin / non-browser dev calls allowed
  try {
    const url = new URL(originOrReferer);
    const host = url.hostname.toLowerCase();

    // Localhost
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return true;
    }

    // Vercel preview and production deployments
    if (host.endsWith(".vercel.app")) {
      return true;
    }

    // Configured custom allowed origin
    const configuredAllowed = process.env.ALLOWED_ORIGIN;
    if (configuredAllowed && (originOrReferer.includes(configuredAllowed) || host.includes(configuredAllowed))) {
      return true;
    }

    return false;
  } catch {
    // If invalid URL, check string match
    if (originOrReferer.includes("localhost") || originOrReferer.includes(".vercel.app")) {
      return true;
    }
    return false;
  }
}

/**
 * Validates request origin, body size, text length, and rate limits.
 */
export function checkStatelessProtection(req: any, options: ProtectionOptions): ProtectionCheckResult {
  const headers = req.headers || {};
  const origin = headers["origin"] || headers["referer"];

  // 1. Allowed Origin Check
  if (!isOriginAllowed(origin)) {
    return {
      allowed: false,
      statusCode: 403,
      error: "Cross-origin request forbidden. Unauthorized origin.",
      code: "ORIGIN_FORBIDDEN",
    };
  }

  // 2. Request Payload Size Check (if Content-Length is present)
  const contentLength = parseInt(headers["content-length"] || "0", 10);
  const maxBodyBytes = options.maxBodyBytes || (options.endpointName === "transcribe" || options.endpointName === "vision" ? 4 * 1024 * 1024 : 50 * 1024);
  if (contentLength > maxBodyBytes) {
    return {
      allowed: false,
      statusCode: 413,
      error: `Payload too large (max ${Math.round(maxBodyBytes / 1024)} KB)`,
      code: "PAYLOAD_TOO_LARGE",
    };
  }

  // 3. Client IP & In-Memory Rate Limiting
  const clientIp = extractClientIp(req);
  const now = Date.now();
  const today = getTodayString();

  // Reset global daily tracker if day rolled over
  if (globalDailyTracker.day !== today) {
    globalDailyTracker = { count: 0, day: today };
  }

  // Server-side daily cap check
  const globalCap = parseInt(process.env.DAILY_REQUEST_CAP || String(DEFAULT_GLOBAL_DAILY_CAP), 10);
  if (globalDailyTracker.count >= globalCap) {
    return {
      allowed: false,
      statusCode: 429,
      error: "Daily demo limit reached (server cap). Please try again tomorrow.",
      code: "DAILY_CAP_EXCEEDED",
      clientIp,
    };
  }

  // Minute-window rate limiting per IP (sliding window of 60 seconds)
  const windowMs = 60 * 1000;
  let timestamps = minuteHits.get(clientIp) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);
  if (timestamps.length >= LIMIT_PER_MINUTE) {
    return {
      allowed: false,
      statusCode: 429,
      error: "Demo limit reached, try again in a minute.",
      code: "RATE_LIMIT_MINUTE",
      clientIp,
    };
  }

  // Daily-window rate limiting per IP
  const dailyRecord = dailyHits.get(clientIp);
  if (dailyRecord && dailyRecord.day === today) {
    if (dailyRecord.count >= LIMIT_PER_DAY_IP) {
      return {
        allowed: false,
        statusCode: 429,
        error: "Per-IP daily limit reached (150 requests/day). Please try again tomorrow.",
        code: "RATE_LIMIT_DAILY",
        clientIp,
      };
    }
  }

  // Record hit
  timestamps.push(now);
  minuteHits.set(clientIp, timestamps);

  if (!dailyRecord || dailyRecord.day !== today) {
    dailyHits.set(clientIp, { count: 1, day: today });
  } else {
    dailyRecord.count += 1;
  }
  globalDailyTracker.count += 1;

  // Periodic cleanup of stale IPs from minuteHits
  if (minuteHits.size > 2000) {
    for (const [ip, ts] of minuteHits.entries()) {
      if (ts.every((t) => now - t > windowMs)) {
        minuteHits.delete(ip);
      }
    }
  }

  return { allowed: true, clientIp };
}

/**
 * Validates text length (e.g. 1000 character maximum)
 */
export function validateTextLength(text: string, maxChars = 1000): { valid: boolean; error?: string } {
  if (text && text.length > maxChars) {
    return {
      valid: false,
      error: `Input text exceeds maximum allowed length of ${maxChars} characters (provided: ${text.length}).`,
    };
  }
  return { valid: true };
}

/**
 * Estimates audio duration in seconds from buffer size and format.
 * Rejects audio exceeding maxSeconds (default 30s).
 */
export function validateAudioBuffer(buffer: Buffer, mimeType: string, maxSeconds = 30): { valid: boolean; durationEstimateSeconds: number; error?: string } {
  const byteLength = buffer.length;

  // If WAV header is present, parse sample rate and channels for exact duration
  let durationEstimate = 0;
  if (byteLength > 44 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE") {
    try {
      const channels = buffer.readUInt16LE(22);
      const sampleRate = buffer.readUInt32LE(24);
      const byteRate = buffer.readUInt32LE(28);
      if (byteRate > 0) {
        durationEstimate = (byteLength - 44) / byteRate;
      } else if (channels > 0 && sampleRate > 0) {
        durationEstimate = (byteLength - 44) / (sampleRate * channels * 2);
      }
    } catch {
      // Fallback to estimation below
    }
  }

  // Fallback estimation for webm/opus or raw audio:
  // 16kHz 16-bit mono WAV = 32,000 bytes/sec
  // Opus WebM = ~4,000 to 12,000 bytes/sec
  if (!durationEstimate) {
    if (mimeType.includes("wav")) {
      durationEstimate = byteLength / 32000;
    } else {
      durationEstimate = byteLength / 12000; // conservative for webm
    }
  }

  if (durationEstimate > maxSeconds) {
    return {
      valid: false,
      durationEstimateSeconds: Math.round(durationEstimate),
      error: `Audio duration (~${Math.round(durationEstimate)}s) exceeds maximum allowed length of ${maxSeconds} seconds.`,
    };
  }

  return { valid: true, durationEstimateSeconds: Math.round(durationEstimate) };
}
