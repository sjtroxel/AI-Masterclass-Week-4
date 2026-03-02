# ChronoQuizzr — Claude Institutional Knowledge

## Project Overview

ChronoQuizzr is a historically-based GeoGuessr-style game. Players receive an obfuscated historical text clue, drop a pin on a Leaflet.js map, and receive a score based on the Haversine distance between their guess and the true event coordinates.

All architectural specs live in `./project-specs/`. Read them before making structural changes.

Enforced rules live in `.claude/rules/` — one file per rule. Claude loads these automatically.

---

## Repo Structure: Scripts-Orchestration Layout (NOT a Workspaces Monorepo)

```
chrono-quizzr/          ← root: concurrently only
├── shared/             ← TypeScript contracts (types.d.ts) — no npm package, no node_modules
├── client/             ← Vite + React frontend ("The Map"), port 5173
└── server/             ← Node/Express backend ("The Brain"), port 3001
```

This is **not** an npm Workspaces setup. Each sub-package has its own `node_modules/`. The `shared/` directory has no package of its own — both client and server import from it directly using the `@shared` path alias (see below). `npm install` at root only installs `concurrently`.

---

## Build & Dev Commands

### First-Time Setup (run once after cloning)

```bash
npm install                        # root: installs concurrently only
npm install --prefix client        # React/Vite/Leaflet/Tailwind/TS deps
npm install --prefix server        # Express, cors, vitest, ts-node-dev, @types/*
```

### Daily Development

```bash
# From the repo root — starts both packages concurrently:
npm run dev
```

- `npm run dev --prefix client` → Vite HMR at http://localhost:5173
- `npm run dev --prefix server` → `ts-node-dev --respawn --transpile-only index.ts` at http://localhost:3001

### Offline Event Batch Generator

```bash
npm run generate --prefix server   # writes server/data/generated_events.json (10 events)
```

Calls the Chronicler Engine with `AnthropicProvider` (claude-haiku-4-5-20251001). Requires `ANTHROPIC_API_KEY` in `server/.env`.

### Testing

```bash
# Run all server tests (vitest, single pass) — 39 tests:
npm test --prefix server

# Run all client unit tests (vitest + jsdom) — 30 tests:
npm test --prefix client

# Watch mode for either package:
npm run test:watch --prefix server
npm run test:watch --prefix client

# Run E2E tests (Playwright, Chromium) — 2 tests:
# Automatically starts the dev stack if it isn't already running.
cd client && npx playwright test
# or: npm run test:e2e --prefix client
```

**Test counts at a glance:**

| Suite | Runner | Count | Files |
|---|---|---|---|
| Server unit | Vitest | 6 | `server/utils/haversine.test.ts` |
| Server unit | Vitest | 8 | `server/utils/scorer.test.ts` |
| Server service | Vitest | 8 | `server/services/chroniclerEngine.test.ts` |
| Server integration | Vitest + supertest | 17 | `server/routes/game.test.ts` |
| Client component | Vitest + jsdom | 6 | `client/src/components/MapView.test.tsx` |
| Client component | Vitest + jsdom | 9 | `client/src/components/CluePanel.test.tsx` |
| Client context | Vitest + jsdom | 5 | `client/src/context/ThemeContext.test.tsx` |
| Client component | Vitest + jsdom | 5 | `client/src/components/FinalScoreScreen.test.tsx` |
| Client component | Vitest + jsdom | 5 | `client/src/components/GameBoard.test.tsx` |
| E2E | Playwright | 2 | `client/e2e/game-loop.spec.ts` |
| **Total** | | **71** | |

### Individual Build Commands

```bash
npm run build --prefix client      # tsc -b → vite build → client/dist/
npm run build --prefix server      # tsc → server/dist/
npm run start --prefix server      # node dist/index.js (production)
```

### TypeScript Type Checking

```bash
cd client && npx tsc -b --noEmit   # checks src/ + vite.config.ts
cd server && npx tsc --noEmit      # checks all server .ts files
```

---

## Shared Types & the `@shared` Alias

All core interfaces live in `shared/types.d.ts`. Both packages reference them via the `@shared` alias:

```typescript
import type { HistoricalEvent, GameEvent, Guess, GuessResult } from '@shared/types';
```

**Always use `import type`** — shared types are erased at compile time, so there is zero runtime overhead and no path-resolution issues in the compiled server output.

**Alias configuration:**
| Package | Config |
|---|---|
| `client` | `vite.config.ts` → `resolve.alias` + `tsconfig.app.json` → `paths` |
| `server` | `server/tsconfig.json` → `paths` |

