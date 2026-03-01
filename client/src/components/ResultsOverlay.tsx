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

        {/* Footer */}
        <p className="font-ui text-xs text-text-dim text-center flex items-center justify-center gap-1.5">
          <span>© 2026 sjtroxel</span>
          <a
            href="https://github.com/sjtroxel/AI-Masterclass-Week-4/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            className="inline-flex items-center text-text-dim hover:text-accent transition-colors duration-150"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
          <span>. All rights reserved.</span>
        </p>

      </div>
    </div>
  )
}
