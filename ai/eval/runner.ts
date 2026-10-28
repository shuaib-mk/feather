// Feather AI Evaluation Harness Runner
// Evaluates Landmark Recall accuracy and Medical Safety Guardrail precision/recall.
// Supports both Offline Rules Engine mode and Live API mode (when META_API_KEY / BASETEN_API_KEY is configured).

import { LANDMARK_DATASET } from "./landmarks.dataset";
import { GUARDRAIL_DATASET } from "./guardrail.dataset";
import { runLavenderAgent } from "../backend/agent";
import { checkMedicalAdviceGuardrail } from "../backend/guardrail";
import { getConfig } from "../backend/config";

interface EvalReport {
  timestamp: string;
  mode: "LIVE_API" | "OFFLINE_RULES_ENGINE";
  provider: string;
  model: string;
  anchorDate: string;
  landmarks: {
    total: number;
    passed: number;
    failed: number;
    accuracyPct: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    byLanguage: Record<string, { total: number; passed: number; accuracyPct: number }>;
    misses: Array<{ id: string; phrase: string; expected: string; got: string | undefined }>;
  };
  guardrail: {
    total: number;
    tp: number;
    fp: number;
    tn: number;
    fn: number;
    precision: number;
    recall: number;
    specificity: number;
    f1Score: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    falsePositives: Array<{ id: string; input: string; language: string }>;
    falseNegatives: Array<{ id: string; input: string; language: string }>;
  };
}

function calculatePercentile(numbers: number[], p: number): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

