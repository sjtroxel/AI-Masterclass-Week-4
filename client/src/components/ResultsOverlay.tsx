import type { GameEvent, GuessResult } from '@shared/types'

// ─── Chronicler audit note ────────────────────────────────────────────────────
// This component renders ONLY after POST /api/game/guess has resolved.
// `result.trueCoords` is already in client state at this point (Rule 04 cleared).
// `event.locationName` and `event.source_url` are fields of GameEvent
// (Omit<HistoricalEvent, 'hiddenCoords'>) — both are safe to display post-guess.
// The Chronicler requires source_url to be prominent and historically framed.
// ─────────────────────────────────────────────────────────────────────────────

interface ResultsOverlayProps {
  result: GuessResult
  event: GameEvent
  /** 1-indexed round number for display. */
  round: number
  totalRounds: number
  /** Running cumulative score including this round. */
  totalScore: number
  onNext: () => void
}

export function ResultsOverlay({
  result,
  event,
  round,
  totalRounds,
  totalScore,
  onNext,
}: ResultsOverlayProps) {
  const isFinalRound = round >= totalRounds

  return (
    // ── Cartographer ────────────────────────────────────────────────────────
    // fixed + z-[1000]: Leaflet's highest internal layer (popups) reaches ~700.
    // This overlay must sit above ALL Leaflet chrome on every browser/platform.
    //
    // items-end   → bottom sheet on mobile  (thumb-reachable, no map conflict)
    // md:items-center → centered modal on tablet/desktop
    // p-4 gives safe-area breathing room on notched phones.
    // ────────────────────────────────────────────────────────────────────────
    <div className="fixed inset-0 z-[1000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4">

      <div className="
        bg-bg-panel border border-trim rounded
        w-full max-w-sm
        flex flex-col gap-5
        p-6
        shadow-[0_8px_40px_rgba(0,0,0,0.7)]
      ">

        {/* Round indicator */}
        <p className="font-ui text-text-muted text-xs tracking-widest uppercase">
          Round {round} of {totalRounds}
        </p>

        {/* Score */}
        <div className="flex flex-col gap-1">
          <p className="font-clue text-text-primary text-5xl font-bold leading-none">
            {result.score.toLocaleString()}
            <span className="font-ui text-text-muted text-base font-normal ml-2">pts</span>
          </p>
          <p className="font-ui text-text-muted text-sm">
            {result.distance} km from the true location
          </p>
        </div>

        <hr className="border-trim-muted" />

        {/* ── Chronicler ──────────────────────────────────────────────────────
            Location reveal: safe to show after guess is scored.
            Source link: left-bordered pull-quote styled in the parchment
            palette — visually prominent without breaking the dark aesthetic.
            `bg-bg-surface` + `border-l-2 border-accent` creates a "reference
            card" look appropriate to the historical theme.
        ─────────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">

          <div>
            <p className="font-ui text-text-dim text-xs tracking-widest uppercase mb-1">
              Location
            </p>
            <p className="font-clue text-text-primary text-lg leading-snug">
              {event.locationName}
            </p>
          </div>

          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="
              block
              border-l-2 border-accent
              pl-3 py-1.5
              bg-bg-surface rounded-r
              font-ui text-accent hover:text-accent-hover text-sm
              underline underline-offset-2 decoration-accent-dim hover:decoration-accent
              transition-colors duration-150
            "
          >
            Historical source ↗
          </a>

        </div>

        <hr className="border-trim-muted" />

        {/* Running total */}
        <div className="flex flex-col gap-0.5">
          <p className="font-ui text-text-dim text-xs tracking-widest uppercase">
            Running total
          </p>
          <p className="font-ui text-text-primary text-sm font-semibold">
            {totalScore.toLocaleString()} / 25,000 pts
          </p>
        </div>

        {/* ── Cartographer ────────────────────────────────────────────────────
            Full-width button at the bottom of the card — sits in the thumb-
            reachable zone on mobile (bottom half of the bottom sheet).
        ─────────────────────────────────────────────────────────────────────── */}
        <button
          onClick={onNext}
          className="
            w-full py-3 px-6
            font-ui text-sm tracking-widest uppercase
            rounded border border-trim
            bg-accent text-bg-base
            hover:bg-accent-hover hover:border-accent
            transition-all duration-200
            cursor-pointer
          "
        >
          {isFinalRound ? 'Final Score →' : 'Next Round →'}
        </button>

      </div>
    </div>
  )
}
