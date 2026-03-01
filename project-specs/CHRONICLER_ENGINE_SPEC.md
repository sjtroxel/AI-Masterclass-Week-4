# Chronicler Engine — Phase 5 Specification

## Overview

Phase 5 replaces the MVP stub in `server/services/eventGenerator.ts` with a live, multi-agent
pipeline backed by the Google Gemini API (`@google/generative-ai` SDK). The engine generates
`HistoricalEvent` records that conform to the obfuscation standard in Rule 06 and the
`HistoricalEvent` schema in `shared/types.ts`.

A companion batch script (`server/scripts/generateBatch.ts`) pre-generates and caches 10 verified
events in `server/data/generated_events.json`. The game server draws from this cache at startup,
falling back to live generation only when the cache is absent or the combined pool is sparse.

---

## Architecture Overview

```
server/
├── services/
│   └── eventGenerator.ts          ← replaced: now a thin façade over ChroniclerEngine
├── services/
│   └── chroniclerEngine.ts        ← new: two-agent orchestrator (Generator + Adversary)
├── providers/
│   └── geminiProvider.ts          ← new: GeminiProvider implements LLMProvider interface
├── scripts/
│   └── generateBatch.ts           ← new: CLI batch runner → generated_events.json
└── data/
    ├── events.json                 ← unchanged (curated seed events, always loaded)
    └── generated_events.json       ← new: LLM-generated cache (git-ignored)
```

---

## 1. Provider-Agnostic Abstraction

**File:** `server/providers/geminiProvider.ts`

All LLM access is routed through a one-method interface so the provider can be swapped without
touching the Chronicler Engine:

```typescript
/** Minimal interface for any text-completion LLM provider. */
export interface LLMProvider {
  complete(prompt: string): Promise<string>
}
```

`GeminiProvider` is the concrete implementation:

```typescript
export class GeminiProvider implements LLMProvider {
  private model: GenerativeModel   // from @google/generative-ai

  constructor(apiKey: string, modelName = 'gemini-2.5-flash') { ... }

  async complete(prompt: string): Promise<string> {
    // Calls model.generateContent(prompt)
    // Returns result.response.text()
    // Throws on API error (caller handles retries)
  }
}
```

`GeminiProvider` reads the model name from the constructor; the default is `gemini-2.0-flash`.
The API key is passed in (never hard-coded); callers read it from `process.env.GEMINI_API_KEY`.
The default model `gemini-2.5-flash` is used unless overridden at construction time.

---

## 2. The Chronicler Engine (Two-Agent Loop)

**File:** `server/services/chroniclerEngine.ts`

The engine exposes one public method:

```typescript
export class ChroniclerEngine {
  constructor(private provider: LLMProvider) {}

  async generateVerifiedEvent(
    difficulty: 'easy' | 'medium' | 'hard'
  ): Promise<HistoricalEvent>
}
```

Internally it runs a **Generate → Validate → Adversarial-Check** loop with up to `MAX_RETRIES = 3`
attempts before throwing a `ChroniclerError`.

### 2.1 Phase 1 — The Generator

The Generator agent requests a `HistoricalEvent` JSON object using the Chronicler's obfuscation
rules. It uses `responseMimeType: 'application/json'` in the Gemini call so the response is raw
JSON (no markdown fences to strip).

**Generator prompt template:**

