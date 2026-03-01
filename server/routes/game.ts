import fs from 'fs'
import path from 'path'
import { Router, Request, Response } from 'express'
import type { HistoricalEvent, GameEvent, Guess, GuessResult } from '@shared/types'
import { haversine } from '../utils/haversine'
import { scorer } from '../utils/scorer'
import { generateEvent } from '../services/eventGenerator'
import eventsData from '../data/events.json'

const router = Router()

/**
 * Reads `generated_events.json` at module startup.
 * Returns an empty array if the file is absent, empty, or malformed —
 * so the server always starts successfully even before a batch run.
 */
function loadGeneratedEvents(): HistoricalEvent[] {
  const p = path.resolve(__dirname, '../data/generated_events.json')
  try {
    if (!fs.existsSync(p)) return []
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'))
    return Array.isArray(parsed) ? (parsed as HistoricalEvent[]) : []
  } catch {
    return []
  }
}

/**
 * In-memory event pool — merged from events.json (seed) and
 * generated_events.json (Chronicler batch output) at module initialisation.
 * Exported so that server/index.ts can extend it via the EventGenerator
 * when the combined pool has fewer than 5 entries.
 *
 * IMPORTANT: Contains full HistoricalEvent objects including hiddenCoords.
 * These must NEVER be sent to the client directly.
 */
export const eventPool: HistoricalEvent[] = [
  ...(eventsData as HistoricalEvent[]),
  ...loadGeneratedEvents(),
]

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
 * Difficulty distribution for each game session: 1 easy, 2 medium, 2 hard.
 * Shuffled before returning so difficulty order is unpredictable to the player.
 */
const DIFFICULTY_SLOTS: Array<'easy' | 'medium' | 'hard'> = [
  'easy', 'medium', 'medium', 'hard', 'hard',
]

/**
 * GET /api/game/start
 *
 * Generates 5 fresh historical events on-demand via the ChroniclerEngine
 * (Generate → Adversary → Rewrite loop). All 5 are requested concurrently
 * via Promise.all to minimise latency (~2–5 s).
 *
 * Generated events are pushed into `eventPool` so that POST /api/game/guess
 * can look them up by eventId after the client submits a guess.
 *
 * Fallback: if the Anthropic API is unavailable (FatalProviderError, network
 * error, missing API key), the handler falls back silently to a Fisher-Yates
 * shuffle of the static pool so the player always receives 5 events.
 *
 * `hiddenCoords` is always stripped before the response — Rule 04.
 */
router.get('/start', async (_req: Request, res: Response) => {
  try {
    // Generate 5 events concurrently — each call runs the full adversarial loop
    const rawGenerated = await Promise.all(
      DIFFICULTY_SLOTS.map((d) => generateEvent(d))
    )

    // Safety-net dedup: if two concurrent calls somehow produced the same event
    // ID (astronomically unlikely), keep the first occurrence and pad from the
    // static seed pool.
    const seenIds = new Set<string>()
    const deduped: HistoricalEvent[] = []

    for (const event of rawGenerated) {
      if (seenIds.has(event.id)) {
        console.warn(`[GET /start] Duplicate event id "${event.id}" in batch — replacing with seed fallback`)
        const replacement = (eventsData as HistoricalEvent[]).find((e) => !seenIds.has(e.id))
        if (replacement) {
          seenIds.add(replacement.id)
          deduped.push(replacement)
        }
        // If every seed event is also a duplicate (should never happen), skip the slot
      } else {
        seenIds.add(event.id)
        deduped.push(event)
      }
    }

    // CRITICAL: push full HistoricalEvent objects (including hiddenCoords) into
    // the in-memory pool so POST /api/game/guess can look them up by eventId.
    eventPool.push(...deduped)

    // Shuffle difficulty order before sending so players can't anticipate it
    const gameEvents: GameEvent[] = shuffle(deduped).map(({ hiddenCoords: _, ...gameEvent }) => gameEvent)
    res.json(gameEvents)

  } catch (err) {
    // FatalProviderError (bad API key, quota exhausted) or network failure.
    // Fall back silently to the static pool — the player still gets a game.
    const reason = err instanceof Error ? err.message : String(err)
    console.warn(`[GET /start] Dynamic generation failed (${reason}); falling back to static pool`)

    if (eventPool.length === 0) {
      res.status(500).json({ error: 'Event store is empty. Server may have failed to load data.' })
      return
    }

    const selected = shuffle(eventPool).slice(0, 5)
    const gameEvents: GameEvent[] = selected.map(({ hiddenCoords: _, ...gameEvent }) => gameEvent)
    res.json(gameEvents)
  }
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
