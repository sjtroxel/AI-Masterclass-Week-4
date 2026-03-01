import type { LLMProvider } from './geminiProvider'
import { FatalProviderError } from './geminiProvider'

/**
 * Mock LLM provider for use in tests only. Never import this in production code.
 *
 * Accepts a pre-scripted array of response strings. Each call to `completeJson`
 * returns the next string in the array (cycling via modulo when exhausted).
 *
 * Special sentinel values:
 *   '__FATAL__' — throws FatalProviderError (simulates bad API key / quota)
 *   '__ERROR__' — throws a generic transient Error (simulates network failure)
 */
export class MockProvider implements LLMProvider {
  private readonly responses: string[]
  private callIndex = 0

  constructor(responses: string[]) {
    this.responses = responses
  }

  async complete(_prompt: string): Promise<string> {
    return this.completeJson(_prompt)
  }

  async completeJson(_prompt: string): Promise<string> {
    const response = this.responses[this.callIndex % this.responses.length]
    this.callIndex++
    if (response === '__FATAL__') throw new FatalProviderError('Mock fatal error', 500)
    if (response === '__ERROR__') throw new Error('Mock transient error')
    return response
  }
}
