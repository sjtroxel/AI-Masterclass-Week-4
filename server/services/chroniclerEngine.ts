import fs from 'fs'
import path from 'path'
import type { HistoricalEvent } from '@shared/types'
import type { LLMProvider } from '../providers/geminiProvider'
import { FatalProviderError } from '../providers/geminiProvider'
import { logLLMTrace } from '../utils/logger'
import eventsData from '../data/events.json'

// ── Loop constants ────────────────────────────────────────────────────────────

/**
 * Number of adversary checks per topic: 1 initial generation + 2 rewrites.
 * Each failed adversary check triggers a targeted clue rewrite for the SAME
 * event before trying a new historical topic.
 */
const MAX_REWRITES_PER_TOPIC = 3

/**
 * Number of distinct historical topics to attempt before falling back to the
 * seed event pool. Each exhausted topic means all 3 adversary rounds failed.
 */
const MAX_TOPICS = 3

const DIFFICULTY_GUIDANCE: Record<'easy' | 'medium' | 'hard', string> = {
  easy:   'Famous, globally recognised events at iconic locations. Most educated adults should recognise the event.',
  medium: 'Significant but regionally famous events. Requires some historical knowledge to place correctly.',
  hard:   'Obscure events, unusual locations, deep specialist knowledge required. Even historians may need to reason carefully.',
}

/** Typed seed pool — used as the fail-safe fallback when all retries are exhausted. */
const SEED_EVENTS: HistoricalEvent[] = eventsData as HistoricalEvent[]

const GENERATED_EVENTS_PATH = path.resolve(__dirname, '../data/generated_events.json')

// ── Internal types ────────────────────────────────────────────────────────────

interface BlacklistEntry {
  id: string
  locationName: string
}

/**
 * Structured verdict from the Evidence Hunter adversary.
 * Returned as JSON so the engine can extract specific leaked phrases
 * and feed them directly into the rewrite prompt.
 */
interface AdversaryVerdict {
  identified: boolean   // true if the adversary identified a named location
  guess: string         // the identified location, or "OBSCURE"
  evidence: string[]    // specific clue words/phrases that revealed the location
  coordsOk: boolean     // true if coordinates are geographically plausible
  coordsIssue: string   // empty when coordsOk; brief description otherwise
}

interface ValidationResult {
  valid: boolean
  reason?: string
}

// ── Engine ───────────────────────────────────────────────────────────────────

/**
 * Orchestrates the iterative Generate → Adversary → Rewrite loop.
 *
 * Per topic (up to MAX_TOPICS attempts):
 *   Round 1: Generate a new event, run the Evidence Hunter adversary.
 *   Round 2: If identified, rewrite the SAME event's clue using the leaked evidence.
 *   Round 3: One final rewrite attempt.
 *   If 3 adversary checks for a topic all fail → discard and try a new topic.
 *
 * On total exhaustion: logs CRITICAL_RETRY_EXHAUSTED and returns a random
 * seed event so the caller never receives a rejection.
 */
export class ChroniclerEngine {
  constructor(private readonly provider: LLMProvider) {}

