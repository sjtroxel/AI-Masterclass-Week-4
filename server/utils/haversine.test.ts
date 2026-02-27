import { describe, it } from 'vitest';
// import { haversine } from './haversine'; // Uncomment when D-06 is complete

/**
 * TDD scaffold for the Haversine utility (D-07).
 * Tests are defined first — implementation follows in D-06.
 *
 * Run: npm test (from server/)
 */
describe('haversine', () => {
  it.todo('same point returns 0 km');
  it.todo('London to Paris returns ~341 km (±1 km tolerance)');
  it.todo('handles antimeridian crossing: Fiji to Samoa');
  it.todo('handles near-pole coordinates without error');
});
