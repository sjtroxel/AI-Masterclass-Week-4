import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'

// Mock generateEvent BEFORE importing app so the route never hits the real API
vi.mock('../services/eventGenerator', () => ({
  generateEvent: vi.fn(),
}))

import { app } from '../app'
import { eventPool } from './game'
import { generateEvent } from '../services/eventGenerator'
import mockEventsData from '../tests/fixtures/mockEvents.json'

// ── Seed event used for POST /guess tests ─────────────────────────────────────
// "berlin-wall-1989" is always in eventPool (loaded from events.json at module init)
const SEED_EVENT_ID = 'berlin-wall-1989'
const SEED_TRUE_LAT = 52.5163
const SEED_TRUE_LNG = 13.3777

// ── Test isolation ─────────────────────────────────────────────────────────────
// Capture the pool state as it was at module-load time (seed + any batch events).
// Restore it before each test so GET /start pushes don't bleed across tests.
const initialPoolSnapshot = [...eventPool]

beforeEach(() => {
  eventPool.splice(0, eventPool.length, ...initialPoolSnapshot)

  // Default mock: cycle through the 5 mock events per call
  let callIdx = 0
  vi.mocked(generateEvent).mockImplementation(async () => {
    const event = mockEventsData[callIdx % mockEventsData.length]
    callIdx++
    // Return a plain object that satisfies HistoricalEvent shape
    return event as ReturnType<typeof generateEvent> extends Promise<infer T> ? T : never
  })
})

// ── GET /api/game/start ───────────────────────────────────────────────────────

describe('GET /api/game/start', () => {
  it('returns 200 with exactly 5 events', async () => {
    const res = await request(app).get('/api/game/start')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(5)
  })

  it('response Content-Type is application/json', async () => {
    const res = await request(app).get('/api/game/start')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('no event in the response contains hiddenCoords (coordinate privacy — Rule 04)', async () => {
    const res = await request(app).get('/api/game/start')
    for (const event of res.body) {
      expect(event).not.toHaveProperty('hiddenCoords')
    }
  })

  it('all required GameEvent fields are present on every event', async () => {
    const res = await request(app).get('/api/game/start')
    for (const event of res.body) {
      expect(event).toHaveProperty('id')
      expect(event).toHaveProperty('year')
      expect(event).toHaveProperty('locationName')
      expect(event).toHaveProperty('clue')
      expect(event).toHaveProperty('difficulty')
      expect(event).toHaveProperty('source_url')
    }
  })

  it('all returned event IDs are unique within the response', async () => {
    const res = await request(app).get('/api/game/start')
    const ids: string[] = res.body.map((e: { id: string }) => e.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(5)
  })

  it('falls back to static pool when generateEvent throws', async () => {
    vi.mocked(generateEvent).mockRejectedValue(new Error('API unavailable'))
    const res = await request(app).get('/api/game/start')
    // Fallback still returns 200 + 5 events from the static pool
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(5)
    // Static-pool events still must not have hiddenCoords
    for (const event of res.body) {
      expect(event).not.toHaveProperty('hiddenCoords')
    }
  })
})

// ── POST /api/game/guess ──────────────────────────────────────────────────────

describe('POST /api/game/guess', () => {
  it('returns 200 with distance, score, and trueCoords for a valid guess', async () => {
    const res = await request(app)
      .post('/api/game/guess')
      .send({ eventId: SEED_EVENT_ID, lat: 52.0, lng: 13.0 })

    expect(res.status).toBe(200)
    expect(typeof res.body.distance).toBe('number')
    expect(typeof res.body.score).toBe('number')
    expect(res.body.trueCoords).toEqual({ lat: SEED_TRUE_LAT, lng: SEED_TRUE_LNG })
  })

  it('score is 5000 when the guess is the exact true location', async () => {
    const res = await request(app)
      .post('/api/game/guess')
      .send({ eventId: SEED_EVENT_ID, lat: SEED_TRUE_LAT, lng: SEED_TRUE_LNG })

    expect(res.status).toBe(200)
    expect(res.body.score).toBe(5000)
  })

  it('score is in the range [0, 5000]', async () => {
    const res = await request(app)
      .post('/api/game/guess')
      .send({ eventId: SEED_EVENT_ID, lat: -33.8688, lng: 151.2093 })

    expect(res.body.score).toBeGreaterThanOrEqual(0)
    expect(res.body.score).toBeLessThanOrEqual(5000)
  })

  it('distance is a positive number for a non-exact guess', async () => {
    const res = await request(app)
      .post('/api/game/guess')
      .send({ eventId: SEED_EVENT_ID, lat: 0, lng: 0 })

    expect(res.status).toBe(200)
    expect(typeof res.body.distance).toBe('number')
    expect(res.body.distance).toBeGreaterThan(0)
  })

  it('returns 404 for an unknown eventId', async () => {
    const res = await request(app)
      .post('/api/game/guess')
      .send({ eventId: 'does-not-exist', lat: 48.8566, lng: 2.3522 })

    expect(res.status).toBe(404)
  })

  it('returns 400 when lat is missing', async () => {
    const res = await request(app)
      .post('/api/game/guess')
      .send({ eventId: SEED_EVENT_ID, lng: 13.0 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when eventId is missing', async () => {
    const res = await request(app)
      .post('/api/game/guess')
      .send({ lat: 52.0, lng: 13.0 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when lat is a string instead of a number', async () => {
    const res = await request(app)
      .post('/api/game/guess')
      .send({ eventId: SEED_EVENT_ID, lat: 'hello', lng: 13.0 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when lat is out of range (> 90)', async () => {
    const res = await request(app)
      .post('/api/game/guess')
      .send({ eventId: SEED_EVENT_ID, lat: 95, lng: 13.0 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when lng is out of range (< -180)', async () => {
    const res = await request(app)
      .post('/api/game/guess')
      .send({ eventId: SEED_EVENT_ID, lat: 52.0, lng: -185 })

    expect(res.status).toBe(400)
  })

  it('trueCoords matches the known seed event coordinates', async () => {
    const res = await request(app)
      .post('/api/game/guess')
      .send({ eventId: SEED_EVENT_ID, lat: 52.0, lng: 13.0 })

    expect(res.body.trueCoords.lat).toBe(SEED_TRUE_LAT)
    expect(res.body.trueCoords.lng).toBe(SEED_TRUE_LNG)
  })
})
