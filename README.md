# Feather — Voice-First Menstrual Cycle Companion

> **One-Sentence Pitch:** Feather is a private, voice-first menstrual companion that turns fuzzy recollections like *"two days before New Year's"* into structured cycle logs and honest event overlap forecasts using Meta Muse Voice & Spark — stored 100% on-device with zero cloud database.

---

> **Meta Global AI Developer Hackathon**  
> **Track:** Indie Developer (*"Build for Your World"*)  
> **Hackathon Window:** October 27 – November 4, 2026  
> **Target Models:** Meta Muse Voice Transcribe (`muse-voice-transcribe-1.0`) & Meta Muse Spark (`muse-spark-1.3`)

---

## Try It in 30 Seconds (Judge Quickstart)

1. **One-Tap Synthetic History:** Tap the **"✨ Try Judge Demo"** button on the home screen. This instantly loads 4 realistic past cycles and 5 symptom logs into your local device vault, immediately activating the Plan Around It forecast and 12-Month Foresight matrix with zero typing or speech needed. *(You can clear it anytime with one click).*
2. **One-Tap Multilingual Speech Pipeline:** Click or speak natural phrases under the voice console:
   - **English:** *"Period started 2 days before New Year's, medium flow with cramps"*
   - **Español (Spanish):** *"El periodo empezó dos días antes de vacaciones, flujo moderado"*
   - **Universal Landmark:** *"Flow started the Monday before the marathon, light flow"*
3. **Accession Slip Preview & Multi-Turn Corrections:** Watch the Accession Slip resolve the calendar date and symptoms. Test conversational corrections: speak or type *"no, make it the 3rd"* or click **"+ Add Headache"** to see multi-turn slip editing in action.
4. **Inspect Under the Hood:** Click **"UNDER THE HOOD — Meta AI Tool Trace"** to inspect live tool calls (`milestone_lookup`, `log_entry`, `update_entry`, `check_overlap`), arguments, returned results, and millisecond latencies.
5. **Explore Overlap Forecasts:** Check the **Plan Around It** section and **Plate 02 12-Month Foresight Matrix** to see honest, non-medical cycle scheduling forecasts against major life events.

---

