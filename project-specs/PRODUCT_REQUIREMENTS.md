# ChronoQuizzr — Product Requirements Document (MVP)

## Overview

ChronoQuizzr is a historically-based GeoGuessr-style game. Players receive an obfuscated historical text clue, then drop a pin on a world map where they believe the event occurred. The closer the guess, the higher the score.

---

## Scope: MVP Only

The following are explicitly **out of scope** for MVP:
- User authentication or accounts
- Leaderboards or social features
- Multiplayer
- Persistent statistics
- Custom round counts (fixed at 5)

---

## Game Loop

1. **Session Start** — The server deals a session of 5 historical events. Only the clue text and year are sent to the client; coordinates are withheld until after each guess.
2. **Clue Display** — The player reads the obfuscated text clue and the event year in the `CluePanel`.
3. **Pin Drop** — The player clicks the Leaflet map to drop a single marker at their best guess location.
4. **Submit Guess** — The player confirms their guess. The client sends `{ eventId, lat, lng }` to the Express backend.
5. **Score Calculation** — The backend computes the Haversine distance (km) between the guess and the true coordinates, then calculates a score.
6. **Results Overlay** — A `ResultsOverlay` displays:
   - A polyline from the guess marker to the true location marker
   - The distance in km
   - The round score
7. **Round Progression** — The player advances to the next round (or final screen after round 5).
8. **Final Score Screen** — Shows the total score (out of 25,000), a per-round breakdown, and a "Play Again" option.

---

## Scoring Formula

```
score = round( 5000 × e^(−distance_km / 2000) )
```

| Distance  | Score     |
|-----------|-----------|
| 0 km      | 5,000 pts |
| 500 km    | ~2,852 pts|
| 1,000 km  | ~1,839 pts|
| 2,000 km  | ~1,006 pts|
| 5,000 km  | ~82 pts   |
| 10,000 km | ~1 pt     |

Maximum score per round: **5,000 points**
Maximum total score: **25,000 points** (5 rounds)

---

## Data Model

### HistoricalEvent

```json
{
  "id": "string (UUID or slug)",
  "clue_text": "string (obfuscated — no place names)",
  "year": "number (e.g. 1914)",
  "difficulty": "easy | medium | hard",
  "coordinates": {
    "lat": "number",
    "lng": "number"
  },
  "source_url": "string (Wikipedia or primary source)"
}
```

### GuessPayload (client → server)

```json
{
  "eventId": "string",
  "lat": "number",
  "lng": "number"
}
```

### ScoreResponse (server → client)

```json
{
  "score": "number (0–5000)",
  "distance_km": "number",
  "true_lat": "number",
  "true_lng": "number"
}
```

---

## Constraints & Standards

- **Haversine utility** must be a standalone, side-effect-free function in `server/utils/haversine.ts` with its own unit tests. No external geo libraries.
- **Clues must never contain place names.** The Chronicler persona is responsible for obfuscation.
- **Every event must have a verifiable primary source** (Wikipedia URL minimum).
- **Events seed file** (`server/data/events.json`) must contain ≥ 10 events spanning at least 3 continents and all 3 difficulty tiers.
- **Coordinates must be accurate to at minimum city-level** (within ~5 km of the actual event site).

---

## Non-Functional Requirements

- **Platform:** Mobile-first responsive web application. The game must be fully playable on modern mobile browsers (iOS Safari, Android Chrome) as the primary target, and equally functional on desktop (Chrome, Firefox) at 1280×720+.
- **Mobile Experience:** On small screens (below the `md` Tailwind breakpoint, i.e. < 768 px), the `CluePanel` must render as a collapsible drawer or bottom-sheet overlay so the map occupies the full viewport. On `md` and above, the panel may be displayed side-by-side or in a persistent top/side strip.
- **Touch input:** The Leaflet map must support touch-based pin-dropping (tap to place marker, tap again to move it). Mouse click and touch tap must behave identically.
- API round-trip (guess → score response) must complete in < 500ms under normal conditions.
- Map must render within 2 seconds on a standard broadband connection.
