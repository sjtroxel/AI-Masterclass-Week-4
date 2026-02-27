import { useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { Icon, latLng, type LatLng } from 'leaflet'

// ─── Leaflet default icon fix ─────────────────────────────────────────────────
// Leaflet's Icon.Default._getIconUrl tries to resolve marker assets relative to
// the Leaflet script URL, which breaks in Vite/bundler environments. Deleting
// the method and supplying explicit resolved asset paths is the standard remedy.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const proto = Icon.Default.prototype as { _getIconUrl?: unknown }
delete proto._getIconUrl
Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})
// ─────────────────────────────────────────────────────────────────────────────

interface PinDropHandlerProps {
  onPinDrop: (lat: number, lng: number) => void
}

/**
 * Inner child component that must live inside `<MapContainer>` to call
 * `useMapEvents`. Intercepts map-level `click` events, which Leaflet v1.9
 * normalises from both mouse clicks and touch taps — no separate touch handler
 * is required. A 300 ms debounce guard prevents the rare ghost-click double-fire
 * on older mobile browsers that do not suppress the synthetic click event that
 * follows a `touchend`.
 */
function PinDropHandler({ onPinDrop }: PinDropHandlerProps) {
  const lastFireRef = useRef<number>(0)

  useMapEvents({
    click(e) {
      const now = Date.now()
      if (now - lastFireRef.current < 300) return
      lastFireRef.current = now
      onPinDrop(e.latlng.lat, e.latlng.lng)
    },
  })

  // This component renders nothing; it exists solely to access the map context.
  return null
}

// ─────────────────────────────────────────────────────────────────────────────

export interface MapViewProps {
  /** Called with the new pin coordinates whenever the player drops or moves a pin. */
  onPinDrop: (lat: number, lng: number) => void
}

/**
 * Full-viewport Leaflet map with single-pin drop mechanics.
 *
 * Layout contract (per SYSTEM_ARCHITECTURE.md):
 *   - `h-full w-full` fills whatever parent container is provided.
 *   - Parent controls the actual height (full-screen on mobile, column on md+).
 *   - `zIndex: 0` on the MapContainer ensures ResultsOverlay / FinalScoreScreen
 *     modals can stack above the map without z-index conflicts.
 *
 * Touch compatibility:
 *   - `useMapEvents` is used via the `PinDropHandler` child component.
 *   - Leaflet normalises touch taps to `click` events, so one handler covers
 *     both desktop and mobile input.
 *   - `worldCopyJump: true` keeps the view coherent when panning near the
 *     antimeridian, complementing the Haversine shortest-path calculation.
 */
export function MapView({ onPinDrop }: MapViewProps) {
  const [pin, setPin] = useState<LatLng | null>(null)

  function handlePinDrop(lat: number, lng: number) {
    setPin(latLng(lat, lng))
    onPinDrop(lat, lng)
  }

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      worldCopyJump={true}
      className="h-full w-full"
      style={{ zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <PinDropHandler onPinDrop={handlePinDrop} />
      {pin !== null && <Marker position={pin} />}
    </MapContainer>
  )
}