## Firsthand Motivation
<!-- FIRSTHAND_MOTIVATION_START -->
[Firsthand Motivation: Enter your personal story/motivation here — e.g., how recalling cycles relative to life events solves real friction compared to rigid calendar datepickers, and why privacy and non-medical clarity are critical for women's cycle planning.]
<!-- FIRSTHAND_MOTIVATION_END -->

---

## Architecture Diagram

```mermaid
flowchart TD
    User([User Voice or Text]) --> Capture[Voice Capture Console / 16kHz WAV]
    Capture --> LimitCheck{Stateless Protection & Rate Limits}
    LimitCheck -- Exceeded --> Friendly429[Friendly UI Error: 'Demo limit reached, try again in a minute']
    LimitCheck -- Allowed --> TranscribeAPI["/api/transcribe (Meta Muse Voice Transcribe)"]
    TranscribeAPI --> Transcript[Captured Transcript]
    Transcript --> GuardrailCheck{"Layer 1 Guardrail (Multilingual Regex)"}
    GuardrailCheck -- Medical Inquiry --> RefusalMsg["Friendly Medical Refusal (Consult Doctor)"]
    GuardrailCheck -- Valid Cycle Log --> AgentAPI["/api/agent (Meta Muse Spark 1.3 / Baseten Open-Weight)"]
    AgentAPI --> Tools["Structured Tool Calls:\n• milestone_lookup\n• log_entry\n• update_entry\n• check_overlap"]
    Tools --> SlipPreview["Accession Slip Preview Card (Interactive Confirmation & Multi-Turn Corrections)"]
    SlipPreview --> Confirm[User Confirmation]
    Confirm --> LocalVault[("On-Device Local Vault (localStorage)\nZero Server DB · Zero Tracking")]
    LocalVault --> OverlapEngine[Plan Around It & 12-Month Foresight Engine]
```

---

## Official Meta Models Used

| Model Name | Endpoint Model ID | Exact Implementation Files | Purpose & Capabilities |
| :--- | :--- | :--- | :--- |
| **Meta Muse Voice Transcribe** | `muse-voice-transcribe-1.0` | `api/transcribe.ts`<br>`api-src/transcribe.ts`<br>`ai/backend/transcribe.ts` | Real-time speech-to-text with 16kHz mono WAV streaming; multilingual ASR across English, Malayalam, Hindi, Spanish. Discarded immediately after transcription. |

---

## API Protection & Credit Safeguards


- **Per-IP Rate Limits:** 20 requests per minute and 150 requests per day (tracked in-memory per serverless instance).
- **Server-Side Daily Cap:** Configurable via `DAILY_REQUEST_CAP` environment variable (defaults to 500 requests/day per instance).
- **Request Body Limits:**
  - JSON payload: max 50 KB
  - Audio upload: max 4 MB (enforced 30-second audio maximum)
  - Vision diary upload: max 6 MB
- **Text Length Limit:** 1,000 characters maximum per prompt.
- **Allowed-Origin Check:** Validates incoming request `Origin` / `Referer` against permitted deployment hosts.
- **Graceful UI Handling:** When a limit is reached, endpoints return a 429 status code with `{ "error": "Demo limit reached, try again in a minute." }`, which the frontend renders as a friendly non-crashing banner with zero app disruption.

> **Implementation Note on Rate Limiting Honesty:** Rate limits are stateless and best-effort per serverless container instance, not a global distributed hard cap. To prevent client spoofing, Feather reads the authentic client IP prioritized by Vercel edge infrastructure (`x-real-ip` and `x-vercel-forwarded-for`) rather than trusting spoofable client `x-forwarded-for` headers.

---

## Evaluation Internal regression suite & Honesty Split

Feather includes a comprehensive evaluation harness covering cultural landmarks, relative date arithmetic, edge cases, blind holdouts, and medical safety guardrails. In strict adherence to evaluation integrity, results are clearly split between what was empirically measured and what was not measured due to local credential availability:

### Part A: Offline Deterministic Engine & Guardrail (Empirically Measured)

```sh
# Run offline internal regression suite (170 samples)
npm run eval

# Run blind holdout internal regression suite (19 samples)
npx tsx ai/eval/run-holdout.ts
```

| Internal regression suite Suite | Total Samples | Accuracy / Recall | Precision / Specificity | False Positives | False Negatives | Latency (p50 / p95) | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Landmark Recall (Multilingual)** | 65 | **100.0%** (65/65) | N/A | 0 | 0 | 0 ms / 1 ms | **MEASURED** |
| • English (`en`) | 25 | **100.0%** (25/25) | N/A | 0 | 0 | 0 ms / 1 ms | **MEASURED** |
| • Malayalam (`ml`) | 15 | **100.0%** (15/15) | N/A | 0 | 0 | 0 ms / 1 ms | **MEASURED** |
| • Hindi (`hi`) | 13 | **100.0%** (13/13) | N/A | 0 | 0 | 0 ms / 1 ms | **MEASURED** |
| • Code-Mixed | 12 | **100.0%** (12/12) | N/A | 0 | 0 | 0 ms / 1 ms | **MEASURED** |
| **Medical Safety Guardrail** | 105 | **100.0%** Refusal (53/53) | **100.0%** Precision (53/53) | 0 | 0 | 0 ms / 0 ms | **MEASURED** |
| • Medical Inquiries (Blocked) | 53 | **100.0%** Refusal | **100.0%** | 0 FP | 0 FN | 0 ms / 0 ms | **MEASURED** |
| • Valid Cycle Logs (Allowed) | 52 | **100.0%** Specificity | **100.0%** | 0 FP | 0 FN | 0 ms / 0 ms | **MEASURED** |
| **Blind Holdout (Post-Fix)** | 19 | **100.0%** (19/19) | **100.0%** | 0 FP | 0 FN | 0 ms / 0 ms | **MEASURED** |

### Part B: Live Remote Models (Credential-Dependent)

| Provider / Model | Internal regression suite Scope | Status | Notes |
| :--- | :--- | :---: | :--- |
| **Meta Model API (`muse-spark-1.3`)** | 30 landmark phrases | **Not measured** | `META_API_KEY` not configured in local evaluation runner |
| **Open-Weight Muse Spark (Baseten `meta-models/muse-spark-open-1026`)** | 30 landmark phrases | **Open-weight not measured** | `BASETEN_API_KEY` not configured in local evaluation runner |

*For complete internal regression suite breakdown, blind holdout failure logs, and latency profiling, see [`EVALS.md`](file:///c:/Users/q04ti/Documents/feather/EVALS.md).*

---

## Privacy Architecture & Data Handling

> **"We never store your audio or your cycle data on our servers. Voice is sent to a speech-to-text service for transcription only, and cycle entries are saved only on your device."**

### How Your Voice & Cycle Data is Processed
- **What Leaves the Device:**
  - Audio recording is sent over HTTPS to `/api/transcribe` exclusively to generate text. Audio is processed in-memory and discarded immediately after transcription.
  - Transcript text is sent to `/api/agent` to extract structured parameters.
- **What Stays Local:**
  - All confirmed cycle entries, notes, symptoms, and dates are stored exclusively in your browser's `localStorage` (`feather_cycle_vault_v1`).
  - Feather contains **zero server-side databases** and **zero user tracking or analytics**.
- **Browser Speech Service (Opt-In):**
  - An optional parallel Web Speech API transcription path is available in Settings. It is **OFF by default** and clearly labelled. Meta Muse Voice Transcribe is the default path.
- **Hackathon Disclosure:**
  > *"While using free hackathon API credits, content sent to the Meta Model API may be used by Meta for product improvement. Do not enter real personal health data in this demo."*

---

## Medical Refusal Guardrail & Neutral Wording

Feather is built strictly for **logging and milestone planning**. It is not a diagnostic tool, does not provide medical or contraception advice, and does not provide fitness coaching.

### Two-Layer Guardrail
1. **Layer 1: Deterministic Multilingual Regex (`ai/backend/guardrail.ts`)**
   - Intercepts inquiries about diagnoses, medication, dosages, symptom causes, and pregnancy risks in English, Spanish, Malayalam, and Hindi.
   - Zero false-positives: neutral logging statements like *"cramps and headache today"* or *"heavy flow"* pass through without interruption.
2. **Layer 2: Agent System Prompt Enforcement (`ai/backend/agent.ts`)**
   - Muse Spark refuses diagnostic or treatment queries with the mandatory response:  
     > *"I can only help with logging and planning. For health questions, please talk to a doctor."*

### Neutral Planning Wording
- Misleading labels like "Clear", "Safe", and "guaranteed" are strictly excluded.
- Forecasts use neutral language: **"Likely overlap"**, **"Possible overlap"**, or **"Unlikely to overlap (estimate)"**.
- Every forecast displays a persistent disclaimer:  
  > *"Estimates based on your logged cycles. Cycles vary, so this is not a guarantee and not contraception or medical advice."*

---

## Local Vault & Unmissable Backup

Because all cycle data lives exclusively on the user's device, clearing browser cache or changing devices would lose data. Feather makes backup prominent:
- **Home Screen Backup Card:** Clear "Back up your data" card with one-click JSON Export.
- **14-Day Overdue Banner:** Appears automatically if the user has entries but has not exported a backup in the last 14 days.
- **5-Entry Toast:** A non-blocking reminder toast after every 5 confirmed cycle entries: *"Your data lives only on this device. Export a backup?"*
- **Import with Overwrite Warning:** One-click JSON import with explicit confirmation before existing entries are merged or replaced.

---

## Request Protection & Rate Limiting Honesty

To protect infrastructure credits against automated scrapers, denial-of-wallet loops, and replay attacks, Feather enforces best-effort request protection across all serverless endpoints:
- **True Client IP Address:** Client IPs are extracted directly from authentic edge headers set by Vercel (`x-real-ip` and `x-vercel-forwarded-for`) rather than trusting a spoofable client-supplied `x-forwarded-for`.
- **Per-IP Limits:** 20 requests/minute and 150 requests/day per serverless instance.
- **Server-Side Daily Cap:** Enforces `DAILY_REQUEST_CAP` (default: 500 requests/day) to safeguard hackathon API credit quotas.
- **Payload Sanitization:** Maximum 4MB request body, 1,000 characters text prompt, and 30 seconds audio duration.
- **Stateless Best-Effort Architecture Note:** Serverless functions on Vercel run as ephemeral, distributed containers that scale independently across multiple instances and regions without a shared centralized Redis or database. Consequently, these rate limits are strictly best-effort per running instance and not a hard global cap across all distributed nodes. When a limit is hit, endpoints return HTTP 429 with a user-friendly notice without crashing the UI.

---

## Project Structure

```
feather/
├── ai/
│   ├── backend/
│   │   ├── agent.ts          # Muse Spark tool-calling agent (log_entry, milestone_lookup, update_entry, check_overlap)
│   │   ├── config.ts         # Meta Model API & Baseten configuration loader
│   │   ├── dateArithmetic.ts # Deterministic temporal arithmetic & multilingual landmark parser
│   │   ├── festivals.json    # Cultural landmark dates (Diwali, Onam, Vishu, Holi, Eid, Christmas)
│   │   ├── guardrail.ts      # Multilingual deterministic safety regex guardrail
│   │   ├── milestonesData.ts # Universal & cultural landmark calendar database (2026-2027)
│   │   ├── protection.ts     # Stateless in-memory rate limiting & payload size protection
│   │   ├── server.ts         # Lightweight Node HTTP API server for local development
│   │   ├── transcribe.ts     # Meta Muse Voice Transcribe service
│   │   └── vision.ts         # Photo diary scanner service using Muse Spark
│   ├── eval/
│   │   ├── guardrail.dataset.ts # 105 labelled samples (medical vs. valid logs)
│   │   ├── landmarks.dataset.ts # 65 labelled multilingual landmark expressions
│   │   └── runner.ts            # Automated internal regression suite runner with p50/p95 latency profiling
│   ├── frontend/
│   │   ├── aiClient.ts       # Frontend client with 10s timeout, retry, and offline fallback
│   │   ├── PaperDiaryImportModal.tsx # Photo calendar extractor modal
│   │   └── useAudioRecorder.ts       # 16kHz WAV audio recorder & live Web Audio visualizer
│   └── test/
│       ├── date_resolution.test.ts  # 22 Landmark recall, edge-case, and slip correction tests
│       ├── guardrail.test.ts        # 57 Multilingual medical refusal tests
├── api-src/                  # Serverless function source files with stateless protection
│   ├── agent.ts
│   ├── transcribe.ts
│   └── vision.ts
├── api/                      # Self-contained bundled serverless functions (Vercel)
├── client/                   # React 19 + TypeScript + Tailwind v4 multi-page SPA
│   ├── public/               # Public assets (icon.webp, manifest.json)
│   ├── src/
│   │   ├── components/       # Reusable UI (Sidebar, AppLayout, PageHeader, EmptyState, ConfirmDialog)
│   │   ├── pages/            # Multi-page views (Dashboard, VoiceFlow, Vault, Chronicle, Insights, Scanner, Settings)
│   │   ├── cycleStorage.ts   # Local vault engine (on-device localStorage, average cycle estimation)
│   │   ├── App.tsx           # React Router route definitions
│   │   ├── main.tsx          # React root entry point with ErrorBoundary & QueryClient
│   │   └── theme.css         # Liquid Glass CSS design tokens, ambient aura, & animations
│   └── index.html            # App entry point
├── scripts/
│   └── bundle-api.mjs        # Esbuild standalone serverless bundler
├── EVALS.md                  # Comprehensive internal regression suite report & open-weight comparison
├── .env.example              # Environment variable template
├── package.json              # Project dependencies and test scripts
├── vercel.json               # Vercel deployment configuration
└── vite.config.ts            # Vite build configuration
```

---

## Quick Start (Run Locally)

### 1. Prerequisites
- Node.js 18+
- npm or pnpm

### 2. Configure Environment
Copy `.env.example` to `.env`:
```sh
cp .env.example .env
```
Add your Meta Model API key (or Baseten API key):
```env
META_API_KEY=your_meta_api_key_here
META_BASE_URL=https://api.meta.ai/v1
MUSE_VOICE_MODEL=muse-voice-transcribe-1.0
MUSE_SPARK_MODEL=muse-spark-1.3
DAILY_REQUEST_CAP=500
PORT=3001
```

### 3. Run Automated Tests & Eval Harness
```sh
npm test

# Run the 170-sample evaluation harness with latency profiling
npm run eval
```

### 4. Build and Run Development
```sh
# Bundle serverless functions and build client
npm run build

# Start local AI backend server (optional if testing with offline fallback)
npm run start:ai

# Start local Vite development server
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Production Deployment (Vercel)

Feather is ready for zero-configuration serverless deployment on Vercel:

1. **Bundle Serverless Functions:**
   ```sh
   npm run build
   ```
2. **Deploy via Vercel CLI or Dashboard:**
   - Set environment variables:
     - `META_API_KEY`
     - `META_BASE_URL` (`https://api.meta.ai/v1`)
     - `MUSE_VOICE_MODEL` (`muse-voice-transcribe-1.0`)
     - `MUSE_SPARK_MODEL` (`muse-spark-1.3`)
     - `DAILY_REQUEST_CAP` (`500`)
   - Run:
     ```sh
     vercel --prod
     ```

---

## License
MIT License. Built for the Meta Global AI Developer Hackathon.


## Calendar sync — Future work
Google Calendar OAuth is future work and is not implemented. Feather supports local .ics export/import only (see Settings and /calendar). Processing of imported .ics files happens entirely in the browser.

## Privacy (matches the app)
Cycle data is stored on this device in localStorage. It is not encrypted unless App Lock is on (Settings -> Privacy). With App Lock on, the vault is encrypted with AES-GCM-256 using a PBKDF2-SHA-256 key (600,000 iterations) derived from your passphrase; the key stays in memory only. Forgotten passphrase = data cannot be recovered. What leaves the device: audio is sent to transcription, and text is sent to the agent, only when you use those features.

## Judge quickstart
Open the app, tap **Try Demo** on the first screen (or add ?demo=1). Demo Mode uses the separate `feather_demo_v1` namespace with fictional irregular cycles (lengths 26-38 days). Exit demo from the banner to return to your real vault untouched. Dev URL: http://localhost:3000

## Models manifest
- Meta Muse Voice Transcribe (`MUSE_VOICE_MODEL`, server-side via `ai/backend/transcribe.ts` -> `api/transcribe.ts`)
- Meta Muse Spark (`MUSE_SPARK_MODEL`, server-side via `ai/backend/agent.ts`, `ai/backend/vision.ts` -> `api/agent.ts`, `api/vision.ts`)
- Exact bundled files: `api/agent.ts`, `api/transcribe.ts`, `api/vision.ts`, `api/health.ts` (sources in `api-src/`, bundled by `scripts/bundle-api.mjs`)

## Known limitations
Live Meta results are Not measured until run with a real key (`npx tsx ai/eval/run-live-meta.ts`). Languages in the internal regression suite: en, hi, ml, ta, kn and code-mixed. Rate limits are best-effort in-memory per serverless instance. Storage is localStorage (device/browser bound, size-limited). Landmark dates are limited to verified entries in `ai/backend/landmarks.json`; unverifiable dates are omitted rather than invented.