```
You are The Chronicler, a historian and puzzle designer for ChronoQuizzr, a historically-based
geography game where players guess event locations on a map.

Generate ONE historical event record as a JSON object with EXACTLY these fields:
{
  "id": "<kebab-case-slug-year>",        // unique identifier, e.g. "marathon-490bc"
  "year": <integer>,                      // use negative values for BCE (e.g. -490)
  "locationName": "<Landmark, City, Country>",   // full reveal name — used ONLY after guess
  "clue": "<obfuscated clue text>",       // see OBFUSCATION RULES below — CRITICAL
  "hiddenCoords": { "lat": <number>, "lng": <number> },   // WGS84 decimal degrees
  "difficulty": "${difficulty}",
  "source_url": "<URL>"                   // Wikipedia preferred; must be a real, verifiable URL
}

DIFFICULTY GUIDANCE (${difficulty}):
${difficultyGuidance}    ← interpolated per tier (see 2.1a)

OBFUSCATION RULES (mandatory — violating these causes the clue to be rejected):
1. The clue MUST NOT contain: city names, country names, region names, person names,
   monument names, river names, or any other named geographical or cultural identifier.
2. Replace all such references with contextual, descriptive language:
   "a narrow strait", "a mountainous inland plateau", "a coastal trading empire",
   "the era's foremost maritime power", etc.
3. The clue MUST remain solvable by an informed player using era, topography,
   political context, and historical significance.
4. Re-read your own clue. If a knowledgeable reader could Google the location
   from the clue text alone in under 10 seconds, it is too specific — revise it.

${retryFeedback}   ← empty on attempt 1; populated with failure reason on retries

Return ONLY the raw JSON object. No markdown, no code fences, no explanation.
```

**Difficulty guidance strings (2.1a):**

| Tier | `difficultyGuidance` |
|------|----------------------|
| `easy` | Famous, globally recognised events at iconic locations. Most educated adults should recognise the event. |
| `medium` | Significant but regionally famous events. Requires some historical knowledge to place correctly. |
| `hard` | Obscure events, unusual locations, deep specialist knowledge required. Even historians may need to reason carefully. |

### 2.2 Phase 2 — Schema & Coordinate Validation

After parsing the Generator's JSON, validate synchronously before calling the Adversary:

| Check | Condition | Failure reason returned to retry loop |
|-------|-----------|---------------------------------------|
| JSON parseable | `JSON.parse` succeeds | `"Response was not valid JSON"` |
| All fields present | `id, year, locationName, clue, hiddenCoords, difficulty, source_url` all exist | `"Missing required fields: <list>"` |
| Type correctness | `year` is number, `difficulty` is enum, `hiddenCoords.lat/lng` are numbers | `"Type error: <field> has wrong type"` |
| Coordinate range | `lat ∈ [-90, 90]`, `lng ∈ [-180, 180]` | `"Coordinates out of range"` |
| Non-empty clue | `clue.trim().length > 50` | `"Clue too short"` |

If any check fails, the loop retries with the failure reason injected into `${retryFeedback}`.

### 2.3 Phase 3 — The Adversary (Obfuscation Check)

The Adversary agent receives **only the clue text and year** (no `locationName`, no `hiddenCoords`).
It is instructed to behave like a knowledgeable player trying to cheat.

**Adversary prompt template:**

```
You are an expert historian and geography specialist playing a competitive location-guessing game.
Your goal is to identify the SPECIFIC geographic location of the following historical event using
ONLY the clue text and year provided. No other information is available to you.

You must also detect "Geographic Hallucinations": cases where the supplied coordinates are
implausible for the described event (e.g., coordinates pointing to open ocean for a land-based
event, or a location on the wrong continent for the described cultural or political context).

Year: ${year}
Clue: "${clue}"
Coordinates to verify: lat ${lat}, lng ${lng}

Perform two checks:

CHECK 1 — OBFUSCATION: Can you name a specific city, country, region, or landmark where this
event occurred using only the clue text?
- If yes: respond IDENTIFIED: <location name>
- If no: respond OBSCURE

CHECK 2 — COORDINATE PLAUSIBILITY: Are the supplied coordinates geographically plausible for
the event described (correct continent, not in open ocean for a land event, consistent with
the historical and cultural context of the clue)?
- If plausible: respond COORDS_OK
- If implausible: respond COORDS_INVALID: <brief reason>

Respond with EXACTLY two lines — one for each check — in this order, no other text:
<CHECK 1 result>
<CHECK 2 result>
```

**Adversary pass/fail logic:**

| Check 1 result | Check 2 result | Overall outcome |
|----------------|----------------|-----------------|
| `OBSCURE` | `COORDS_OK` | **PASS** — return the event |
| `IDENTIFIED:` | any | **FAIL** — `retryFeedback`: `"Adversarial check failed: the clue too easily reveals the location. The adversary identified: <location>. Make the clue less specific while keeping it solvable."` |
| `OBSCURE` | `COORDS_INVALID:` | **FAIL** — `retryFeedback`: `"Geographic hallucination detected: <reason>. The coordinates do not match the described event. Generate a new event with accurate, verifiable coordinates."` |
| Unparseable | any | Treat as FAIL/IDENTIFIED (conservative — safer to retry) |