**Core types** (`shared/types.d.ts`):

| Type | Description |
|---|---|
| `Coordinates` | `{ lat: number; lng: number }` |
| `HistoricalEvent` | Full event record including `hiddenCoords` — server only |
| `GameEvent` | `Omit<HistoricalEvent, 'hiddenCoords'>` — safe to send to client |
| `Guess` | Client → server: `{ eventId, lat, lng }` |
| `GuessResult` | Server → client: `{ distance, score, trueCoords }` |

---

## Code Style

### Language: TypeScript Throughout

- **Client:** `.tsx` for components, `.ts` for utilities
- **Server:** `.ts` source → compiled CommonJS in `dist/`
- Both use `"strict": true`
- Use `import`/`export` syntax everywhere; TypeScript handles CommonJS output for server

### TypeScript Configs

| File | Purpose |
|---|---|
| `client/tsconfig.json` | Project references root |
| `client/tsconfig.app.json` | `src/` — strict, `jsx: react-jsx`, `@shared` path |
| `client/tsconfig.node.json` | `vite.config.ts` + `playwright.config.ts` + `e2e/**` — Node types |
| `server/tsconfig.json` | All server `.ts` — CommonJS output to `server/dist/`, `@shared` path |

### General Rules
- Do not use `any` — use `unknown` and narrow, or define a proper interface.
- All API shapes must use types from `shared/types.d.ts` — no ad-hoc inline types for request/response bodies.
- No semicolons in client component files (ESLint default).
- Prefer named exports over default exports in utility files.

### AI Commit Policy — ABSOLUTE PROHIBITION
**Claude must never create, amend, or suggest git commits.** This includes:
- Never running `git commit` or `git add`
- Never using `--no-verify` to bypass hooks
- Never adding "Co-Authored-By" tags

The developer commits manually. If asked to commit, decline.

### File Creation Policy
- Do not create files outside the established structure without first updating `project-specs/`.
- Prefer editing existing files over creating new ones.

---

## Project Logic

### Scoring: The Haversine Formula

Standalone utility at `server/utils/haversine.ts`:

```typescript
haversine(lat1: number, lng1: number, lat2: number, lng2: number): number
// returns distance in kilometres
```

Earth radius = 6371 km. No external geo libraries. Tested in `server/utils/haversine.test.ts`.

Scoring wrapper at `server/utils/scorer.ts`:

```
score = Math.round( 5000 × e^(−distance / 2000) )
```

| Distance  | Score       |
|-----------|-------------|
| 0 km      | 5,000 (max) |
| 500 km    | ~3,894      |
| 1,000 km  | ~3,033      |
| 2,000 km  | ~1,839      |
| 10,000 km | ~34         |

Max per game: **25,000** (5 rounds).

### Data Security: Coordinates Withheld Until After Guess

`GET /api/game/start` strips `hiddenCoords` before responding. Only `POST /api/game/guess` returns `trueCoords` — after scoring. See `project-specs/API_SPEC.md` for full contracts.

### Observability: LLM Trace Log

`server/utils/logger.ts` exports `logLLMTrace(prompt, response)`. Call it in the EventGenerator whenever a Claude API request is made. Logs append to `server/logs/llm_trace.log` (git-ignored, directory tracked via `.gitkeep`).

### The Two Agent Personas

**The Cartographer** — Leaflet.js, Tailwind v4 UI, coordinate-system edge cases, `client/src/components/`.
Invoke with: *"Cartographer, how should we..."*

**The Chronicler** — Historical event sourcing, clue obfuscation, `events.json`, `eventGenerator.ts` interface.
Invoke with: *"Chronicler, craft a clue for..."*

See `project-specs/AGENTS.md` for full detail.

### The Chronicler Engine & Event Pool

**Event pool** (assembled at server startup): `events.json` (10 seed) + `generated_events.json` (10 Haiku-generated) = 20 total. Merged in `server/routes/game.ts`.

**`server/services/chroniclerEngine.ts`** — two-agent Generate → Adversary → Rewrite loop. Takes a `difficulty` tier, runs up to 3 retries. Both agents use `AnthropicProvider` (`claude-haiku-4-5-20251001`). Logs every call via `logLLMTrace`.

**`server/services/eventGenerator.ts`** — thin façade over `ChroniclerEngine`. Called by `server/index.ts` at startup if combined pool < 5 entries.

**LLM provider:** `AnthropicProvider` in `server/providers/anthropicProvider.ts`. Model: **`claude-haiku-4-5-20251001`** (never use `*-latest` — aliases expire silently). Throws `FatalProviderError` on 401/403/404/429/529. `LLMProvider` interface and `FatalProviderError` live in `server/providers/geminiProvider.ts` (legacy location). Requires `ANTHROPIC_API_KEY` in `server/.env`.

