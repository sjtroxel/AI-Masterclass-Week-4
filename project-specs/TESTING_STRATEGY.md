# ChronoQuizzr — Testing Strategy

## Overview

ChronoQuizzr currently has **1 test file** covering the Haversine formula only. This document
defines a roadmap to professional-grade coverage across all layers: unit, service, integration,
component, and end-to-end.

All backend tests use **Vitest** (already installed). Frontend tests add **Vitest + React
Testing Library**. E2E adds **Playwright**.

---

## Coverage Target by Layer

| Layer | Framework | Status | Priority |
|-------|-----------|--------|----------|
| Backend unit (pure functions) | Vitest | Partial (Haversine only) | **P0 — immediate** |
| Backend service (ChroniclerEngine) | Vitest + mock provider | None | **P0 — immediate** |
| Backend integration (Express routes) | Vitest + supertest | None | **P1** |
| Frontend component | Vitest + React Testing Library | None | **P2** |
| E2E full game loop | Playwright | None | **P3** |

---

## Layer 1 — Backend Unit Tests (Pure Functions)

### 1.1 `server/utils/haversine.test.ts` (existing — extend)

4 tests already pass. Add:

| New Test | Assertion |
|----------|-----------|
| Equatorial crossing (west → east) | Distance is symmetric: `haversine(A, B) === haversine(B, A)` |
| Both poles | `haversine(90, 0, -90, 0)` ≈ 20,015 km (half Earth circumference) |

### 1.2 `server/utils/scorer.test.ts` (new file)

**File:** `server/utils/scorer.test.ts`

Pure function — no mocks needed. Model after `haversine.test.ts`.

| Test | Input | Expected Output |
|------|-------|----------------|
| Perfect guess | `scorer(0)` | `5000` |
| 500 km | `scorer(500)` | `3894` (Math.round(5000 × e^-0.25)) |
| 1000 km | `scorer(1000)` | `3033` |
| 2000 km | `scorer(2000)` | `1839` |
| 10000 km | `scorer(10000)` | `34` |
| Antipodal (max distance) | `scorer(20015)` | `0` |
| Non-negative guarantee | `scorer(100000)` | `≥ 0` (no negative scores) |

---

## Layer 2 — Service Tests (ChroniclerEngine with Mock Provider)

### 2.1 Why Mock the Provider

`ChroniclerEngine` makes live Anthropic API calls. Tests must not:
- Incur API costs
- Fail due to network conditions
- Be rate-limited
- Depend on model output stability

Solution: implement `MockProvider` that satisfies the `LLMProvider` interface and returns
pre-scripted JSON strings.

### 2.2 `MockProvider` Design

**Location:** `server/providers/mockProvider.ts` (test helper — not imported by production code)

```typescript
// Conceptual shape
class MockProvider implements LLMProvider {
  private responses: string[]
  private callIndex = 0

  constructor(responses: string[]) {
    this.responses = responses
  }

  async completeJson(_prompt: string): Promise<string> {
    const response = this.responses[this.callIndex % this.responses.length]
    this.callIndex++
    if (response === '__FATAL__') throw new FatalProviderError('Mock fatal error')
    if (response === '__ERROR__') throw new Error('Mock transient error')
    return response
  }
}
```

Pre-scripted response fixtures belong in `server/test-fixtures/`:

| Fixture | Content |
|---------|---------|
| `validEvent.json` | A fully valid `HistoricalEvent` JSON string passing all schema checks |
| `validAdversaryPass.json` | Adversary verdict: `{ identified: false, coordsOk: true, ... }` |
| `validAdversaryFail.json` | Adversary verdict: `{ identified: true, guess: "Paris", ... }` |
| `validAdversaryCoordsBad.json` | Adversary verdict: `{ identified: false, coordsOk: false, ... }` |
| `rewrittenEvent.json` | Same event with rewritten clue (same `id` as `validEvent.json`) |
| `invalidJson.json` | Malformed JSON string (e.g., `"{ broken"`) |
| `missingFields.json` | Valid JSON but missing required fields |

### 2.3 `server/services/chroniclerEngine.test.ts` (new file)

**Test Scenarios:**

| Scenario | Provider sequence | Expected outcome |
|----------|-------------------|-----------------|
| Happy path (1st attempt passes) | `[validEvent, adversaryPass]` | Returns the event |
| Pass after 1 rewrite | `[validEvent, adversaryFail, rewrittenEvent, adversaryPass]` | Returns rewritten event |
| Topic drift guarded | Rewrite returns event with different `id` | Discards rewrite, moves to next topic |
| Coordinate hallucination | `[validEvent, adversaryCoordsBad]` | Skips to next topic |
| Schema invalid on generation | `[invalidJson, validEvent, adversaryPass]` | Skips to next topic, succeeds on topic 2 |
| Total exhaustion → seed fallback | All responses are `adversaryFail` across all topics | Returns a seed event (non-null) |
| `FatalProviderError` propagates | Provider returns `__FATAL__` | Error re-thrown (not caught by engine) |
| Blacklist enforced in prompt | Inspect `completeJson` call argument | Prompt contains blacklisted IDs |

