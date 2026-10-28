import { parseLocally } from "../backend/agent";
import type { AgentResult, StructuredEntry } from "../backend/agent";
import type { VisionDiaryResult } from "../backend/vision";

export interface TranscribeResponse {
  text: string;
  language?: string;
  error?: string;
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
    const res = await fetch("/api/transcribe", {
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
    if (errData && errData.error) {
      return { text: "", error: errData.error };
    }
  } catch (err) {
    console.warn("Backend /api/transcribe unavailable, running in client-only mode.");
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
): Promise<AgentResult> {
  try {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context, conversationHistory }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Backend /api/agent unavailable, running client-side agent fallback.");
  }

  // Pure client-side parsing fallback for GitHub Pages
  const today = context?.currentDate || new Date().toISOString().split("T")[0];
  return parseLocally(message, today, context);
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
  const res = await fetch("/api/vision", {
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
    const res = await fetch("/api/synthesis", {
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

  // Client-side fallback for static host
  const { runDeepCycleSynthesis } = await import("../backend/synthesis");
  return runDeepCycleSynthesis(periods, logs, cycleStats, targetYear);
}

