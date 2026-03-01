import { describe, it, expect, vi } from 'vitest'
import { ChroniclerEngine } from './chroniclerEngine'
import { MockProvider } from '../providers/mockProvider'
import { FatalProviderError } from '../providers/geminiProvider'

// ── Fixture helpers ───────────────────────────────────────────────────────────

import validEventFixture from '../test-fixtures/validEvent.json'
import rewrittenEventFixture from '../test-fixtures/rewrittenEvent.json'
import adversaryPassFixture from '../test-fixtures/validAdversaryPass.json'
import adversaryFailFixture from '../test-fixtures/validAdversaryFail.json'
import adversaryCoordsBadFixture from '../test-fixtures/validAdversaryCoordsBad.json'

const V = JSON.stringify(validEventFixture)      // valid event JSON string
const R = JSON.stringify(rewrittenEventFixture)  // rewritten event (same id, different clue)
const P = JSON.stringify(adversaryPassFixture)   // adversary PASS
const F = JSON.stringify(adversaryFailFixture)   // adversary FAIL (identified=true)
const C = JSON.stringify(adversaryCoordsBadFixture) // adversary FAIL (coordsOk=false)

// Builds the 6-call sequence that exhausts one full topic (3 adversary rounds all fail)
const onTopicExhaust = [V, F, R, F, R, F]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChroniclerEngine', () => {

  it('happy path: returns event when first adversary check passes', async () => {
    const mock = new MockProvider([V, P])
    const engine = new ChroniclerEngine(mock)

    const result = await engine.generateVerifiedEvent('medium')

    expect(result.id).toBe(validEventFixture.id)
    expect(result.clue).toBe(validEventFixture.clue)
    expect(result.hiddenCoords).toEqual(validEventFixture.hiddenCoords)
  })

  it('pass after 1 rewrite: returns rewritten event when clue passes on round 2', async () => {
    // Gen → adversaryFail → rewrite → adversaryPass
    const mock = new MockProvider([V, F, R, P])
    const engine = new ChroniclerEngine(mock)

    const result = await engine.generateVerifiedEvent('medium')

    // Must be the REWRITTEN version (same id, different clue)
    expect(result.id).toBe(rewrittenEventFixture.id)
    expect(result.clue).toBe(rewrittenEventFixture.clue)
  })

  it('topic drift guarded: discards rewrite with wrong id, succeeds on topic 2', async () => {
    // Topic 1: gen → adversaryFail → drifted rewrite (wrong id) → topic fail
    // Topic 2: gen → adversaryPass → return
    const driftedEvent = { ...validEventFixture, id: 'drifted-event-9999' }
    const D = JSON.stringify(driftedEvent)

    const mock = new MockProvider([V, F, D, V, P])
    const engine = new ChroniclerEngine(mock)

    const result = await engine.generateVerifiedEvent('medium')

    // Engine should succeed on topic 2 and return a valid event
    expect(result).toBeDefined()
    expect(typeof result.id).toBe('string')
  })

  it('coordinate hallucination: skips topic, succeeds on topic 2', async () => {
    // Topic 1: gen → adversary reports coordsOk=false → topic fail
    // Topic 2: gen → adversaryPass → return
    const mock = new MockProvider([V, C, V, P])
    const engine = new ChroniclerEngine(mock)

    const result = await engine.generateVerifiedEvent('hard')

    expect(result).toBeDefined()
    expect(result.id).toBe(validEventFixture.id)
  })

  it('schema invalid on generation: skips to next topic, succeeds on topic 2', async () => {
    // Topic 1: gen returns malformed JSON → schema check fails → continue to topic 2
    // Topic 2: gen → adversaryPass → return
    const mock = new MockProvider(['{ broken json', V, P])
    const engine = new ChroniclerEngine(mock)

    const result = await engine.generateVerifiedEvent('easy')

    expect(result.id).toBe(validEventFixture.id)
  })

  it('total exhaustion falls back to seed event (non-null)', async () => {
    // All 3 topics exhaust all 3 rewrite rounds — adversary always identifies
    const mock = new MockProvider([
      ...onTopicExhaust, // topic 1
      ...onTopicExhaust, // topic 2
      ...onTopicExhaust, // topic 3
    ])
    const engine = new ChroniclerEngine(mock)

    const result = await engine.generateVerifiedEvent('medium')

    // Engine must return a seed event (fallback) — never null/undefined
    expect(result).toBeDefined()
    expect(typeof result.id).toBe('string')
    expect(result.id.length).toBeGreaterThan(0)
  })

  it('FatalProviderError propagates and is not swallowed', async () => {
    const mock = new MockProvider(['__FATAL__'])
    const engine = new ChroniclerEngine(mock)

    await expect(engine.generateVerifiedEvent('medium')).rejects.toThrow(FatalProviderError)
  })

  it('blacklist enforced: generation prompt contains blacklisted event IDs', async () => {
    const mock = new MockProvider([V, P])
    const spy = vi.spyOn(mock, 'completeJson')
    const engine = new ChroniclerEngine(mock)

    const blacklistedEvent = {
      ...validEventFixture,
      id: 'unique-blacklisted-event-xyz',
      locationName: 'Blacklisted Place',
    }

    await engine.generateVerifiedEvent('medium', [blacklistedEvent])

    // First call is the generator prompt — it must reference the blacklisted ID
    const generatorPrompt = spy.mock.calls[0][0]
    expect(generatorPrompt).toContain('unique-blacklisted-event-xyz')
  })
})
