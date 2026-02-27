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

- [ ] **D-06** Implement `server/utils/haversine.ts`
  - Pure function: `haversine(lat1: number, lng1: number, lat2: number, lng2: number): number` (returns km)
  - Uses Earth radius = 6371 km
  - No external dependencies
  - Full TSDoc comment block

- [ ] **D-07** Write unit tests for `haversine.ts`
  File: `server/utils/haversine.test.ts`
  Test cases must include:
  - Same point → 0 km
  - Known distance pair (e.g., London → Paris ≈ 341 km, ±1 km tolerance)
  - Antimeridian crossing (e.g., Fiji to Samoa)
  - Near-pole coordinates

- [ ] **D-08** Curate `server/data/events.json`
  Minimum 10 events, following The Chronicler's standards:
  - All 3 difficulty tiers represented (≥ 2 each)
  - ≥ 3 continents
  - No two events in the same city
  - Every entry has `source_url`

- [ ] **D-09** Implement `server/utils/scorer.ts`
  `scorer(distance_km: number): number` (returns 0–5000)
  Formula: `Math.round(5000 * Math.exp(-distance_km / 2000))`

- [ ] **D-10** Implement Express routes (`server/routes/game.ts`)
  - `GET /api/game/start` — shuffle events, strip coordinates, return 5
  - `POST /api/game/guess` — validate `{eventId, lat, lng}`, run haversine + scorer, return score payload

- [ ] **D-11** Scaffold `server/services/eventGenerator.ts`
  - Define and export `generateEvent(difficulty: 'easy' | 'medium' | 'hard'): Promise<HistoricalEvent>` interface
  - Stub returns a hardcoded placeholder event (real LLM call wired later)
  - Integrate startup check in `server/index.ts`: if `events.json` count < 5, call generator to fill pool

---

## Phase 2 — Frontend Core

- [ ] **D-12** Create `MapView` component (`client/src/components/MapView.tsx`)
  - Leaflet map with OpenStreetMap tiles
  - Single-pin drop on click (replace previous marker)
  - Exposes `onPinDrop(lat: number, lng: number): void` callback prop

- [ ] **D-13** Create `CluePanel` component (`client/src/components/CluePanel.tsx`)
  - Displays `clue_text` and `year`
  - Disabled Submit button until a pin is dropped
  - Calls `onSubmit(): void` prop on button click

- [ ] **D-14** Create `GameBoard` component (`client/src/components/GameBoard.tsx`)
  - Holds game state: `session[]`, `currentRound`, `scores[]`, `guessCoords`
  - Fetches `GET /api/game/start` on mount
  - Renders `CluePanel` + `MapView` for current round

---

## Phase 3 — Results & Scoring

- [ ] **D-15** Wire `POST /api/game/guess` in `GameBoard`
  - Send `{ eventId, lat, lng }` on submit
  - Store response in state: `{ score, distance_km, true_lat, true_lng }`

- [ ] **D-16** Create `ResultsOverlay` component (`client/src/components/ResultsOverlay.tsx`)
  - Add second marker at true location
  - Draw polyline from guess to truth using `react-leaflet` `<Polyline>`
  - Display distance (km) and round score
  - "Next Round" button

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
