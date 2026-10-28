# Meta Global AI Developer Hackathon Submission
**Track:** Indie Developer (*"Build for Your World"*)  
**Project:** Feather — Voice-First Menstrual Cycle Companion  
**Hackathon Window:** October 27 – November 4, 2026  
**Primary Models:** Meta Muse Voice Transcribe (`muse-voice-transcribe-1.0`) & Meta Muse Spark (`muse-spark-1.3`)

---

## 1. Demo Video Opening Statement
> *"Feather is a voice-first menstrual cycle logging and planning companion built this week for the Meta Global AI Hackathon; earlier prototypes lacked voice and fuzzy landmark recall, which were engineered entirely during the hackathon."*

---

## 2. Personal Firsthand Motivation
[Firsthand Motivation: Enter your personal story/motivation here — e.g., how recalling cycles relative to life events solves real friction compared to rigid calendar datepickers, and why privacy and non-medical clarity are critical for women's cycle planning.]

---

## 3. Executive Summary & Core Innovation

Most menstrual trackers assume women remember calendar dates (*"my cycle started on October 14th"*). In reality, human episodic memory anchors experiences to **real-world landmarks**:
- *"My period started two days before New Year's."*
- *"I had heavy flow the Monday before Diwali."*
- *"I have a marathon on Oct 15 and a flight on Oct 28 — will my period overlap?"*

**Feather** is an indie developer submission built to solve this exact problem using Meta's latest foundational audio and reasoning models:
1. **Voice-First Logging**: Streams audio directly to **Meta Muse Voice Transcribe** with 16kHz mono WAV downsampling and real-time audio visualization.
2. **Fuzzy Landmark Recall**: Uses **Meta Muse Spark** with structured tool-calling (`milestone_lookup`) to resolve conversational temporal references into calendar coordinates.
3. **Accession Slip Preview**: Displays an interactive glass slip card allowing the user to inspect and confirm dates, flow level, and symptoms before anything is stored.
4. **Cycle Overlap Forecast**: Evaluates upcoming milestones and travel against logged cycle history using honest, non-medical planning language ("Likely overlap", "Possible overlap", "Unlikely to overlap (estimate)").
5. **Zero Server Storage & Prominent Backup**: Saves entries strictly to the user's device (`localStorage`), backed by a prominent backup card, 14-day export banner, and 5-entry toast reminder.
6. **Hardened Safety Guardrail**: Deterministic multilingual regex (Layer 1) and agent prompt refusal (Layer 2) that blocks diagnosis, medication, and fertility/contraception advice while permitting symptom logging.

---

## 4. What Was Built During the Hackathon (Oct 27 – Nov 4, 2026)

All code in this repository was engineered specifically for the hackathon event:

### A. Speech-to-Text Pipeline (`/ai/backend/transcribe.ts`, `/ai/frontend/useAudioRecorder.ts`)
- Implemented real-time audio downsampling to 16kHz mono 16-bit PCM WAV.
- Formats multipart HTTP request payload (`request` JSON metadata + `audio` binary) expected by Meta's `/asr/transcribe` endpoint.
- Zero audio retention: audio is processed in-memory and discarded immediately after transcription.
- User-facing toggle in Settings for browser Web Speech API (OFF by default, Meta Muse Voice Transcribe is the default).

### B. Tool-Calling Agent (`/ai/backend/agent.ts`, `/ai/backend/milestonesData.ts`)
- Powered by **Meta Muse Spark** (`muse-spark-1.3`).
- Custom tools:
  - `log_entry`: Extracts flow, 14 standard symptoms, mood, energy, and notes.
  - `milestone_lookup`: Database of 2026–2027 universal and cultural milestones (New Year's Day, Valentine's Day, International Women's Day, Spring Equinox, Earth Day, Summer Solstice, Global Marathon Season, Winter Holidays, Diwali, Eid, etc.).
  - `check_overlap`: Evaluates event dates against the user's cycle pattern.
- Strict system prompt enforcing non-medical refusal, neutral scheduling terminology, and structured JSON outputs.

### C. Hardened Safety Guardrail (`/ai/backend/guardrail.ts`, `/ai/test/guardrail.test.ts`)
- Dual-layer defense mechanism:
  - **Layer 1 (Regex)**: Intercepts diagnostic inquiries, medication advice, dosage questions, and pregnancy-risk queries across English, Spanish, Malayalam, and Hindi.
  - **Layer 2 (Model Refusal)**: Enforces fixed refusal message: *"I can only help with logging and planning. For health questions, please talk to a doctor."*
- Permissive symptom logging: ensures valid inputs like *"cramps and headache today"* or *"heavy flow"* are never falsely blocked.
- Automated test suite with unit tests passing.

### D. User Interface & Liquid Glass Aesthetics (`/client/src/`)
- Responsive React 19 + TypeScript + Tailwind v4 client with hand-crafted Liquid Glass design tokens (specular borders, convex lighting, backdrop blur).
- Default home experience is the **Hero Flow**: mic capture → live waveform → Accession Slip preview → confirm → instant overlap forecast.
- Unmissable local backup architecture:
  - Home screen "Back up your data" card with one-click JSON export.
  - 14-day export overdue gentle banner.
  - 5-entry reminder toast.
  - JSON import with overwrite warning.
- Collapsible "More Tools" section containing:
  - Paper Diary Scanner (`PaperDiaryImportModal.tsx`) using Meta Muse Spark.
  - 12-Month Plate 02 Foresight Matrix (`synthesis.ts`) with neutral calendar phase labels and zero athletic/dietary coaching language.

---

## 5. Official Meta Model Manifest

| Model Name | Endpoint Model ID | Usage in Feather |
| :--- | :--- | :--- |
| **Meta Muse Voice Transcribe** | `muse-voice-transcribe-1.0` | Real-time speech-to-text audio transcription |
| **Meta Muse Spark** | `muse-spark-1.3` | Tool-calling agent, landmark resolution, overlap evaluation, paper calendar scanning, and 12-month foresight matrix |
| *(Baseten Bridge)* | `meta-models/muse-spark-open-1026` | Optional open-weights swappable provider via `USE_BASETEN=true` |

---

## 6. Privacy Architecture & Ethical AI Disclosures

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

## 7. Verification & Test Suite

The test suite can be run at any time via:
```sh
npm run test:ai
```

### Results
- **Guardrail Unit Tests (`ai/test/guardrail.test.ts`)**: **35 / 35 passed**  
  - 24 bait questions in English, Spanish, Malayalam, and Hindi correctly refused.  
  - 11 neutral symptom logging prompts correctly permitted.
- **Date Resolution & Landmark Tests (`ai/test/date_resolution.test.ts`)**: **14 / 14 passed**  
  - 12 universal milestones verified across 2026 and 2027.  
  - Natural-language landmark offset resolution verified.  
  - Honest overlap scheduling calculation verified.
- **Longitudinal Synthesis Tests (`ai/test/synthesis.test.ts`)**: **6 / 6 passed**  
  - Executive summary, regularity score, phase correlations, and 12-month foresight matrix verified.
- **Production Build (`npm run build`)**:  
  - Serverless functions bundled with esbuild into `/api/`.  
  - Client compiled cleanly with Vite v6.4.5 in ~2.5s.