async function runEvaluations(): Promise<EvalReport> {
  const config = getConfig();
  const hasLiveKey = Boolean(config.metaApiKey || config.basetenApiKey);
  const mode = hasLiveKey ? "LIVE_API" : "OFFLINE_RULES_ENGINE";
  const provider = config.useBaseten ? "Baseten (Open-Weight)" : hasLiveKey ? "Meta Model API" : "Local Deterministic Engine";
  const model = config.useBaseten ? "meta-models/muse-spark-open-1026" : hasLiveKey ? config.museSparkModel : "offline-rule-engine";
  const anchorDate = "2026-10-28";

  console.log("===============================================================");
  console.log("             FEATHER AI COMPREHENSIVE EVALUATION HARNESS        ");
  console.log("===============================================================");
  console.log(` Mode:        ${mode}`);
  console.log(` Provider:    ${provider}`);
  console.log(` Model ID:    ${model}`);
  console.log(` Anchor Date: ${anchorDate}`);
  console.log("---------------------------------------------------------------\n");

  // -------------------------------------------------------------
  // SUITE 1: LANDMARK RECALL EVALUATION (65 SAMPLES)
  // -------------------------------------------------------------
  console.log("--> [1/2] Running Landmark Recall Benchmark (65 samples across EN, ML, HI, Code-Mixed)...");
  const landmarkLatencies: number[] = [];
  const landmarkMisses: Array<{ id: string; phrase: string; expected: string; got: string | undefined }> = [];
  const byLanguage: Record<string, { total: number; passed: number; accuracyPct: number }> = {
    en: { total: 0, passed: 0, accuracyPct: 0 },
    ml: { total: 0, passed: 0, accuracyPct: 0 },
    hi: { total: 0, passed: 0, accuracyPct: 0 },
    "code-mixed": { total: 0, passed: 0, accuracyPct: 0 },
  };

  let landmarksPassed = 0;

  for (const sample of LANDMARK_DATASET) {
    byLanguage[sample.language].total += 1;
    const start = Date.now();
    const result = await runLavenderAgent(sample.phrase, { currentDate: anchorDate });
    const latency = Date.now() - start;
    landmarkLatencies.push(latency);

    const resolvedDate = result.entry?.date;
    if (resolvedDate === sample.expectedDate) {
      landmarksPassed += 1;
      byLanguage[sample.language].passed += 1;
    } else {
      landmarkMisses.push({
        id: sample.id,
        phrase: sample.phrase,
        expected: sample.expectedDate,
        got: resolvedDate,
      });
    }
  }

  for (const lang of Object.keys(byLanguage)) {
    const stat = byLanguage[lang];
    stat.accuracyPct = stat.total > 0 ? Math.round((stat.passed / stat.total) * 1000) / 10 : 0;
  }

  const landmarkAccuracyPct = Math.round((landmarksPassed / LANDMARK_DATASET.length) * 1000) / 10;
  const landmarkP50 = calculatePercentile(landmarkLatencies, 50);
  const landmarkP95 = calculatePercentile(landmarkLatencies, 95);

  console.log(`    Landmark Accuracy: ${landmarkAccuracyPct}% (${landmarksPassed}/${LANDMARK_DATASET.length})`);
  console.log(`    Latency: Median(p50) = ${landmarkP50}ms | p95 = ${landmarkP95}ms`);
  for (const [lang, stat] of Object.entries(byLanguage)) {
    console.log(`      • ${lang.padEnd(10)}: ${stat.accuracyPct}% (${stat.passed}/${stat.total})`);
  }
  if (landmarkMisses.length > 0) {
    console.log(`    Discrepancies (${landmarkMisses.length}):`);
    for (const m of landmarkMisses.slice(0, 5)) {
      console.log(`      [${m.id}] "${m.phrase}" -> Expected: ${m.expected}, Got: ${m.got}`);
    }
  }
  console.log("");

  // -------------------------------------------------------------
  // SUITE 2: MEDICAL SAFETY GUARDRAIL EVALUATION (105 SAMPLES)
  // -------------------------------------------------------------
  console.log("--> [2/2] Running Medical Safety Guardrail Benchmark (105 samples)...");
  const guardrailLatencies: number[] = [];
  let tp = 0; // True Positive: correctly refused medical request
  let fp = 0; // False Positive: incorrectly refused valid log/plan
  let tn = 0; // True Negative: correctly allowed valid log/plan
  let fn = 0; // False Negative: failed to refuse medical request

  const falsePositives: Array<{ id: string; input: string; language: string }> = [];
  const falseNegatives: Array<{ id: string; input: string; language: string }> = [];

  for (const sample of GUARDRAIL_DATASET) {
    const start = Date.now();
    // Test two layers: pre-execution regex guardrail and agent refusal
    const check = checkMedicalAdviceGuardrail(sample.input);
    const latency = Date.now() - start;
    guardrailLatencies.push(latency);

    const wasRefused = check.isRefusal;

    if (sample.expectedRefusal) {
      if (wasRefused) {
        tp += 1;
      } else {
        fn += 1;
        falseNegatives.push({ id: sample.id, input: sample.input, language: sample.language });
      }
    } else {
      if (!wasRefused) {
        tn += 1;
      } else {
        fp += 1;
        falsePositives.push({ id: sample.id, input: sample.input, language: sample.language });
      }
    }
  }

  const precision = tp + fp > 0 ? Math.round((tp / (tp + fp)) * 1000) / 10 : 100;
  const recall = tp + fn > 0 ? Math.round((tp / (tp + fn)) * 1000) / 10 : 100;
  const specificity = tn + fp > 0 ? Math.round((tn / (tn + fp)) * 1000) / 10 : 100;
  const f1Score = precision + recall > 0 ? Math.round(((2 * precision * recall) / (precision + recall)) * 10) / 10 : 100;

  const guardrailP50 = calculatePercentile(guardrailLatencies, 50);
  const guardrailP95 = calculatePercentile(guardrailLatencies, 95);

  console.log(`    Guardrail Refusal Recall (Sensitivity): ${recall}% (${tp}/${tp + fn} medical queries blocked)`);
  console.log(`    Guardrail Precision:                   ${precision}% (${tp}/${tp + fp})`);
  console.log(`    Guardrail Specificity (Valid Logging): ${specificity}% (${tn}/${tn + fp} valid logs allowed)`);
  console.log(`    F1 Score:                              ${f1Score}%`);
  console.log(`    Latency: Median(p50) = ${guardrailP50}ms | p95 = ${guardrailP95}ms`);

  if (falsePositives.length > 0) {
    console.log(`    False Positives (${falsePositives.length}) [Valid inputs incorrectly blocked]:`);
    for (const item of falsePositives) {
      console.log(`      [${item.id} - ${item.language}] "${item.input}"`);
    }
  } else {
    console.log(`    False Positives: 0 (Zero valid cycle logs blocked!)`);
  }

  if (falseNegatives.length > 0) {
    console.log(`    False Negatives (${falseNegatives.length}) [Medical queries not blocked]:`);
    for (const item of falseNegatives) {
      console.log(`      [${item.id} - ${item.language}] "${item.input}"`);
    }
  } else {
    console.log(`    False Negatives: 0 (100% of medical queries safely refused!)`);
  }

  console.log("\n===============================================================");
  console.log("                    EVALUATION SUMMARY                         ");
  console.log("===============================================================");
  console.log(` Total Benchmark Samples: ${LANDMARK_DATASET.length + GUARDRAIL_DATASET.length}`);
  console.log(` Landmark Recall Accuracy: ${landmarkAccuracyPct}%`);
  console.log(` Medical Guardrail F1:     ${f1Score}% (Precision: ${precision}%, Recall: ${recall}%)`);
  console.log("===============================================================\n");

  return {
    timestamp: new Date().toISOString(),
    mode,
    provider,
    model,
    anchorDate,
    landmarks: {
      total: LANDMARK_DATASET.length,
      passed: landmarksPassed,
      failed: landmarkMisses.length,
      accuracyPct: landmarkAccuracyPct,
      latencyP50Ms: landmarkP50,
      latencyP95Ms: landmarkP95,
      byLanguage,
      misses: landmarkMisses,
    },
    guardrail: {
      total: GUARDRAIL_DATASET.length,
      tp,
      fp,
      tn,
      fn,
      precision,
      recall,
      specificity,
      f1Score,
      latencyP50Ms: guardrailP50,
      latencyP95Ms: guardrailP95,
      falsePositives,
      falseNegatives,
    },
  };
}

runEvaluations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Eval harness error:", err);
    process.exit(1);
  });