### 2.4 `server/services/eventGenerator.test.ts` (new file)

Simpler — tests the façade wiring:

| Test | Assertion |
|------|-----------|
| Resolves with a `HistoricalEvent` | Shape matches interface |
| Calls `logLLMTrace` | Spy confirms trace call at façade level |
| Propagates `FatalProviderError` | Error is not swallowed |

*Note:* `eventGenerator.ts` instantiates `AnthropicProvider` directly. To test with a mock,
the façade needs a provider injection path (optional second parameter or a
`setProviderForTesting()` export — keep it minimal and test-only).

---

## Layer 3 — Integration Tests (Express Routes)

### 3.1 Install `supertest`

```bash
npm install --save-dev supertest @types/supertest --prefix server
```

### 3.2 `server/routes/game.test.ts` (new file)

Integration tests treat the route as a black box, sending real HTTP requests to a test
instance of the Express app.

**Test setup:** Import the Express `app` from `server/index.ts` (or extract app creation
into `server/app.ts` so it can be imported without starting the server — see §Breaking Changes).

**`GET /api/game/start` tests:**

| Test | Condition | Expected |
|------|-----------|----------|
| Returns 5 events | Static pool has ≥ 5 events | `200`, array length 5 |
| Events are `GameEvent` shape | All fields present | No `hiddenCoords` field in any item |
| `hiddenCoords` is absent | Deliberate coordinate privacy check | Property must not exist on any item |
| Unique IDs in response | No duplicate `id` within the 5 returned | All IDs distinct |
| Response is valid JSON array | Basic contract | Content-Type `application/json` |

*After the dynamic generation feature lands, add:*

| Test | Condition | Expected |
|------|-----------|----------|
| Falls back to static pool | Mock provider throws | `200` with events from seed pool |
| Fresh IDs each call | Two sequential requests | IDs differ (probabilistic assertion) |

**`POST /api/game/guess` tests:**

| Test | Input | Expected |
|------|-------|----------|
| Valid guess | Known `eventId`, valid `lat`/`lng` | `200`, `{ distance, score, trueCoords }` |
| Unknown `eventId` | `eventId` not in pool | `404` |
| Missing `lat` | Body `{ eventId, lng }` | `400` |
| Missing `eventId` | Body `{ lat, lng }` | `400` |
| Wrong type `lat` | `lat: "hello"` | `400` |
| `lat` out of range | `lat: 95` | `400` |
| `lng` out of range | `lng: -185` | `400` |
| Score is in `[0, 5000]` | Perfect guess (exact coordinates) | `score === 5000` |
| `trueCoords` matches event | Known event | `trueCoords.lat` matches seed data |
| `distance` is a number | Valid guess | `typeof result.distance === 'number'` |

---

## Layer 4 — Frontend Component Tests

### 4.1 Install Dependencies

```bash
npm install --save-dev vitest @vitest/coverage-v8 jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  --prefix client
```

Update `client/vite.config.ts` to add a `test` block:

```typescript
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/test-setup.ts',
}
```

Create `client/src/test-setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

### 4.2 Test Files

**`client/src/components/CluePanel.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders clue text | `getByText(event.clue)` |
| Renders year | `getByText(String(event.year))` |
| Submit disabled when no pin | Button has `disabled` attribute |
| Submit enabled after pin dropped | `onSubmit` is callable |
| Submit calls `onSubmit` on click | Spy is invoked |
| Spinner visible when `isSubmitting` | Spinner element in DOM |
| `submitError` renders inline | Error message visible |
| Difficulty badge renders | Badge text matches `event.difficulty` |

**`client/src/components/FinalScoreScreen.test.tsx`**

| Test | Assertion |
|------|-----------|
| Renders total score | Score from `roundHistory` sum |
| Renders round count rows | Table has 5 `<tr>` in `<tbody>` |
| Play Again button present | Button exists |
| Play Again calls `onPlayAgain` | Click fires callback |

**`client/src/context/ThemeContext.test.tsx`**

| Test | Assertion |
|------|-----------|
| Default theme is dark | `html` does not have `theme-light` class |
| Toggle adds `theme-light` class | After toggle, class present |
| Toggle removes `theme-light` class | Second toggle removes class |
| Persists to localStorage | `localStorage.getItem('theme')` set |

**`client/src/components/GameBoard.test.tsx`** *(complex — mock `fetch`)*

