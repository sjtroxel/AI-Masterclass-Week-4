import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ThemeProvider } from '../context/ThemeContext'
import { CluePanel } from './CluePanel'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const testEvent = {
  id: 'test-clue-event',
  year: 1989,
  locationName: 'Test Location, Test Country',
  clue: 'On a November night, jubilant crowds dismantled a concrete barrier that had divided a once-great central European capital for nearly three decades.',
  difficulty: 'medium' as const,
  source_url: 'https://en.wikipedia.org/wiki/Test',
}

// ── Wrapper ───────────────────────────────────────────────────────────────────
// CluePanel calls useTheme() so it must be rendered inside ThemeProvider.

function withTheme(ui: ReactNode) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('theme-light')
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CluePanel', () => {
  it('renders the clue text', () => {
    withTheme(<CluePanel event={testEvent} hasPin={false} onSubmit={vi.fn()} />)
    expect(screen.getByText(testEvent.clue)).toBeTruthy()
  })

  it('renders the formatted year', () => {
    withTheme(<CluePanel event={testEvent} hasPin={false} onSubmit={vi.fn()} />)
    // Year appears in both the mobile handle and the hidden desktop header —
    // getAllByText handles the duplicate without throwing.
    const yearEls = screen.getAllByText('1989')
    expect(yearEls.length).toBeGreaterThan(0)
  })

  it('renders the difficulty badge', () => {
    withTheme(<CluePanel event={testEvent} hasPin={false} onSubmit={vi.fn()} />)
    const badges = screen.getAllByText('medium')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('Submit button is disabled when hasPin is false', () => {
    withTheme(<CluePanel event={testEvent} hasPin={false} onSubmit={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /submit guess/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('Submit button is enabled when hasPin is true', () => {
    withTheme(<CluePanel event={testEvent} hasPin={true} onSubmit={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /submit guess/i })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('clicking Submit calls onSubmit when hasPin is true', () => {
    const onSubmit = vi.fn()
    withTheme(<CluePanel event={testEvent} hasPin={true} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: /submit guess/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('shows spinner and "Scoring…" text when isSubmitting is true', () => {
    withTheme(
      <CluePanel event={testEvent} hasPin={true} onSubmit={vi.fn()} isSubmitting={true} />
    )
    // Button accessible name changes to "Scoring…" (spinner is aria-hidden)
    expect(screen.getByRole('button', { name: /scoring/i })).toBeTruthy()
    // The animated spinner element is present in the DOM
    expect(document.querySelector('.animate-spin')).not.toBeNull()
  })

  it('renders submitError inline when provided', () => {
    withTheme(
      <CluePanel
        event={testEvent}
        hasPin={true}
        onSubmit={vi.fn()}
        submitError="Network error — please try again."
      />
    )
    expect(screen.getByText('Network error — please try again.')).toBeTruthy()
  })

  it('formats BCE years correctly', () => {
    const bceEvent = { ...testEvent, year: -490 }
    withTheme(<CluePanel event={bceEvent} hasPin={false} onSubmit={vi.fn()} />)
    const bceEls = screen.getAllByText('490 BCE')
    expect(bceEls.length).toBeGreaterThan(0)
  })
})
