import express from 'express'
import cors from 'cors'
import gameRouter from './routes/game'

/**
 * Express application instance.
 *
 * Exported separately from the server entry point so that integration tests
 * can import `app` and issue supertest requests without calling `app.listen()`.
 * The actual `listen()` call lives exclusively in `server/index.ts`.
 */
const allowedOrigins = [
  'http://localhost:5173',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
]

export const app = express()

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())
app.use('/api/game', gameRouter)