  async generateVerifiedEvent(
    difficulty: 'easy' | 'medium' | 'hard',
    alreadyGenerated: HistoricalEvent[] = []
  ): Promise<HistoricalEvent> {

    // Build blacklist once — seed events + previously generated on disk + current batch
    const onDisk   = loadGeneratedEvents()
    const blacklist: BlacklistEntry[] = [...SEED_EVENTS, ...onDisk, ...alreadyGenerated]
      .map((e) => ({ id: e.id, locationName: e.locationName }))
      .filter((entry, idx, arr) => arr.findIndex((x) => x.id === entry.id) === idx)

    let lastTopicFailureReason = ''

    for (let topicAttempt = 1; topicAttempt <= MAX_TOPICS; topicAttempt++) {

      // ── Phase 1: Initial Generation ─────────────────────────────────────────
      const generatorPrompt = buildGeneratorPrompt(
        difficulty, topicAttempt, lastTopicFailureReason, blacklist
      )
      let rawJson: string

      try {
        rawJson = await this.provider.completeJson(generatorPrompt)
      } catch (err) {
        if (err instanceof FatalProviderError) throw err
        const errMsg = err instanceof Error ? err.message : String(err)
        logLLMTrace(
          `[GEN — Topic ${topicAttempt}/${MAX_TOPICS} — ${difficulty}]\n${generatorPrompt}`,
          `[API ERROR] ${errMsg}`
        )
        lastTopicFailureReason = `Generation API error: ${errMsg}`
        continue
      }

      logLLMTrace(
        `[GEN — Topic ${topicAttempt}/${MAX_TOPICS} — ${difficulty}]\n${generatorPrompt}`,
        rawJson
      )

      const schemaCheck = validateSchema(rawJson)
      if (!schemaCheck.valid) {
        logLLMTrace(
          `[SCHEMA — Topic ${topicAttempt}/${MAX_TOPICS}]`,
          `FAIL: ${schemaCheck.reason}`
        )
        lastTopicFailureReason = `Schema invalid: ${schemaCheck.reason}`
        continue
      }

      let candidate = JSON.parse(rawJson) as HistoricalEvent

      // ── Phase 2–4: Evidence Hunter + Iterative Rewrite ──────────────────────
      let topicFailedReason = ''

      for (let rewriteRound = 1; rewriteRound <= MAX_REWRITES_PER_TOPIC; rewriteRound++) {

        // ── Adversary check ──────────────────────────────────────────────────
        const adversaryPrompt = buildAdversaryPrompt(candidate, topicAttempt, rewriteRound)
        let verdictRaw: string

        try {
          verdictRaw = await this.provider.completeJson(adversaryPrompt)
        } catch (err) {
          if (err instanceof FatalProviderError) throw err
          const errMsg = err instanceof Error ? err.message : String(err)
          logLLMTrace(
            `[ADVERSARY — Topic ${topicAttempt}/${MAX_TOPICS} Round ${rewriteRound}/${MAX_REWRITES_PER_TOPIC}]\n${adversaryPrompt}`,
            `[API ERROR] ${errMsg}`
          )
          topicFailedReason = `Adversary API error: ${errMsg}`
          break
        }

        logLLMTrace(
          `[ADVERSARY — Topic ${topicAttempt}/${MAX_TOPICS} Round ${rewriteRound}/${MAX_REWRITES_PER_TOPIC}]\n${adversaryPrompt}`,
          verdictRaw
        )

        const verdictParse = parseAdversaryVerdict(verdictRaw)
        if (!verdictParse.valid) {
          logLLMTrace(
            `[VERDICT PARSE — Topic ${topicAttempt}/${MAX_TOPICS} Round ${rewriteRound}/${MAX_REWRITES_PER_TOPIC}]`,
            `FAIL: ${verdictParse.reason}`
          )
          topicFailedReason = `Verdict parse error: ${verdictParse.reason}`
          break
        }

        const verdict = verdictParse.verdict!

        // ── PASS ─────────────────────────────────────────────────────────────
        if (!verdict.identified && verdict.coordsOk) {
          return candidate // ✓ VERIFIED
        }

        // ── FAIL: coordinate hallucination — rewrite won't fix bad coords ────
        if (!verdict.coordsOk) {
          topicFailedReason = `Geographic hallucination: ${verdict.coordsIssue}`
          logLLMTrace(
            `[COORDS INVALID — Topic ${topicAttempt}/${MAX_TOPICS}]`,
            topicFailedReason
          )
          break
        }

        // ── FAIL: identified — log and decide whether to rewrite or discard ──
        const leakedEvidence = verdict.evidence.length > 0
          ? verdict.evidence.join(', ')
          : 'unspecified phrases'

        logLLMTrace(
          `[IDENTIFIED — Topic ${topicAttempt}/${MAX_TOPICS} Round ${rewriteRound}/${MAX_REWRITES_PER_TOPIC}]`,
          `Adversary identified: "${verdict.guess}" via evidence: [${leakedEvidence}]`
        )

        if (rewriteRound === MAX_REWRITES_PER_TOPIC) {
          topicFailedReason =
            `Exhausted all ${MAX_REWRITES_PER_TOPIC} rewrite rounds for topic "${candidate.id}". ` +
            `Adversary kept identifying: "${verdict.guess}".`
          break
        }

        // ── REWRITE the clue for the same event ──────────────────────────────
        const rewritePrompt = buildRewritePrompt(candidate, verdict, rewriteRound)
        let rewriteRaw: string

        try {
          rewriteRaw = await this.provider.completeJson(rewritePrompt)
        } catch (err) {
          if (err instanceof FatalProviderError) throw err
          const errMsg = err instanceof Error ? err.message : String(err)
          logLLMTrace(
            `[REWRITE — Topic ${topicAttempt}/${MAX_TOPICS} Round ${rewriteRound + 1}/${MAX_REWRITES_PER_TOPIC}]\n${rewritePrompt}`,
            `[API ERROR] ${errMsg}`
          )
          topicFailedReason = `Rewrite API error: ${errMsg}`
          break
        }

        logLLMTrace(
          `[REWRITE — Topic ${topicAttempt}/${MAX_TOPICS} Round ${rewriteRound + 1}/${MAX_REWRITES_PER_TOPIC}]\n${rewritePrompt}`,
          rewriteRaw
        )

        const rewriteSchema = validateSchema(rewriteRaw)
        if (!rewriteSchema.valid) {
          logLLMTrace(
            `[SCHEMA — Rewrite Topic ${topicAttempt}/${MAX_TOPICS} Round ${rewriteRound + 1}/${MAX_REWRITES_PER_TOPIC}]`,
            `FAIL: ${rewriteSchema.reason}`
          )
          topicFailedReason = `Rewrite schema invalid: ${rewriteSchema.reason}`
          break
        }

        const rewritten = JSON.parse(rewriteRaw) as HistoricalEvent

        // Guard against topic drift (LLM swapped the event)
        if (rewritten.id !== candidate.id) {
          logLLMTrace(
            `[TOPIC DRIFT — Topic ${topicAttempt}/${MAX_TOPICS}]`,
            `Expected id="${candidate.id}", got id="${rewritten.id}". Discarding rewrite.`
          )
          topicFailedReason = `Topic drift: LLM changed event from "${candidate.id}" to "${rewritten.id}"`
          break
        }

        candidate = rewritten
        // Loop back to adversary check on the rewritten clue
      }

      lastTopicFailureReason = topicFailedReason
    }

    // ── Total Exhaustion ─────────────────────────────────────────────────────
    const exhaustionMsg =
      `[CRITICAL_RETRY_EXHAUSTED] ChroniclerEngine failed to produce a verified ` +
      `"${difficulty}" event after ${MAX_TOPICS} topics × ${MAX_REWRITES_PER_TOPIC} rounds. ` +
      `Last failure: ${lastTopicFailureReason}. ` +
      `Returning a random seed event as fallback.`

    logLLMTrace('[CRITICAL_RETRY_EXHAUSTED]', exhaustionMsg)
    console.warn(`\n⚠  ${exhaustionMsg}\n`)

    return loadFallbackEvent(difficulty)
  }
}

