// Audio transcription service using Meta Muse Voice Transcribe.
// Privacy rule: audio is never saved to disk or persistent storage. It is
// processed in-memory, dispatched to the transcription API, and released.
//
// Meta ASR shape (owner-provided official docs):
//   POST {META_BASE_URL}/asr/transcribe  (default https://api.meta.ai/v1/asr/transcribe)
//   Authorization: Bearer <META_API_KEY> (server-side only)
//   multipart: "request" = JSON {mode:"PUSH_TO_TALK", model:MUSE_VOICE_MODEL,
//              audioEncoding:"WAV", languageBias:[...], keywords:[...]}
//              sent as application/json, and "audio" = the WAV file.
//   Response JSON: read the "transcript" field.
// Audio must be mono 16-bit PCM WAV at 16 kHz or 24 kHz; max 60 seconds.
// Why 60s: Vercel serverless functions reject request bodies over ~4.5 MB before
// our handler runs. 60s of 24 kHz mono WAV is ~2.9 MB raw (~3.9 MB base64 JSON),
// which fits; longer clips would be rejected by the platform, not by Meta.
// The speech model id comes only from MUSE_VOICE_MODEL (never the Spark model).

import { getConfig } from "./config";

export const GENERIC_TRANSCRIBE_ERROR = "Couldn't hear that — try again or type it";
export const MAX_AUDIO_SECONDS = 60;

// Indian languages supported by Meta voice per owner-provided docs, plus English.
// Malayalam is NOT in Meta's supported list; Malayalam is typed-text/offline only.
export const SUPPORTED_VOICE_LANGUAGES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  kn: "Kannada",
  mr: "Marathi",
  ta: "Tamil",
  te: "Telugu",
};

export interface TranscribeRequestPayload {
  mode: "PUSH_TO_TALK";
  model: string;
  audioEncoding: "WAV";
  languageBias: string[];
  keywords: string[];
}

export function buildTranscribeRequest(model: string, languageHint?: string): TranscribeRequestPayload {
  const bias: string[] = [];
  const hinted = languageHint ? SUPPORTED_VOICE_LANGUAGES[languageHint.toLowerCase()] : undefined;
  if (hinted) bias.push(hinted);
  for (const name of ["English", "Hindi"]) if (!bias.includes(name)) bias.push(name);
  return {
    mode: "PUSH_TO_TALK",
    model,
    audioEncoding: "WAV",
    languageBias: bias,
    keywords: ["period", "cramps", "flow"],
  };
}

/** Duration in seconds parsed from a RIFF/WAVE header, or null if not WAV. */
export function wavDurationSeconds(audioBuffer: Buffer): number | null {
  if (
    audioBuffer.length < 44 ||
    audioBuffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    audioBuffer.subarray(8, 12).toString("ascii") !== "WAVE"
  ) return null;
  const byteRate = audioBuffer.readUInt32LE(28);
  if (byteRate <= 0) return null;
  return (audioBuffer.length - 44) / byteRate;
}

export interface TranscribeResult {
  text: string;
  error?: string;
  statusCode?: number;
  language?: string;
  duration?: number;
  confidence?: number;
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = "audio/wav",
  languageHint?: string,
): Promise<TranscribeResult> {
  if (!audioBuffer || audioBuffer.length === 0) {
    return { text: "", error: GENERIC_TRANSCRIBE_ERROR };
  }
  if (audioBuffer.length < 1000) {
    return { text: "", error: GENERIC_TRANSCRIBE_ERROR };
  }

  const duration = wavDurationSeconds(audioBuffer);
  if (duration !== null && duration > MAX_AUDIO_SECONDS) {
    return { text: "", error: GENERIC_TRANSCRIBE_ERROR, statusCode: 413 };
  }

  const config = getConfig();
  // Meta only: transcription never falls back to Baseten or any other provider.
  const apiKey = config.metaApiKey;
  if (!apiKey) {
    return { text: "", error: GENERIC_TRANSCRIBE_ERROR };
  }

  try {
    let response: Response;

    const requestJson = buildTranscribeRequest(config.museVoiceModel, languageHint);
    const formData = new FormData();
    formData.append(
      "request",
      new Blob([JSON.stringify(requestJson)], { type: "application/json" }),
      "request.json",
    );
    formData.append("audio", new Blob([new Uint8Array(audioBuffer)], { type: "audio/wav" }), "audio.wav");

    response = await fetch(`${config.metaBaseUrl.replace(/\/$/, "")}/asr/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      // Detail stays server-side only; the client gets a generic message.
      const errText = await response.text().catch(() => "");
      console.error(`[transcribe] ASR upstream ${response.status}: ${errText}`);
      const statusCode = [400, 413, 429, 500].includes(response.status) ? response.status : 500;
      return { text: "", error: GENERIC_TRANSCRIBE_ERROR, statusCode };
    }

    const data = (await response.json()) as { text?: string; transcript?: string; language?: string };
    const text = (data.transcript || data.text || "").trim();
    if (!text) return { text: "", error: GENERIC_TRANSCRIBE_ERROR };
    return { text, language: data.language };
  } catch (error: any) {
    console.error("[transcribe] ASR request failed:", error?.message || error);
    return { text: "", error: GENERIC_TRANSCRIBE_ERROR, statusCode: 500 };
  }
}
