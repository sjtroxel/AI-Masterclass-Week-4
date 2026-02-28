import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type Theme = 'dark' | 'light'

// ─── Initial theme resolution ─────────────────────────────────────────────────
// Priority:
//   1. localStorage('cq-theme')          — explicit saved preference
//   2. prefers-color-scheme: light       — OS / browser setting
//   3. 'dark'                            — default "Inky Night"
//
// The class is applied SYNCHRONOUSLY here (before React's first paint) to
// eliminate the flash-of-wrong-theme that would occur if we waited for the
// useEffect to run. The try/catch guards against localStorage being unavailable
// (e.g. private browsing with strict settings).
// ─────────────────────────────────────────────────────────────────────────────
function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('cq-theme')
    if (saved === 'dark' || saved === 'light') {
      if (saved === 'light') document.documentElement.classList.add('theme-light')
      return saved
    }
  } catch {
    // localStorage unavailable — fall through to media query
  }

  if (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.documentElement.classList.add('theme-light')
    return 'light'
  }

  return 'dark'
}

// ─────────────────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // useState with an initializer function — called once on mount, never again.
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  // Sync the <html> class and localStorage whenever theme changes.
  // First run is effectively a no-op because getInitialTheme already set the class.
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light')
    } else {
      document.documentElement.classList.remove('theme-light')
    }
    try {
      localStorage.setItem('cq-theme', theme)
    } catch {
      // localStorage unavailable — preference won't persist, but theme still works
    }
  }, [theme])

  function toggle() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

/** Consume the current theme and toggle function from anywhere inside ThemeProvider. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (ctx === null) {
    throw new Error('useTheme must be called inside <ThemeProvider>')
  }
  return ctx
}