---

## Architecture Reference

See `project-specs/SYSTEM_ARCHITECTURE.md` and `project-specs/API_SPEC.md`.

**API ports:** Vite `5173` → Express `3001` (CORS configured for dev).

**Production:**
- Frontend: `https://chrono-quizzr.vercel.app` (Vercel, Root Directory = `client`)
- Backend: `https://chrono-quizzr.up.railway.app` (Railway, Root Directory = blank in UI)
- Railway env vars required: `ANTHROPIC_API_KEY`, `FRONTEND_URL` (do NOT set `PORT`)
- Vercel env var required: `VITE_API_URL=https://chrono-quizzr.up.railway.app`
- `railway.toml` at repo root — buildCommand uses `--include=dev` to force devDep install despite `NODE_ENV=production`

**Key files:**
```
shared/types.d.ts                           ← canonical TypeScript contracts — declaration file (MUST stay .d.ts, not .ts)
server/utils/haversine.ts                   ← pure Haversine, Earth radius 6371 km
server/utils/haversine.test.ts              ← 6 Vitest unit tests
server/utils/scorer.ts                      ← Math.round(5000 * exp(-d/2000))
server/utils/scorer.test.ts                 ← 8 Vitest unit tests
server/utils/logger.ts                      ← logLLMTrace → server/logs/llm_trace.log
server/data/events.json                     ← 10 curated seed events (The Chronicler owns)
server/data/generated_events.json           ← 10 Haiku-generated events (batch output, git-ignored)
server/app.ts                               ← Express app export (no listen) — for supertest + index.ts
server/routes/game.ts                       ← GET /start + POST /guess; merges both event files
server/routes/game.test.ts                  ← 17 Vitest supertest integration tests
server/index.ts                             ← async startServer(), dotenv/config first import
server/providers/geminiProvider.ts          ← LLMProvider interface + FatalProviderError (shared) + GeminiProvider (inactive)
server/providers/anthropicProvider.ts       ← AnthropicProvider (PRIMARY, claude-haiku-4-5-20251001)
server/providers/mockProvider.ts            ← LLMProvider mock (test helper — not imported by production code)
server/services/chroniclerEngine.ts         ← two-agent Generate → Adversary → Rewrite loop
server/services/chroniclerEngine.test.ts    ← 8 Vitest service tests (mock provider)
server/services/eventGenerator.ts           ← thin façade; startup fallback if pool < 5
server/scripts/generateBatch.ts             ← offline batch generator (npm run generate --prefix server)
server/test-fixtures/                       ← JSON fixtures for chroniclerEngine tests
server/tests/fixtures/mockEvents.json       ← 5-event fixture shared by game.test.ts + client tests
client/playwright.config.ts                 ← Playwright config (Chromium, webServer, colorScheme:dark)
client/e2e/game-loop.spec.ts                ← 2 Playwright E2E tests (full game journey + theme toggle)
client/src/test-setup.ts                    ← Vitest setup (jest-dom, vitest-canvas-mock, matchMedia mock)
client/src/index.css                        ← @theme tokens + html.theme-light overrides + Leaflet tile filters
client/src/App.tsx                          ← ThemeProvider + ThemeToggle + GameBoard
client/src/context/ThemeContext.tsx         ← theme state + provider + useTheme() hook
client/src/context/ThemeContext.test.tsx    ← 5 Vitest tests (toggle, localStorage, class mutation)
client/src/components/ThemeToggle.tsx       ← fixed top-3 left-3 z-900 HUD pill
client/src/components/GameBoard.tsx         ← root orchestrator, all game state
client/src/components/GameBoard.test.tsx    ← 5 Vitest tests (loading, error, round advance, long-clue regression)
client/src/components/MapView.tsx           ← Leaflet map, pin-drop, revealCoords polyline
client/src/components/MapView.test.tsx      ← 6 Vitest tests (pin, reveal, react-leaflet fully mocked)
client/src/components/CluePanel.tsx         ← clue display, spinner button, inline submit error
client/src/components/CluePanel.test.tsx    ← 9 Vitest tests (disabled state, spinner, BCE years)
client/src/components/ResultsOverlay.tsx    ← fixed z-[1000], score card, source link reveal
client/src/components/FinalScoreScreen.tsx  ← Round Logbook ledger table, Play Again
client/src/components/FinalScoreScreen.test.tsx ← 5 Vitest tests (table rows, Play Again callback)
```

