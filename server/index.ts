import 'dotenv/config'
import { app } from './app'
import { eventPool } from './routes/game'
import { generateEvent } from './services/eventGenerator'

const PORT = parseInt(process.env.PORT ?? '3001', 10)

/**
 * Async server entry point.
 *
 * On startup, checks that the in-memory event pool has at least 5 events.
 * If not (e.g. the seed file is sparse during development), the EventGenerator
 * is called once per missing slot to bring the pool up to 5.
 *
 * Generated events are held in-memory for the session only and are not
 * written back to events.json.
 */
async function startServer(): Promise<void> {
  if (eventPool.length < 5) {
    const needed = 5 - eventPool.length
    console.log(`[Startup] events.json has ${eventPool.length} event(s) — generating ${needed} more via EventGenerator...`)
    const tiers: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard']
    for (let i = 0; i < needed; i++) {
      const generated = await generateEvent(tiers[i % tiers.length])
      eventPool.push(generated)
    }
    console.log(`[Startup] Event pool ready with ${eventPool.length} events.`)
  }

  app.listen(PORT, () => {
    console.log(`ChronoQuizzr Brain listening on http://localhost:${PORT}`)
  })
}

startServer()
