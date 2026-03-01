import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { GameEvent, GuessResult } from '@shared/types'
import { ThemeProvider } from '../context/ThemeContext'
import { GameBoard } from './GameBoard'

// ── Mock react-leaflet ────────────────────────────────────────────────────────
// Leaflet requires a real browser canvas and DOM APIs unavailable in jsdom.
// This mirrors the strategy in MapView.test.tsx, extended with a pin-drop
// capture so tests can simulate the player dropping a pin without a real map.

// Module-level variable that tests call to simulate a pin-drop event.
// Set each time PinDropHandler mounts (i.e. once the playing phase starts).
let simulatePinDrop: ((lat: number, lng: number) => void) | null = null

vi.mock('react-leaflet', () => ({
  MapContainer: (props: { children?: ReactNode }) => (
    <div data-testid="map-container">{props.children}</div>
  ),
  TileLayer: () => null,
  Marker: (props: { position: [number, number] }) => (
    <div
      data-testid="pin-marker"
      data-lat={props.position[0]}
      data-lng={props.position[1]}
    />
  ),
  Polyline: () => <div data-testid="polyline" />,
  CircleMarker: (props: { center: [number, number] }) => (
    <div
      data-testid="circle-marker"
      data-lat={props.center[0]}
      data-lng={props.center[1]}
    />
  ),
  // Capture the click handler so tests can fire a synthetic pin-drop.
  useMapEvents: (handlers: Record<string, (e: { latlng: { lat: number; lng: number } }) => void>) => {
    simulatePinDrop = (lat: number, lng: number) => {
      handlers.click?.({ latlng: { lat, lng } })
    }
    return null
  },
  useMap: () => ({ fitBounds: vi.fn() }),
}))

// ── Mock leaflet Icon.Default ─────────────────────────────────────────────────
// MapView.tsx modifies Icon.Default at module scope — the mock prevents
// TypeError: Cannot delete property '_getIconUrl' in jsdom.

vi.mock('leaflet', () => ({
  Icon: {
    Default: {
      prototype: {},
      mergeOptions: vi.fn(),
    },
  },
}))

vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: 'icon2x.png' }))
vi.mock('leaflet/dist/images/marker-icon.png',    () => ({ default: 'icon.png'   }))
vi.mock('leaflet/dist/images/marker-shadow.png',  () => ({ default: 'shadow.png' }))

// ── Mock data ─────────────────────────────────────────────────────────────────
// GameEvent = Omit<HistoricalEvent, 'hiddenCoords'> — no coordinates sent to
// the client until after the guess, per Rule 04 (coordinate privacy).

const mockEvents: GameEvent[] = [
  {
    id: 'mock-event-001',
    year: 1850,
    locationName: 'Mock Location One, Test City, Test Country',
    clue: 'A sufficiently long mock clue text for test event number one, describing an event at a notable location that exceeds fifty characters.',
    difficulty: 'easy',
    source_url: 'https://en.wikipedia.org/wiki/Mock',
  },
  {
    id: 'mock-event-002',
    year: 1900,
    locationName: 'Mock Location Two, Test City, Test Country',
    clue: 'A sufficiently long mock clue text for test event number two, describing an event at a notable location that exceeds fifty characters.',
    difficulty: 'medium',
    source_url: 'https://en.wikipedia.org/wiki/Mock',
  },
  {
    id: 'mock-event-003',
    year: 1920,
    locationName: 'Mock Location Three, Test City, Test Country',
    clue: 'A sufficiently long mock clue text for test event number three, describing an event at a notable location that exceeds fifty characters.',
    difficulty: 'hard',
    source_url: 'https://en.wikipedia.org/wiki/Mock',
  },
  {
    id: 'mock-event-004',
    year: 1950,
    locationName: 'Mock Location Four, Test City, Test Country',
    clue: 'A sufficiently long mock clue text for test event number four, describing an event at a notable location that exceeds fifty characters.',
    difficulty: 'medium',
    source_url: 'https://en.wikipedia.org/wiki/Mock',
  },
  {
    id: 'mock-event-005',
    year: 1975,
    locationName: 'Mock Location Five, Test City, Test Country',
    clue: 'A sufficiently long mock clue text for test event number five, describing an event at a notable location that exceeds fifty characters.',
    difficulty: 'hard',
    source_url: 'https://en.wikipedia.org/wiki/Mock',
  },
]

