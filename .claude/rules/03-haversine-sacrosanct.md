# Rule: Haversine Is Sacrosanct

Never replace, remove, or externalize the Haversine utility (`server/utils/haversine.ts`). It must remain:

- A standalone pure function with no external dependencies
- Covered by unit tests in `server/utils/haversine.test.ts`
- The single source of truth for all distance calculations in the app

Do not use a third-party geo library (e.g., `geolib`, `turf`) as a substitute or supplement for the core distance calculation.
