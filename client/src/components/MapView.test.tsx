import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MapView } from './MapView'

// ── Mock react-leaflet ────────────────────────────────────────────────────────
// Leaflet requires a real browser canvas and DOM APIs unavailable in jsdom.
// We replace every react-leaflet export with a minimal stub so that MapView's
// conditional rendering logic can be tested without triggering Leaflet errors.

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
  // useMapEvents is used by PinDropHandler — return null to satisfy the hook contract
  useMapEvents: (_handlers: unknown) => null,
  // useMap is used by MapFitBounds — return a stub with fitBounds
  useMap: () => ({ fitBounds: vi.fn() }),
}))

// ── Mock leaflet Icon.Default ─────────────────────────────────────────────────
// MapView.tsx deletes prototype._getIconUrl and calls Icon.Default.mergeOptions
// at module scope. The mock prevents this from throwing in jsdom.

vi.mock('leaflet', () => ({
  Icon: {
    Default: {
      prototype: {},
      mergeOptions: vi.fn(),
    },
  },
}))

// Mock the PNG asset imports that MapView pulls from leaflet/dist/images/
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: 'icon2x.png' }))
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'icon.png' }))
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: 'shadow.png' }))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MapView', () => {
  it('renders the map container', () => {
    const { container } = render(
      <MapView onPinDrop={vi.fn()} pinCoords={null} />
    )
    expect(container.querySelector('[data-testid="map-container"]')).not.toBeNull()
  })

  it('renders Marker when pinCoords is provided', () => {
    const { container } = render(
      <MapView onPinDrop={vi.fn()} pinCoords={{ lat: 48.8566, lng: 2.3522 }} />
    )
    expect(container.querySelector('[data-testid="pin-marker"]')).not.toBeNull()
  })

  it('does not render Marker when pinCoords is null', () => {
    const { container } = render(
      <MapView onPinDrop={vi.fn()} pinCoords={null} />
    )
    expect(container.querySelector('[data-testid="pin-marker"]')).toBeNull()
  })

  it('does not render Polyline or CircleMarker when revealCoords is null', () => {
    const { container } = render(
      <MapView
        onPinDrop={vi.fn()}
        pinCoords={{ lat: 48.8566, lng: 2.3522 }}
        revealCoords={null}
      />
    )
    expect(container.querySelector('[data-testid="polyline"]')).toBeNull()
    expect(container.querySelector('[data-testid="circle-marker"]')).toBeNull()
  })

  it('renders Polyline and CircleMarker when revealCoords is set', () => {
    const { container } = render(
      <MapView
        onPinDrop={vi.fn()}
        pinCoords={{ lat: 48.8566, lng: 2.3522 }}
        revealCoords={{ lat: 51.5074, lng: -0.1278 }}
      />
    )
    expect(container.querySelector('[data-testid="polyline"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="circle-marker"]')).not.toBeNull()
  })

  it('CircleMarker center matches the revealCoords passed in', () => {
    const revealCoords = { lat: 51.5074, lng: -0.1278 }
    const { container } = render(
      <MapView
        onPinDrop={vi.fn()}
        pinCoords={{ lat: 0, lng: 0 }}
        revealCoords={revealCoords}
      />
    )

    const circleMarker = container.querySelector('[data-testid="circle-marker"]')
    expect(circleMarker).not.toBeNull()
    expect(circleMarker?.getAttribute('data-lat')).toBe(String(revealCoords.lat))
    expect(circleMarker?.getAttribute('data-lng')).toBe(String(revealCoords.lng))
  })
})
