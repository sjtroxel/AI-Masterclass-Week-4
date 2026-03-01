import { vi } from 'vitest'
import '@testing-library/jest-dom'
import 'vitest-canvas-mock'

/**
 * Mock window.matchMedia — jsdom does not implement this API.
 * ThemeContext uses it to detect the user's OS color-scheme preference.
 * The mock returns `matches: false` so tests default to dark theme
 * unless overridden explicitly.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
