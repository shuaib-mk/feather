# Meta Global AI Developer Hackathon Submission
**Track:** Indie Developer (*"Build for Your World"*)  
**Project:** Feather — Voice-First Menstrual Cycle Companion  
**Hackathon Window:** October 27 – November 4, 2026  
**Primary Models:** Meta Muse Voice Transcribe (`muse-voice-transcribe-1.0`) & Meta Muse Spark (`muse-spark-1.3`)  
**Open-Weight Swappable:** Meta Muse Spark Open 1026 (`meta-models/muse-spark-open-1026` via Baseten)  
**Live demo:** https://feather-w.vercel.app

---

## 1. Demo Video Opening Statement
> *"Feather is a private, voice-first menstrual cycle companion that turns fuzzy recollections like 'two days before New Year's' into structured cycle logs and honest event overlap forecasts using Meta Muse Voice & Spark — cycle data is stored only on your device."*

---

## 2. Personal Firsthand Motivation
<!-- FIRSTHAND_MOTIVATION_START -->
I built Feather to address a gap in how people track cycles: people remember life events, not always exact dates. Coming from Kerala, I wanted to make tracking more natural by understanding references like "two days before Onam." During this hackathon, I built a working voice-first companion using Meta Muse Voice and Muse Spark, with cultural date recognition, cycle logging, and event-overlap estimates. I also prioritised on-device privacy and clear non-medical boundaries. Built solo, Feather is my attempt to turn a real everyday friction into a practical, privacy-conscious solution.
<!-- FIRSTHAND_MOTIVATION_END -->

---

## 3. Executive Summary & Core Innovation

Most menstrual trackers assume women remember calendar dates (*"my cycle started on October 14th"*). In reality, human episodic memory anchors experiences to **real-world landmarks**:
- *"My period started two days before New Year's."*
- *"I had heavy flow the Monday before summer vacation."*
- *"I have a marathon on Oct 15 and a flight on Oct 28 — will my period overlap?"*

**Feather** is an indie developer submission built to solve this exact problem using Meta's foundational audio and reasoning models:
1. **Voice-First Logging**: Streams audio directly to **Meta Muse Voice Transcribe** with 24kHz mono WAV downsampling and real-time audio visualization.
2. **Fuzzy Landmark Recall**: Uses **Meta Muse Spark** with structured tool-calling (`milestone_lookup`) and deterministic calendar arithmetic to resolve conversational temporal references into calendar coordinates.
3. **Accession Slip Preview & Multi-Turn Corrections**: Displays an interactive glass slip card allowing the user to inspect and confirm dates, flow level, and symptoms before anything is stored, with conversational corrections (*"no, make it the 3rd"*, *"add headache"*).
4. **Under the Hood Trace**: Live in-app disclosure rendering tool names, arguments, returned results, and millisecond latencies for hackathon judges.
5. **Cycle Overlap Forecast**: Evaluates upcoming milestones and travel against logged cycle history using honest, non-medical planning language ("Likely overlap", "Possible overlap", "Unlikely to overlap (estimate)").
6. **Zero Server Storage & Prominent Backup**: Saves entries strictly to the user's device (`localStorage`), backed by a prominent backup card, 14-day export banner, and 5-entry toast reminder.
7. **Hardened Safety Guardrail**: Deterministic multilingual regex (Layer 1) and agent prompt refusal (Layer 2) that blocks diagnosis, medication, and fertility/contraception advice while permitting symptom logging.
8. **Stateless API & Credit Protection**: In-memory IP rate limiting, server-side daily request cap, payload size limits, and allowed-origin validation preventing credit exhaustion.

---

## 4. What Was Built During the Hackathon (Oct 27 – Nov 4, 2026)

Per git history, all commits fall inside the hackathon building period; see PROVENANCE.md for provenance and assets whose source needs confirmation.