### 2.4 Retry Loop

```
attempt = 1
loop:
  call Generator with current retryFeedback
  validate schema + coordinates  →  on failure: retryFeedback = validation error, attempt++, continue
  call Adversary                  →  on IDENTIFIED: retryFeedback = adversary message, attempt++, continue
  return validated HistoricalEvent   ← success
  if attempt > MAX_RETRIES (3): throw ChroniclerError('Failed after 3 attempts: <last reason>')
```

Each iteration calls `logLLMTrace` once for the Generator call and once for the Adversary call.

---

## 3. Batch Generation Script

**File:** `server/scripts/generateBatch.ts`

A standalone CLI script (not imported by the game server). Run manually to refresh the cache:

```bash
npx ts-node scripts/generateBatch.ts
# or with ts-node-dev unavailable:
npx tsx scripts/generateBatch.ts
```

### Batch composition (10 events default):

| Difficulty | Count |
|------------|-------|
| `easy`     | 3     |
| `medium`   | 5     |
| `hard`     | 2     |

### Script behaviour:

1. Load `server/.env` via `dotenv`.
2. Instantiate `GeminiProvider` and `ChroniclerEngine`.
3. For each event slot, call `engine.generateVerifiedEvent(difficulty)`.
4. Apply a **1,000 ms delay** between calls to stay within Gemini's rate limits.
5. Collect all successful results. On `ChroniclerError` for a slot: log the error and **skip that slot** (do not abort the whole batch).
6. Write the collected array to `server/data/generated_events.json` (overwrites if exists).
7. Log final summary: `Generated N/10 events → server/data/generated_events.json`.

### Output format:

`generated_events.json` uses the same schema as `events.json` — a top-level JSON array of
`HistoricalEvent` objects. The file is valid to be consumed without any transformation.

---

## 4. Integration with the Game Server

### 4.1 Event pool loading (`server/routes/game.ts`)

The `eventPool` array is currently populated at module load from `events.json` alone. Phase 5
extends this to merge both files:

```
On module load:
  1. Load events.json           → curatedEvents[]
  2. Load generated_events.json (if file exists; silent if absent) → generatedEvents[]
  3. Deduplicate by id (curated events win on collision)
  4. Merge into eventPool[]
```

No changes to the route handlers themselves — they consume `eventPool` unchanged.

### 4.2 Startup fill (`server/index.ts`)

The existing `startServer()` logic that calls `generateEvent()` when `eventPool.length < 5`
is retained but now calls the real `ChroniclerEngine` underneath. No changes to `index.ts`
are needed beyond ensuring `dotenv` is loaded before environment variables are read.

### 4.3 `eventGenerator.ts` (updated façade)

The existing `generateEvent(difficulty)` export is preserved so `index.ts` needs no changes.
Internally it constructs a `ChroniclerEngine` on demand:

```typescript
// server/services/eventGenerator.ts (updated)
export async function generateEvent(difficulty: 'easy' | 'medium' | 'hard'): Promise<HistoricalEvent> {
  const provider = new GeminiProvider(process.env.GEMINI_API_KEY!)
  const engine = new ChroniclerEngine(provider)
  return engine.generateVerifiedEvent(difficulty)
}
```

---

## 5. Environment & Dependencies

### 5.1 New dependency: `dotenv`

`dotenv` loads `server/.env` at startup. Since the server package uses CommonJS, the idiomatic
import is:

```typescript
import 'dotenv/config'  // place at the very top of server/index.ts
```

This must appear **before** any other import that reads `process.env`.

### 5.2 New dependency: `@google/generative-ai`

The official Google Generative AI SDK. Install in `server/`:

```bash
npm install --prefix server @google/generative-ai dotenv
```

| Package | Purpose |
|---------|---------|
| `@google/generative-ai` | Gemini API calls (ships its own TypeScript declarations) |
| `dotenv` | Load `server/.env` into `process.env` (ships its own TypeScript declarations) |

