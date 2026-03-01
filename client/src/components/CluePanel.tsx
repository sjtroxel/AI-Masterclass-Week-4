import { useState } from 'react'
import type { GameEvent } from '@shared/types'
import { useTheme } from '../context/ThemeContext'

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
  /** Set by GameBoard when the POST /api/game/guess request fails. Cleared on
   *  the next attempt. Shown inline so the player can retry without losing
   *  their pin or round progress. */
  submitError?: string | null
}

/** Formats a year number for human display, handling BCE dates correctly. */
function formatYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BCE` : String(year)
}

/**
 * Difficulty badge styles — two sets so both themes remain legible.
 *
 * Dark "Inky Night": 400-level pastels read well on the dark panel.
 * Light "Aged Map":  400-level pastels wash out on cream; 700-level dark
 *                    ink variants restore contrast against parchment.
 *
 * Plain objects (not template strings) keep all class names statically
 * detectable by Tailwind's scanner at build time.
 */
const difficultyStylesDark: Record<GameEvent['difficulty'], string> = {
  easy:   'border-emerald-700/60 text-emerald-400',
  medium: 'border-amber-600/60   text-amber-400',
  hard:   'border-red-800/60     text-red-400',
}

const difficultyStylesLight: Record<GameEvent['difficulty'], string> = {
  easy:   'border-emerald-600/70 text-emerald-700',
  medium: 'border-amber-500/70   text-amber-700',
  hard:   'border-red-700/70     text-red-700',
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
  submitError = null,
}: CluePanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { theme } = useTheme()
  const difficultyStyles = theme === 'light' ? difficultyStylesLight : difficultyStylesDark

  const canSubmit = hasPin && !isSubmitting

  return (
    <div className="
      fixed bottom-0 left-0 right-0 z-10
      md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto md:h-full
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
          <span className="font-clue text-xl text-text-primary font-bold">
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
              <span className="font-clue text-2xl text-text-primary font-bold">
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

            {/* Submit button
                Two distinct disabled states:
                  · No pin yet     → disabled:opacity-40  (faded — clearly unavailable)
                  · In-flight POST → disabled:opacity-100 (full opacity — communicates work)
                The spinner is a pure-CSS border animation; border-current inherits the
                button's text-bg-base colour so it works in both themes automatically. */}
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className={`
                w-full py-3.5 px-8 mt-1
                font-ui text-sm tracking-widest uppercase
                rounded border
                transition-all duration-200
                bg-accent border-trim text-bg-base
                hover:bg-accent-hover hover:border-accent
                ${isSubmitting
                  ? 'disabled:opacity-100 cursor-wait'
                  : 'disabled:opacity-40 disabled:cursor-not-allowed'
                }
              `}
            >
              <span className="flex items-center justify-center gap-2">
                {isSubmitting && (
                  <span
                    aria-hidden="true"
                    className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"
                  />
                )}
                {isSubmitting ? 'Scoring…' : 'Submit Guess'}
              </span>
            </button>

            {/* Inline submit error — stays in 'playing' phase so the player
                can retry with their existing pin. Shown above the nudge
                text so layout doesn't shift when both are absent. */}
            {submitError !== null && (
              <p className="text-center font-ui text-xs text-red-400 tracking-wide">
                {submitError}
              </p>
            )}

            {/* Pin-drop nudge — appears only when no pin and no error */}
            {!hasPin && !isSubmitting && submitError === null && (
              <p className="text-center font-ui text-xs text-text-muted tracking-wide">
                Drop a pin on the map to enable submission
              </p>
            )}

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-trim-muted">
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
        </div>
      </div>
    </div>
  )
}
