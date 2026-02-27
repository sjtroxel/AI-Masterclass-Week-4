import { Router, Request, Response } from 'express'
import type { HistoricalEvent, GameEvent, Guess, GuessResult } from '@shared/types'
import { haversine } from '../utils/haversine'
import { scorer } from '../utils/scorer'
import eventsData from '../data/events.json'

const router = Router()

/**
 * In-memory event pool — loaded from events.json at module initialisation.
 * Exported so that server/index.ts can extend it via the EventGenerator
 * when the seed file has fewer than 5 entries.
 *
 * IMPORTANT: Contains full HistoricalEvent objects including hiddenCoords.
 * These must NEVER be sent to the client directly.
 */
export const eventPool: HistoricalEvent[] = eventsData as HistoricalEvent[]

/** Fisher-Yates in-place shuffle; returns a shallow copy. */
function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * GET /api/game/start
 *
 * Returns 5 randomly-selected historical events with `hiddenCoords` stripped.
 * The client receives only the `GameEvent` shape — coordinates are never exposed
 * until the player submits a guess.
 */
router.get('/start', (_req: Request, res: Response) => {
  if (eventPool.length === 0) {
    res.status(500).json({ error: 'Event store is empty. Server may have failed to load data.' })
    return
  }

  const selected = shuffle(eventPool).slice(0, 5)

  const gameEvents: GameEvent[] = selected.map(({ hiddenCoords: _, ...gameEvent }) => gameEvent)

  res.json(gameEvents)
})

/**
 * POST /api/game/guess
 *
 * Accepts a player's pin-drop guess, scores it against the true coordinates,
 * and returns the result. True coordinates are only revealed at this point —
 * after the guess has been submitted and scored.
 *
 * Request body: { eventId: string, lat: number, lng: number }
 * Response:     { distance: number, score: number, trueCoords: { lat, lng } }
 */
router.post('/guess', (req: Request, res: Response) => {
  const { eventId, lat, lng } = req.body as Partial<Guess>

  // Validate presence
  if (eventId === undefined || lat === undefined || lng === undefined) {
    res.status(400).json({ error: 'Request body must include eventId, lat, and lng.' })
    return
  }

  // Validate types
  if (typeof eventId !== 'string' || typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'eventId must be a string; lat and lng must be numbers.' })
    return
  }

  // Validate coordinate ranges
  if (lat < -90 || lat > 90) {
    res.status(400).json({ error: 'lat must be in the range [-90, 90].' })
    return
  }
  if (lng < -180 || lng > 180) {
    res.status(400).json({ error: 'lng must be in the range [-180, 180].' })
    return
  }

  // Look up the event
  const event = eventPool.find((e) => e.id === eventId)
  if (!event) {
    res.status(404).json({ error: `Event with id "${eventId}" not found.` })
    return
  }

  const { lat: trueLat, lng: trueLng } = event.hiddenCoords

  const rawDistance = haversine(lat, lng, trueLat, trueLng)
  const distance = Math.round(rawDistance * 10) / 10 // 1 decimal place

  const score = scorer(rawDistance)

  const result: GuessResult = {
    distance,
    score,
    trueCoords: { lat: trueLat, lng: trueLng },
  }

  res.json(result)
})

export default router
