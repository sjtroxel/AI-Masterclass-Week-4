# ADR: Pivot from Gemini to Anthropic (Haiku) — Phase 5 LLM Provider

**Date:** 2026-02-28
**Status:** Accepted
**Decider:** Developer + Claude Code session

---

## Context

Phase 5 of ChronoQuizzr introduced the Chronicler Engine — a two-agent adversarial loop
that generates verified historical event clues. The engine requires an LLM provider
implementing the `LLMProvider` interface (`completeJson`, `complete`).

The original choice was **Google Gemini via the free tier** (`@google/generative-ai` SDK).

---

## What We Tried (Gemini — All Failed)

### Attempt 1: `gemini-2.5-flash` (Generator) + `gemini-2.0-flash` (Adversary)

Split-model configuration. Ran into daily quota limits (HTTP 429) after a few events.
The Gemini free tier enforces a per-day token budget; a batch of 10 events exhausted it
by the third or fourth slot.

### Attempt 2: Unified `gemini-2.0-flash` pipeline

Consolidated to a single model to reduce RPM pressure. Same result — 429 errors.
The daily token quota was the binding constraint, not the per-minute rate.

### Attempt 3: `gemini-1.5-flash`

Tried the older model hoping for a separate quota bucket. Same quota wall.
Added a 15-second retry delay on 429 — this masked individual errors but could not
overcome a daily exhaustion event.

### Root cause

Gemini's **free tier imposes a daily token quota** shared across all models.
The Chronicler Engine generates up to 9 API calls per event slot (3 topics × 3 rounds)
plus adversary checks. A 10-event batch can issue 60–90+ calls, trivially exhausting
the free daily budget. There is no paid-tier option that doesn't require billing setup.

---

## Decision

**Pivot to Anthropic API** using `claude-haiku-4-5-20251001` (Haiku 4.5) for both
the Generator and Adversary roles.

### Why Haiku specifically

- Lowest cost in the Claude model family — appropriate for high-volume batch generation
- Sufficient capability for structured JSON output and adversarial clue evaluation
- Anthropic API access was already provisioned (`ANTHROPIC_API_KEY` in `.env`)
- Single model for both roles simplifies the provider implementation

### Why not a higher Claude tier

The prompts are well-structured and the tasks (JSON generation + binary classification)
do not require Sonnet or Opus reasoning depth. Haiku keeps per-batch cost minimal.

---

## Implementation

### Provider Abstraction (retained from Gemini design)

The `LLMProvider` interface in `server/providers/geminiProvider.ts` was kept as-is.
`AnthropicProvider` implements the same two methods:

```typescript
export interface LLMProvider {
  complete(prompt: string): Promise<string>      // plain text (adversary)
  completeJson(prompt: string): Promise<string>  // raw JSON string (generator/rewrite)
}
```

`AnthropicProvider` adds markdown-fence stripping in `completeJson()` because Haiku
sometimes wraps JSON in triple-backticks despite being instructed not to. This is
invisible to the engine.

### Fatal Error Propagation

A new `FatalProviderError` class (exported from `geminiProvider.ts` alongside the
interface) signals errors that no retry will fix:

| HTTP Status | Meaning | Action |
|---|---|---|
| 401 | Invalid API key | Stop batch immediately |
| 403 | Permission denied | Stop batch immediately |
| 404 | Model not found (e.g. deprecated model) | Stop batch immediately |
| 429 | Rate limit / quota exhausted | Stop batch immediately |
| 529 | Anthropic overloaded | Stop batch immediately |

The engine re-throws `FatalProviderError` from all three catch blocks (generator,
adversary, rewrite). The batch script catches it at the outer loop and breaks.
This prevents the engine's retry logic from issuing dozens of doomed API calls.

### Model Deprecation Incident (2026-02-28)

The first batch attempt used `claude-3-5-haiku-latest`. This model reached end-of-life
on **2026-02-19** (9 days before this session). The API returned HTTP 404 on every call.
Because 404 was not yet in the `FatalProviderError` list, the engine exhausted all
MAX_TOPICS × MAX_REWRITES retry slots (9 calls per event) and fell back to seed events
for all 10 slots — a full batch failure with no useful output.

**Fix applied:**
1. Model updated to the pinned ID `claude-haiku-4-5-20251001` — never use `*-latest`
   aliases in production; they expire without warning.
2. HTTP 404 added to `FatalProviderError` so model-not-found stops the batch on the
   first call rather than burning all retries.

---

## Batch Results (Second Run — claude-haiku-4-5-20251001)

All 10 events generated fresh. No fallbacks to seed events. No rate limits.

| Slot | Difficulty | Event | Adversary rounds |
|---|---|---|---|
| 1 | easy | Pompeii eruption (79 AD) | Topic 1 (Colosseum) exhausted × 3 rewrites → Topic 2 passed round 1 |
| 2 | easy | Colossus of Rhodes (−280) | Passed round 1 |
| 3 | medium | Gutenberg printing press (1440) | Passed round 1 |
| 4 | medium | Battle of Kadesh (−1274) | Passed round 1 |
| 5 | medium | Battle of Lepanto (1571) | Passed round 1 |
| 6 | hard | Zheng He voyage — Nanjing (1405) | 1 rewrite, passed round 2 |
| 7 | hard | Library of Alexandria (−48) | Passed round 1 |
| 8 | hard | Zheng He voyage — Malindi (1418) | 1 rewrite, passed round 2 |
| 9 | hard | Siege of Szigetvár (1566) | 1 rewrite, passed round 2 |
| 10 | hard | Tegucigalpa coup (2009) | Passed round 1 |

**Notable:** The Colosseum (Topic 1 for slot 1) failed all three rewrite rounds. Every
rewrite the Chronicler produced still unmistakably described the Colosseum — the
amphitheater, naval flood battles, and imperial capital context are too distinctive.
The engine correctly discarded the topic and tried Pompeii on Topic 2. This is the
adversarial loop working as designed.

**Known quirk:** Two Zheng He voyages landed in the same batch (slots 6 and 8, different
ports). The blacklist deduplicates by event `id` and `locationName` — it does not prevent
the same voyage/explorer appearing twice at different stops. Not a bug in the current
spec but worth noting for future batch diversity.

---

## Files Changed

| File | Change |
|---|---|
| `server/providers/anthropicProvider.ts` | Created — `AnthropicProvider` + markdown fence stripper |
| `server/providers/geminiProvider.ts` | Added `FatalProviderError` export |
| `server/services/chroniclerEngine.ts` | Imports `FatalProviderError`; re-throws in all 3 catch blocks |
| `server/services/eventGenerator.ts` | Swapped `GeminiProvider` → `AnthropicProvider` |
| `server/scripts/generateBatch.ts` | Swapped provider + env var; catches `FatalProviderError` |
| `server/routes/game.ts` | Merges `events.json` + `generated_events.json` into `eventPool` |
| `server/package.json` | Added `@anthropic-ai/sdk` dependency |
| `project-specs/SYSTEM_ARCHITECTURE.md` | Updated component map and EventGenerator section |

---

## Consequences

- **GeminiProvider is retained** in the codebase. It is not wired into any runtime path.
  It can be deleted in a future cleanup once the Anthropic provider has proven stable.
- The `LLMProvider` interface remains provider-agnostic. Swapping providers in the future
  requires only changing the constructor call in `eventGenerator.ts` and `generateBatch.ts`.
- **Never use `*-latest` model aliases** in either provider. Always pin to the full model ID
  (e.g. `claude-haiku-4-5-20251001`) to avoid silent 404 failures when Anthropic retires an alias.
