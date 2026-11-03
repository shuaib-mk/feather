import { parseLocally } from "../backend/agent";
import type { AgentResult, StructuredEntry } from "../backend/agent";
import type { VisionDiaryResult } from "../backend/vision";
import { todayLocal } from "../../client/src/lib/localDate";

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

export const SESSION_API_KEY = "feather_session_api_calls";

export function getSessionApiCalls(): number {
  try {
    if (typeof sessionStorage === "undefined") return 0;
    const val = sessionStorage.getItem(SESSION_API_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function recordSessionApiCall(): number {
  try {
    if (typeof sessionStorage === "undefined") return 0;
    const next = getSessionApiCalls() + 1;
    sessionStorage.setItem(SESSION_API_KEY, String(next));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("feather_api_call_made", { detail: next }));
    }
    return next;
  } catch {
    return 0;
  }
}

/**
 * Robust fetch wrapper with timeout via AbortController and automatic retries
 * on transient failures. Defaults preserve the legacy behaviour (10s timeout,
 * 1 retry on 502/503/504 only, no retry on timeout); callers opt into more.
 *
 * Hotfix (speed): the live agent call waits longer per attempt (45s) but
 * retries at most ONCE, after 1s, and only on a network failure or a
 * 502/503. Timeouts, aborts and 504s never retry: a retry cannot fix them
 * and could double a save. Worst case is ~46s, not ~90s.
 */
export const AGENT_ATTEMPTS = 2;
export const AGENT_TIMEOUT_MS = 45000;
export const AGENT_RETRY_DELAYS_MS = [1000];
async function fetchWithTimeoutAndRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000,
  retries = 1,
  retryOptions: {
    retryOnTimeout?: boolean;
    retryOnServerError?: boolean;
    retryStatuses?: number[];
    backoffMs?: number[];
    onRetry?: (nextAttempt: number, totalAttempts: number) => void;
  } = {},
): Promise<Response> {
  if (typeof url === "string" && (url.startsWith("/api/agent") || url.startsWith("/api/transcribe") || url.startsWith("/api/vision"))) {
    recordSessionApiCall();
  }
  const totalAttempts = retries + 1;
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

      // Retryable statuses: an explicit list wins; every 5xx when opted in;
      // otherwise the legacy 502/503/504 list.
      const serverRetryable = retryOptions.retryStatuses
        ? retryOptions.retryStatuses.includes(response.status)
        : retryOptions.retryOnServerError
          ? response.status >= 500 && response.status < 600
          : [502, 503, 504].includes(response.status);
      if (!response.ok && serverRetryable && attempt < retries) {
        attempt++;
        try { retryOptions.onRetry?.(attempt + 1, totalAttempts); } catch {}
        await new Promise((r) => setTimeout(r, retryOptions.backoffMs?.[attempt - 1] ?? 600));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timer);
      const timeoutRetryable = retryOptions.retryOnTimeout || err.name !== "AbortError";
      if (attempt < retries && timeoutRetryable) {
        attempt++;
        try { retryOptions.onRetry?.(attempt + 1, totalAttempts); } catch {}
        await new Promise((r) => setTimeout(r, retryOptions.backoffMs?.[attempt - 1] ?? 600));
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
    // Group E: transcription uploads are large on mobile data. Give /api/transcribe
    // its own 60-second timeout and never retry it - a retry doubles the wait and
    // the upload. (The agent call above keeps its text-sized timeout.)
    const res = await fetchWithTimeoutAndRetry("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64,
        mimeType: blob.type || "audio/webm",
        languageHint,
      }),
    }, 60000, 0);

    if (res.ok) {
      return await res.json();
    }

    const errData = await res.json().catch(() => ({}));
    if (res.status === 413) {
      return { text: "", error: "That recording was too long to upload — try a shorter one, or type your entry instead." };
    }
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
      return { text: "", error: "That recording took too long to upload — try a shorter one, or type your entry instead." };
    }
  }

  // No fabricated transcript: transcription requires the server endpoint.
  return { text: "", error: "Couldn't hear that — try again or type it" };
}

export const MAX_PROMPT_CHARS = 1000;
export const OVER_LIMIT_MESSAGE = "Please keep it under 1,000 characters — try splitting it into two entries";

export async function sendAgentMessage(
  message: string,
  context: any = {},
  conversationHistory: any[] = [],
  onRetry?: (attempt: number, totalAttempts: number) => void,
  attemptTimeoutMs: number = AGENT_TIMEOUT_MS,
): Promise<ClientAgentResult> {
  // C3: over-limit input is flagged visibly and never sent as-is.
  if (message.length > MAX_PROMPT_CHARS) {
    return { message: OVER_LIMIT_MESSAGE, needsClarification: true, clarificationQuestion: OVER_LIMIT_MESSAGE, activityTrail: [{ step: "Input limit", detail: OVER_LIMIT_MESSAGE, status: "clarify" }], toolCalls: [], mode: "offline", modeReason: "Offline parser — Meta model not used (input over 1,000 characters)", isOfflineFallback: true } as ClientAgentResult;
  }
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
    }, attemptTimeoutMs, AGENT_ATTEMPTS - 1, { retryOnTimeout: false, retryStatuses: [502, 503], backoffMs: AGENT_RETRY_DELAYS_MS, onRetry });

    if (res.ok) {
      const data: AgentResult = await res.json();
      const hasSlip = !!((data as any).entry) || !!((data as any).entries && (data as any).entries.length) || !!((data as any).plannedEvents && (data as any).plannedEvents.length) || !!((data as any).planOverlaps && (data as any).planOverlaps.length)
      const blankLive = !(data.message || '').trim() && !hasSlip && !(data as any).needsClarification
      if (blankLive) { const today = context && context.currentDate ? context.currentDate : todayLocal(); const fb = parseLocally(message, today, { ...context, provider }); fb.activityTrail = [...(fb.activityTrail || []), { step: 'Empty Live Reply', detail: 'Live API returned no usable reply, offline parser used', status: 'done' }]; return { ...fb, isOfflineFallback: true } }

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
    console.warn("Backend /api/agent unavailable after " + AGENT_ATTEMPTS + " attempts, running on-device deterministic rules engine.");
  }

  // Pure on-device deterministic rules fallback
  const today = context?.currentDate || todayLocal();
  const localResult = parseLocally(message, today, { ...context, provider });
  localResult.activityTrail = [
    ...(localResult.activityTrail || []),
    { step: "Retry", detail: "Live AI unreachable after " + AGENT_ATTEMPTS + " attempts; using on-device rules", status: "done" },
  ];
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
