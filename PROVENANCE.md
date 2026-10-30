# Provenance & Licensing

## Repository history (from `git log`, not altered)
- Earliest commit in this repository: `c09d38f` — 2026-10-28 16:53 +0530 ("Feather: voice-first cycle companion for the Meta Global AI Developer Hackathon").
- Hackathon kickoff was Oct 26 12:00 ET; the building period is Oct 27 – Nov 4, 2026.
- Because the repository history begins on 2026-10-28, no file in this repo has a first commit that predates the kickoff. All commits fall inside the building period. History has not been rewritten, squashed, or deleted for this submission.
- Owner: confirm that no code, data, or assets were copied from any pre-event project. This file records only what `git log` shows; it cannot prove how code was authored before its first commit.

## Non-code assets
| Asset | Source | License / status |
|---|---|---|
| `client/public/icon.webp` | SOURCE UNKNOWN - owner must confirm | SOURCE UNKNOWN - owner must confirm |
| `client/public/icon-192.png`, `client/public/icon-512.png` | Generated in this repo (2026-10-30) by resizing `client/public/icon.webp` | Derived from the above; same unknown status |
| Fonts: Newsreader, Plus Jakarta Sans, Inter, JetBrains Mono | Loaded at runtime from Google Fonts (`fonts.googleapis.com`, see `client/src/theme.css` and `client/index.html`); no font files are vendored in this repo | As published by Google Fonts for each family |
| `ai/backend/landmarks.json` date data | Each entry carries its own `source` URL and `verifiedOn` date inside the file (e.g. timeanddate.com holiday pages, un.org, earthday.org) | Factual calendar dates; sources recorded per entry |
| Demo data (`client/src/lib/demoMode.ts`) | Written for this project; fictional cycles, labelled fictional in the UI | Original to this repo |

## Runtime dependencies (from package.json / package-lock.json only)
| Package | Version (installed) | License (package metadata) |
|---|---|---|
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| react-router-dom | 7.18.5 | MIT |
| @tanstack/react-query | 5.105.0 | MIT |
| zod | 4.6.7 | MIT |

Dev-only tooling (Vite, Tailwind, TypeScript, tsx, esbuild, React plugin) is listed in `package.json` devDependencies and is not shipped in the product runtime.
