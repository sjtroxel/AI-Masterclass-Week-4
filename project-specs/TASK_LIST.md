# ChronoQuizzr — Task List

All tasks use the "Deliver" (D-##) prefix. Phases are sequential. Within a phase, complete tasks in order unless marked as parallelizable.

Legend: `[ ]` = pending · `[x]` = complete · `[~]` = in progress

---

## Phase 0 — Project Scaffold

- [x] **D-01** Scaffold the React client with Vite (TypeScript template)
  `npx create-vite@latest client --template react-ts` from project root
  Note: additional tsconfig split (`tsconfig.app.json` + `tsconfig.node.json`) applied manually.

- [x] **D-02** Scaffold the Express server with TypeScript
  `mkdir server && cd server && npm init -y`
  `npm install express cors`
  `npm install --save-dev typescript ts-node-dev @types/express @types/cors @types/node`

- [x] **D-03** Install Tailwind CSS v4 in `client/`
  CSS-first config via `@import "tailwindcss"` in `src/index.css`; plugin via `@tailwindcss/vite` in `vite.config.ts`. No `tailwind.config.js` needed.

- [x] **D-04** Install Leaflet in `client/`
  `npm install leaflet react-leaflet` · Import Leaflet CSS in `main.tsx`

- [x] **D-05** Configure root-level dev orchestration
  Root `package.json` with `concurrently` script:
  `"dev": "concurrently \"npm run dev --prefix client\" \"npm run dev --prefix server\""`
  Server `dev` script: `ts-node-dev --respawn --transpile-only index.ts`

---

## Phase 1 — Backend Core

- [x] **D-06** Implement `server/utils/haversine.ts`
  - Pure function: `haversine(lat1: number, lng1: number, lat2: number, lng2: number): number` (returns km)
  - Uses Earth radius = 6371 km
  - No external dependencies
  - Full TSDoc comment block

- [x] **D-07** Write unit tests for `haversine.ts`
  File: `server/utils/haversine.test.ts`
  Test cases (all passing):
  - Same point → 0 km
  - London → Paris ≈ 343.6 km (actual Haversine for standard city-centre coords; tolerance ±3 km)
  - Antimeridian crossing: Fiji to Samoa (confirms short-path ~1080 km, not naive ~38,000 km)
  - Near-pole coordinates: no NaN, result ≥ 0

- [x] **D-08** Curate `server/data/events.json`
  10 events delivered: 3 easy / 4 medium / 3 hard · 4 continents (Europe, Asia, Oceania, Americas) · no duplicate cities · all entries have `source_url`

- [x] **D-09** Implement `server/utils/scorer.ts`
  `scorer(distanceKm: number): number` (returns 0–5000)
  Formula: `Math.round(5000 * Math.exp(-distanceKm / 2000))`

- [x] **D-10** Implement Express routes (`server/routes/game.ts`)
  - `GET /api/game/start` — Fisher-Yates shuffle, strip `hiddenCoords` via destructuring, return 5 `GameEvent[]`
  - `POST /api/game/guess` — validate `{eventId, lat, lng}`, run haversine + scorer, return `GuessResult`
  - Exports `eventPool: HistoricalEvent[]` for startup check

- [x] **D-11** Scaffold `server/services/eventGenerator.ts`
  - Exports `generateEvent(difficulty): Promise<HistoricalEvent>` — MVP stub, calls `logLLMTrace`
  - `server/index.ts` updated with async `startServer()`: fills `eventPool` if `events.json` count < 5

- [x] **D-11.5** Define Tailwind v4 theme tokens — parchment/dark historical aesthetic
  File: `client/src/index.css`
  Delivered via `@theme { }` block (Tailwind v4 CSS-first config). Tokens defined:
  `--color-bg-base/panel/surface`, `--color-trim/trim-muted`, `--color-text-primary/muted/dim`,
  `--color-accent/accent-hover/accent-dim`, `--font-clue` (Georgia serif), `--font-ui` (system sans).
  `@layer base` sets full-height layout + default bg/color/font on `html, body, #root`.
  Note: `--color-trim` used instead of `--color-border` to avoid naming collision with Tailwind's
  built-in `border-*` utilities.
  Also: installed `@types/leaflet` as a devDependency (required by D-12).

---

## Phase 2 — Frontend Core

- [x] **D-12** Create `MapView` component (`client/src/components/MapView.tsx`)
  - `MapContainer` (OSM tiles, center `[20,0]`, zoom 2, `minZoom 2`, `worldCopyJump: true`)
  - `PinDropHandler` child component uses `useMapEvents({ click })` — Leaflet normalises touch to click; 300ms debounce prevents ghost-click double-fire
  - Container `h-full w-full`, `zIndex: 0`; parent controls height
  - Named export `MapView` with `onPinDrop(lat, lng)` prop; single pin replaces previous via `useState<LatLng|null>`
  - Leaflet default icon fix applied at module scope (Vite bundler compatibility)
  - `@types/leaflet` installed as devDependency; `tsc -b --noEmit` passes clean
  - **Chronicler reviewed:** No server data, no hiddenCoords, no events.json imported — coordinate privacy clean

- [x] **D-13** Create `CluePanel` component (`client/src/components/CluePanel.tsx`)
  - Displays `clue` and `year` (canonical field names from `shared/types.ts`)
  - Disabled Submit button until a pin is dropped; calls `onSubmit(): void` prop on click
  - **Responsive check (mobile drawer):** Below `md` breakpoint (< 768 px), panel renders as a fixed bottom drawer. Initially collapsed — shows only year + chevron toggle. On expand: reveals full clue text and Submit button. Submit must be reachable without scrolling at all viewport sizes.
  - **Responsive check (desktop):** At `md+`, panel is always visible (no toggle needed); may be a side strip or top banner per `GameBoard` layout

- [x] **D-14** Create `GameBoard` component (`client/src/components/GameBoard.tsx`)
  - Holds game state: `session[]`, `currentRound`, `scores[]`, `guessCoords`
  - Fetches `GET /api/game/start` on mount
  - Renders `CluePanel` + `MapView` for current round
  - **Responsive check (layout):** On mobile, `MapView` is `h-screen` with `CluePanel` as a fixed overlay; on `md+`, switch to a flex/grid two-column layout where map fills remaining space

---

## Phase 3 — Results & Scoring

- [x] **D-15** Wire `POST /api/game/guess` in `GameBoard`
  - Send `{ eventId, lat, lng }` on submit
  - Store `GuessResult` response in state: `{ distance, score, trueCoords }` (canonical `shared/types.ts` shape)
  - Implemented as part of D-14; wired and confirmed in Phase 3 review.

- [x] **D-16** Create `ResultsOverlay` component (`client/src/components/ResultsOverlay.tsx`)
  - `CircleMarker` at true location + dashed amber `Polyline` from guess to truth (both inside MapView via `revealCoords` prop)
  - Score card: distance, round score, running total, `locationName` reveal, `source_url` link
  - Fixed `z-[1000]` overlay (above Leaflet max ~700); bottom sheet mobile / centered modal `md+`

- [x] **D-17** Implement round progression in `GameBoard`
  - `handleNextRound()`: appends to `roundHistory` before phase transition (guarantees round 5 captured)
  - After round 5: transitions to `FinalScoreScreen`

- [x] **D-18** Create `FinalScoreScreen` component (`client/src/components/FinalScoreScreen.tsx`)
  - "Round Logbook" ledger table: semantic `<table>` with `thead/tbody/tfoot`, alternating stripe rows
  - "Play Again" uses `setFetchKey` increment — pure React state reset, no page refresh

---

## Phase 4 — Polish

- [x] **D-19** Apply 'Parchment & Inky' Tailwind v4 token polish across all components
  - Year display upgraded to `font-clue text-xl/text-2xl font-bold` in both mobile handle and desktop panel
  - Submit button disabled states split: `disabled:opacity-40` (no pin) vs `disabled:opacity-100` (in-flight)
  - CluePanel outer div: `md:h-full` added so `bg-bg-panel` fills the full column height (no colour cut-off)
  - ThemeToggle moved to `top-3 left-3` (was `right-3`, conflicted with difficulty badge)

- [x] **D-19a** Implement Theme Toggle: Dark "Inky Night" / Light "Aged Map" modes
  - **Mechanism:** `html.theme-light` class overrides CSS custom properties — zero JSX `dark:` prefixes needed
  - **Context:** `client/src/context/ThemeContext.tsx` — `getInitialTheme()` resolves synchronously (localStorage → prefers-color-scheme: light → dark default); class set before first paint to prevent flash
  - **Leaflet tiles (Cartographer):**
    - Dark mode: `filter: invert(1) hue-rotate(180deg) brightness(0.85) saturate(0.9)` on `.leaflet-tile-pane`
    - Light mode: `filter: sepia(0.3) brightness(0.96) saturate(0.8)` on `.leaflet-tile-pane`
    - Attribution control in `.leaflet-control-container` is unaffected by tile filters ✓
  - **Toggle UI:** `client/src/components/ThemeToggle.tsx` — `fixed top-3 left-3 z-900`, `bg-bg-panel/80 backdrop-blur-md border-trim/50` HUD pill
  - **Light theme accent tokens (Chronicler-verified WCAG AA):**
    - `--color-accent: #7c3d0f` (5.19:1 on bg-surface ✓) · `--color-accent-hover: #5c2e0a` (7.13:1 ✓)
    - Hover direction reversed in light mode (darker = higher contrast on parchment)
  - **Difficulty badge (Chronicler):** `useTheme()` in CluePanel; two static style maps — `*-400` pastels for dark, `*-700` ink variants for light

- [x] **D-20** Add loading states
  - CSS spinner (`border-current border-t-transparent rounded-full animate-spin`) injected inline in Submit button when `isSubmitting`
  - Button label: "Submit Guess" → "⟳ Scoring…" during in-flight POST
  - `disabled:opacity-100 cursor-wait` overrides the no-pin `disabled:opacity-40` in the submitting state

- [x] **D-21** Add error handling
  - POST `/api/game/guess` failure: `submitError` state surfaces inline in CluePanel (red text below button); game stays in `'playing'` phase — pin preserved, button re-enables immediately
  - `gamePhase = 'error'` now reserved exclusively for session fetch failures (GET `/api/game/start`)
  - `submitError` cleared on: next submission attempt, round transition, Play Again / retry

- [x] **D-22** Verify Haversine edge cases end-to-end
  - Perfect guess (0,0) → (0,0): distance = 0 km, score = **5,000** ✓
  - Antipodal guess (0,0) → (0,180): distance = 20,015 km, score = **0** ✓
  - Antimeridian polyline: `worldCopyJump: true` on MapContainer; Haversine formula handles antimeridian natively
  - **Docstring correction:** `scorer.ts` table was wrong (matched k≈1000, not k=2000). Corrected to actual values: 500 km→3,894 · 1,000 km→3,033 · 10,000 km→34 · score hits 1 at ~16,300 km

---

## Phase 5 — Chronicler Engine

> **Note:** Spec was originally written for Gemini. Mid-phase, pivoted to Anthropic SDK. See `project-specs/ADR_ANTHROPIC_PIVOT.md` for decision record. All tasks completed with `AnthropicProvider` (`claude-haiku-4-5-20251001`).

- [x] **D-23** Install `@anthropic-ai/sdk` + `dotenv` in `server/`
  - Replaced `@google/generative-ai` (Gemini pivot per ADR)
  - `dotenv` loaded via `import 'dotenv/config'` as first line of `server/index.ts`

- [x] **D-24** Create `server/providers/geminiProvider.ts` — `LLMProvider` interface + `FatalProviderError` (shared abstractions) + `GeminiProvider` impl (retained for reference, not wired)

- [x] **D-25** Create `server/providers/anthropicProvider.ts` — `AnthropicProvider` implementing `LLMProvider`
  - Model: `claude-haiku-4-5-20251001` (hard-coded; never use `*-latest`)
  - Throws `FatalProviderError` on 401/403/404/429/529 — stops batch immediately

- [x] **D-26** Create `server/services/chroniclerEngine.ts` — two-agent Generate → Adversary → Rewrite loop
  - Generator prompt: Chronicler persona + obfuscation rules + difficulty guidance
  - Adversary prompt: blind check on clue text + coordinate plausibility
  - `MAX_RETRIES = 3`; throws `ChroniclerError` on exhaustion
  - Both agents call `logLLMTrace` per invocation

- [x] **D-27** Update `server/services/eventGenerator.ts` — replace stub; thin façade over `ChroniclerEngine`

- [x] **D-28** Create `server/scripts/generateBatch.ts` — CLI batch generator
  - Composition: 3 easy / 5 medium / 2 hard = 10 events
  - 1,000 ms delay between calls; skips failed slots (logs error, continues)
  - Writes to `server/data/generated_events.json`; `npm run generate --prefix server`

- [x] **D-29** Update `server/routes/game.ts` — merge `generated_events.json` into `eventPool` at load time
  - Deduplicates by `id`; curated events win on collision

- [x] **D-30** Update `.gitignore` + `project-specs/SYSTEM_ARCHITECTURE.md`
  - `server/data/generated_events.json` added to `.gitignore`
  - `SYSTEM_ARCHITECTURE.md` updated with `providers/`, `scripts/`, and event pool section

- [x] **D-31** Run `generateBatch.ts` — 10 events generated and written to `server/data/generated_events.json`

- [x] **D-32** Smoke-test: `npm run dev` → `GET /api/game/start` returns 5 events from merged 20-event pool ✓

---

## Phase 6 — Professional Test Coverage

> Strategy spec: `project-specs/TESTING_STRATEGY.md`
> All 71 tests passing as of this phase completion.

### Layer 1 — Backend Unit Tests (Pure Functions)

- [x] **D-33** Extend `server/utils/haversine.test.ts` — 2 new cases added (equatorial symmetry + both-poles antipodal ≈ 20,015 km), total 6 tests passing

- [x] **D-34** Create `server/utils/scorer.test.ts` — 8 pure-function tests covering all scoring benchmarks from the spec table plus a non-negative guarantee at extreme distances

### Layer 2 — Service Tests (ChroniclerEngine with Mock Provider)

- [x] **D-35** Create `server/providers/mockProvider.ts` — `MockProvider` implementing `LLMProvider`; rotates through pre-scripted response strings; sentinels `__FATAL__` and `__ERROR__` trigger the two error paths

- [x] **D-36** Create `server/test-fixtures/` — 7 JSON fixture files (`validEvent.json`, `validAdversaryPass.json`, `validAdversaryFail.json`, `validAdversaryCoordsBad.json`, `rewrittenEvent.json`, `invalidJson.json`, `missingFields.json`) used by `chroniclerEngine.test.ts`

- [x] **D-37** Create `server/services/chroniclerEngine.test.ts` — 8 service tests covering: happy path, pass-after-rewrite, topic-drift guard, coordinate hallucination guard, schema-invalid generation, total exhaustion → seed fallback, `FatalProviderError` propagation, blacklist enforcement in prompt

### Layer 3 — Integration Tests (Express Routes)

- [x] **D-38** Extract `server/app.ts` — Express app (with routes and middleware) exported without calling `listen`; `server/index.ts` imports and starts it; enables supertest to bind a random port in tests without conflicts

- [x] **D-39** Install `supertest` + `@types/supertest` in `server/`; create `server/routes/game.test.ts` — 17 integration tests:
  - `GET /api/game/start`: 5 events returned, `GameEvent` shape, **`hiddenCoords` absent** (coordinate privacy regression guard), unique IDs, JSON content-type
  - `POST /api/game/guess`: valid guess → `{ distance, score, trueCoords }`, `score === 5000` on exact match, unknown eventId → 404, missing/invalid fields → 400, out-of-range lat/lng → 400

- [x] **D-40** Create `server/tests/fixtures/mockEvents.json` — 5-event `HistoricalEvent[]` fixture used by both `game.test.ts` (supertest) and the client's `GameBoard.test.tsx` (fetch mock)

### Layer 4 — Frontend Component Tests

- [x] **D-41** Configure client test environment:
  - Add `test` block to `client/vite.config.ts` (jsdom, globals:true, setupFiles, `exclude: ['e2e/**']`)
  - Install `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `vitest-canvas-mock`, `@vitest/coverage-v8`
  - Create `client/src/test-setup.ts` (jest-dom import, `vitest-canvas-mock`, `matchMedia` stub)

- [x] **D-42** Create `client/src/components/MapView.test.tsx` — 6 tests; `react-leaflet` and `leaflet` fully mocked via `vi.mock`; tests verify: map container renders, `Marker` appears with `pinCoords`, absent with null, `Polyline`/`CircleMarker` absent/present based on `revealCoords`, `CircleMarker` center matches coords

- [x] **D-43** Create `client/src/components/CluePanel.test.tsx` — 9 tests; `ThemeProvider` wrapper required (uses `useTheme`); tests verify: clue text, year (via `getAllByText` — appears in both mobile handle and desktop section), difficulty badge, Submit disabled/enabled with `hasPin`, `onSubmit` called on click, spinner when `isSubmitting`, `submitError` inline, BCE year formatting

- [x] **D-44** Create `client/src/context/ThemeContext.test.tsx` — 5 tests; verifies: default dark (no `theme-light` class), toggle adds class, second toggle removes class, `localStorage` persistence

- [x] **D-45** Create `client/src/components/FinalScoreScreen.test.tsx` — 5 tests; verifies: "Round Logbook" heading, 5 `<tr>` rows in `<tbody>`, total score rendered ≥ twice (`toLocaleString()`), "Play Again" button present, click fires callback

- [x] **D-46** Create `client/src/components/GameBoard.test.tsx` — 5 tests; global `fetch` stubbed with `vi.stubGlobal`; `react-leaflet` mocked with `simulatePinDrop` closure captured from `useMapEvents`; tests verify: loading state on mount, first clue after fetch, error screen on 500, round 1 → round 2 transition (pin drop + submit + Next Round), 150+ word clue renders with Submit still present (long-clue scroll regression)

### Layer 5 — E2E Tests (Playwright)

- [x] **D-47** Install `@playwright/test` in `client/`; run `npx playwright install chromium`

- [x] **D-48** Create `client/playwright.config.ts`:
  - Chromium-only, 1 worker (prevents race conditions on shared game state)
  - `webServer`: `npm run dev` from repo root (`cwd: path.resolve(__dirname, '..')`), url 5173, 60 s timeout, `reuseExistingServer: !process.env.CI`
  - `colorScheme: 'dark'` forced globally for deterministic theme assertions
  - ESM-compatible: `__dirname` reconstructed via `fileURLToPath(import.meta.url)` (required because `client/package.json` is `"type": "module"`)
  - Added `playwright.config.ts` and `e2e/**` to `tsconfig.node.json` include — clears IDE diagnostics

- [x] **D-49** Create `client/e2e/game-loop.spec.ts` — 2 E2E specs:
  - **Full Game Journey**: navigates to `/`, asserts loading text, plays all 5 rounds (drop pin via `.leaflet-container` click, Submit Guess, assert ResultsOverlay with `Round N of 5`, click Next Round / Final Score), asserts FinalScoreScreen + "Play Again", clicks Play Again and asserts loading text reappears
  - **Theme Integration**: asserts no `theme-light` on `html`, clicks ThemeToggle (aria-label "Switch to Aged Map"), asserts `theme-light` added, toggles back

- [x] **D-50** Add `"test:e2e": "playwright test"` script to `client/package.json`; add `exclude: ['e2e/**']` to Vitest config so `npm test --prefix client` no longer picks up Playwright specs
