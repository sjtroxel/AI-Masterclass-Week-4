/**
 * Batch Event Generator — ChronoQuizzr Phase 5
 *
 * Runs the ChroniclerEngine adversarial loop to produce 10 verified
 * HistoricalEvent records and writes them to server/data/generated_events.json.
 *
 * Usage (from repo root):
 *   npm run generate --prefix server
 *
 * Or directly from the server/ directory:
 *   npx ts-node-dev --transpile-only scripts/generateBatch.ts
 */

import 'dotenv/config'

import fs from 'fs'
import path from 'path'
import type { HistoricalEvent } from '@shared/types'
import { FatalProviderError } from '../providers/geminiProvider'
import { AnthropicProvider } from '../providers/anthropicProvider'
import { ChroniclerEngine } from '../services/chroniclerEngine'

// ── Batch composition ────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard'

const BATCH: Difficulty[] = [
  'easy', 'easy',
  'medium', 'medium', 'medium',
  'hard', 'hard', 'hard', 'hard', 'hard',
]

const DELAY_MS   = 2_000   // claude-3-5-haiku: generous rate limits — 2s between slots
const OUTPUT_PATH = path.resolve(__dirname, '../data/generated_events.json')

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pad(n: number, total: number): string {
  return `${n}`.padStart(String(total).length, ' ')
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log(  '║          ChronoQuizzr — Chronicler Batch Generator       ║')
  console.log(  '╚══════════════════════════════════════════════════════════╝\n')

  // Validate API key before spending any time on generation
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('✗  ANTHROPIC_API_KEY is not set in server/.env — aborting.')
    process.exit(1)
  }

  const provider = new AnthropicProvider(apiKey)
  const engine   = new ChroniclerEngine(provider)

  const results: HistoricalEvent[] = []
  const failures: Array<{ slot: number; difficulty: Difficulty; error: string }> = []

  const total = BATCH.length
  console.log(`  Generating ${total} events (2 easy · 3 medium · 5 hard)`)
  console.log(`  Rate limit delay: ${DELAY_MS}ms between calls\n`)

  for (let i = 0; i < BATCH.length; i++) {
    const difficulty = BATCH[i]
    const slot = i + 1
    const label = `[${pad(slot, total)}/${total}]  ${difficulty.padEnd(6)}`

    process.stdout.write(`  ${label}  generating …`)

    try {
      const event = await engine.generateVerifiedEvent(difficulty, results)
      results.push(event)
      process.stdout.write(`\r  ${label}  ✓  id="${event.id}"  year=${event.year}\n`)
    } catch (err) {
      if (err instanceof FatalProviderError) {
        process.stdout.write(`\r  ${label}  ✗  FATAL (HTTP ${err.statusCode})\n`)
        console.error(`\n✗  Fatal API error — aborting batch: ${err.message}\n`)
        break
      }
      // Unexpected runtime error — log and continue to next slot
      const msg = err instanceof Error ? err.message : String(err)
      failures.push({ slot, difficulty, error: msg })
      process.stdout.write(`\r  ${label}  ✗  ERROR: ${msg}\n`)
    }

    // Delay between every call except the last
    if (i < BATCH.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  // ── Write output ───────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────────────────────')

  if (results.length === 0) {
    console.error('\n✗  No events generated — output file not written.\n')
    process.exit(1)
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8')

  // ── Summary ────────────────────────────────────────────────────────────────
  const easy   = results.filter((e) => e.difficulty === 'easy').length
  const medium = results.filter((e) => e.difficulty === 'medium').length
  const hard   = results.filter((e) => e.difficulty === 'hard').length

  console.log(`\n  ✓  Written ${results.length} event(s) to:`)
  console.log(`     ${OUTPUT_PATH}`)
  console.log(`\n  Breakdown: ${easy} easy · ${medium} medium · ${hard} hard`)

  if (failures.length > 0) {
    console.warn(`\n  ⚠  ${failures.length} slot(s) failed (unexpected errors):`)
    failures.forEach(({ slot, difficulty: d, error }) => {
      console.warn(`     Slot ${slot} (${d}): ${error}`)
    })
  }

  console.log('\n  Trace log: server/logs/llm_trace.log')
  console.log('──────────────────────────────────────────────────────────────\n')
}

main().catch((err) => {
  console.error('\n✗  Unhandled error in batch generator:', err)
  process.exit(1)
})
