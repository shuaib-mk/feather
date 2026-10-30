// Audio transcription service using Meta Muse Voice Transcribe.
// Privacy rule: Audio is never saved to disk or persistent storage.
// It is processed in-memory, dispatched to the transcription API, and immediately released.

import { getConfig } from "./config";

export interface TranscribeResult {
  text: string;
  error?: string;
  language?: string;
  duration?: number;
  confidence?: number;
}

/**
 * Transcribes audio buffer using Meta Muse Voice Transcribe (or OpenAI-compatible ASR endpoint).
 * Handles multi-lingual speech across English, Spanish, French, and vernacular code-switching.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = "audio/wav",
  languageHint?: string,
): Promise<TranscribeResult> {
  if (!audioBuffer || audioBuffer.length === 0) {
    return { text: "" };
  }

  // Extremely short audio (< 1KB) is just a header without speech
  if (audioBuffer.length < 1000) {
    return { text: "" };
  }

  const config = getConfig();
  const apiKey = config.metaApiKey || config.basetenApiKey;

  if (!apiKey) {
    return { text: "", error: "Couldn't hear that — try again or type it" } as TranscribeResult;
  }

  const isWav =
    audioBuffer.length >= 12 &&
    audioBuffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    audioBuffer.subarray(8, 12).toString("ascii") === "WAVE";

  try {
    const isMetaAi = config.metaBaseUrl.includes("api.meta.ai");
    let response: Response;

    if (isMetaAi) {
      // Meta Muse Voice expects multipart with 'request' (JSON) and 'audio' (WAV)
      const requestJson = {
        model: config.museVoiceModel || "muse-voice-transcribe-1.0",
        audioEncoding: "WAV",
        ...(languageHint && languageHint !== "auto" ? { language: languageHint } : {}),
      };

      const formData = new FormData();
      formData.append(
        "request",
        new Blob([JSON.stringify(requestJson)], { type: "application/json" }),
        "request.json",
      );
      formData.append("audio", new Blob([new Uint8Array(audioBuffer)], { type: "audio/wav" }), "audio.wav");

      response = await fetch(`${config.metaBaseUrl}/asr/transcribe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });
    } else {
      // OpenAI / standard multipart format (supports webm, mp4, wav, ogg)
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
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Muse Voice] ASR returned ${response.status}:`, errText);
      throw new Error(`ASR service error (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as { text?: string; transcript?: string; language?: string };
    const text = (data.transcript || data.text || "").trim();

    return {
      text,
      language: data.language,
    };
  } catch (error: any) {
    console.error("[Lavender Voice] Error in transcribeAudio:", error);
    throw error;
  }
}