const mockGuessResult: GuessResult = {
  distance: 500,
  score: 3894,
  trueCoords: { lat: 48.8566, lng: 2.3522 },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderGameBoard() {
  return render(
    <ThemeProvider>
      <GameBoard />
    </ThemeProvider>
  )
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  simulatePinDrop = null
  localStorage.clear()
  document.documentElement.classList.remove('theme-light')
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GameBoard', () => {
  it('shows the loading state while the session fetch is pending', async () => {
    // Fetch never resolves — GameBoard stays in 'loading' phase the whole test.
    let resolveStart!: (value: Response) => void
    const pendingStart = new Promise<Response>((res) => { resolveStart = res })
    vi.mocked(fetch).mockReturnValue(pendingStart)

    renderGameBoard()

    // Loading text is synchronously visible because `gamePhase` initialises to 'loading'.
    expect(
      screen.getByText(/the chronicler is consulting the archives/i)
    ).toBeTruthy()

    // Resolve so the test doesn't leak a pending Promise into the next test.
    await act(async () => {
      resolveStart({ ok: true, json: async () => mockEvents } as Response)
    })
  })

  it('renders the first event clue after the session fetch resolves', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockEvents,
    } as Response)

    renderGameBoard()

    await waitFor(() => {
      expect(screen.getByText(mockEvents[0].clue)).toBeTruthy()
    })
  })

  it('shows the error screen when the session fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response)

    renderGameBoard()

    // GameBoard sets errorMessage to the Error's message and renders it.
    await waitFor(() => {
      expect(screen.getByText(/server responded 500/i)).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
  })

  it('advances to round 2 after a guess is submitted', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => mockEvents } as Response)  // GET /start
      .mockResolvedValueOnce({ ok: true, json: async () => mockGuessResult } as Response) // POST /guess

    renderGameBoard()

    // Wait for the playing phase — clue visible and pin-drop handler registered.
    await waitFor(() => {
      expect(screen.getByText(mockEvents[0].clue)).toBeTruthy()
      expect(simulatePinDrop).not.toBeNull()
    })

    // Drop a pin to enable the Submit button.
    await act(async () => {
      simulatePinDrop!(48.8566, 2.3522)
    })

    // Submit the guess.
    fireEvent.click(screen.getByRole('button', { name: /submit guess/i }))

    // Wait for ResultsOverlay — confirms the POST /guess response was handled.
    await waitFor(() => {
      expect(screen.getByText(/round 1 of 5/i)).toBeTruthy()
    })

    // Click "Next Round →" to advance.
    fireEvent.click(screen.getByRole('button', { name: /next round/i }))

    // Round 2's clue should now be visible.
    await waitFor(() => {
      expect(screen.getByText(mockEvents[1].clue)).toBeTruthy()
    })
  })

  // ── Long-clue regression ─────────────────────────────────────────────────────
  // The scroll-fix in CluePanel (overflow-y-auto max-h-32 md:max-h-none) ensures
  // that a 150+ word clue doesn't push the Submit button off-screen on mobile.
  // This test confirms that both the clue text AND the button are present in the
  // DOM when a very long clue is passed through GameBoard → CluePanel.

  it('renders a 150+ word clue without hiding the Submit button', async () => {
    // Build a 152-word clue using distinct historical-sounding filler.
    const longClue = Array.from({ length: 152 }, (_, i) =>
      `During a period of significant civil unrest word${i + 1}`
    ).join(' ')

    const eventsWithLongClue: GameEvent[] = [
      { ...mockEvents[0], clue: longClue },
      ...mockEvents.slice(1),
    ]

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => eventsWithLongClue,
    } as Response)

    renderGameBoard()

    await waitFor(() => {
      expect(screen.getByText(longClue)).toBeTruthy()
    })

    // Submit button must remain in the DOM and be accessible.
    const submitBtn = screen.getByRole('button', { name: /submit guess/i })
    expect(submitBtn).toBeTruthy()
    // Button is disabled until a pin is dropped — that's correct behaviour,
    // not a layout bug. The regression we guard is the button disappearing entirely.
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true)
  })
})
