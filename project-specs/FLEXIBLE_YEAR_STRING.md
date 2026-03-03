# Implementation Plan: Flexible Year Strings (PLAN-YEAR-STRING)

## Problem Statement

`HistoricalEvent.year` is currently typed as `number`. The Chronicler Engine's
generator prompt requires an exact integer year. This prevents Claude Haiku from
generating events for ancient history — it cannot confidently pinpoint, say, the
exact year of a Bronze Age trade route or a 5th-century BCE battle, so it either
refuses the topic, hallucinates a precise year, or falls back to the seed pool.
The result is repetitive event sets and poor coverage of antiquity.

## Solution Summary

Change `year` from `number` to `string` throughout the type system and prompt
machinery. Introduce a **Century Threshold Rule** in the generator prompt so that
date precision is calibrated to how well historians actually know it.

## Century Threshold Rule

| Event era | Allowed year format | Examples |
|---|---|---|
| **Post-1500 AD** | Exact 4-digit year as string | `"1914"`, `"1989"`, `"1066"` |
| **Pre-1500 AD, date known** | `c.` prefix + year | `"c. 1066"`, `"c. 450 BCE"` |
| **Pre-1500 AD, only century known** | `c.` + century phrase | `"c. 3rd century BCE"` |
| **BCE events** | Year + ` BCE` suffix (never negative integer) | `"44 BCE"`, `"490 BCE"` |

The threshold of 1500 AD is intentionally generous — it covers the vast majority
of "hard" and "medium" ancient events while still keeping modern events pinpoint-accurate.

---

## Full File Change Map

### 1. `shared/types.d.ts`
**Change:** `year: number` → `year: string` in `HistoricalEvent`.
`GameEvent` inherits the change automatically via `Omit`.

```typescript
// Before
year: number;

// After
year: string;
```

---

### 2. `server/services/chroniclerEngine.ts`

Four distinct edits required in this file:

#### 2a. `buildGeneratorPrompt` — schema template
The schema comment inside the prompt string currently shows `"year": <integer>`.
Update the schema to show `"year": "<year-string>"` and replace the field note.

```
// Before (in prompt string)
"year": <integer>,
...
- "year": integer; use negative values for BCE (e.g. -490 for 490 BCE)

// After
"year": "<year-string>",
...
- "year": string; follow the CENTURY THRESHOLD RULE:
    • Post-1500 AD     → exact year as a string: "1989", "1914"
    • Pre-1500 AD      → add "c." prefix:        "c. 1450", "c. 490 BCE"
    • BCE events       → year + " BCE" suffix:   "44 BCE", "490 BCE"
    • Ancient / approx → century phrase:          "c. 3rd century BCE"
  Never use negative integers. Never omit the "c." for pre-1500 dates.
```

#### 2b. `buildAdversaryPrompt` — year interpolation
Line: `` Year: ${year} ``
No change needed. Template string interpolation renders a JavaScript string value
correctly. ✓ (no edit)

#### 2c. `buildRewritePrompt` — JSON template with embedded year
Line: `` "year": ${candidate.year}, ``
Currently works for numbers (produces valid JSON). With a string value like
`"1989"` it would produce `` "year": 1989 `` — an unquoted string in JSON, which
is invalid. Must wrap in quotes.

```typescript
// Before
  "year": ${candidate.year},

// After
  "year": "${candidate.year}",
```

#### 2d. `validateSchema` — year type check
Line 435–437: currently validates year as a non-zero integer.
Must be replaced with a string check.

```typescript
// Before
if (typeof obj.year !== 'number' || !Number.isInteger(obj.year)) {
  return { valid: false, reason: 'Type error: "year" must be an integer (use negative for BCE).' }
}

// After
if (typeof obj.year !== 'string' || obj.year.trim().length === 0) {
  return { valid: false, reason: 'Type error: "year" must be a non-empty string (e.g. "1989", "c. 490 BCE").' }
}
```

---

### 3. `server/data/events.json` — apply Century Threshold Rule

10 seed events. All numeric years converted to strings with the threshold applied:

| Event id | Old value | New value | Reasoning |
|---|---|---|---|
| `berlin-wall-1989` | `1989` | `"1989"` | Post-1500, exact |
| `sarajevo-1914` | `1914` | `"1914"` | Post-1500, exact |
| `battle-hastings-1066` | `1066` | `"c. 1066"` | Pre-1500, well-known date |
| `sydney-opera-1973` | `1973` | `"1973"` | Post-1500, exact |
| `hiroshima-1945` | `1945` | `"1945"` | Post-1500, exact |
| `bastille-1789` | `1789` | `"1789"` | Post-1500, exact |
| `kitty-hawk-1903` | `1903` | `"1903"` | Post-1500, exact |
| `caesar-44bc` | `-44` | `"44 BCE"` | Ancient BCE |
| `chernobyl-1986` | `1986` | `"1986"` | Post-1500, exact |
| `machu-picchu-1450` | `1450` | `"c. 1450"` | Pre-1500, approximate |