| Test | Mock | Assertion |
|------|------|-----------|
| Loading state on mount | Delay `/start` response | Spinner / loading copy visible |
| Error state when `/start` 500s | Mock 500 | Error screen rendered |
| Round advances after guess | Mock valid `/start` + `/guess` | Round counter increments |
| Final screen after round 5 | 5 rounds completed | `FinalScoreScreen` rendered |

### 4.3 `MapView` Testing Note

`MapView` uses Leaflet which requires a real DOM and canvas context unavailable in jsdom.
Mock `react-leaflet` entirely for unit tests. Leaflet behaviour is covered by E2E tests.

---

## Layer 5 — E2E Tests (Playwright)

### 5.1 Install Playwright

```bash
npm install --save-dev playwright @playwright/test --prefix client
npx playwright install chromium --prefix client
```

Add `client/playwright.config.ts`:

```typescript
export default {
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev',    // from repo root — starts both client and server
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
}
```

### 5.2 `client/e2e/game-loop.spec.ts` (new file)

**Full game loop (happy path):**

```
1. Navigate to http://localhost:5173
2. Wait for loading to complete (loading copy disappears)
3. Assert CluePanel is visible with a clue and year
4. Click on the map (simulate pin drop)
5. Assert Submit button is enabled
6. Click Submit
7. Wait for ResultsOverlay to appear
8. Assert score is visible (text matches /\d+ pts/ or similar)
9. Assert distance is visible
10. Click "Next Round"
11. Repeat steps 3–10 for rounds 2–5
12. Assert FinalScoreScreen is rendered
13. Assert total score is the sum of round scores
14. Click "Play Again"
15. Assert loading state re-enters (game resets)
```

**Additional E2E scenarios:**

| Scenario | Steps | Assertion |
|----------|-------|-----------|
| Theme toggle | Click theme toggle | Map filter changes; body has/lacks `theme-light` |
| Pin moves on re-click | Drop pin, click elsewhere | Only one pin visible on map |
| Submit disabled pre-pin | Load game, do NOT click map | Submit button is `disabled` |
| Score capped at 5000 | Mock exact coordinate match | Score displayed is 5000 |

---

## 6. New Packages Summary

| Package | Layer | Install location |
|---------|-------|-----------------|
| `supertest` + `@types/supertest` | Integration | `server/` devDep |
| `@testing-library/react` | Frontend | `client/` devDep |
| `@testing-library/user-event` | Frontend | `client/` devDep |
| `@testing-library/jest-dom` | Frontend | `client/` devDep |
| `jsdom` | Frontend | `client/` devDep |
| `@vitest/coverage-v8` | Frontend | `client/` devDep |
| `playwright` + `@playwright/test` | E2E | `client/` devDep |

---

## 7. New Files to Create

```
server/
├── providers/
│   └── mockProvider.ts            ← LLMProvider mock (test helper only)
├── test-fixtures/
│   ├── validEvent.json
│   ├── validAdversaryPass.json
│   ├── validAdversaryFail.json
│   ├── validAdversaryCoordsBad.json
│   ├── rewrittenEvent.json
│   ├── invalidJson.json
│   └── missingFields.json
├── utils/
│   └── scorer.test.ts             ← New unit tests for scorer
├── routes/
│   └── game.test.ts               ← New integration tests (supertest)
└── services/
    ├── chroniclerEngine.test.ts   ← New service tests
    └── eventGenerator.test.ts     ← New façade tests

client/
├── src/
│   ├── test-setup.ts              ← jest-dom import
│   └── components/
│       ├── CluePanel.test.tsx
│       ├── FinalScoreScreen.test.tsx
│       └── GameBoard.test.tsx
├── context/
│   └── ThemeContext.test.tsx
├── e2e/
│   └── game-loop.spec.ts
└── playwright.config.ts
```

---

## 8. Recommended Implementation Order

Tackle in this sequence to build confidence incrementally and catch regressions early:

1. **`scorer.test.ts`** — Pure function, zero dependencies, 30-minute win.
2. **`mockProvider.ts` + fixtures** — Unlocks all service tests.
3. **`chroniclerEngine.test.ts`** — Validates the adversarial loop without API costs.
4. **`game.test.ts` (supertest)** — Catches coordinate privacy regressions.
5. **Frontend component tests** — After dynamic generation lands (avoids rewriting).
6. **Playwright E2E** — Last, because it needs both client and server running.

---

## 9. CI Note (Future)

When a CI pipeline is added, the test command sequence should be:

```bash
npm test --prefix server          # Vitest: haversine + scorer + chroniclerEngine + game routes
npm test --prefix client          # Vitest: component tests
npx playwright test --prefix client  # E2E (requires dev server running)
```

The E2E suite should run against a test environment with `ANTHROPIC_API_KEY` set — or
with a mock server that returns pre-canned `/start` and `/guess` responses — to avoid
live API calls in CI.
