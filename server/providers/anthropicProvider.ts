import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider } from './geminiProvider'
import { FatalProviderError } from './geminiProvider'

const MODEL = 'claude-haiku-4-5-20251001'

/**
 * Concrete LLMProvider backed by the Anthropic SDK (Claude).
 *
 * - Both `complete()` and `completeJson()` use claude-3-5-haiku-latest.
 * - `completeJson()` strips any markdown fences the model may emit despite
 *   being instructed not to, so the caller always receives a raw JSON string.
 * - Auth errors (401/403) and quota/overload errors (429/529) throw
 *   `FatalProviderError`, which signals the engine to abort the batch
 *   immediately rather than burning through retry slots.
 */
export class AnthropicProvider implements LLMProvider {
  private readonly client: Anthropic

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error(
        '[AnthropicProvider] ANTHROPIC_API_KEY is required. ' +
        'Ensure server/.env is present and dotenv is loaded before instantiation.'
      )
    }
    this.client = new Anthropic({ apiKey })
  }

  /** Adversary path — returns plain text. */
  async complete(prompt: string): Promise<string> {
    return this.call(prompt)
  }

  /** Generator / rewrite path — returns raw JSON string (fences stripped). */
  async completeJson(prompt: string): Promise<string> {
    const raw = await this.call(prompt)
    return stripMarkdownFences(raw)
  }

  private async call(prompt: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      })

      const block = response.content[0]
      if (!block || block.type !== 'text') {
        throw new Error('[AnthropicProvider] Unexpected non-text response block from API.')
      }
      return block.text
    } catch (err) {
      // Propagate fatal errors immediately — no point retrying auth or quota failures
      if (err instanceof Anthropic.APIError) {
        const status = err.status
        if (status === 401 || status === 403 || status === 404 || status === 429 || status === 529) {
          throw new FatalProviderError(
            `[AnthropicProvider] Fatal API error (HTTP ${status}): ${err.message}`,
            status
          )
        }
      }
      throw err
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Strips leading/trailing markdown code fences if the model emitted them
 * despite being instructed to return raw JSON only.
 */
function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
}
