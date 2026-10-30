// Pure WAV encoding helpers for Meta Muse Voice Transcribe uploads.
// Spec (owner-provided Meta docs): mono 16-bit PCM WAV at 16 kHz or 24 kHz.
// We standardize on 24 kHz mono. No browser globals are used here so this
// module can be unit-tested in Node.

export const TARGET_SAMPLE_RATE = 24000;
export const MAX_AUDIO_SECONDS = 60; // reject audio over 60 seconds
// Why 60s: Vercel serverless functions reject request bodies over ~4.5 MB before
// our handler runs. 60s of 24 kHz 16-bit mono WAV is ~2.9 MB raw (~3.9 MB as the
// base64 JSON we upload), which fits; longer clips would fail at the platform.

export function mergePcmChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

/** Linear-interpolation resample of mono samples to the target rate. */
export function resampleMono(samples: Float32Array, inputSampleRate: number, targetSampleRate: number = TARGET_SAMPLE_RATE): Float32Array {
  if (inputSampleRate === targetSampleRate) return samples;
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const idx = Math.floor(srcIdx);
    const frac = srcIdx - idx;
    const s0 = samples[idx] || 0;
    const s1 = samples[idx + 1] || s0;
    out[i] = s0 + frac * (s1 - s0);
  }
  return out;
}

/** Encode mono Float32 samples (already at targetSampleRate) as 16-bit PCM WAV bytes. */
export function encodeWavPcm16Mono(samples: Float32Array, sampleRate: number = TARGET_SAMPLE_RATE): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);
  let p = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    p += 2;
  }
  return new Uint8Array(buffer);
}

/** Resample captured mono PCM chunks to 24 kHz and encode as a WAV Blob. */
export function encodeRecordingToWav(pcmChunks: Float32Array[], inputSampleRate: number): Blob {
  const merged = mergePcmChunks(pcmChunks);
  const resampled = resampleMono(merged, inputSampleRate, TARGET_SAMPLE_RATE);
  const bytes = encodeWavPcm16Mono(resampled, TARGET_SAMPLE_RATE);
  return new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" });
}

/** Duration in seconds of captured PCM at the given input rate. */
export function pcmDurationSeconds(pcmChunks: Float32Array[], inputSampleRate: number): number {
  const total = pcmChunks.reduce((acc, c) => acc + c.length, 0);
  return inputSampleRate > 0 ? total / inputSampleRate : 0;
}
