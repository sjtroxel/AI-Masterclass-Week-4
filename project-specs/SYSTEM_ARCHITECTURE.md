# ChronoQuizzr — System Architecture

## Overview

ChronoQuizzr is a two-tier web application:

- **"The Map"** — React (Vite) frontend, runs in the browser at `localhost:5173` (dev)
- **"The Brain"** — Node/Express backend, runs at `localhost:3001` (dev)

Communication is via JSON REST API over HTTP. The frontend never receives event coordinates until after a guess is submitted.

---

## Component Map

```
client/ (The Map — React/Vite/TypeScript)
├── playwright.config.ts        # Playwright E2E config (Chromium, webServer, colorScheme:dark)
├── e2e/
│   └── game-loop.spec.ts       # 2 E2E tests: full game journey + theme toggle
├── src/
│   ├── test-setup.ts           # Vitest global setup (jest-dom, vitest-canvas-mock, matchMedia)
│   ├── components/
│   │   ├── GameBoard.tsx        # Root orchestrator: manages round index & game state
│   │   ├── GameBoard.test.tsx   # 5 Vitest tests (loading, error, round advance, long-clue regression)
│   │   ├── CluePanel.tsx        # Displays clue, year; contains Submit button + spinner
│   │   ├── CluePanel.test.tsx   # 9 Vitest tests (disabled state, spinner, BCE years)
│   │   ├── MapView.tsx          # Leaflet map, pin-drop, post-guess polyline/marker
│   │   ├── MapView.test.tsx     # 6 Vitest tests (pin, reveal; react-leaflet fully mocked)
│   │   ├── ResultsOverlay.tsx   # Polyline, distance, round score, source reveal post-guess
│   │   ├── FinalScoreScreen.tsx # Total score, Round Logbook table, Play Again
│   │   ├── FinalScoreScreen.test.tsx  # 5 Vitest tests (table rows, Play Again callback)
│   │   └── ThemeToggle.tsx      # Dark/Light mode toggle; fixed top-left, z-[900]
│   ├── context/
│   │   ├── ThemeContext.tsx     # Theme state + provider + useTheme hook; persists to localStorage
│   │   └── ThemeContext.test.tsx # 5 Vitest tests (toggle, localStorage, class mutation)
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts            # Vite client type declarations (SVG imports, etc.)

server/ (The Brain — Node/Express/TypeScript)
├── app.ts                      # Express app export (no listen) — imported by tests + index.ts
├── index.ts                    # Entry point: merges event pool, starts server
├── routes/
│   ├── game.ts                 # GET /api/game/start, POST /api/game/guess
│   └── game.test.ts            # 17 Vitest supertest integration tests
├── utils/
│   ├── haversine.ts            # Pure Haversine function — standalone, tested
│   ├── haversine.test.ts       # 6 Vitest unit tests
│   ├── scorer.ts               # Wraps haversine, applies scoring formula
│   ├── scorer.test.ts          # 8 Vitest unit tests
│   └── logger.ts               # logLLMTrace → server/logs/llm_trace.log
├── providers/
│   ├── geminiProvider.ts       # LLMProvider interface + FatalProviderError (shared) + GeminiProvider impl
│   ├── anthropicProvider.ts    # AnthropicProvider impl (claude-haiku-4-5-20251001) — PRIMARY
│   └── mockProvider.ts         # LLMProvider mock for unit/service tests (not in production)
├── services/
│   ├── eventGenerator.ts       # LLM-backed event generator façade (startup fallback slot)
│   ├── chroniclerEngine.ts     # Two-agent Generate → Adversary → Rewrite loop
│   └── chroniclerEngine.test.ts # 8 Vitest service tests (mock provider)
├── scripts/
│   └── generateBatch.ts        # Offline batch generator: npm run generate --prefix server
├── test-fixtures/              # JSON fixtures for chroniclerEngine test scenarios
│   ├── validEvent.json
│   ├── validAdversaryPass.json
│   ├── validAdversaryFail.json
│   ├── validAdversaryCoordsBad.json
│   ├── rewrittenEvent.json
│   ├── invalidJson.json
│   └── missingFields.json
├── tests/
│   └── fixtures/
│       └── mockEvents.json     # 5-event fixture shared by game.test.ts + client GameBoard tests
└── data/
    ├── events.json             # Curated seed file (10 verified events, hand-reviewed)
    └── generated_events.json   # Chronicler batch output (10 events, Haiku-generated)
```

---

## API Contracts

