/**
 * Converts degrees to radians.
 */
function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * Calculates the great-circle distance between two points on Earth
 * using the Haversine formula.
 *
 * @param lat1 - Latitude of the first point in decimal degrees.
 * @param lng1 - Longitude of the first point in decimal degrees.
 * @param lat2 - Latitude of the second point in decimal degrees.
 * @param lng2 - Longitude of the second point in decimal degrees.
 * @returns Distance in kilometres (km).
 *
 * @remarks
 * Uses Earth mean radius = 6371 km. Antimeridian crossings are handled
 * correctly by the spherical formula — no special-casing required.
 * This is the single source of truth for all distance calculations in
 * ChronoQuizzr. Do not replace with an external geo library.
 */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth mean radius in km

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}
