/**
 * Shared TypeScript contracts for ChronoQuizzr.
 * Imported by both client and server using `import type`.
 * These are type-only declarations — zero runtime footprint.
 */

/** A lat/lng coordinate pair. */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * A historical event as stored in events.json.
 * Contains hiddenCoords — NEVER sent to the client directly.
 */
export interface HistoricalEvent {
  id: string;
  year: string;
  locationName: string;
  clue: string;
  hiddenCoords: Coordinates;
  difficulty: 'easy' | 'medium' | 'hard';
  source_url: string;
}

/**
 * The safe view of a HistoricalEvent sent to the client.
 * hiddenCoords is stripped. Only revealed after a guess is submitted.
 */
export type GameEvent = Omit<HistoricalEvent, 'hiddenCoords'>;

/** The player's guess payload — sent from client to POST /api/game/guess. */
export interface Guess {
  eventId: string;
  lat: number;
  lng: number;
}

/** The server's response to a guess — includes true location and score. */
export interface GuessResult {
  distance: number;   // kilometres, rounded to 1 decimal
  score: number;      // 0–5000
  trueCoords: Coordinates;
}
