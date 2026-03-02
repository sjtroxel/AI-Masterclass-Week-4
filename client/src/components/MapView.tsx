import { useRef, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMapEvents, useMap } from 'react-leaflet'
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

/**
 * Fires `map.fitBounds` once when the result reveal happens, zooming/panning
 * so both the player's pin and the true location are fully visible.
 * Mounts only when `revealCoords` becomes non-null (see MapView render logic).
 * `maxZoom: 7` prevents over-zooming on near-perfect guesses.
 * Extra bottom padding (120 px) accommodates the mobile bottom-sheet overlay.
 */
function MapFitBounds({
  pinCoords,
  revealCoords,
}: {
  pinCoords: { lat: number; lng: number }
  revealCoords: { lat: number; lng: number }
}) {
  const map = useMap()

  useEffect(() => {
    map.fitBounds(
      [
        [pinCoords.lat, pinCoords.lng],
        [revealCoords.lat, revealCoords.lng],
      ],
      { paddingTopLeft: [60, 60], paddingBottomRight: [60, 120], maxZoom: 7 }
    )
  }, [map, pinCoords.lat, pinCoords.lng, revealCoords.lat, revealCoords.lng])

  return null
}

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
  /**
   * Set by GameBoard after POST /api/game/guess resolves. When non-null:
   *   - Renders a dashed amber Polyline from `pinCoords` to this location.
   *   - Renders a CircleMarker at this location (the true event site).
   *   - Suppresses PinDropHandler so the player cannot move the pin mid-reveal.
   * Defaults to `null`; GameBoard passes `roundResult.trueCoords` once scoring
   * is complete. Satisfies Rule 04 — trueCoords only enters the map after scoring.
   */
  revealCoords?: { lat: number; lng: number } | null
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
export function MapView({ onPinDrop, pinCoords, revealCoords = null }: MapViewProps) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      worldCopyJump={true}
      maxBounds={[[-85.051129, -180000], [85.051129, 180000]]}
      maxBoundsViscosity={1.0}
      className="h-full w-full"
      style={{ zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {/* Suppress pin-drop while the true location is revealed */}
      {revealCoords === null && <PinDropHandler onPinDrop={onPinDrop} />}

      {/* Player's guess marker */}
      {pinCoords !== null && (
        <Marker position={[pinCoords.lat, pinCoords.lng]} />
      )}

      {/* Post-guess reveal: dashed amber polyline from guess to true location */}
      {revealCoords !== null && pinCoords !== null && (
        <Polyline
          positions={[
            [pinCoords.lat, pinCoords.lng],
            [revealCoords.lat, revealCoords.lng],
          ]}
          pathOptions={{ color: '#f0b429', dashArray: '10 6', weight: 4, opacity: 1 }}
        />
      )}

      {/* Post-guess reveal: bright amber CircleMarker at the true event location */}
      {revealCoords !== null && (
        <CircleMarker
          center={[revealCoords.lat, revealCoords.lng]}
          radius={12}
          pathOptions={{
            color: '#ffffff',
            fillColor: '#f0b429',
            fillOpacity: 1,
            weight: 3,
          }}
        />
      )}

      {/* Auto-zoom to frame both pins when result is revealed */}
      {revealCoords !== null && pinCoords !== null && (
        <MapFitBounds pinCoords={pinCoords} revealCoords={revealCoords} />
      )}
    </MapContainer>
  )
}
