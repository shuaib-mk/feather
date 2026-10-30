// Web Audio recorder: captures mono PCM via AudioContext, resamples to 24 kHz
// mono and encodes 16-bit PCM WAV for Meta Muse Voice Transcribe (docs spec).
import { useCallback, useEffect, useRef, useState } from "react";
import { encodeRecordingToWav, pcmDurationSeconds, MAX_AUDIO_SECONDS } from "./wavEncode";

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  durationSeconds: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  waveformLevels: number[];
  permissionError: string | null;
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    durationSeconds: 0,
    audioBlob: null,
    audioUrl: null,
    waveformLevels: [0.1, 0.2, 0.15, 0.3, 0.2, 0.1, 0.2, 0.1],
    permissionError: null,
  });

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const cleanupAudioPipeline = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        // ignore
      }
      analyserRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    cleanupAudioPipeline();
    setState((prev) => ({
      ...prev,
      audioBlob: null,
      audioUrl: null,
      permissionError: null,
      durationSeconds: 0,
    }));
    pcmChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error("AudioContext is not supported by this browser.");
      }

      const audioCtx = new AudioCtx();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      analyserRef.current = analyser;

      // 4096 buffer size gives smooth buffer dispatching with low CPU load
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Copy chunk
        pcmChunksRef.current.push(new Float32Array(inputData));
      };

      source.connect(analyser);
      analyser.connect(processor);
      // Processor must be connected to destination for onaudioprocess to run across WebKit & Blink
      processor.connect(audioCtx.destination);

      // Waveform visualizer throttled to 10 FPS (100ms) to ensure 120 FPS UI scrolling
      let lastWaveformUpdate = 0;
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        const now = Date.now();
        if (now - lastWaveformUpdate > 100) {
          lastWaveformUpdate = now;
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          const levels: number[] = [];
          for (let i = 0; i < 8; i++) {
            const val = dataArray[i * 2] || 0;
            levels.push(Math.max(0.12, Math.min(1.0, val / 255)));
          }
          setState((prev) => ({ ...prev, waveformLevels: levels }));
        }
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();

      setState((prev) => ({ ...prev, isRecording: true, isPaused: false }));

      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, durationSeconds: prev.durationSeconds + 1 }));
      }, 1000);
    } catch (err: any) {
      console.error("Microphone capture error:", err);
      let errorMsg = "Could not access microphone.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMsg = "Microphone access denied. Please grant microphone permission in your browser or device settings.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMsg = "No microphone device found on this system.";
      }
      setState((prev) => ({ ...prev, permissionError: errorMsg }));
    }
  }, [cleanupAudioPipeline]);

  const stopRecording = useCallback(() => {
    const audioCtx = audioContextRef.current;
    const sampleRate = audioCtx ? audioCtx.sampleRate : 44100;
    const chunks = [...pcmChunksRef.current];

    cleanupAudioPipeline();

    // Reject audio over 60 seconds (client cap; server enforces the same limit)
    if (pcmDurationSeconds(chunks, sampleRate) > MAX_AUDIO_SECONDS) {
      setState((prev) => ({
        ...prev,
        isRecording: false,
        audioBlob: null,
        audioUrl: null,
        permissionError: "That recording is over 60 seconds. Please record a shorter clip, or type your entry instead.",
      }));
      return;
    }
    // Resample to 24 kHz mono and encode 16-bit PCM WAV
    const wavBlob = encodeRecordingToWav(chunks, sampleRate);
    const url = URL.createObjectURL(wavBlob);

    setState((prev) => ({
      ...prev,
      isRecording: false,
      audioBlob: wavBlob,
      audioUrl: url,
    }));
  }, [cleanupAudioPipeline]);

  const cancelRecording = useCallback(() => {
    cleanupAudioPipeline();
    pcmChunksRef.current = [];
    setState((prev) => ({
      ...prev,
      isRecording: false,
      audioBlob: null,
      audioUrl: null,
      durationSeconds: 0,
    }));
  }, [cleanupAudioPipeline]);

  useEffect(() => {
    return () => {
      cleanupAudioPipeline();
    };
  }, [cleanupAudioPipeline]);

  return {
    ...state,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