// ── Generator Prompt ─────────────────────────────────────────────────────────

function buildGeneratorPrompt(
  difficulty: 'easy' | 'medium' | 'hard',
  topicAttempt: number,
  lastTopicFailureReason: string,
  blacklist: BlacklistEntry[]
): string {
  const topicRetrySection = lastTopicFailureReason
    ? `\nPREVIOUS TOPIC FAILED (topic ${topicAttempt - 1} of ${MAX_TOPICS}):\n` +
      `${lastTopicFailureReason}\n` +
      `Choose a completely different historical event for this new attempt.\n`
    : ''

  const blacklistSection = blacklist.length > 0
    ? `\nDATABASE BLACKLIST — these events already exist. Do NOT recreate them and avoid ` +
      `events from the same city or landmark as any entry below:\n` +
      blacklist.map((e) => `- ${e.id}  →  ${e.locationName}`).join('\n') + '\n'
    : ''

  return `You are The Chronicler, a historian and puzzle designer for ChronoQuizzr, a historically-based geography game where players guess event locations on a map.

Generate ONE historical event record as a JSON object with EXACTLY these fields:
{
  "id": "<kebab-case-slug-year>",
  "year": "<year-string>",
  "locationName": "<Landmark, City, Country>",
  "clue": "<obfuscated clue text>",
  "hiddenCoords": { "lat": <number>, "lng": <number> },
  "difficulty": "${difficulty}",
  "source_url": "<URL>"
}

FIELD NOTES:
- "id": unique kebab-case identifier, e.g. "marathon-490bc" or "moon-landing-1969"
- "year": string; follow the CENTURY THRESHOLD RULE:
    • Post-1500 CE  → exact year, no suffix:          "1989", "1914", "1571"
    • Pre-1500 CE   → add "c." prefix, no suffix:     "c. 1450", "c. 79", "c. 1066"
    • BCE events    → year + " BCE" suffix:            "44 BCE", "490 BCE", "1274 BCE"
    • Ancient/approx→ century-level phrase:            "c. 3rd century BCE"
  NEVER use negative integers. NEVER append "AD" or "CE" to any year. Never omit "c." for pre-1500 CE dates.
- "locationName": full descriptive name for the post-guess reveal, e.g. "Trafalgar Square, London, United Kingdom"
- "source_url": a real, verifiable URL — Wikipedia preferred
- "hiddenCoords": WGS84 decimal degrees; must be on land (or coastal water only if the event is explicitly maritime)

DIFFICULTY GUIDANCE (${difficulty}):
${DIFFICULTY_GUIDANCE[difficulty]}

OBFUSCATION RULES — violations cause immediate rejection:
1. The "clue" MUST NOT contain: city names, country names, region names, person names,
   monument names, river names, or any other named geographical or cultural identifier.
2. Replace all named references with contextual, descriptive language only:
   "a narrow strait", "a mountainous inland plateau", "a coastal trading empire",
   "the era's foremost maritime power", "a great river delta city".
3. The clue MUST remain solvable by an informed player using era, topography,
   political context, and historical significance.
4. Re-read your clue: if a knowledgeable reader could Google the location in under
   10 seconds from the clue text alone, it is too specific — revise it.
${blacklistSection}${topicRetrySection}
Return ONLY the raw JSON object. No markdown, no code fences, no explanation.`
}

