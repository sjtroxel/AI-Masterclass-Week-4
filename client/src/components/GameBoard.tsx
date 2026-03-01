import { useState, useEffect } from 'react'
import type { GameEvent, Guess, GuessResult } from '@shared/types'
import { MapView } from './MapView'
import { CluePanel } from './CluePanel'
import { ResultsOverlay } from './ResultsOverlay'
import { FinalScoreScreen } from './FinalScoreScreen'
import Logo from './Logo'

// ─── Chronicler audit note ────────────────────────────────────────────────────
// All coordinate privacy rules enforced here:
//
// 1. `session: GameEvent[]` — the server returns Omit<HistoricalEvent,'hiddenCoords'>.
//    There is no path by which hiddenCoords can reach this array.
//
// 2. `guessCoords` — the player's own pin position. Not event data.
//
// 3. `roundResult: GuessResult | null` — initialised to null and only ever set
//    by calling `setRoundResult(result)` inside the POST /api/game/guess
//    response handler. `trueCoords` therefore cannot exist in client state until
//    the server has already scored the guess and chosen to reveal it.
//    This satisfies Rule 04 (coordinate privacy).
// ─────────────────────────────────────────────────────────────────────────────

// Dev API base — the Express server runs on :3001 in development.
// Override via VITE_API_URL env variable for other environments.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type GamePhase = 'loading' | 'playing' | 'submitting' | 'result' | 'finished' | 'error'

/** Shared button style — mirrors the Submit button in CluePanel. */
const btnClass = `
  py-3 px-6
  font-ui text-sm tracking-widest uppercase
  rounded border border-trim
  bg-accent text-bg-base
  hover:bg-accent-hover hover:border-accent
  transition-all duration-200
  cursor-pointer
`

/**
 * Root game orchestrator. Owns all game state and coordinates the
 * MapView ↔ CluePanel ↔ backend interaction for all 5 rounds.
 *
 * State ownership:
 *   `session`     — 5 GameEvent objects fetched once per game
 *   `currentRound` — 0-indexed round counter (0–4)
 *   `totalScore`  — running sum of round scores
 *   `guessCoords` — player's current pin; passed as controlled prop to MapView;
 *                   cleared to null on every round transition
 *   `roundResult` — null until the POST /api/game/guess response arrives
 *   `gamePhase`   — drives what the UI renders
 */
