# ChronoQuizzr — Claude Institutional Knowledge

## Project Overview

ChronoQuizzr is a historically-based GeoGuessr-style game. Players receive an obfuscated historical text clue, drop a pin on a Leaflet.js map, and receive a score based on the Haversine distance between their guess and the true event coordinates.

All architectural specs live in `./project-specs/`. Read them before making structural changes.

Enforced rules live in `.claude/rules/` — one file per rule. Claude loads these automatically.

---

## Repo Structure: Scripts-Orchestration Layout (NOT a Workspaces Monorepo)

This repo has **three independent npm packages**, each with its own `node_modules/`:

```
chrono-quizzr/          ← root: owns only `concurrently` (dev orchestration)
├── client/             ← Vite + React frontend ("The Map"), port 5173
└── server/             ← Node/Express backend ("The Brain"), port 3001
```

This is **not** an npm Workspaces setup. There is no `"workspaces"` field in the root `package.json`, and npm does **not** hoist shared dependencies between packages. Each sub-package is fully self-contained.

**Consequence:** `npm install` at the root only installs `concurrently`. Client and server dependencies must be installed independently.

---

## Build & Dev Commands

### First-Time Setup (run once after cloning)

```bash
npm install                        # root: installs concurrently only
npm install --prefix client        # installs all React/Vite/Leaflet/Tailwind deps
npm install --prefix server        # installs Express + cors
```

### Daily Development

```bash
# From the repo root — starts both client and server concurrently:
npm run dev
```

This runs `concurrently "npm run dev --prefix client" "node server/index.js"`.

- Vite dev server: http://localhost:5173
- Express API: http://localhost:3001

### Individual Package Commands

```bash
# Client only
npm run dev --prefix client        # start Vite dev server
npm run build --prefix client      # production build (output: client/dist/)
npm run lint --prefix client       # ESLint

# Server only
node server/index.js               # start Express server
node --test server/utils/haversine.test.js  # run Haversine unit tests
```

---

## Code Style

### General Rules
- JavaScript only (no TypeScript). React uses JSX (`.jsx` files).
- Server uses CommonJS (`require`/`module.exports`). Client uses ES Modules (`import`/`export`).
- No semicolons in React component files (Vite default ESLint config).
- Prefer named exports over default exports in utility files.

### AI Commit Policy — ABSOLUTE PROHIBITION
**Claude must never create, amend, or suggest git commits.** This includes:
- Never running `git commit` or `git add`
- Never using `--no-verify` to bypass hooks
- Never adding "Co-Authored-By" tags
- Never amending existing commits

The developer handles all version control manually. If Claude is asked to commit, it must decline and remind the developer to commit manually.

### File Creation Policy
- Do not create new files outside the established structure without first updating `project-specs/` to reflect the addition.
- Prefer editing existing files over creating new ones.
- Do not add speculative utilities, helpers, or abstractions not required by the current task.

---

## Project Logic

### Scoring: The Haversine Formula

All geographic scoring is based on the **Haversine formula**, implemented as a standalone tested utility at `server/utils/haversine.js`.

```
haversine(lat1, lng1, lat2, lng2) → distance in kilometers
```

Uses Earth radius = 6371 km. No external geo libraries — pure math only.

The score per round is calculated in `server/utils/scorer.js`:

```
score = Math.round( 5000 × e^(−distance_km / 2000) )
```

| Distance  | Score       |
|-----------|-------------|
| 0 km      | 5,000 (max) |
| 500 km    | ~2,852      |
| 1,000 km  | ~1,839      |
| 2,000 km  | ~1,006      |
| 10,000 km | ~1          |

Max score per game: **25,000** (5 rounds × 5,000).

The Haversine utility must have unit tests covering: same-point (→ 0 km), known distance pairs, antimeridian crossing, and near-pole coordinates.

### Data Security: Coordinates Withheld Until After Guess

`GET /api/game/start` **never** sends event coordinates to the client. They are stripped server-side before the response is built. Coordinates are only revealed in the `POST /api/game/guess` response, after the server has scored the guess. This prevents cheating via DevTools network inspection.

### The Two Agent Personas

See `project-specs/AGENTS.md` for full detail. Summary:

**The Cartographer** — Map & UI expert.
Owns all Leaflet.js code, Tailwind v4 components, and responsive layout. Decision authority over coordinate-system edge cases (antimeridian, poles), tile layer choices, and all files under `client/src/components/`. Invoke with: *"Cartographer, how should we..."*

**The Chronicler** — Historical Pipeline curator.
Sources and validates historical events with city-level GPS accuracy. Applies the obfuscation protocol (no place names in clues), calibrates difficulty tiers, and maintains `server/data/events.json`. Also owns the `server/services/eventGenerator.js` interface spec. Invoke with: *"Chronicler, craft a clue for..."*

### The EventGenerator Service

`server/services/eventGenerator.js` is a future-ready fallback slot. On server startup, if `events.json` contains fewer than 5 events, the generator is called to fill the pool in-memory (not written to disk). The interface matches the `events.json` record shape exactly so consumers are source-agnostic. The MVP ships with a stub; the real LLM call (Claude API via `@anthropic-ai/sdk`) is wired in Phase 1.

---

## Architecture Reference

See `project-specs/SYSTEM_ARCHITECTURE.md` for the full data-flow diagram and API contracts.

**API ports:**
- Frontend (Vite): `localhost:5173`
- Backend (Express): `localhost:3001`
- CORS is configured to allow `localhost:5173` → `localhost:3001` in dev.

**Key files:**
```
server/utils/haversine.js          ← pure Haversine, no deps, unit tested
server/utils/scorer.js             ← scoring formula wrapper
server/data/events.json            ← curated seed events (≥10, The Chronicler owns this)
server/services/eventGenerator.js  ← LLM fallback interface
server/routes/game.js              ← GET /api/game/start, POST /api/game/guess
client/src/components/GameBoard.jsx    ← root orchestrator
client/src/components/MapView.jsx      ← Leaflet map, pin-drop
client/src/components/CluePanel.jsx    ← clue text + submit
client/src/components/ResultsOverlay.jsx   ← post-guess: polyline, score
client/src/components/FinalScoreScreen.jsx ← end-of-game summary
```

---

## Phase Status

| Phase | Status |
|-------|--------|
| Phase 0 — Project Scaffold | Complete |
| Phase 1 — Backend Core | Pending |
| Phase 2 — Frontend Core | Pending |
| Phase 3 — Results & Scoring | Pending |
| Phase 4 — Polish | Pending |

See `project-specs/TASK_LIST.md` for the full D-## checklist.
