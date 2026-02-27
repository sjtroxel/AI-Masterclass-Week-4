import fs from 'fs';
import path from 'path';

const LOG_DIR = path.resolve(__dirname, '../logs');
const LOG_PATH = path.join(LOG_DIR, 'llm_trace.log');
const DIVIDER = '─'.repeat(80);

/**
 * Appends an LLM prompt/response pair to logs/llm_trace.log.
 * Call this whenever the EventGenerator sends a request to the Claude API.
 *
 * @param prompt  - The full prompt string sent to the LLM.
 * @param response - The raw response string received from the LLM.
 */
export function logLLMTrace(prompt: string, response: string): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}]\nPROMPT:\n${prompt}\n\nRESPONSE:\n${response}\n${DIVIDER}\n\n`;

  fs.appendFileSync(LOG_PATH, entry, 'utf-8');
}
