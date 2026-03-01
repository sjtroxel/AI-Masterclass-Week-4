import { describe, it, expect } from 'vitest'
import { haversine } from './haversine'

/**
 * Unit tests for the Haversine distance utility (D-07).
 *
 * Run: npm test (from server/) or npm test --prefix server (from root)
 */
describe('haversine', () => {
  it('same point returns 0 km', () => {
    expect(haversine(51.5074, -0.1278, 51.5074, -0.1278)).toBe(0)
  })

  it('London to Paris returns ~343 km (±3 km tolerance)', () => {
    // London: 51.5074° N, 0.1278° W → Paris: 48.8566° N, 2.3522° E
    // Haversine for these coordinates yields ~343.6 km.
    const dist = haversine(51.5074, -0.1278, 48.8566, 2.3522)
    expect(dist).toBeGreaterThan(340)
    expect(dist).toBeLessThan(346)
  })

  it('handles antimeridian crossing: Fiji to Samoa', () => {
    // Fiji: -17.7134° S, 178.0650° E  |  Samoa: -13.7590° S, -172.1046° W
    // The shortest path crosses the antimeridian — only ~9.8° of longitude apart.
    // A naive implementation computes the long way (~350° of longitude) → >20,000 km.
    // The Haversine formula handles this correctly because it operates on the
    // sine/cosine of the angular difference, not the raw difference in degrees.
    const dist = haversine(-17.7134, 178.065, -13.759, -172.1046)
    expect(dist).toBeGreaterThan(800)
    expect(dist).toBeLessThan(1500)
  })

  it('handles near-pole coordinates without error', () => {
    // Two points at latitude 89.9° on opposite sides of the north pole.
    // Tests that the formula does not produce NaN or throw near singularities.
    const dist = haversine(89.9, 0, 89.9, 180)
    expect(typeof dist).toBe('number')
    expect(isNaN(dist)).toBe(false)
    expect(dist).toBeGreaterThanOrEqual(0)
  })

  it('equatorial crossing is symmetric: haversine(A,B) === haversine(B,A)', () => {
    // Two equatorial points on opposite sides of the prime meridian.
    // Symmetry is a mathematical requirement of the Haversine formula.
    const lat1 = 0
    const lng1 = -60 // 60° W
    const lat2 = 0
    const lng2 = 60  // 60° E
    expect(haversine(lat1, lng1, lat2, lng2)).toBe(haversine(lat2, lng2, lat1, lng1))
  })

  it('both poles: haversine(90,0,-90,0) ≈ 20,015 km (half circumference)', () => {
    // North pole to south pole through the prime meridian should equal exactly
    // half the Earth's great-circle circumference: π × R ≈ 20,015 km.
    const dist = haversine(90, 0, -90, 0)
    expect(dist).toBeGreaterThan(20_000)
    expect(dist).toBeLessThan(20_030)
  })
})
