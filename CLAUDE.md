# ChronoQuizzr — Claude Institutional Knowledge

## Project Overview

ChronoQuizzr is a historically-based GeoGuessr-style game. Players receive an obfuscated historical text clue, drop a pin on a Leaflet.js map, and receive a score based on the Haversine distance between their guess and the true event coordinates.

All architectural specs live in `./project-specs/`. Read them before making structural changes.

Enforced rules live in `.claude/rules/` — one file per rule. Claude loads these automatically.

---

## Repo Structure: Scripts-Orchestration Layout (NOT a Workspaces Monorepo)

```
chrono-quizzr/          ← root: concurrently only
├── shared/             ← TypeScript contracts (types.ts) — no npm package, no node_modules
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

### Testing

```bash
# Run all server tests (vitest, single pass):
npm test --prefix server

# Watch mode (re-runs on file change):
npm run test:watch --prefix server
```

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

All core interfaces live in `shared/types.ts`. Both packages reference them via the `@shared` alias:

```typescript
import type { HistoricalEvent, GameEvent, Guess, GuessResult } from '@shared/types';
```

**Always use `import type`** — shared types are erased at compile time, so there is zero runtime overhead and no path-resolution issues in the compiled server output.

**Alias configuration:**
| Package | Config |
|---|---|
| `client` | `vite.config.ts` → `resolve.alias` + `tsconfig.app.json` → `paths` |
| `server` | `server/tsconfig.json` → `paths` |

**Core types** (`shared/types.ts`):

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
| `client/tsconfig.node.json` | `vite.config.ts` only |
| `server/tsconfig.json` | All server `.ts` — CommonJS output to `server/dist/`, `@shared` path |

### General Rules
- Do not use `any` — use `unknown` and narrow, or define a proper interface.
- All API shapes must use types from `shared/types.ts` — no ad-hoc inline types for request/response bodies.
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
| 500 km    | ~2,852      |
| 1,000 km  | ~1,839      |
| 10,000 km | ~1          |

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

### The EventGenerator Service

`server/services/eventGenerator.ts` — fallback event source when `events.json` has < 5 entries. Returns `HistoricalEvent` shape. MVP ships as a stub; real Claude API call wired in Phase 1. Uses `logLLMTrace` for observability.

---

## Architecture Reference

See `project-specs/SYSTEM_ARCHITECTURE.md` and `project-specs/API_SPEC.md`.

**API ports:** Vite `5173` → Express `3001` (CORS configured for dev).

**Key files:**
```
shared/types.ts                    ← canonical TypeScript contracts (source of truth)
server/utils/haversine.ts          ← pure Haversine, unit tested
server/utils/scorer.ts             ← scoring formula
server/utils/logger.ts             ← LLM trace logger → server/logs/llm_trace.log
server/data/events.json            ← curated seed events (The Chronicler owns this)
server/services/eventGenerator.ts  ← LLM fallback (Claude API)
server/routes/game.ts              ← GET /api/game/start, POST /api/game/guess
client/src/components/GameBoard.tsx    ← root orchestrator
client/src/components/MapView.tsx      ← Leaflet map, pin-drop
client/src/components/CluePanel.tsx    ← clue + submit
client/src/components/ResultsOverlay.tsx   ← post-guess results
client/src/components/FinalScoreScreen.tsx ← end-of-game summary
```

---

## Phase Status

| Phase | Status |
|-------|--------|
| Phase 0 — Project Scaffold | Complete |
| Phase 1 — Backend Core | Complete |
| Phase 2 — Frontend Core | Complete |
| Phase 3 — Results & Scoring | Complete |
| Phase 4 — Polish | Complete |

See `project-specs/TASK_LIST.md` for the D-## checklist.
