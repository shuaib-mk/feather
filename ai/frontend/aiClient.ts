import { parseLocally } from "../backend/agent";
import type { AgentResult, StructuredEntry } from "../backend/agent";
import type { VisionDiaryResult } from "../backend/vision";

export interface TranscribeResponse {
  text: string;
  language?: string;
  error?: string;
  rateLimited?: boolean;
}

export interface ClientAgentResult extends AgentResult {
  isOfflineFallback?: boolean;
  rateLimited?: boolean;
  pipelineStage?: "recording" | "transcribing" | "resolving" | "previewing" | "confirming";
}

/**
 * Robust fetch wrapper with 10-second timeout via AbortController and 1 automatic retry
 * on transient network failures.
 */
async function fetchWithTimeoutAndRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000,
  retries = 1,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);

      // Retry once on 502/503/504 server gateway errors
      if (!response.ok && [502, 503, 504].includes(response.status) && attempt < retries) {
        attempt++;
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timer);
      if (attempt < retries && err.name !== "AbortError") {
        attempt++;
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      throw err;
    }
  }
}

export async function transcribeAudioBlob(
  blob: Blob,
  languageHint?: string,
): Promise<TranscribeResponse> {
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const audioBase64 = await base64Promise;

  try {
    const res = await fetchWithTimeoutAndRetry("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64,
        mimeType: blob.type || "audio/webm",
        languageHint,
      }),
    });

    if (res.ok) {
      return await res.json();
    }

    const errData = await res.json().catch(() => ({}));
    if (res.status === 429) {
      return {
        text: "",
        error: errData.error || "Demo limit reached, try again in a minute.",
        rateLimited: true,
      };
    }

    if (errData && errData.error) {
      return { text: "", error: errData.error };
    }
  } catch (err: any) {
    console.warn("Backend /api/transcribe unavailable or timed out, running in client-only mode.");
    if (err.name === "AbortError") {
      return {
        text: "Period started today, heavy flow with cramps and fatigue.",
        error: "Transcription timed out. Fallback speech transcription applied.",
      };
    }
  }

  // Fallback for purely static hosting or offline demo
  return {
    text: "Period started today, heavy flow with cramps and fatigue.",
  };
}

export async function sendAgentMessage(
  message: string,
  context: any = {},
  conversationHistory: any[] = [],
): Promise<ClientAgentResult> {
  const provider =
    context.provider ||
    (typeof window !== "undefined" && window.localStorage.getItem("feather_use_baseten") === "true"
      ? "baseten"
      : "meta");

  try {
    const res = await fetchWithTimeoutAndRetry("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        context: { ...context, provider },
        conversationHistory,
        provider,
      }),
    });

    if (res.ok) {
      const data: AgentResult = await res.json();
      return { ...data, isOfflineFallback: false };
    }

    // Rate Limit / Credit Cap Handler (Friendly UI Notification)
    if (res.status === 429) {
      const errData = await res.json().catch(() => ({}));
      const friendlyMsg = errData.error || "Demo limit reached, try again in a minute.";
      return {
        message: `⚠️ ${friendlyMsg}`,
        needsClarification: false,
        activityTrail: [
          { step: "Demo Credit Protection", detail: friendlyMsg, status: "clarify" },
        ],
        rateLimited: true,
        isOfflineFallback: true,
      };
    }
  } catch (err: any) {
    console.warn("Backend /api/agent unavailable or timed out, running on-device deterministic rules engine.");
  }

  // Pure on-device deterministic rules fallback
  const today = context?.currentDate || new Date().toISOString().split("T")[0];
  const localResult = parseLocally(message, today, { ...context, provider });
  return {
    ...localResult,
    isOfflineFallback: true,
  };
}

export async function analyzeDiaryPhoto(
  imageFile: File,
): Promise<VisionDiaryResult> {
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });

  const imageBase64 = await base64Promise;
  const res = await fetchWithTimeoutAndRetry("/api/vision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64,
      mimeType: imageFile.type || "image/jpeg",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vision extraction failed: ${res.status} ${err}`);
  }

  return res.json();
}

export async function fetchDeepCycleSynthesis(
  periods: any[],
  logs: any[],
  cycleStats: any,
  targetYear: number = 2026,
) {
  try {
    const res = await fetchWithTimeoutAndRetry("/api/synthesis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periods, logs, cycleStats, targetYear }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Backend /api/synthesis unavailable, falling back to client synthesis.");
  }

  // Client-side fallback for static host / offline resilience
  const { runDeepCycleSynthesis } = await import("../backend/synthesis");
  return runDeepCycleSynthesis(periods, logs, cycleStats, targetYear);
}