// ── Adversary Prompt (Evidence Hunter) ───────────────────────────────────────

function buildAdversaryPrompt(
  candidate: HistoricalEvent,
  topicAttempt: number,
  rewriteRound: number
): string {
  const { clue, year, hiddenCoords: { lat, lng } } = candidate
  const label = `Topic ${topicAttempt}/${MAX_TOPICS}, Round ${rewriteRound}/${MAX_REWRITES_PER_TOPIC}`

  return `You are an expert historian conducting an adversarial quality check (${label}).

Analyze the historical event clue below and return a JSON assessment.

Year: ${year}
Clue: "${clue}"
Coordinates to verify: lat ${lat}, lng ${lng}

Return a JSON object with EXACTLY these fields:
{
  "identified": <boolean>,
  "guess": "<string>",
  "evidence": ["<phrase>", ...],
  "coordsOk": <boolean>,
  "coordsIssue": "<string>"
}

CHECK 1 — OBFUSCATION:
Using ONLY the clue text and year, can you name a specific city, country, region, or landmark?
- If YES: "identified": true, "guess": the named location, "evidence": array of the exact
  words or phrases in the clue that reveal it (e.g. "Nile", "river delta", "Eiffel").
- If NO:  "identified": false, "guess": "OBSCURE", "evidence": [].

CHECK 2 — COORDINATE PLAUSIBILITY:
Are the coordinates geographically consistent with the described event?
Consider: correct continent, not in open ocean for a land-based event, consistent with
historical/cultural context (era, climate zone, topography).
- If plausible:   "coordsOk": true,  "coordsIssue": "".
- If implausible: "coordsOk": false, "coordsIssue": brief description of the problem.

Return ONLY the raw JSON object. No markdown, no code fences, no prose.`
}