No `@types/` packages needed. **D-23 is the first task to execute** — all subsequent files depend on these packages being installed.

### 5.3 Environment variable

| Key | Where set | Purpose |
|-----|-----------|---------|
| `GEMINI_API_KEY` | `server/.env` | Authenticates all Gemini API calls |

`server/.env` is already git-ignored. The batch script and the engine both fail fast with a
clear error if the key is absent.

---

## 6. `.gitignore` Addition

`server/data/generated_events.json` must be added to the root `.gitignore` — it is ephemeral
generated content and should not be committed.

---

## 7. New Files & Modified Files

### New files

| File | Description |
|------|-------------|
| `project-specs/CHRONICLER_ENGINE_SPEC.md` | This document |
| `server/providers/geminiProvider.ts` | `LLMProvider` interface + `GeminiProvider` class |
| `server/services/chroniclerEngine.ts` | `ChroniclerEngine` orchestrator (generate → validate → adversary) |
| `server/scripts/generateBatch.ts` | CLI batch script → `generated_events.json` |
| `server/data/generated_events.json` | Generated cache (git-ignored; created by batch script) |

### Modified files

| File | Change |
|------|--------|
| `server/services/eventGenerator.ts` | Replace stub body — now constructs `ChroniclerEngine` and delegates |
| `server/routes/game.ts` | Merge `generated_events.json` into `eventPool` at load time |
| `server/index.ts` | Add `import 'dotenv/config'` as the first line |
| `server/package.json` | Add `@google/generative-ai` and `dotenv` to `dependencies` |
| `.gitignore` | Add `server/data/generated_events.json` |
| `project-specs/SYSTEM_ARCHITECTURE.md` | Add `providers/`, `scripts/`, and `generated_events.json` to component map |
| `project-specs/TASK_LIST.md` | Add Phase 5 task entries |

---

## 8. Phase 5 Task Entries (for TASK_LIST.md)

```
## Phase 5 — Chronicler Engine

- [ ] D-23  Install @google/generative-ai + dotenv in server/
- [ ] D-24  Create server/providers/geminiProvider.ts (LLMProvider interface + GeminiProvider)
- [ ] D-25  Create server/services/chroniclerEngine.ts (two-agent Generate/Adversary loop)
- [ ] D-26  Update server/services/eventGenerator.ts (replace stub with ChroniclerEngine façade)
- [ ] D-27  Create server/scripts/generateBatch.ts (CLI cache generator)
- [ ] D-28  Update server/routes/game.ts (merge generated_events.json into eventPool)
- [ ] D-29  Add dotenv/config import to server/index.ts
- [ ] D-30  Update .gitignore + SYSTEM_ARCHITECTURE.md
- [ ] D-31  Run generateBatch.ts — verify 10 events generated and written to cache
- [ ] D-32  Smoke-test: npm run dev → GET /api/game/start returns 5 events from merged pool
```

---

## 9. Error Handling Summary

| Scenario | Behaviour |
|----------|-----------|
| `GEMINI_API_KEY` absent | `GeminiProvider` constructor throws immediately with clear message |
| Gemini API network error | Bubble up to retry loop; counted as attempt; logged via `logLLMTrace` |
| JSON parse failure | Counted as attempt; `retryFeedback` set to parse error message |
| Schema validation failure | Counted as attempt; `retryFeedback` set to specific field error |
| Adversary identifies location | Counted as attempt; `retryFeedback` set to identified location |
| All 3 attempts exhausted | `ChroniclerEngine` throws `ChroniclerError`; batch script logs and skips slot |
| `generated_events.json` absent | `routes/game.ts` catches file-not-found silently; pool uses `events.json` only |

---

## 10. Out of Scope for Phase 5

- Streaming responses (not needed; events are short)
- Coordinate verification against a geocoding API (out of scope; Gemini is expected to provide accurate coords for well-known events; hard tier events may warrant manual review)
- Automatic cache invalidation / TTL (cache is refreshed by manually re-running the batch script)
- UI changes (the frontend is unaware of the event source; Phase 5 is server-only)
