import { useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { Icon } from 'leaflet'

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

  return null
}

// ─────────────────────────────────────────────────────────────────────────────

export interface MapViewProps {
  /**
   * Called with the new pin coordinates whenever the player drops or moves a pin.
   * GameBoard stores this in `guessCoords` state.
   */
  onPinDrop: (lat: number, lng: number) => void
  /**
   * The current pin position, controlled by GameBoard.
   * GameBoard clears this to `null` on round transitions — no effect or roundKey
   * needed. Pass `null` to remove the marker.
   */
  pinCoords: { lat: number; lng: number } | null
}

/**
 * Controlled Leaflet map with single-pin drop mechanics.
 *
 * Design notes (per SYSTEM_ARCHITECTURE.md):
 *   - Fully controlled: `pinCoords` is owned by GameBoard; MapView renders it.
 *     Clearing the pin on round change requires only `setGuessCoords(null)` in
 *     GameBoard — no internal effect or remount is needed.
 *   - `h-full w-full` fills whatever parent container is provided.
 *   - `zIndex: 0` ensures ResultsOverlay / FinalScoreScreen modals render above.
 *   - `worldCopyJump: true` keeps the view coherent near the antimeridian.
 */
export function MapView({ onPinDrop, pinCoords }: MapViewProps) {
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
      <PinDropHandler onPinDrop={onPinDrop} />
      {pinCoords !== null && (
        <Marker position={[pinCoords.lat, pinCoords.lng]} />
      )}
    </MapContainer>
  )
}
