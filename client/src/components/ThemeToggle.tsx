import { useTheme } from '../context/ThemeContext'

// ─── Cartographer note ────────────────────────────────────────────────────────
// fixed top-3 right-3 z-[900]:
//   - Above Leaflet's highest internal layer (popups at ~700)
//   - Below ResultsOverlay (z-[1000]) so the overlay covers it when active
//   - Does not obscure Leaflet attribution (leaflet-bottom leaflet-right)
//
// bg-bg-panel/80 + backdrop-blur-md:
//   Reads as the current theme's panel color at 80% opacity, with a blur of
//   the map tiles beneath. In dark mode: warm translucent charcoal HUD element.
//   In light mode: cream glass pill against aged-map tiles. Both read as a
//   premium, high-end UI affordance appropriate to the historical aesthetic.
// ─────────────────────────────────────────────────────────────────────────────

export function ThemeToggle() {
  const { theme, toggle } = useTheme()

  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to Aged Map (light) theme' : 'Switch to Inky Night (dark) theme'}
      className="
        fixed top-3 left-3 z-900
        px-3 py-1.5
        font-ui text-xs tracking-widest uppercase
        rounded-full
        bg-bg-panel/80 backdrop-blur-md
        border border-trim/50
        text-text-muted hover:text-text-primary
        transition-colors duration-150
        cursor-pointer
        select-none
      "
    >
      {isDark ? '☀ Aged Map' : '☾ Inky'}
    </button>
  )
}
