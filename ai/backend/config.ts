// Configuration for Meta Model API & Baseten provider
// All model IDs and endpoints are loaded via environment variables (zero hardcoded secrets).

export interface AiConfig {
  metaApiKey: string;
  metaBaseUrl: string;
  museVoiceModel: string;
  museSparkModel: string;
  basetenApiKey: string;
  basetenBaseUrl: string;
  useBaseten: boolean;
  port: number;
}

export function getConfig(): AiConfig {
  if (typeof process !== "undefined" && typeof (process as any).loadEnvFile === "function") {
    try {
      (process as any).loadEnvFile();
    } catch {
      // .env file is optional; offline fallback is used if missing
    }
  }

  const env: Record<string, string | undefined> =
    typeof process !== "undefined" && process?.env ? process.env : {};

  const useBaseten = env.USE_BASETEN === "true";
  const metaApiKey = env.META_API_KEY || "";
  const basetenApiKey = env.BASETEN_API_KEY || "";
  return {
    metaApiKey,
    metaBaseUrl: env.META_BASE_URL || "https://api.meta.ai/v1",
    museVoiceModel: env.MUSE_VOICE_MODEL || "muse-voice-transcribe-1.0",
    museSparkModel: env.MUSE_SPARK_MODEL || "muse-spark-1.3",
    basetenApiKey,
    basetenBaseUrl: env.BASETEN_BASE_URL || "https://bridge.baseten.co/v1",
    useBaseten,
    port: parseInt(env.PORT || "3001", 10),
  };
}
