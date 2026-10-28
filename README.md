# Feather — Voice-First Menstrual Cycle Companion

> **Meta Global AI Developer Hackathon**  
> **Track:** Indie Developer (*"Build for Your World"*)  
> **Hackathon Window:** October 27 – November 4, 2026  
> **Target Models:** Meta Muse Voice Transcribe (`muse-voice-transcribe-1.0`) & Meta Muse Spark (`muse-spark-1.3`)

---

## Demo Video Opening Statement
> *"Feather is a voice-first menstrual cycle logging and planning companion built this week for the Meta Global AI Hackathon; earlier prototypes lacked voice and fuzzy landmark recall, which were engineered entirely during the hackathon."*

---

## Firsthand Motivation
[Firsthand Motivation: Enter your personal story/motivation here — e.g., how recalling cycles relative to life events solves real friction compared to rigid calendar datepickers, and why privacy and non-medical clarity are critical for women's cycle planning.]

---

## Headline Pitch: Fuzzy Landmark Date Recall

Most cycle trackers demand exact calendar dates on a grid. In reality, women often recall past cycles through life events:
- *"I got my period two days before New Year's."*
- *"It started the Monday before Diwali."*
- *"Heavy flow around International Women's Day."*
- *"I have an exam on Nov 20 and a marathon on Dec 3 — will it overlap?"*

**Feather** is an intelligent, voice-first companion that listens to natural, code-mixed speech, resolves fuzzy landmark memories into structured calendar dates via **Meta Muse Spark**, and produces an instant **Accession Slip** preview and **Overlap Forecast**.

### Hero Flow
1. **Speak a Fuzzy Memory**: Tap the mic and describe your cycle naturally in English, Malayalam, Hindi, or Spanish.
2. **Accession Slip Preview**: Review resolved calendar dates, flow levels, and symptom tags before anything is saved.
3. **One-Tap Confirm**: The entry is saved strictly into your device's local vault.
4. **Instant Overlap Forecast**: See neutral, honest scheduling estimates against upcoming travel, exams, or athletic milestones.

### Also Included
- **Paper Diary & Calendar Scanner**: Upload photos of handwritten paper diaries or wall calendars with circled dates; Meta Muse Spark extracts contiguous cycle intervals into an editable confirmation table.
- **12-Month Life Foresight Matrix (Plate 02)**: Long-range calendar milestone projection evaluating estimated phases across global events without athletic or dietary coaching.

---

## Key Architecture & Components

Feather focuses on voice logging, landmark recall, and private planning.

| Feature / Component | Description |
| :--- | :--- |
| **Meta Muse Voice Transcribe (`muse-voice-transcribe-1.0`)** | 16kHz mono WAV in-memory audio streaming and transcription. Discarded immediately after transcription. |
| **Meta Muse Spark (`muse-spark-1.3`) Agent & Tools** | Tool-calling loop with `log_entry`, `milestone_lookup`, and `check_overlap`. |
| **Landmark Date Recall Engine** | Natural-language temporal offset resolution against 2026–2027 global & cultural milestones. |
| **Two-Layer Safety Guardrail** | Layer 1 deterministic multilingual regex refusal + Layer 2 system prompt refusal. |
| **Accession Slip Preview & Confirmation** | Interactive glass card for validating extracted flow, symptoms, and dates before saving. |
| **Cycle Overlap Forecast** | Neutral scheduling projections with persistent non-medical disclaimers. |
| **Local Device Vault & Unmissable Backup** | Zero server database. Home screen backup card, 14-day export banner, and 5-entry toast reminder. |
| **Paper Diary Scanner** | Multimodal calendar photo extraction powered by Meta Muse Spark. |
| **12-Month Plate 02 Foresight Matrix** | Planning-only long-term milestone matrix. |

---

## Official Meta Models Used

Feather connects directly to official Meta endpoints (`https://api.meta.ai/v1`) using verified model identifiers:

1. **`muse-voice-transcribe-1.0` (Meta Muse Voice Transcribe)**
   - Used in `/api/transcribe` for real-time speech-to-text.
   - Accepts 16kHz mono 16-bit PCM WAV audio.
2. **`muse-spark-1.3` (Meta Muse Spark)**
   - Used in `/api/agent` for structured tool calling, landmark milestone resolution, and overlap forecasting.
   - Used in `/api/vision` for extracting circled dates from calendar photos.
   - Used in `/api/synthesis` for generating the 12-month foresight matrix.
   - *(Optional Swappable Provider: supports Baseten bridge `meta-models/muse-spark-open-1026` via environment toggle)*.

---

## Privacy Architecture & Data Handling

> **"We never store your audio or your cycle data on our servers. Voice is sent to a speech-to-text service for transcription only, and cycle entries are saved only on your device."**

### How Your Voice is Processed
- **What Leaves the Device**:
  - Audio recording is sent over HTTPS to the transcription endpoint (`/api/transcribe`) exclusively to generate text. The audio is processed in-memory and immediately discarded.
  - The resulting transcript is sent to the AI agent (`/api/agent`) to extract structured cycle parameters.
- **What Stays Local**:
  - All confirmed cycle entries, notes, symptoms, and dates are stored exclusively in your browser's `localStorage` (`feather_cycle_vault_v1`).
  - Feather contains **zero server-side databases** and **zero user tracking or analytics**.
- **Browser Speech Service (Opt-In)**:
  - An optional parallel Web Speech API transcription path is available in Settings. It is **OFF by default** and clearly labelled as using your browser vendor's speech service. Meta Muse Voice Transcribe is the default path.
- **Hackathon Disclosure**:
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
- Misleading labels like "Clear", "Safe", and "guaranteed" have been removed.
- Forecasts use neutral language: **"Likely overlap"**, **"Possible overlap"**, or **"Unlikely to overlap (estimate)"**.
- Every forecast displays a persistent disclaimer:  
  > *"Estimates based on your logged cycles. Cycles vary, so this is not a guarantee and not contraception or medical advice."*

---

## Local Vault & Unmissable Backup

Because all cycle data lives exclusively on the user's device, clearing browser cache or changing devices would lose data. Feather makes backup prominent:
- **Home Screen Backup Card**: Clear "Back up your data" card with one-click JSON Export.
- **14-Day Overdue Banner**: Appears automatically if the user has entries but has not exported a backup in the last 14 days.
- **5-Entry Toast**: A non-blocking reminder toast after every 5 confirmed cycle entries: *"Your data lives only on this device. Export a backup?"*
- **Import with Overwrite Warning**: One-click JSON import with explicit confirmation before existing entries are merged or replaced.

---

## Project Structure

```
feather/
├── ai/
│   ├── backend/
│   │   ├── agent.ts          # Muse Spark tool-calling agent (log_entry, milestone_lookup, check_overlap)
│   │   ├── config.ts         # Meta Model API & Baseten configuration loader
│   │   ├── guardrail.ts      # Multilingual deterministic safety regex guardrail
│   │   ├── milestonesData.ts # Universal & cultural landmark calendar database (2026-2027)
│   │   ├── server.ts         # Lightweight Node HTTP API server for local development
│   │   ├── synthesis.ts      # 12-month Plate 02 foresight matrix engine
│   │   ├── transcribe.ts     # Meta Muse Voice Transcribe service
│   │   └── vision.ts         # Photo diary scanner service using Muse Spark
│   ├── frontend/
│   │   ├── aiClient.ts       # Frontend client dispatching to /api/*
│   │   ├── PaperDiaryImportModal.tsx # Photo calendar extractor modal
│   │   └── useAudioRecorder.ts       # 16kHz WAV audio recorder & live Web Audio visualizer
│   └── test/
│       ├── date_resolution.test.ts  # 14 Landmark recall and overlap tests
│       ├── guardrail.test.ts        # 35 Multilingual medical refusal tests
│       └── synthesis.test.ts        # 6 Foresight matrix & chronobiology tests
├── api-src/                  # Serverless function source files
│   ├── agent.ts
│   ├── synthesis.ts
│   ├── transcribe.ts
│   └── vision.ts
├── api/                      # Self-contained bundled serverless functions (Vercel/Netlify)
├── client/                   # React 19 + TypeScript + Tailwind v4 frontend
│   ├── public/               # Public assets (icon.webp, manifest.json)
│   ├── src/
│   │   ├── App.tsx           # Hero flow: Voice capture, Accession Slip, Overlap Forecast
│   │   ├── CreditsModal.tsx  # Settings: Voice processing explainer, Web Speech toggle, Backup
│   │   ├── DeveloperDocsModal.tsx # In-app system architecture & guardrail documentation
│   │   ├── LiquidGlassSidebar.tsx # Mobile dock navigation & desktop sidebar
│   │   ├── cycleStorage.ts   # Local vault engine (average cycle estimation, backup tracking)
│   │   ├── main.tsx          # React root entry point
│   │   └── theme.css         # Liquid Glass CSS design tokens & animations
│   └── index.html            # App entry point
├── scripts/
│   └── bundle-api.mjs        # Esbuild standalone serverless bundler
├── .env.example              # Environment variable template
├── .gitignore                # Git ignore configuration
├── package.json              # Project dependencies and test scripts
├── tsconfig.json             # Root TypeScript configuration
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
PORT=3001
```

### 3. Run Automated Tests
```sh
# Run all tests (55 tests across guardrails, landmarks, and synthesis)
npm run test:ai

# Or run suites individually:
npm run test:guardrail   # 35 passed, 0 failed
npm run test:dates       # 14 passed, 0 failed
npm run test:synthesis   # 6 passed, 0 failed
```

### 4. Start Local Development
Start the AI backend server:
```sh
npm run start:ai
```
In a separate terminal, start the Vite frontend:
```sh
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Production Deployment (Vercel)

Feather is ready for zero-configuration serverless deployment on Vercel:

1. **Bundle Serverless Functions**:
   ```sh
   npm run build
   ```
   *This automatically runs `scripts/bundle-api.mjs` using esbuild to bundle `api-src/*` into self-contained standalone serverless functions in `api/`.*

2. **Deploy via Vercel Dashboard or CLI**:
   - Set environment variables in Vercel Project Settings:
     - `META_API_KEY`
     - `META_BASE_URL` (`https://api.meta.ai/v1`)
     - `MUSE_VOICE_MODEL` (`muse-voice-transcribe-1.0`)
     - `MUSE_SPARK_MODEL` (`muse-spark-1.3`)
   - Run:
     ```sh
     vercel --prod
     ```

---

## License
MIT License. Built for the Meta Global AI Developer Hackathon.
