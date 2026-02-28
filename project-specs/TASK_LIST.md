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

- [ ] **D-15** Wire `POST /api/game/guess` in `GameBoard`
  - Send `{ eventId, lat, lng }` on submit
  - Store `GuessResult` response in state: `{ distance, score, trueCoords }` (canonical `shared/types.ts` shape)
  - **Responsive check:** Loading/disabled state while POST is in-flight must not shift layout on any viewport

- [ ] **D-16** Create `ResultsOverlay` component (`client/src/components/ResultsOverlay.tsx`)
  - Add second marker at true location
  - Draw polyline from guess to truth using `react-leaflet` `<Polyline>`
  - Display distance (km) and round score
  - "Next Round" button
  - **Responsive check:** Overlay must render as a modal/full-screen sheet on mobile so it does not fight Leaflet's z-index; ensure "Next Round" button is thumb-reachable (bottom half of screen on mobile)

- [ ] **D-17** Implement round progression in `GameBoard`
  - On "Next Round": increment `currentRound`, clear guess state
  - After round 5: transition to `FinalScoreScreen`

- [ ] **D-18** Create `FinalScoreScreen` component (`client/src/components/FinalScoreScreen.tsx`)
  - Display total score (sum of all round scores)
  - Per-round breakdown table: round, distance, score
  - "Play Again" button resets state and re-fetches `/api/game/start`

---

## Phase 4 — Polish

- [ ] **D-19** Apply Tailwind v4 styling — dark historical theme
  - Dark background, parchment-toned text accents
  - Consistent button styles, panel borders, typography scale

- [ ] **D-20** Add loading states
  - Spinner in `GameBoard` while fetching session
  - Disable Submit button and show loading indicator while guess POST is in-flight

- [ ] **D-21** Add error handling
  - API fetch failures: display user-friendly error message with retry option
  - Invalid guess coordinates: client-side validation before submit

- [ ] **D-22** Verify Haversine edge cases end-to-end
  - Guess at the exact true location → score = 5000
  - Guess on opposite side of Earth → score ≈ 0
  - Antimeridian polyline displays correctly on the Leaflet map
