import { describe, it, expect } from 'vitest'
import { scorer } from './scorer'

describe('scorer', () => {
  it('returns 5000 for a perfect guess (0 km)', () => {
    expect(scorer(0)).toBe(5000)
  })

  it('returns 3894 for 500 km', () => {
    // Math.round(5000 × e^−0.25) = Math.round(3894.003…) = 3894
    expect(scorer(500)).toBe(3894)
  })

  it('returns 3033 for 1000 km', () => {
    // Math.round(5000 × e^−0.5) = Math.round(3032.653…) = 3033
    expect(scorer(1000)).toBe(3033)
  })

  it('returns 1839 for 2000 km', () => {
    // Math.round(5000 × e^−1) = Math.round(1839.397…) = 1839
    expect(scorer(2000)).toBe(1839)
  })

  it('returns 34 for 10000 km', () => {
    // Math.round(5000 × e^−5) = Math.round(33.689…) = 34
    expect(scorer(10000)).toBe(34)
  })

  it('returns 0 for antipodal distance (~20015 km)', () => {
    // Math.round(5000 × e^−10.0075) ≈ Math.round(0.225…) = 0
    expect(scorer(20015)).toBe(0)
  })

  it('never returns a negative score for extreme distances', () => {
    expect(scorer(100_000)).toBeGreaterThanOrEqual(0)
  })

  it('score is strictly decreasing as distance increases', () => {
    expect(scorer(0)).toBeGreaterThan(scorer(1000))
    expect(scorer(1000)).toBeGreaterThan(scorer(5000))
    expect(scorer(5000)).toBeGreaterThan(scorer(10000))
  })
})
