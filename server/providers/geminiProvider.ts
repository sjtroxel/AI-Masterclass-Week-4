import { GoogleGenerativeAI, GenerativeModel, GoogleGenerativeAIFetchError } from '@google/generative-ai'

/**
 * Thrown by any LLMProvider implementation when the error is fatal —
 * meaning retrying will not help and the entire batch should stop.
 *
 * Fatal conditions: authentication failure (401/403) and quota exhaustion (429/529).
 */
export class FatalProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message)
    this.name = 'FatalProviderError'
  }
}

/**
 * Minimal interface for any text-completion LLM provider.
 *
 * @remarks
 * Two variants are defined so the Chronicler Engine can request plain text
 * (Adversary prompt) or structured JSON (Generator prompt) through the same
 * abstraction, without coupling the interface to Gemini-specific options.
 *
 * Any alternative provider (Claude, OpenAI, etc.) must implement both methods.
 */
export interface LLMProvider {
  /** Send a prompt and receive a plain-text response. */
  complete(prompt: string): Promise<string>
  /**
   * Send a prompt and receive a raw JSON string response.
   * Implementations should configure the underlying model to return JSON
   * without markdown fences or surrounding prose.
   */
  completeJson(prompt: string): Promise<string>
}

/**
 * Per-model configuration for `GeminiProvider`.
 *
 * Allowing separate models for Generator and Adversary is intentional:
 * the Generator benefits from a higher-quality reasoning model (gemini-2.5-flash)
 * while the Adversary only needs fast detection (gemini-2.0-flash, 15 RPM free tier).
 * Splitting the load keeps both agents within their respective rate-limit budgets.
 */
export interface GeminiProviderOptions {
  /** Model used by `completeJson()` — the Generator agent. Defaults to `gemini-2.0-flash`. */
  generatorModel?: string
  /** Model used by `complete()` — the Adversary agent. Defaults to `gemini-2.0-flash`. */
  adversaryModel?: string
}

const RATE_LIMIT_RETRY_DELAY_MS = 15_000

/**
 * Concrete LLMProvider backed by the Google Generative AI SDK (Gemini).
 *
 * - `completeJson()` (Generator) uses `generatorModel` (default: gemini-2.5-flash)
 *   with `responseMimeType: application/json`.
 * - `complete()` (Adversary) uses `adversaryModel` (default: gemini-2.0-flash)
 *   for plain-text two-line responses.
 *
 * Both methods automatically retry once on a 429 rate-limit response,
 * waiting `RATE_LIMIT_RETRY_DELAY_MS` (15s) before the retry attempt.
 */
export class GeminiProvider implements LLMProvider {
  private readonly textModel: GenerativeModel  // adversary — plain text
  private readonly jsonModel: GenerativeModel  // generator — JSON output

  /**
   * @param apiKey  - A valid Gemini API key. Throws immediately if absent.
   * @param options - Optional model overrides. See `GeminiProviderOptions`.
   */
  constructor(apiKey: string, options: GeminiProviderOptions = {}) {
    if (!apiKey) {
      throw new Error(
        '[GeminiProvider] GEMINI_API_KEY is required. ' +
        'Ensure server/.env is present and dotenv is loaded before instantiation.'
      )
    }

    const {
      generatorModel = 'gemini-2.0-flash',
      adversaryModel = 'gemini-2.0-flash',
    } = options

    const genAI = new GoogleGenerativeAI(apiKey)

    this.textModel = genAI.getGenerativeModel({ model: adversaryModel })

    this.jsonModel = genAI.getGenerativeModel({
      model: generatorModel,
      generationConfig: { responseMimeType: 'application/json' },
    })
  }

  /**
   * Internal helper: calls `model.generateContent(prompt)` and returns the
   * response text. On a 429 rate-limit error, waits 15s and retries once.
   * Any other error, or a second consecutive 429, is re-thrown to the caller.
   */
  private async callWithRetry(model: GenerativeModel, prompt: string): Promise<string> {
    try {
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (err) {
      if (err instanceof GoogleGenerativeAIFetchError && err.status === 429) {
        console.warn(
          `[GeminiProvider] Rate limit (429) — waiting ${RATE_LIMIT_RETRY_DELAY_MS / 1000}s before retry…`
        )
        await sleep(RATE_LIMIT_RETRY_DELAY_MS)
        const retryResult = await model.generateContent(prompt)
        return retryResult.response.text()
      }
      throw err
    }
  }

  /** Adversary path — returns plain text (two-line CHECK format). */
  async complete(prompt: string): Promise<string> {
    return this.callWithRetry(this.textModel, prompt)
  }

  /** Generator path — returns raw JSON string (no markdown fences). */
  async completeJson(prompt: string): Promise<string> {
    return this.callWithRetry(this.jsonModel, prompt)
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