export function GameBoard() {
  const [session, setSession] = useState<GameEvent[]>([])
  const [currentRound, setCurrentRound] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [guessCoords, setGuessCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [roundResult, setRoundResult] = useState<GuessResult | null>(null)
  const [gamePhase, setGamePhase] = useState<GamePhase>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Per-round history for FinalScoreScreen breakdown table.
  // Appended inside handleNextRound() before any phase transition so that
  // round 5's entry is captured even when transitioning directly to 'finished'.
  const [roundHistory, setRoundHistory] = useState<Array<{ score: number; distance: number }>>([])
  // Shown inline in CluePanel when the POST /api/game/guess request fails.
  // Cleared on the next submission attempt and on round transitions.
  // Does NOT trigger gamePhase='error' — the round stays live so the player
  // can retry with the same pin without losing their progress.
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Incrementing fetchKey re-triggers the session load effect (used by Play Again / retry).
  const [fetchKey, setFetchKey] = useState(0)

  // ── Session fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function loadSession() {
      setGamePhase('loading')
      try {
        const res = await fetch(`${API_BASE}/api/game/start`)
        if (!res.ok) throw new Error(`Server responded ${res.status}`)
        const data = await res.json() as GameEvent[]
        if (!cancelled) {
          setSession(data)
          setCurrentRound(0)
          setTotalScore(0)
          setGuessCoords(null)
          setRoundResult(null)
          setRoundHistory([])
          setGamePhase('playing')
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load game.')
          setGamePhase('error')
        }
      }
    }

    void loadSession()
    return () => { cancelled = true }
  }, [fetchKey])

  // ── Derived state ────────────────────────────────────────────────────────
  const currentEvent: GameEvent | null = session[currentRound] ?? null

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handlePinDrop(lat: number, lng: number) {
    setGuessCoords({ lat, lng })
  }

  function handleSubmit() {
    void submitGuess()
  }

  async function submitGuess() {
    if (currentEvent === null || guessCoords === null) return
    setSubmitError(null)   // clear any previous inline error before each attempt
    setGamePhase('submitting')

    const body: Guess = {
      eventId: currentEvent.id,
      lat: guessCoords.lat,
      lng: guessCoords.lng,
    }

    try {
      const res = await fetch(`${API_BASE}/api/game/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Server responded ${res.status}`)
      const result = await res.json() as GuessResult

      // Chronicler: trueCoords enters state here — only after the server has
      // scored the guess and chosen to reveal the true location.
      setRoundResult(result)
      setTotalScore((prev) => prev + result.score)
      setGamePhase('result')
    } catch (err) {
      // Stay in 'playing' — the pin is preserved and the button re-enables.
      // Surface the failure inline in CluePanel rather than blowing away the
      // game screen. gamePhase='error' is reserved for session fetch failures.
      const message = err instanceof Error ? err.message : 'Submission failed.'
      setSubmitError(`Connection error — ${message}. Please try again.`)
      setGamePhase('playing')
    }
  }

  function handleNextRound() {
    // Append this round's result to history BEFORE any phase transition.
    // This guarantees round 5's entry is captured when isFinalRound is true
    // and we transition directly to 'finished' without another render cycle.
    if (roundResult !== null) {
      setRoundHistory((prev) => [...prev, { score: roundResult.score, distance: roundResult.distance }])
    }

    if (currentRound >= session.length - 1) {
      setGamePhase('finished')
      return
    }
    setCurrentRound((r) => r + 1)
    setGuessCoords(null)   // clears the MapView pin (controlled prop)
    setRoundResult(null)
    setSubmitError(null)
    setGamePhase('playing')
  }

  function handlePlayAgain() {
    setFetchKey((k) => k + 1)  // re-triggers the session fetch effect
  }

  function handleRetry() {
    setErrorMessage(null)
    setFetchKey((k) => k + 1)
  }

  // ── Render: loading ───────────────────────────────────────────────────────
  if (gamePhase === 'loading') {
    return (
      <div className="relative h-full flex flex-col items-center justify-center bg-bg-base gap-3">
        <Logo className="absolute opacity-10 scale-150 animate-pulse grayscale w-64 h-64 pointer-events-none" />
        <p className="font-clue text-text-primary text-lg animate-pulse">
          The Chronicler is consulting the archives…
        </p>
        <p className="font-ui text-text-muted text-xs tracking-widest uppercase">
          Preparing 5 historical puzzles
        </p>
      </div>
    )
  }

  // ── Render: error ─────────────────────────────────────────────────────────
  if (gamePhase === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-bg-base gap-5 p-8">
        <p className="font-ui text-red-400 text-sm text-center">
          {errorMessage ?? 'Something went wrong.'}
        </p>
        <button onClick={handleRetry} className={btnClass}>
          Try Again
        </button>
      </div>
    )
  }

  // ── Render: finished ──────────────────────────────────────────────────────
  if (gamePhase === 'finished') {
    return (
      <FinalScoreScreen
        totalScore={totalScore}
        roundHistory={roundHistory}
        onPlayAgain={handlePlayAgain}
      />
    )
  }

  // ── Render: playing / submitting / result ─────────────────────────────────
  return (
    <div className="relative h-full flex flex-col md:flex-row overflow-hidden">

      {/* Map — fills remaining space; controlled pin via guessCoords.
          revealCoords is null during play, set to trueCoords after scoring. */}
      <div className="flex-1 min-h-0">
        <MapView
          onPinDrop={handlePinDrop}
          pinCoords={guessCoords}
          revealCoords={roundResult?.trueCoords ?? null}
        />
      </div>

      {/* CluePanel column — desktop: fixed-width right column (md:w-80).
          Mobile: CluePanel uses fixed bottom positioning internally; this
          wrapper has no layout effect on mobile. */}
      <div className="md:w-80 lg:w-96 md:shrink-0 md:h-full md:overflow-y-auto">
        {currentEvent !== null && (
          <CluePanel
            event={currentEvent}
            hasPin={guessCoords !== null}
            onSubmit={handleSubmit}
            isSubmitting={gamePhase === 'submitting'}
            submitError={submitError}
          />
        )}
      </div>

      {/* ── ResultsOverlay ──────────────────────────────────────────────────
          Rendered after a guess is scored. Uses fixed z-[1000] internally
          so it sits above all Leaflet layers regardless of this stacking context.
          currentEvent is guaranteed non-null when gamePhase === 'result'.
      ─────────────────────────────────────────────────────────────────────── */}
      {gamePhase === 'result' && roundResult !== null && currentEvent !== null && (
        <ResultsOverlay
          result={roundResult}
          event={currentEvent}
          round={currentRound + 1}
          totalRounds={session.length}
          totalScore={totalScore}
          onNext={handleNextRound}
        />
      )}
    </div>
  )
}
