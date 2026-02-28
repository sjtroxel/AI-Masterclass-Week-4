import { useState } from 'react'
import type { GameEvent } from '@shared/types'

// ─── Chronicler note ──────────────────────────────────────────────────────────
// GameEvent also carries `locationName` and `source_url`. Neither is rendered
// here — displaying either would trivially reveal the event location to the
// player before they have guessed. Only `clue`, `year`, and `difficulty` are
// shown. Rule 04 (coordinate privacy) is not implicated by this component, but
// the Chronicler's obfuscation contract applies to everything the player can
// read before submitting.
// ─────────────────────────────────────────────────────────────────────────────

export interface CluePanelProps {
  /** The current round's event — coordinates and location name already stripped by the server. */
  event: GameEvent
  /** True once the player has dropped a pin on the map. Enables the Submit button. */
  hasPin: boolean
  /** Called when the player confirms their guess. */
  onSubmit: () => void
  /** True while the POST /api/game/guess request is in-flight. */
  isSubmitting?: boolean
}

/** Formats a year number for human display, handling BCE dates correctly. */
function formatYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BCE` : String(year)
}

/**
 * Static difficulty badge styles.
 * Defined as a plain object (not template strings) so Tailwind's scanner
 * can detect all class names at build time.
 */
const difficultyStyles: Record<GameEvent['difficulty'], string> = {
  easy:   'border-emerald-700/60 text-emerald-400',
  medium: 'border-amber-600/60   text-amber-400',
  hard:   'border-red-800/60     text-red-400',
}

/**
 * Historical clue panel with mobile-first bottom-drawer behaviour.
 *
 * Mobile (< md):
 *   Fixed to the bottom of the viewport. A tap on the header strip toggles
 *   the drawer open/closed. The full clue and Submit button are only visible
 *   when open. The year and difficulty badge are always visible in the strip
 *   so the player knows which round they are on even when collapsed.
 *
 * Desktop (≥ md):
 *   Positioned normally in the layout (GameBoard supplies the column/row).
 *   The toggle button is hidden; the panel body is always expanded.
 */
export function CluePanel({
  event,
  hasPin,
  onSubmit,
  isSubmitting = false,
}: CluePanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  const canSubmit = hasPin && !isSubmitting

  return (
    <div className="
      fixed bottom-0 left-0 right-0 z-10
      md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto
      bg-bg-panel
      border-t-2 border-trim md:border-t-0 md:border-l-2
      flex flex-col
      shadow-[0_-4px_24px_rgba(0,0,0,0.5)] md:shadow-none
    ">

      {/* ── Mobile drawer handle ─────────────────────────────────────────────
          Visible only on mobile. Tapping it toggles the panel body.
          Always shows the year and difficulty badge so the player has context
          even when the drawer is collapsed.
      ──────────────────────────────────────────────────────────────────────── */}
      <button
        className="
          md:hidden
          flex items-center justify-between
          w-full px-5 py-3.5
          text-text-muted hover:text-text-primary
          transition-colors duration-150
          select-none
        "
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Collapse clue panel' : 'Expand clue panel'}
      >
        <div className="flex items-center gap-3">
          <span className="font-ui text-xs tracking-widest uppercase">
            {formatYear(event.year)}
          </span>
          <span
            className={`
              font-ui text-xs tracking-widest uppercase
              border rounded px-1.5 py-0.5
              ${difficultyStyles[event.difficulty]}
            `}
          >
            {event.difficulty}
          </span>
        </div>

        {/* Chevron — rotates 180° when open */}
        <svg
          className={`w-5 h-5 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* ── Panel body ────────────────────────────────────────────────────────
          On mobile: animates open/closed via grid-template-rows transition.
          The grid-rows-[0fr]/[1fr] technique gives a smooth height animation
          without needing a fixed max-height value.
          On md+: always expanded (md:grid-rows-[1fr] overrides mobile state).
      ──────────────────────────────────────────────────────────────────────── */}
      <div
        className={`
          grid transition-[grid-template-rows] duration-300 ease-in-out
          ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
          md:grid-rows-[1fr]
        `}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-5 pb-6 pt-3 md:pt-6 flex flex-col gap-5">

            {/* Year + difficulty — desktop only (mobile shows these in the handle) */}
            <div className="hidden md:flex items-center justify-between">
              <span className="font-ui text-xs tracking-widest uppercase text-text-muted">
                {formatYear(event.year)}
              </span>
              <span
                className={`
                  font-ui text-xs tracking-widest uppercase
                  border rounded px-1.5 py-0.5
                  ${difficultyStyles[event.difficulty]}
                `}
              >
                {event.difficulty}
              </span>
            </div>

            {/* Decorative rule — desktop only */}
            <hr className="hidden md:block border-trim-muted" />

            {/* Clue text — the heart of the panel */}
            <p className="font-clue text-text-primary text-base leading-relaxed md:text-lg md:leading-loose">
              {event.clue}
            </p>

            {/* Submit button */}
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="
                w-full py-3.5 px-8 mt-1
                font-ui text-sm tracking-widest uppercase
                rounded border
                transition-all duration-200
                bg-accent border-trim text-bg-base
                hover:bg-accent-hover hover:border-accent
                disabled:bg-accent-dim disabled:border-trim-muted
                disabled:text-text-dim disabled:cursor-not-allowed
              "
            >
              {isSubmitting ? 'Scoring…' : 'Submit Guess'}
            </button>

            {/* Pin-drop nudge — appears only when no pin has been placed yet */}
            {!hasPin && !isSubmitting && (
              <p className="text-center font-ui text-xs text-text-muted tracking-wide">
                Drop a pin on the map to enable submission
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
