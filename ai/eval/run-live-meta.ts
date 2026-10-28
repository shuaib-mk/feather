import { getConfig } from "../backend/config";
import { runLavenderAgent } from "../backend/agent";
import { LANDMARK_DATASET } from "./landmarks.dataset";

async function main() {
  console.log("===============================================================");
  console.log("       FEATHER AI LIVE MODEL BENCHMARK (META MODEL API)        ");
  console.log("===============================================================");

  const config = getConfig();

  // Check key availability WITHOUT printing key contents
  const hasMetaKey = Boolean(config.metaApiKey && config.metaApiKey.length > 5);
  const hasBasetenKey = Boolean(config.basetenApiKey && config.basetenApiKey.length > 5);

  console.log(`Provider Configured:`);
  console.log(`- META_API_KEY:    ${hasMetaKey ? "PRESENT (configured in environment)" : "NOT SET"}`);
  console.log(`- BASETEN_API_KEY: ${hasBasetenKey ? "PRESENT (configured in environment)" : "NOT SET"}`);
  console.log(`- Target Model:    ${config.museSparkModel}`);
  console.log(`- Base URL:        ${config.metaBaseUrl}`);
  console.log("---------------------------------------------------------------\n");

  if (!hasMetaKey) {
    console.log("[NOTICE] META_API_KEY is not set in the local environment.");
    console.log("Live Meta model test cannot connect to remote API without credentials.");
    console.log("Reporting: Live Meta model results not measured (credentials not set).");
    return;
  }

  // Select 30 representative samples across EN, ML, HI, Code-Mixed
  const selectedSamples = [
    ...LANDMARK_DATASET.filter((s) => s.language === "en").slice(0, 10),
    ...LANDMARK_DATASET.filter((s) => s.language === "ml").slice(0, 8),
    ...LANDMARK_DATASET.filter((s) => s.language === "hi").slice(0, 6),
    ...LANDMARK_DATASET.filter((s) => s.language === "code-mixed").slice(0, 6),
  ];

  console.log(`Running ${selectedSamples.length} landmark phrases through live Meta model...`);

  const latencies: number[] = [];
  let passed = 0;
  let failed = 0;
  const failureDetails: any[] = [];
  let sampleTrace: any = null;

  for (let i = 0; i < selectedSamples.length; i++) {
    const sample = selectedSamples[i];
    const t0 = Date.now();
    try {
      const res = await runLavenderAgent(sample.phrase, {
        currentDate: "2026-10-28",
        provider: "meta",
      });
      const elapsed = Date.now() - t0;
      latencies.push(elapsed);

      // Verify date resolution
      const resolvedDate = res.entry?.date;
      const isCorrect = resolvedDate === sample.expectedDate;

      if (isCorrect) {
        passed++;
        console.log(`[PASS ${i + 1}/${selectedSamples.length}] (${sample.language}) "${sample.phrase}" -> ${resolvedDate} (${elapsed}ms)`);
      } else {
        failed++;
        console.log(`[FAIL ${i + 1}/${selectedSamples.length}] (${sample.language}) "${sample.phrase}" -> got ${resolvedDate}, expected ${sample.expectedDate} (${elapsed}ms)`);
        failureDetails.push({
          phrase: sample.phrase,
          expected: sample.expectedDate,
          got: resolvedDate,
          rawResponse: res.message,
        });
      }

      if (!sampleTrace && res.toolCalls && res.toolCalls.length > 0) {
        sampleTrace = res.toolCalls[0];
      }
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      latencies.push(elapsed);
      failed++;
      console.log(`[ERROR ${i + 1}/${selectedSamples.length}] "${sample.phrase}": ${err.message} (${elapsed}ms)`);
      failureDetails.push({
        phrase: sample.phrase,
        expected: sample.expectedDate,
        got: "ERROR",
        rawResponse: err.message,
      });
    }
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  console.log("\n===============================================================");
  console.log("                   LIVE RUN RESULTS SUMMARY                    ");
  console.log("===============================================================");
  console.log(`Total Samples:       ${selectedSamples.length}`);
  console.log(`Passed:              ${passed}`);
  console.log(`Failed:              ${failed}`);
  console.log(`Accuracy:            ${((passed / selectedSamples.length) * 100).toFixed(1)}%`);
  console.log(`Median Latency(p50): ${p50} ms`);
  console.log(`p95 Latency:         ${p95} ms`);
  console.log("===============================================================\n");

  if (sampleTrace) {
    console.log("REDACTED LIVE TOOL TRACE SAMPLE:");
    console.log(JSON.stringify(sampleTrace, null, 2));
  }

  if (failureDetails.length > 0) {
    console.log("FAILURES:");
    console.log(JSON.stringify(failureDetails, null, 2));
  }
}

main().catch(console.error);