// ── Rewrite Prompt ────────────────────────────────────────────────────────────

function buildRewritePrompt(
  candidate: HistoricalEvent,
  verdict: AdversaryVerdict,
  rewriteRound: number
): string {
  const evidenceList = verdict.evidence.length > 0
    ? verdict.evidence.map((e) => `  - "${e}"`).join('\n')
    : '  (no specific phrases listed — use your judgement to make the clue more cryptic)'

  return `You are The Chronicler. A clue was rejected because it reveals the location (rewrite ${rewriteRound} of ${MAX_REWRITES_PER_TOPIC - 1}).

ADVERSARY VERDICT:
- Location identified as: "${verdict.guess}"
- Leaked phrases that gave it away:
${evidenceList}

THE SAME EVENT — keep ALL fields below UNCHANGED, rewrite ONLY the "clue":
{
  "id": "${candidate.id}",
  "year": "${candidate.year}",
  "locationName": "${candidate.locationName}",
  "hiddenCoords": { "lat": ${candidate.hiddenCoords.lat}, "lng": ${candidate.hiddenCoords.lng} },
  "difficulty": "${candidate.difficulty}",
  "source_url": "${candidate.source_url}"
}

YOUR TASK:
- Eliminate every leaked phrase listed above.
- Replace them with vaguer contextual language: era, topography, political context.
- The rewritten clue must still be solvable by an informed player.
- Do NOT introduce any new named identifiers (cities, countries, monuments, people, rivers).

OBFUSCATION RULES (same as always):
1. No city names, country names, region names, person names, monument names, or river names.
2. Use contextual language: "a coastal empire", "a mountainous plateau", "a river delta city".
3. Clue must remain solvable via era, topography, and historical significance.
4. If a reader could Google the location in < 10 seconds, revise further.

Return the COMPLETE event JSON with the rewritten "clue" and ALL other fields identical to the values above.`
}

// ── Schema & Coordinate Validator ────────────────────────────────────────────

