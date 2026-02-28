/**
 * Converts a Haversine distance into a ChronoQuizzr round score.
 *
 * Formula: score = Math.round( 5000 × e^(−distance / 2000) )
 *
 * | Distance   | Score       |
 * |------------|-------------|
 * | 0 km       | 5,000 (max) |
 * | 500 km     | ~3,894      |
 * | 1,000 km   | ~3,033      |
 * | 2,000 km   | ~1,839      |
 * | 5,000 km   | ~410        |
 * | 10,000 km  | ~34         |
 * | 16,300 km  | ~1          |
 * | 20,015 km  | 0 (antipodal, exact opposite side of Earth) |
 *
 * @param distanceKm - Great-circle distance in kilometres (from haversine utility).
 * @returns Integer score in the range [0, 5000].
 */
export function scorer(distanceKm: number): number {
  return Math.round(5000 * Math.exp(-distanceKm / 2000))
}
