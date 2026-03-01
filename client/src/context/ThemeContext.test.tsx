import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, useTheme } from './ThemeContext'

// ── Helper component ──────────────────────────────────────────────────────────
// Surfaces the current theme value and a toggle button for testing.

function ThemeTestHarness() {
  const { theme, toggle } = useTheme()
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={toggle}>Toggle</button>
    </div>
  )
}

// ── Setup & teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  // Clear any theme preference saved by a previous test, and remove any class
  // that getInitialTheme() might have applied to the <html> element.
  localStorage.clear()
  document.documentElement.classList.remove('theme-light')
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ThemeContext', () => {
  it('default theme is dark when no localStorage preference and matchMedia returns false', () => {
    render(
      <ThemeProvider>
        <ThemeTestHarness />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme-value').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('theme-light')).toBe(false)
  })

  it('toggling once switches to light and adds theme-light class to <html>', () => {
    render(
      <ThemeProvider>
        <ThemeTestHarness />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }))

    expect(screen.getByTestId('theme-value').textContent).toBe('light')
    expect(document.documentElement.classList.contains('theme-light')).toBe(true)
  })

  it('toggling twice returns to dark and removes theme-light class from <html>', () => {
    render(
      <ThemeProvider>
        <ThemeTestHarness />
      </ThemeProvider>
    )

    const btn = screen.getByRole('button', { name: 'Toggle' })
    fireEvent.click(btn) // dark → light
    fireEvent.click(btn) // light → dark

    expect(screen.getByTestId('theme-value').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('theme-light')).toBe(false)
  })

  it('persists the chosen theme to localStorage under the cq-theme key', () => {
    render(
      <ThemeProvider>
        <ThemeTestHarness />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }))

    expect(localStorage.getItem('cq-theme')).toBe('light')
  })

  it('restores a saved light preference from localStorage on mount', () => {
    localStorage.setItem('cq-theme', 'light')

    render(
      <ThemeProvider>
        <ThemeTestHarness />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme-value').textContent).toBe('light')
    expect(document.documentElement.classList.contains('theme-light')).toBe(true)
  })
})
