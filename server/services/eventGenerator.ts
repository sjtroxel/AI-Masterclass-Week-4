import type { HistoricalEvent } from '@shared/types'
import { logLLMTrace } from '../utils/logger'
import { AnthropicProvider } from '../providers/anthropicProvider'
import { ChroniclerEngine } from '../services/chroniclerEngine'

/**
 * Generates a historical event of the requested difficulty.
 *
 * Delegates to `ChroniclerEngine`, which runs the two-agent Generate →
 * Validate → Adversary loop backed by Anthropic (claude-haiku-4-5-20251001).
 * On retry exhaustion the engine falls back to a random seed event from
 * `events.json` so this function never rejects.
 *
 * @param difficulty - The desired difficulty tier for the generated event.
 * @returns A promise resolving to a verified `HistoricalEvent`.
 *
 * @remarks
 * `dotenv` must have been loaded before this function is called — i.e.
 * `import 'dotenv/config'` must appear at the top of `server/index.ts`
 * before this module is imported.  The `AnthropicProvider` constructor throws
 * immediately with a descriptive message if `ANTHROPIC_API_KEY` is absent.
 */
export async function generateEvent(difficulty: 'easy' | 'medium' | 'hard'): Promise<HistoricalEvent> {
  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY ?? '')
  const engine   = new ChroniclerEngine(provider)

  const event = await engine.generateVerifiedEvent(difficulty)

  // Keep the existing logLLMTrace contract — summary trace at the façade level.
  logLLMTrace(
    `[EVENT GENERATOR FAÇADE] generateEvent("${difficulty}")`,
    `Returned event id="${event.id}" year=${event.year} difficulty="${event.difficulty}"`
  )

  return event
}