### `GET /api/game/start`

Returns a shuffled selection of 5 events for the session. **Coordinates are stripped** from the response.

**Response** (`GameEvent[]` — `hiddenCoords` stripped server-side):
```json
[
  {
    "id": "sarajevo-1914",
    "clue": "In a narrow street of an old Austro-Hungarian city, a young nationalist fired the shots that ignited a continental war.",
    "year": 1914,
    "difficulty": "medium",
    "locationName": "Sarajevo, Bosnia",
    "source_url": "https://en.wikipedia.org/wiki/Assassination_of_Archduke_Franz_Ferdinand"
  }
]
```

### `POST /api/game/guess`

Accepts the player's guess and returns the score and the true location.

**Request** (`Guess`):
```json
{ "eventId": "sarajevo-1914", "lat": 44.5, "lng": 18.7 }
```

**Response** (`GuessResult`):
```json
{
  "score": 4812,
  "distance": 14.3,
  "trueCoords": { "lat": 43.8563, "lng": 18.4131 }
}
```

**Validation:** `lat` must be in [-90, 90]; `lng` must be in [-180, 180]; `eventId` must exist in the loaded event store.

---

## Data Flow

```
Frontend (The Map)                  Backend (The Brain)
─────────────────                   ───────────────────
                                    On startup:
                                    1. Load events.json
                                    2. If count < 5 → EventGenerator fills gap
                                    3. Express listens on :3001

Page load
  │── GET /api/game/start ─────────>│
  │<── [GameEvent ×5]  ──────────────│  (hiddenCoords stripped)
  │                                  │
  │  Store session in React state    │
  │  Render Round 1: CluePanel       │
  │              + MapView           │
  │                                  │
  User clicks map → pin appears      │
  User clicks Submit                 │
  │── POST /api/game/guess ─────────>│
  │   {eventId, lat, lng}            │  haversine(guess, true_coords) → km
  │                                  │  scorer(km) → score
  │<── {score, distance,             │
  │     trueCoords:{lat,lng}} ───────│
  │                                  │
  Show ResultsOverlay                │
  (polyline + score)                 │
  │                                  │
  [Rounds 2–5 repeat]                │
  │                                  │
  Show FinalScoreScreen              │
```

---

## Event Pool & Data Sources

The in-memory `eventPool` (exported from `server/routes/game.ts`) is assembled at module load from two sources:

| Source | File | Contents |
|---|---|---|
| Seed events | `data/events.json` | 10 hand-curated, hand-reviewed events |
| Generated events | `data/generated_events.json` | 10 Haiku-generated, adversarially verified events |

The pool is merged at startup. If the combined count is still below 5 (e.g. both files are empty or missing), the `EventGenerator` fallback fires.

### EventGenerator Fallback

```
server/services/eventGenerator.ts
```

**Purpose:** Last-resort event source when the combined pool has fewer than 5 entries.

**Interface:**
```typescript
generateEvent(difficulty: 'easy' | 'medium' | 'hard'): Promise<HistoricalEvent>
// HistoricalEvent shape matches an events.json record exactly.
```

**Trigger condition:** On server startup, if `eventPool.length < 5`, the loader calls `generateEvent()` once per missing slot. Generated events are held in-memory for the session only.

**Provider:** Uses `AnthropicProvider` (claude-haiku-4-5-20251001) via the `ChroniclerEngine`.

### Batch Generator (Offline Tool)

```
server/scripts/generateBatch.ts
```

**Purpose:** Offline tool to populate `data/generated_events.json` with 10 adversarially-verified events. Run manually; not invoked at server startup.

**Usage:** `npm run generate --prefix server`

### LLM Provider Abstraction

| File | Role |
|---|---|
| `providers/geminiProvider.ts` | Defines `LLMProvider` interface and `FatalProviderError` (shared abstractions). Contains `GeminiProvider` impl (kept for reference). |
| `providers/anthropicProvider.ts` | **Primary provider** — `AnthropicProvider` using claude-haiku-4-5-20251001. Throws `FatalProviderError` on 401/403/404/429/529. |

See `project-specs/ADR_ANTHROPIC_PIVOT.md` for the full decision record on why Gemini was replaced.

---

## Frontend Layout Strategy

### Breakpoint Model

All client components use **Tailwind v4 mobile-first breakpoints**. The default (no prefix) styles target mobile; larger screens are progressively enhanced.

