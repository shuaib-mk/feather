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

  // Over 10 minutes -> 413 without calling fetch
  let fetchCalled = false;
  (globalThis as any).fetch = async () => { fetchCalled = true; return { ok: true, status: 200, json: async () => ({ transcript: "x" }), text: async () => "" }; };
  const longWav = makeWav(1);
  longWav.writeUInt32LE(79, 28); // fake byteRate so parsed duration = 48000/79 = ~608s > 600s
  const longRes: any = await transcribeAudio(longWav, "audio/wav");
  check("over 10 minutes -> 413 generic, no fetch", longRes.statusCode === 413 && longRes.error === GENERIC_TRANSCRIBE_ERROR && !fetchCalled, JSON.stringify(longRes));

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
