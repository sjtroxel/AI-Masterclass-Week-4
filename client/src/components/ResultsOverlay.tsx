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
    // No full-screen backdrop — the map must stay fully visible so the player
    // can see the two pins and the distance line after scoring.
    //
    // Mobile:  fixed bottom sheet (max-h-[52vh], scrollable) — map visible above.
    // Desktop: fixed right-side panel matching the CluePanel column width — map
    //          fills the remaining left space with both markers in view.
    //
    // z-[1000] sits above all Leaflet chrome (popups ~700) on both layouts.
    // MapView auto-zooms to fit both pins when revealCoords is set.
    // ────────────────────────────────────────────────────────────────────────
    <div className="
      fixed bottom-0 inset-x-0 z-1000
      md:top-0 md:right-0 md:left-auto md:w-80 lg:w-96
      max-h-[52vh] md:max-h-none md:h-full
      overflow-y-auto
      bg-bg-panel
      border-t border-trim md:border-t-0 md:border-l
      shadow-[0_-4px_32px_rgba(0,0,0,0.65)] md:shadow-[-4px_0_32px_rgba(0,0,0,0.5)]
    ">

      <div className="
        flex flex-col gap-5
        p-6
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
