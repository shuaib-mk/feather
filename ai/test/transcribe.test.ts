// Transcription path tests (Batch: Meta ASR docs alignment).
// Mocked fetch only — no live Meta key, no real audio files.
import { transcribeAudio, buildTranscribeRequest, wavDurationSeconds, GENERIC_TRANSCRIBE_ERROR } from "../backend/transcribe";
import { encodeWavPcm16Mono, resampleMono, TARGET_SAMPLE_RATE } from "../../ai/frontend/wavEncode";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) passed++;
  else { failed++; console.log("FAIL:", name, detail || ""); }
}

function makeWav(seconds = 1, rate = TARGET_SAMPLE_RATE): Buffer {
  const samples = new Float32Array(rate * seconds);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 20) * 0.5;
  return Buffer.from(encodeWavPcm16Mono(samples, rate));
}

async function main() {
  const originalFetch = globalThis.fetch;
  const savedEnv = { ...process.env };
  process.env.META_API_KEY = "test-key-not-real";
  process.env.META_BASE_URL = "https://api.meta.ai/v1";
  process.env.MUSE_VOICE_MODEL = "muse-voice-transcribe-1.0";
  process.env.MUSE_SPARK_MODEL = "muse-spark-1.3";

  // WAV encoding: header, mono, 16-bit, 24 kHz
  const wav = makeWav(1);
  check("WAV RIFF header", wav.subarray(0, 4).toString("ascii") === "RIFF" && wav.subarray(8, 12).toString("ascii") === "WAVE");
  check("WAV mono", wav.readUInt16LE(22) === 1);
  check("WAV 16-bit", wav.readUInt16LE(34) === 16);
  check("WAV 24 kHz", wav.readUInt32LE(24) === 24000);
  check("WAV data size = seconds*rate*2", wav.readUInt32LE(40) === 24000 * 2);
  check("resample 48k -> 24k halves length", resampleMono(new Float32Array(4800), 48000).length === 2400);
  check("wavDurationSeconds 1s", Math.abs((wavDurationSeconds(wav) || 0) - 1) < 0.01);

  // Group E transport sizes: generated WAVs at 15/30/45/60s (24 kHz mono 16-bit)
  for (const secs of [15, 30, 45, 60]) {
    const w = makeWav(secs);
    const payloadBytes = Buffer.byteLength(JSON.stringify({ audioBase64: w.toString("base64"), mimeType: "audio/wav" }));
    check(`E ${secs}s WAV data size`, w.readUInt32LE(40) === secs * 48000, String(w.readUInt32LE(40)));
    check(`E ${secs}s base64 JSON payload under the ~4.5 MB Vercel body limit`, payloadBytes < 4.5 * 1024 * 1024, String(payloadBytes));
    check(`E ${secs}s duration measured`, Math.abs((wavDurationSeconds(w) || 0) - secs) < 0.05);
  }
  {
    (globalThis as any).fetch = async () => ({ ok: true, status: 200, json: async () => ({ transcript: "long clip ok" }), text: async () => "" });
    const r: any = await transcribeAudio(makeWav(60), "audio/wav");
    check("E 60s WAV transcribes via mocked transport", r.text === "long clip ok" && !r.error, JSON.stringify(r));
  }

  // Request payload shape (pure)
  const req = buildTranscribeRequest("muse-voice-transcribe-1.0");
  check("request payload matches docs", JSON.stringify(req) === JSON.stringify({
    mode: "PUSH_TO_TALK", model: "muse-voice-transcribe-1.0", audioEncoding: "WAV",
    languageBias: ["English", "Hindi"], keywords: ["period", "cramps", "flow"],
  }), JSON.stringify(req));
  check("supported hint biases language", buildTranscribeRequest("m", "ta").languageBias[0] === "Tamil");
  check("Malayalam is not a supported voice language", buildTranscribeRequest("m", "ml").languageBias.join(",") === "English,Hindi");

  // Success with mocked fetch
  let captured: any = null;
  (globalThis as any).fetch = async (url: string, init: any) => {
    captured = { url, init };
    return { ok: true, status: 200, json: async () => ({ transcript: "period started today" }), text: async () => "" };
  };
  const okRes: any = await transcribeAudio(makeWav(1), "audio/wav");
  check("success returns transcript field", okRes.text === "period started today" && !okRes.error, JSON.stringify(okRes));
  check("endpoint is /asr/transcribe", captured?.url === "https://api.meta.ai/v1/asr/transcribe", captured?.url);
  check("Authorization Bearer from env key", captured?.init?.headers?.Authorization === "Bearer test-key-not-real");
  const form = captured?.init?.body as FormData;
  const reqPart: any = form?.get("request");
  const reqJson = JSON.parse(await reqPart.text());
  check("multipart request part matches docs JSON", JSON.stringify(reqJson) === JSON.stringify(req), JSON.stringify(reqJson));
  check("multipart request part is application/json", reqPart?.type === "application/json", reqPart?.type);
  check("multipart audio part present", !!form?.get("audio"));
  check("speech model is voice model, never spark", reqJson.model === "muse-voice-transcribe-1.0" && reqJson.model !== process.env.MUSE_SPARK_MODEL);

  // Upstream errors: generic client error, status preserved, no upstream detail leaked
  for (const status of [400, 429, 500]) {
    (globalThis as any).fetch = async () => ({
      ok: false, status,
      text: async () => "UPSTREAM_DETAIL_SHOULD_NOT_LEAK",
      json: async () => ({}),
    });
    const res: any = await transcribeAudio(makeWav(1), "audio/wav");
    check(`upstream ${status} -> generic error`, res.text === "" && res.error === GENERIC_TRANSCRIBE_ERROR, JSON.stringify(res));
    check(`upstream ${status} -> statusCode preserved`, res.statusCode === status, String(res.statusCode));
    check(`upstream ${status} -> no upstream detail leaked`, !JSON.stringify(res).includes("UPSTREAM_DETAIL_SHOULD_NOT_LEAK"));
  }

  // Over 60 seconds -> 413 without calling fetch
  let fetchCalled = false;
  (globalThis as any).fetch = async () => { fetchCalled = true; return { ok: true, status: 200, json: async () => ({ transcript: "x" }), text: async () => "" }; };
  const longWav = makeWav(1);
  longWav.writeUInt32LE(79, 28); // fake byteRate so parsed duration = 48000/79 = ~608s > 60s cap
  const longRes: any = await transcribeAudio(longWav, "audio/wav");
  check("over 60 seconds -> 413 generic, no fetch", longRes.statusCode === 413 && longRes.error === GENERIC_TRANSCRIBE_ERROR && !fetchCalled, JSON.stringify(longRes));

  // 60-second cap constants on both client and server
  const { MAX_AUDIO_SECONDS: serverCap } = await import("../backend/transcribe");
  const { MAX_AUDIO_SECONDS: clientCap } = await import("../../ai/frontend/wavEncode");
  check("MAX_AUDIO_SECONDS is 60 on server and client", serverCap === 60 && clientCap === 60, `${serverCap}/${clientCap}`);

  // Baseten can never run for transcription: no Meta key -> no fetch at all,
  // even with a Baseten key and USE_BASETEN=true set.
  const basetenCalls: string[] = [];
  (globalThis as any).fetch = async (url: string) => { basetenCalls.push(String(url)); return { ok: true, status: 200, json: async () => ({ transcript: "x" }), text: async () => "" }; };
  delete process.env.META_API_KEY;
  process.env.BASETEN_API_KEY = "baseten-test-key";
  process.env.USE_BASETEN = "true";
  const noMetaRes: any = await transcribeAudio(makeWav(1), "audio/wav");
  check("no Meta key -> generic error, Baseten never called", noMetaRes.error === GENERIC_TRANSCRIBE_ERROR && basetenCalls.length === 0, JSON.stringify({ noMetaRes, basetenCalls }));
  // Meta failure with a Baseten key present -> generic error, only the Meta ASR endpoint was called
  process.env.META_API_KEY = "test-key-not-real";
  const metaFailCalls: string[] = [];
  (globalThis as any).fetch = async (url: string) => { metaFailCalls.push(String(url)); return { ok: false, status: 500, text: async () => "meta down", json: async () => ({}) }; };
  const metaFailRes: any = await transcribeAudio(makeWav(1), "audio/wav");
  check("Meta 500 -> generic error, Baseten never called", metaFailRes.error === GENERIC_TRANSCRIBE_ERROR && metaFailCalls.length === 1 && metaFailCalls[0] === "https://api.meta.ai/v1/asr/transcribe" && !metaFailCalls.some((u) => u.includes("baseten") || u.includes("audio/transcriptions")), JSON.stringify(metaFailCalls));
  delete process.env.BASETEN_API_KEY;
  delete process.env.USE_BASETEN;

  // Network failure -> generic 500, no throw
  (globalThis as any).fetch = async () => { throw new Error("network down"); };
  const netRes: any = await transcribeAudio(makeWav(1), "audio/wav");
  check("network failure -> generic error, no throw", netRes.text === "" && netRes.error === GENERIC_TRANSCRIBE_ERROR && netRes.statusCode === 500, JSON.stringify(netRes));

  (globalThis as any).fetch = originalFetch;
  for (const k of Object.keys(process.env)) if (!(k in savedEnv)) delete process.env[k];
  Object.assign(process.env, savedEnv);

  console.log(`Transcribe: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
