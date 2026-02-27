# ChronoQuizzr — Task List

All tasks use the "Deliver" (D-##) prefix. Phases are sequential. Within a phase, complete tasks in order unless marked as parallelizable.

Legend: `[ ]` = pending · `[x]` = complete · `[~]` = in progress

---

## Phase 0 — Project Scaffold

- [ ] **D-01** Scaffold the React client with Vite
  `npm create vite@latest client --template react` from project root

- [ ] **D-02** Scaffold the Express server
  `mkdir server && cd server && npm init -y && npm install express cors`

- [ ] **D-03** Install Tailwind CSS v4 in `client/`
  Follow the official Tailwind v4 + Vite guide (CSS-first config via `@import "tailwindcss"` in CSS, no `tailwind.config.js`)

- [ ] **D-04** Install Leaflet in `client/`
  `npm install leaflet react-leaflet` · Import Leaflet CSS in `main.jsx`

- [ ] **D-05** Configure root-level dev orchestration
  Create root `package.json` with `concurrently` script:
  `"dev": "concurrently \"npm run dev --prefix client\" \"node server/index.js\""`

---

## Phase 1 — Backend Core

- [ ] **D-06** Implement `server/utils/haversine.js`
  - Pure function: `haversine(lat1, lng1, lat2, lng2) → number (km)`
  - Uses Earth radius = 6371 km
  - No external dependencies
  - Full JSDoc comment block

- [ ] **D-07** Write unit tests for `haversine.js`
  File: `server/utils/haversine.test.js`
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

- [ ] **D-09** Implement `server/utils/scorer.js`
  `scorer(distance_km) → number (0–5000)`
  Formula: `Math.round(5000 * Math.exp(-distance_km / 2000))`

- [ ] **D-10** Implement Express routes (`server/routes/game.js`)
  - `GET /api/game/start` — shuffle events, strip coordinates, return 5
  - `POST /api/game/guess` — validate `{eventId, lat, lng}`, run haversine + scorer, return score payload

- [ ] **D-11** Scaffold `server/services/eventGenerator.js`
  - Define and export `generateEvent(difficulty)` interface
  - Stub returns a hardcoded placeholder event (real LLM call wired later)
  - Integrate startup check in `server/index.js`: if `events.json` count < 5, call generator to fill pool

---

## Phase 2 — Frontend Core

- [ ] **D-12** Create `MapView` component (`client/src/components/MapView.jsx`)
  - Leaflet map with OpenStreetMap tiles
  - Single-pin drop on click (replace previous marker)
  - Exposes `onPinDrop(lat, lng)` callback prop

- [ ] **D-13** Create `CluePanel` component (`client/src/components/CluePanel.jsx`)
  - Displays `clue_text` and `year`
  - Disabled Submit button until a pin is dropped
  - Calls `onSubmit()` prop on button click

- [ ] **D-14** Create `GameBoard` component (`client/src/components/GameBoard.jsx`)
  - Holds game state: `session[]`, `currentRound`, `scores[]`, `guessCoords`
  - Fetches `GET /api/game/start` on mount
  - Renders `CluePanel` + `MapView` for current round

---

## Phase 3 — Results & Scoring

- [ ] **D-15** Wire `POST /api/game/guess` in `GameBoard`
  - Send `{ eventId, lat, lng }` on submit
  - Store response in state: `{ score, distance_km, true_lat, true_lng }`

- [ ] **D-16** Create `ResultsOverlay` component (`client/src/components/ResultsOverlay.jsx`)
  - Add second marker at true location
  - Draw polyline from guess to truth using `react-leaflet` `<Polyline>`
  - Display distance (km) and round score
  - "Next Round" button

- [ ] **D-17** Implement round progression in `GameBoard`
  - On "Next Round": increment `currentRound`, clear guess state
  - After round 5: transition to `FinalScoreScreen`

- [ ] **D-18** Create `FinalScoreScreen` component (`client/src/components/FinalScoreScreen.jsx`)
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
