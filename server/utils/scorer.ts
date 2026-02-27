/**
 * Converts a Haversine distance into a ChronoQuizzr round score.
 *
 * Formula: score = Math.round( 5000 × e^(−distance / 2000) )
 *
 * | Distance  | Score       |
 * |-----------|-------------|
 * | 0 km      | 5,000 (max) |
 * | 500 km    | ~2,852      |
 * | 1,000 km  | ~1,839      |
 * | 10,000 km | ~1          |
 *
 * @param distanceKm - Great-circle distance in kilometres (from haversine utility).
 * @returns Integer score in the range [0, 5000].
 */
export function scorer(distanceKm: number): number {
  return Math.round(5000 * Math.exp(-distanceKm / 2000))
}
