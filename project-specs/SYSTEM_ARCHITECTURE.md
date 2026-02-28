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
├── src/
│   ├── components/
│   │   ├── GameBoard.tsx        # Root orchestrator: manages round index & game state
│   │   ├── CluePanel.tsx        # Displays clue, year; contains Submit button + spinner
│   │   ├── MapView.tsx          # Leaflet map, pin-drop, post-guess polyline/marker
│   │   ├── ResultsOverlay.tsx   # Polyline, distance, round score, source reveal post-guess
│   │   ├── FinalScoreScreen.tsx # Total score, Round Logbook table, Play Again
│   │   └── ThemeToggle.tsx      # Dark/Light mode toggle; fixed top-right, z-[900]
│   ├── context/
│   │   └── ThemeContext.tsx     # Theme state + provider + useTheme hook; persists to localStorage
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts            # Vite client type declarations (SVG imports, etc.)

server/ (The Brain — Node/Express/TypeScript)
├── index.ts                    # Entry point: loads events, starts server
├── routes/
│   └── game.ts                 # GET /api/game/start, POST /api/game/guess
├── utils/
│   ├── haversine.ts            # Pure Haversine function — standalone, tested
│   └── scorer.ts               # Wraps haversine, applies scoring formula
├── services/
│   └── eventGenerator.ts       # LLM-backed event generator (fallback slot)
└── data/
    └── events.json             # Curated seed file (≥ 10 verified events)
```

---

## API Contracts

### `GET /api/game/start`

Returns a shuffled selection of 5 events for the session. **Coordinates are stripped** from the response.

**Response:**
```json
[
  {
    "id": "sarajevo-1914",
    "clue_text": "In a narrow street of an old Austro-Hungarian city, a young nationalist fired the shots that ignited a continental war.",
    "year": 1914,
    "difficulty": "medium"
  }
]
```

### `POST /api/game/guess`

Accepts the player's guess and returns the score and the true location.

**Request:**
```json
{ "eventId": "sarajevo-1914", "lat": 44.5, "lng": 18.7 }
```

**Response:**
```json
{
  "score": 4812,
  "distance_km": 14.3,
  "true_lat": 43.8563,
  "true_lng": 18.4131
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
  │<── [{id, clue_text, year} ×5] ──│
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
  │<── {score, distance_km,          │
  │     true_lat, true_lng} ─────────│
  │                                  │
  Show ResultsOverlay                │
  (polyline + score)                 │
  │                                  │
  [Rounds 2–5 repeat]                │
  │                                  │
  Show FinalScoreScreen              │
```

---

## EventGenerator Service

```
server/services/eventGenerator.ts
```

**Purpose:** Provides a fallback event source when `events.json` has fewer than 5 entries. Keeps the API contract (`GET /api/game/start`) stable regardless of seed-data quantity.

**Interface:**
```typescript
// generateEvent(difficulty: 'easy' | 'medium' | 'hard'): Promise<HistoricalEvent>
// HistoricalEvent shape matches an events.json record exactly.
```

**Trigger condition:** On server startup, after loading `events.json`, if `events.length < 5` the loader calls `EventGenerator` once per missing event to fill the pool to 5. The generated events are held in-memory for the session only; they are not written back to `events.json`.

**MVP posture:** The service file is scaffolded and its interface is defined. The LLM call implementation (Claude API via `@anthropic-ai/sdk`) is wired in Phase 1 but only invoked if the seed file is sparse.

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
