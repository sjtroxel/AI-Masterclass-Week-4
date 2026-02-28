// ─── Chronicler audit note ────────────────────────────────────────────────────
// This component receives only scores and distances — no coordinates, no event
// ids. All data here is post-guess and fully safe to display. The "Round
// Logbook" framing is intentional: it echoes the historical ledger aesthetic
// of the Parchment & Inky theme.
// ─────────────────────────────────────────────────────────────────────────────

interface RoundEntry {
  score: number
  distance: number
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
    <div className="h-full flex flex-col items-center justify-center bg-bg-base p-6 overflow-y-auto">

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
                    Round {i + 1}
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

      </div>
    </div>
  )
}