---

### 4. `server/tests/fixtures/mockEvents.json` — update test fixture years

5 entries, all post-1500. Convert to string years (exact, no `c.` prefix needed).

| Event id | Old | New |
|---|---|---|
| `mock-event-001` | `1850` | `"1850"` |
| `mock-event-002` | `1900` | `"1900"` |
| `mock-event-003` | `1920` | `"1920"` |
| `mock-event-004` | `1950` | `"1950"` |
| `mock-event-005` | `1975` | `"1975"` |

---

### 5. `server/test-fixtures/validEvent.json` and `rewrittenEvent.json`

Both have `"year": 1000` — pre-1500, convert to `"c. 1000"`.

---

### 6. `client/src/components/CluePanel.tsx`

The `formatYear(year: number): string` helper (lines 30–32) handles BCE conversion
for the old numeric type. With `year: string` the conversion is already baked into
the data — the value arrives as `"44 BCE"` or `"c. 1450"` directly from the server.

**Remove `formatYear`** entirely and replace both render sites:

```typescript
// Before (mobile handle, line 112)
{formatYear(event.year)}

// After
{event.year}

// Before (desktop section, line 155)
{formatYear(event.year)}

// After
{event.year}
```

---

### 7. `server/data/generated_events.json` (git-ignored)

This file currently contains numeric years from a previous batch run. Because
`loadGeneratedEvents()` uses a runtime type assertion (`as HistoricalEvent[]`)
without schema validation, numeric years will silently load at runtime — but
the TypeScript compiler will flag the mismatch if it can see the file.

**Action required during implementation:** Manually convert all year values to
strings in the existing file, or simply delete it and regenerate with
`npm run generate --prefix server` after the type change is complete.
Deletion is the simpler and safer option.

---

## Test Impact Matrix

| File | Impact | Action |
|---|---|---|
| `server/utils/haversine.test.ts` | None — no year field | No change |
| `server/utils/scorer.test.ts` | None — no year field | No change |
| `server/routes/game.test.ts` | Low — uses `mockEvents.json` fixture; year not validated in guess route | Recheck after fixture update; tests should pass with no code changes |
| `server/services/chroniclerEngine.test.ts` | Medium — `validateSchema` path for year type error changes | Existing "bad year" test expectations must be updated to match new error message |
| `client/src/components/CluePanel.test.tsx` | Medium — constructs `GameEvent` objects inline with numeric years | All inline `year` values must change to strings; `formatYear` BCE test must be updated to verify string passthrough |
| `client/src/components/GameBoard.test.tsx` | Low — uses `mockEvents.json` via import or inline `GameEvent`; if inline, year values need updating | Review and update inline event objects |
| `client/src/components/FinalScoreScreen.test.tsx` | None — `RoundEntry` has only `score` and `distance`, no year | No change |
| `client/src/context/ThemeContext.test.tsx` | None | No change |
| `client/src/components/MapView.test.tsx` | None | No change |

---

## Migration Order

Execute steps in this order to keep the TypeScript compiler happy at each stage:

1. Update `shared/types.d.ts` — establishes the new type contract
2. Update all JSON data files: `events.json`, `mockEvents.json`, `validEvent.json`, `rewrittenEvent.json`
3. Delete (or update) `generated_events.json`
4. Update `server/services/chroniclerEngine.ts` — all four edits
5. Update `client/src/components/CluePanel.tsx` — remove `formatYear`, update render sites
6. **Run server tests:** `npm test --prefix server` — must be 39/39 green before proceeding
7. Update client test files as needed (`CluePanel.test.tsx`, `GameBoard.test.tsx`)
8. **Run client tests:** `npm test --prefix client` — must be 30/30 green
9. TypeScript check both packages: `cd client && npx tsc -b --noEmit` and `cd server && npx tsc --noEmit`

---

## Verification

```bash
# After step 6:
npm test --prefix server          # Must: 39/39 ✓

# After step 8:
npm test --prefix client          # Must: 30/30 ✓

# TypeScript clean build:
cd client && npx tsc -b --noEmit  # Must: 0 errors
cd server && npx tsc --noEmit     # Must: 0 errors

# Smoke test — start the server and confirm a game session works:
npm run dev
# GET http://localhost:3001/api/game/start → verify year fields are strings
# POST http://localhost:3001/api/game/guess → verify scoring still works
```

---

## Out of Scope

- No changes to `ResultsOverlay.tsx` — year is not displayed there
- No changes to `FinalScoreScreen.tsx` — RoundEntry has no year field
- No changes to the Haversine formula or scoring logic — these are coordinate-only
- No changes to the `@shared` path alias configuration
- No spec update required for `project-specs/` — this is a field type change within
  the existing `HistoricalEvent` model, not adding or removing a field
