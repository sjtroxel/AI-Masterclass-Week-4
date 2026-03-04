import Logo from './Logo'

function getGrade(score: number): string {
  if (score >= 24950) return 'Super Seismic Champion'
  if (score >= 24500) return 'The Omniscient Chronicler'
  if (score >= 24000) return 'Grand Cartographer'
  if (score >= 23000) return 'Master Navigator'
  if (score >= 22000) return 'Royal Geographer'
  if (score >= 20000) return 'Seasoned Explorer'
  if (score >= 18000) return 'Veteran Historian'
  if (score >= 15000) return 'Accomplished Scholar'
  if (score >= 10000) return 'Apprentice Archivist'
  if (score >= 5000)  return 'Wandering Scribe'
  if (score >= 1000)  return 'Lost Traveller'
  return 'Bewildered Stupid Tourist'
}

// ─── Chronicler audit note ────────────────────────────────────────────────────
// This component receives only scores and distances — no coordinates, no event
// ids. All data here is post-guess and fully safe to display. The "Round
// Logbook" framing is intentional: it echoes the historical ledger aesthetic
// of the Parchment & Inky theme.
// ─────────────────────────────────────────────────────────────────────────────

interface RoundEntry {
  score: number
  distance: number
  locationName: string
}

interface FinalScoreScreenProps {
  totalScore: number
  roundHistory: RoundEntry[]
  onPlayAgain: () => void
}

export function FinalScoreScreen({ totalScore, roundHistory, onPlayAgain }: FinalScoreScreenProps) {
  return (
    // ── Cartographer ──────────────────────────────────────────────────────────
    // h-full fills the #root container (set to height: 100% in @layer base).
    // overflow-y-auto guards against very small viewports, though 5 ledger
    // rows + header fit comfortably on any modern phone screen.
    // ─────────────────────────────────────────────────────────────────────────
    <div className="relative h-full flex flex-col items-center justify-center bg-bg-base p-6 overflow-y-auto">
      <Logo className="absolute opacity-5 w-160 h-160 pointer-events-none" />

      <div className="
        bg-bg-panel border border-trim rounded
        w-full max-w-md
        flex flex-col gap-6
        p-6
        shadow-[0_8px_40px_rgba(0,0,0,0.6)]
      ">

        {/* ── Score header ────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="font-ui text-text-muted text-xs tracking-widest uppercase">
            Game Complete
          </p>
          <p className="font-clue text-text-primary text-6xl font-bold leading-none">
            {totalScore.toLocaleString()}
          </p>
          <p className="font-ui text-accent text-sm tracking-widest uppercase">
            {getGrade(totalScore)}
          </p>
          <p className="font-ui text-text-muted text-sm">
            out of 25,000 points
          </p>
        </div>

        <hr className="border-trim-muted" />

        {/* ── Chronicler: Round Logbook ────────────────────────────────────────
            Semantic <table> keeps column widths stable across all 5 rows.
            `border-collapse` removes default cell spacing for a tighter ledger.
            Alternating bg-bg-surface stripes on even rows (0-indexed) reinforce
            the ledger metaphor. Right-aligned numeric columns follow standard
            accounting convention.
        ─────────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">

          <p className="font-ui text-text-dim text-xs tracking-widest uppercase">
            Round Logbook
          </p>

          <table className="w-full text-sm font-ui border-collapse">
            <thead>
              <tr className="border-b border-trim">
                <th className="text-left  text-text-dim text-xs tracking-widest uppercase pb-2 font-normal">
                  Round
                </th>
                <th className="text-right text-text-dim text-xs tracking-widest uppercase pb-2 font-normal">
                  Distance
                </th>
                <th className="text-right text-text-dim text-xs tracking-widest uppercase pb-2 font-normal">
                  Score
                </th>
              </tr>
            </thead>

            <tbody>
              {roundHistory.map((entry, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-bg-surface' : ''}>
                  <td className="py-2 pl-2 text-text-muted">
                    <span className="block">Round {i + 1}</span>
                    <span className="block text-xs text-text-dim truncate max-w-36">
                      {entry.locationName}
                    </span>
                  </td>
                  <td className="py-2 text-right text-text-muted">
                    {entry.distance} km
                  </td>
                  <td className="py-2 pr-2 text-right text-text-primary font-semibold">
                    {entry.score.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* tfoot: amber rule + bold total — acts as the sum line */}
            <tfoot>
              <tr className="border-t border-trim">
                <td
                  colSpan={2}
                  className="pt-3 pl-2 text-text-dim text-xs tracking-widest uppercase"
                >
                  Total
                </td>
                <td className="pt-3 pr-2 text-right font-clue text-text-primary text-2xl font-bold">
                  {totalScore.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>

        </div>

        <hr className="border-trim-muted" />

        {/* ── Cartographer: Play Again ─────────────────────────────────────────
            bg-accent-hover (#ddb84f) as the resting state — brightest gold in
            the palette, visually distinct from every other button in the app
            which uses bg-accent (#c9993a). border-2 + py-4 make it taller and
            bolder so the player immediately knows this is the primary CTA.
            hover:bg-accent slightly dims on hover (natural "press" feedback).
        ─────────────────────────────────────────────────────────────────────── */}
        <button
          onClick={onPlayAgain}
          className="
            w-full py-4 px-6
            font-ui text-base tracking-widest uppercase font-semibold
            rounded border-2 border-accent
            bg-accent-hover text-bg-base
            hover:bg-accent hover:border-trim
            transition-all duration-200
            cursor-pointer
          "
        >
          Play Again
        </button>

        {/* Footer */}
        <p className="font-ui text-xs text-text-dim text-center flex items-center justify-center gap-1.5">
          <span>© 2026 sjtroxel.</span>
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
          <span> All rights reserved.</span>
        </p>

      </div>
    </div>
  )
}