| Tailwind prefix | Viewport width | Layout intent |
|---|---|---|
| *(default)* | < 768 px | Full-screen map; `CluePanel` as collapsible drawer/overlay |
| `md:` | ≥ 768 px | `CluePanel` visible as a persistent side strip or top banner |
| `lg:` | ≥ 1024 px | Wider panel, larger typography, additional decorative elements |

### Component Layout Rules

**`GameBoard`**
- On mobile: stack `MapView` (full-screen, `h-screen`) with `CluePanel` as a fixed bottom drawer.
- On `md+`: render as a two-column flex/grid — map takes remaining space, panel takes a fixed width column.

**`MapView`**
- Must use Leaflet's built-in touch event handling — no mouse-only listeners.
- The Leaflet container must fill its parent via `h-full w-full`; the parent controls the height.
- Pin-drop must respond equally to `click` and `touchend` events. Use the react-leaflet `<MapContainer>` `useMapEvents` hook (via a child component) to intercept both.

**`CluePanel`** (mobile drawer behaviour)
- On mobile, renders at the bottom of the viewport, initially showing only the event year and a chevron toggle.
- On expand: slides up to reveal the full clue text and the Submit button.
- Submit button remains accessible at all viewport sizes without the player needing to scroll.

**`ResultsOverlay`** and **`FinalScoreScreen`**
- Render as modal-style overlays on mobile (full-screen or near-full-screen) to avoid map z-index conflicts with Leaflet.

---

## Testing Infrastructure

### Strategy

Five-layer coverage aligned with `project-specs/TESTING_STRATEGY.md`:

| Layer | Framework | Count | Scope |
|---|---|---|---|
| Backend unit | Vitest | 14 | `haversine.ts`, `scorer.ts` — pure functions, no mocks |
| Backend service | Vitest + MockProvider | 8 | `chroniclerEngine.ts` — adversarial loop without API calls |
| Backend integration | Vitest + supertest | 17 | Express routes — real HTTP against `app.ts` |
| Frontend component | Vitest + jsdom + RTL | 30 | React components — `react-leaflet` fully mocked |
| E2E | Playwright (Chromium) | 2 | Real browser against dev stack |

**Total: 71 tests**

### Key Design Decisions

**`server/app.ts` extraction** — The Express app is exported from `app.ts` (no `listen` call) and imported by both `index.ts` (which binds the port) and supertest tests (which inject a random port). This prevents port conflicts during parallel test runs.

**`MockProvider`** — Implements `LLMProvider` with pre-scripted JSON responses drawn from `server/test-fixtures/`. Allows `chroniclerEngine.test.ts` to drive every branch of the Generate → Adversary → Rewrite loop without live API calls. Uses `__FATAL__` / `__ERROR__` sentinel strings to trigger error paths.

**`react-leaflet` mock** — `MapView` and `GameBoard` tests use `vi.mock('react-leaflet', ...)` to replace Leaflet's canvas-dependent components with minimal `data-testid` stubs. `useMapEvents` is mocked to capture the click handler via a module-level `simulatePinDrop` closure, enabling pin-drop simulation in `GameBoard.test.tsx`.

**Playwright `webServer`** — `playwright.config.ts` runs `npm run dev` from the repo root (`cwd: path.resolve(__dirname, '..')`) so both Vite (5173) and Express (3001) start together. `reuseExistingServer: !process.env.CI` lets local devs run against an already-running dev stack. `colorScheme: 'dark'` is forced globally for deterministic theme assertions.

**ESM compatibility** — `client/package.json` is `"type": "module"`. `playwright.config.ts` uses `fileURLToPath(import.meta.url)` to reconstruct `__dirname` instead of relying on the CommonJS global.

### Test Commands

```bash
npm test --prefix server          # 39 Vitest tests (server)
npm test --prefix client          # 30 Vitest tests (client, e2e/ excluded)
cd client && npx playwright test  # 2 Playwright E2E tests
```

---

## Key Constraints

| Constraint | Rationale |
|---|---|
| Coordinates never sent to client until after guess | Prevents cheating via DevTools network inspection |
| Haversine in a standalone utility with unit tests | Correctness is critical for scoring fairness; no external geo libs |
| CORS enabled for `localhost:5173` in dev | Vite dev server and Express run on different ports |
| Events loaded at startup, not per-request | Keeps request latency low; avoids repeated file I/O |
| EventGenerator produces same schema as events.json | Consumers are decoupled from data source |

---

## Dev Ports

| Service | Port |
|---|---|
| React (Vite) | 5173 |
| Express | 3001 |
