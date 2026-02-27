import type { HistoricalEvent } from '@shared/types'
import { logLLMTrace } from '../utils/logger'

/**
 * Generates a historical event of the requested difficulty.
 *
 * @param difficulty - The desired difficulty tier for the generated event.
 * @returns A promise resolving to a `HistoricalEvent` matching the events.json schema.
 *
 * @remarks
 * **MVP stub** — the real Claude API call (via `@anthropic-ai/sdk`) is wired in a later phase.
 * This stub is only invoked when `events.json` has fewer than 5 entries. With the full
 * seed file in place it will never be called in normal operation.
 *
 * When the LLM call is implemented, `logLLMTrace` must be called with the full prompt
 * and raw response before returning.
 */
export async function generateEvent(difficulty: 'easy' | 'medium' | 'hard'): Promise<HistoricalEvent> {
  const prompt = `[STUB] Generate a ${difficulty} historical event for ChronoQuizzr.`
  const response = '[STUB] Returning hardcoded placeholder — LLM not yet wired.'

  logLLMTrace(prompt, response)

  return {
    id: `generated-${difficulty}-${Date.now()}`,
    year: 1969,
    locationName: 'Placeholder Location (stub)',
    clue: 'A stub event — the EventGenerator has not yet been connected to the Claude API.',
    hiddenCoords: { lat: 0, lng: 0 },
    difficulty,
    source_url: 'https://example.com',
  }
}
