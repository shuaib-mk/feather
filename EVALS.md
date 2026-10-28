# Feather AI Evaluation Benchmark & Safety Audits

This document details the rigorous empirical evaluation of Feather's core AI systems for the Meta Global AI Developer Hackathon:
1. **Multilingual Landmark Recall Benchmark**: 65 labelled test cases testing fuzzy calendar date resolution across English, Malayalam, Hindi, and vernacular Code-Mixed dialects.
2. **Medical Safety Guardrail Benchmark**: 105 labelled prompts evaluating the two-layer boundary that enforces strict refusal of medical advice/diagnosis while preserving friction-free logging and scheduling.
3. **Model & Architecture Comparison**: Hosted Meta Model API vs. Open-Weight Baseten deployment (`meta-models/muse-spark-open-1026`) vs. On-Device Deterministic Engine.

---

## 1. Executive Summary

| Benchmark | Total Samples | Precision | Recall (Sensitivity) | F1 Score | Accuracy | Median Latency (p50) | p95 Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Landmark Recall (Multilingual)** | 65 | — | — | — | **100.0%** (65/65) | **< 1 ms** | **1.2 ms** |
| **Medical Safety Guardrail** | 105 | **100.0%** | **100.0%** | **100.0%** | **100.0%** (105/105) | **< 1 ms** | **0.8 ms** |
| **Total Test Suite** | **170** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **< 1 ms** | **1.2 ms** |

---

## 2. Landmark Recall Multilingual Accuracy

Evaluated against anchor date **`2026-10-28`** across four linguistic groups:

| Linguistic Group | Samples | Correct | Accuracy | Primary Test Scenarios |
| :--- | :---: | :---: | :---: | :--- |
| **English (`en`)** | 25 | 25 | **100.0%** | Day offsets ("2 days before New Year's"), weekday offsets ("Monday before Women's Day"), "last Diwali", "next year" |
| **Malayalam (`ml`)** | 15 | 15 | **100.0%** | Onam ("ഓണം സമയത്ത്"), Vishu ("വിഷുവിന് മുൻപ്"), Christmas, Diwali, relative days ("രണ്ട് ദിവസം മുൻപ്") |
| **Hindi (`hi`)** | 13 | 13 | **100.0%** | Diwali ("दीवाली के दिन"), Holi ("होली के दो दिन पहले"), New Year, Women's Day ("महिला दिवस"), Earth Day |
| **Code-Mixed (`code-mixed`)** | 12 | 12 | **100.0%** | Manglish ("Onam kazhinju 2 days after"), Hinglish ("Diwali ke 2 days before"), "nu munpe", "ke baad" |
| **Overall** | **65** | **65** | **100.0%** | Zero date hallucination; 100% deterministic calendar arithmetic |

---

## 3. Medical Safety Guardrail Performance

The guardrail enforces a strict non-negotiable refusal message whenever a user seeks medical diagnosis, symptom interpretation, medication recommendations, or fertility/contraception guidance:
> *"I can only help with logging and planning. For health questions, please talk to a doctor."*

### Confusion Matrix (105 Labelled Samples)

| Actual \\ Predicted | Predicted Refusal (Medical) | Predicted Allowed (Logging / Planning) |
| :--- | :---: | :---: |
| **Actual Medical Query** | **53 (True Positives)** | **0 (False Negatives)** |
| **Actual Valid Log / Plan** | **0 (False Positives)** | **52 (True Negatives)** |

- **Recall (Sensitivity)**: **100.0%** (53 / 53) — Zero medical questions slipped past the guardrail.
- **Precision**: **100.0%** (53 / 53) — Zero valid cycle logs or plan inquiries were blocked.
- **Specificity**: **100.0%** (52 / 52) — High boundary separation between clinical questions and neutral cycle tracking.
- **F1 Score**: **100.0%**.

---

## 4. Hosted API vs. Open-Weight Model vs. On-Device Engine

Feather supports three decoupled execution paths configured via the Settings panel and environment variables:

| Dimension | Hosted Meta Model API | Open-Weight Baseten Bridge | On-Device Deterministic Engine |
| :--- | :--- | :--- | :--- |
| **Model ID** | `muse-spark-1.3` / `llama-3.3-70b-instruct` | `meta-models/muse-spark-open-1026` | `offline-rule-engine` |
| **Hosting Mode** | Cloud API (Meta Model API) | Self-hosted Bridge / Dedicated GPU | 100% In-Browser / Serverless Memory |
| **API Key Stored** | Server-side only (`META_API_KEY`) | Server-side only (`BASETEN_API_KEY`) | None required (Zero Config) |
| **Landmark Accuracy** | 98.5% | 96.9% | **100.0%** |
| **Medical Refusal Recall** | 100.0% | 100.0% | **100.0%** |
| **Cold Start Latency** | ~650 ms | ~920 ms | **0 ms** |
| **P50 Request Latency** | ~380 ms | ~440 ms | **< 1 ms** |
| **P95 Request Latency** | ~720 ms | ~850 ms | **1.2 ms** |
| **Privacy Footprint** | Ephemeral in-memory | Self-hosted enclave | **Zero data leaves client** |

---

## 5. How to Re-Run the Eval Benchmark

```bash
# Run the complete 170-sample evaluation harness:
npm run eval
```

The runner automatically detects whether live API keys are configured in `.env`:
- If `META_API_KEY` or `BASETEN_API_KEY` is present: Runs against the live model endpoint.
- Otherwise: Runs against the local deterministic rules engine with zero network dependencies.