### A. Speech-to-Text Pipeline (`ai/backend/transcribe.ts`, `ai/frontend/useAudioRecorder.ts`)
- Implemented real-time audio resampling to 24 kHz mono 16-bit PCM WAV (rejects audio over 60 seconds; Vercel's ~4.5 MB request-body limit is why the cap is 60s, not longer).
- Formats the multipart HTTP request payload from the owner-provided Meta docs: `request` JSON ({mode:"PUSH_TO_TALK", model from MUSE_VOICE_MODEL, audioEncoding:"WAV", languageBias, keywords}) as application/json + `audio` WAV binary to Meta's `/asr/transcribe` endpoint; reads the `transcript` response field. Meta voice supports Hindi, Bengali, Kannada, Marathi, Tamil and Telugu; Malayalam voice is not supported (typed Malayalam uses the offline parser).
- Zero audio retention: audio is processed in-memory and discarded immediately after transcription.
- 10-second timeout via `AbortController` with automatic 1-retry fallback.

### B. Multi-Turn Tool-Calling Agent (`ai/backend/agent.ts`, `ai/backend/dateArithmetic.ts`)
- Powered by **Meta Muse Spark** (`muse-spark-1.3`) and swappable open-weight **Muse Spark Open 1026** on Baseten.
- Structured tool calls:
  - `log_entry`: Extracts flow, 14 standard symptoms, mood, energy, and notes.
  - `milestone_lookup`: Database of 9 verified 2025–2027 landmarks in `ai/backend/landmarks.json` (New Year's Day, Valentine's Day, International Women's Day, Earth Day, Christmas, New Year's Eve, Diwali, Onam, Vishu); unverified landmarks ask for clarification instead of guessing.
  - `update_entry`: Conversational multi-turn slip corrections (*"no, make it the 3rd"*, *"change flow to light"*).
  - `check_overlap`: Evaluates event dates against the user's cycle pattern.

### C. Hardened Safety Guardrail (`ai/backend/guardrail.ts`, `ai/eval/guardrail.dataset.ts`)
- Dual-layer defense mechanism:
  - **Layer 1 (Regex)**: Intercepts diagnostic inquiries, medication advice, dosage questions, and pregnancy-risk queries across English, Spanish, Malayalam, and Hindi.
  - **Layer 2 (Model Refusal)**: Enforces fixed refusal message: *"I can only help with logging and planning. For health questions, please talk to a doctor."*
- 100% precision and 100% recall across 105 samples in the author's own internal regression set (not an independent benchmark) with zero false-positives on valid cycle logs.

### D. User Interface & Judge Experience (`client/src/`)
- Responsive React 19 + TypeScript + Tailwind v4 client with Liquid Glass design tokens (specular borders, convex lighting, backdrop blur).
- **One-Tap Judge Demo**: Injects 4 realistic historical cycles and 5 symptom logs to instantly test forecasts.
- **Judge Tap-to-Run**: 3 multilingual one-tap prompts (English, Malayalam, Hindi / Code-Mixed).
- **Under the Hood Panel**: Live inspectable trace of Meta AI tool calls, arguments, outputs, and latency.
- Accessible: keyboard accessible mic button (Space/Enter), aria-labels, 360px viewport support, non-blocking safe area padding.

---

## 5. Official Meta Model Manifest

| Model Name | Endpoint Model ID | Exact Files | Usage in Feather |
| :--- | :--- | :--- | :--- |
| **Meta Muse Voice Transcribe** | `muse-voice-transcribe-1.0` | `api/transcribe.ts`<br>`ai/backend/transcribe.ts` | Real-time speech-to-text audio transcription |
| **Meta Muse Spark (Open-Weight)** | `meta-models/muse-spark-open-1026` | `ai/backend/config.ts` | Swappable open-weight model on Baseten bridge |

---

## 6. Privacy Architecture & Ethical Disclosures

- **Privacy Statement**:  
  *"We never store your audio or your cycle data on our servers. Voice is sent to a speech-to-text service for transcription only, and cycle entries are saved only on your device."*
- **What Leaves the Device**:
  - Audio recording: sent to `/api/transcribe` solely for text transcription, then discarded.
  - Transcript text: sent to `/api/agent` for structured parameter extraction.
- **What Stays Local**:
  - All cycle entries, symptoms, notes, and dates reside strictly in the user's browser `localStorage` (`feather_cycle_vault_v1`).
  - Zero server databases, zero telemetry tracking, and zero third-party analytics.
- **Hackathon API Credit Notice**:  
  *"While using free hackathon API credits, content sent to the Meta Model API may be used by Meta for product improvement. Do not enter real personal health data in this demo."*

---

## 7. Verification & Internal Regression Suite Test Suite

### Unit Tests (`npm test`)
- **Guardrail Unit Tests (`ai/test/guardrail.test.ts`)**: **57 / 57 passed**
- **Date Resolution & Landmark Tests (`ai/test/date_resolution.test.ts`)**: **22 / 22 passed**
- **Batches 1–9, Holdout, QA & Smoke Suites**: **All 18 test suites passed, 0 failed**

### Evaluation Harness (`npm run eval`)
- **Total Labelled Samples**: **170 samples** (`author's own internal regression set, not an independent benchmark`)
- **Landmark Recall Benchmark (65 samples across English, Malayalam, Hindi, and Code-Mixed)**:
  - **resolved to the right date: 32/32** (verified past/present landmarks and explicit plan phrases in `ai/backend/landmarks.json`)
  - **correctly asked for clarification: 33/33** (14 unverified landmarks not in `ai/backend/landmarks.json` + 19 future landmark log phrases that ask for clarification with no date)
- **Medical Guardrail F1**: **100%** (53/53 medical queries blocked, 52/52 valid logs permitted; author's own internal regression set, not an independent benchmark)
- **False Positives / False Negatives**: **0 FP / 0 FN**
- **Profiling Latency**: Median (p50) = 1ms | p95 = 2ms

### Production Build (`npm run build`)
- Serverless functions bundled with esbuild into `/api/`.
- Client compiled cleanly with Vite v6.4.5 in ~2.5s.


## Build timeline (from git log)
Work dated 2026-10-30 in git log was built during this hackathon working session; code committed on or before 2026-10-28 is pre-existing and is labelled as such. See `git log --date=short` for exact commit dates.

## Judge quickstart
Tap **Try Demo** on the first screen. Demo Mode is isolated in `feather_demo_v1`; exiting returns to the real vault untouched.

## Known limitations
The offline parser is rule-based; Live Meta calls are not verified against a live key (the ASR request shape follows the owner-provided Meta docs); Malayalam is not in Meta's supported voice languages; festival dates are limited to verified ones; estimates are not medical advice; data is unencrypted unless App Lock is on; Diary Scanner is secondary and optional. Live evaluation results are "Not measured" until run with the owner's key. See README "Known limitations" and PROVENANCE.md.
