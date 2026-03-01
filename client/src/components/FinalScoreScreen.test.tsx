import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FinalScoreScreen } from './FinalScoreScreen'

// ── Fixtures ───────────────────────────────────────────────────────────────────
// 5 rounds, scores sum to 500 — a value < 1000 so toLocaleString() renders
// identically across all locales (no thousands separator ambiguity).

const roundHistory = [
  { score: 150, distance: 1200 },
  { score: 120, distance: 1800 },
  { score: 100, distance: 2400 },
  { score: 80,  distance: 3600 },
  { score: 50,  distance: 5000 },
]

const totalScore = 500 // must equal sum of roundHistory scores

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('FinalScoreScreen', () => {
  it('renders the "Round Logbook" heading', () => {
    render(
      <FinalScoreScreen
        totalScore={totalScore}
        roundHistory={roundHistory}
        onPlayAgain={vi.fn()}
      />
    )
    expect(screen.getByText(/round logbook/i)).toBeTruthy()
  })

  it('renders one <tr> per round in the logbook tbody', () => {
    const { container } = render(
      <FinalScoreScreen
        totalScore={totalScore}
        roundHistory={roundHistory}
        onPlayAgain={vi.fn()}
      />
    )
    const tbody = container.querySelector('tbody')
    expect(tbody).not.toBeNull()
    const rows = tbody!.querySelectorAll('tr')
    expect(rows.length).toBe(roundHistory.length)
  })

  it('renders the total score in the card header', () => {
    render(
      <FinalScoreScreen
        totalScore={totalScore}
        roundHistory={roundHistory}
        onPlayAgain={vi.fn()}
      />
    )
    // The component renders totalScore twice (header + tfoot) via toLocaleString().
    // getAllByText handles both occurrences without throwing.
    const scoreEls = screen.getAllByText(totalScore.toLocaleString())
    expect(scoreEls.length).toBeGreaterThanOrEqual(2)
  })

  it('renders the Play Again button', () => {
    render(
      <FinalScoreScreen
        totalScore={totalScore}
        roundHistory={roundHistory}
        onPlayAgain={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /play again/i })).toBeTruthy()
  })

  it('clicking Play Again calls onPlayAgain', () => {
    const onPlayAgain = vi.fn()
    render(
      <FinalScoreScreen
        totalScore={totalScore}
        roundHistory={roundHistory}
        onPlayAgain={onPlayAgain}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(onPlayAgain).toHaveBeenCalledTimes(1)
  })
})
