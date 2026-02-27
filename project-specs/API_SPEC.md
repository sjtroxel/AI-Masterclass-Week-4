# ChronoQuizzr — API Specification

## Overview

All endpoints are served by the Express backend ("The Brain") at `localhost:3001` in development.
TypeScript types for all request/response shapes are defined in `shared/types.ts`.
Import with: `import type { GameEvent, Guess, GuessResult } from '@shared/types'`

Base path: `/api/game`

---

## Endpoints

### `GET /api/game/start`

Starts a new game session. Returns 5 shuffled historical events with coordinates **stripped**.

**Request:** No body, no parameters.

**Response:** `200 OK` — `GameEvent[]` (array of 5)

```typescript
// GameEvent = Omit<HistoricalEvent, 'hiddenCoords'>
[
  {
    "id": "sarajevo-1914",
    "year": 1914,
    "locationName": "Sarajevo, Bosnia",   // used server-side only for logging
    "clue": "In a narrow street of an old Austro-Hungarian city, a young nationalist fired the shots that ignited a continental war.",
    "difficulty": "medium",
    "source_url": "https://en.wikipedia.org/wiki/Assassination_of_Archduke_Franz_Ferdinand"
  }
]
```

> **Security:** `hiddenCoords` is stripped via `const { hiddenCoords: _, ...gameEvent } = event` before the response is sent. The coordinate field must never appear in this response.

**Errors:**
| Status | Condition |
|--------|-----------|
| `500` | Event store failed to load on startup |

---

### `POST /api/game/guess`

Submits a player's pin-drop guess for a specific event. Returns the score and the true location.

**Request body:** `Guess`

```typescript
{
  "eventId": "sarajevo-1914",
  "lat": 44.5,
  "lng": 18.7
}
```

**Validation:**
- `eventId` must match an event in the current session's event store
- `lat` must be a number in `[-90, 90]`
- `lng` must be a number in `[-180, 180]`

**Response:** `200 OK` — `GuessResult`

```typescript
{
  "distance": 14.3,          // kilometres, rounded to 1 decimal
  "score": 4812,             // 0–5000 via scorer(distance)
  "trueCoords": {
    "lat": 43.8563,
    "lng": 18.4131
  }
}
```

**Errors:**
| Status | Condition |
|--------|-----------|
| `400` | Missing or invalid `eventId`, `lat`, or `lng` |
| `404` | `eventId` not found in the loaded event store |

---

## Scoring Formula

Implemented in `server/utils/scorer.ts`:

```
score = Math.round( 5000 × e^(−distance / 2000) )
```

The `distance` field in `GuessResult` is computed by `server/utils/haversine.ts`.

---

## Shared Types Reference

Defined in `shared/types.ts`:

```typescript
interface Coordinates   { lat: number; lng: number }
interface HistoricalEvent { id, year, locationName, clue, hiddenCoords, difficulty, source_url }
type      GameEvent      = Omit<HistoricalEvent, 'hiddenCoords'>
interface Guess          { eventId: string; lat: number; lng: number }
interface GuessResult    { distance: number; score: number; trueCoords: Coordinates }
```