function validateSchema(raw: string): ValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      valid: false,
      reason: 'Response was not valid JSON. Return ONLY a raw JSON object — no markdown fences, no prose.',
    }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, reason: 'Response must be a JSON object, not an array or primitive value.' }
  }

  const obj = parsed as Record<string, unknown>

  const required = ['id', 'year', 'locationName', 'clue', 'hiddenCoords', 'difficulty', 'source_url']
  const missing = required.filter((f) => !(f in obj))
  if (missing.length > 0) {
    return { valid: false, reason: `Missing required fields: ${missing.join(', ')}.` }
  }

  if (typeof obj.id !== 'string' || obj.id.trim().length === 0) {
    return { valid: false, reason: 'Type error: "id" must be a non-empty string.' }
  }
  if (typeof obj.year !== 'string' || obj.year.trim().length === 0) {
    return { valid: false, reason: 'Type error: "year" must be a non-empty string (e.g. "1989", "c. 490 BCE").' }
  }
  if (typeof obj.locationName !== 'string' || obj.locationName.trim().length === 0) {
    return { valid: false, reason: 'Type error: "locationName" must be a non-empty string.' }
  }
  if (typeof obj.clue !== 'string' || obj.clue.trim().length < 50) {
    return { valid: false, reason: 'Type error: "clue" must be a string of at least 50 characters.' }
  }
  if (!['easy', 'medium', 'hard'].includes(obj.difficulty as string)) {
    return { valid: false, reason: '"difficulty" must be one of "easy", "medium", or "hard".' }
  }
  if (typeof obj.source_url !== 'string' || !obj.source_url.startsWith('http')) {
    return { valid: false, reason: 'Type error: "source_url" must be a valid HTTP/HTTPS URL.' }
  }
  if (typeof obj.hiddenCoords !== 'object' || obj.hiddenCoords === null || Array.isArray(obj.hiddenCoords)) {
    return { valid: false, reason: 'Type error: "hiddenCoords" must be a plain object { lat, lng }.' }
  }
  const coords = obj.hiddenCoords as Record<string, unknown>
  if (typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
    return { valid: false, reason: 'Type error: "hiddenCoords.lat" and "hiddenCoords.lng" must be numbers.' }
  }
  if (coords.lat < -90 || coords.lat > 90) {
    return {
      valid: false,
      reason: `Coordinates out of range: "hiddenCoords.lat" must be in [-90, 90], got ${coords.lat}.`,
    }
  }
  if (coords.lng < -180 || coords.lng > 180) {
    return {
      valid: false,
      reason: `Coordinates out of range: "hiddenCoords.lng" must be in [-180, 180], got ${coords.lng}.`,
    }
  }

  return { valid: true }
}

// ── Adversary Verdict Parser ──────────────────────────────────────────────────

function parseAdversaryVerdict(
  raw: string
): { valid: boolean; verdict?: AdversaryVerdict; reason?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { valid: false, reason: 'Adversary response was not valid JSON.' }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, reason: 'Adversary response must be a JSON object.' }
  }

  const obj = parsed as Record<string, unknown>

  if (typeof obj.identified !== 'boolean') {
    return { valid: false, reason: '"identified" must be a boolean.' }
  }
  if (typeof obj.guess !== 'string') {
    return { valid: false, reason: '"guess" must be a string.' }
  }
  if (!Array.isArray(obj.evidence) || !obj.evidence.every((e) => typeof e === 'string')) {
    return { valid: false, reason: '"evidence" must be an array of strings.' }
  }
  if (typeof obj.coordsOk !== 'boolean') {
    return { valid: false, reason: '"coordsOk" must be a boolean.' }
  }
  if (typeof obj.coordsIssue !== 'string') {
    return { valid: false, reason: '"coordsIssue" must be a string.' }
  }

  return {
    valid: true,
    verdict: {
      identified:  obj.identified as boolean,
      guess:       obj.guess as string,
      evidence:    obj.evidence as string[],
      coordsOk:    obj.coordsOk as boolean,
      coordsIssue: obj.coordsIssue as string,
    },
  }
}

// ── Generated Events Loader ───────────────────────────────────────────────────

function loadGeneratedEvents(): HistoricalEvent[] {
  try {
    if (!fs.existsSync(GENERATED_EVENTS_PATH)) return []
    return JSON.parse(fs.readFileSync(GENERATED_EVENTS_PATH, 'utf-8')) as HistoricalEvent[]
  } catch {
    return []
  }
}

// ── Fallback Event Loader ─────────────────────────────────────────────────────

/**
 * Returns a random seed event from events.json, preferring the requested
 * difficulty tier. Falls back to any event if no match exists.
 */
function loadFallbackEvent(difficulty: 'easy' | 'medium' | 'hard'): HistoricalEvent {
  const matching = SEED_EVENTS.filter((e) => e.difficulty === difficulty)
  const pool = matching.length > 0 ? matching : SEED_EVENTS
  return pool[Math.floor(Math.random() * pool.length)]
}
