import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

// ESM does not expose __dirname — reconstruct it from import.meta.url.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * ChronoQuizzr Playwright configuration.
 *
 * webServer starts the full dev stack (Vite + ts-node-dev) from the repo root
 * so both the client (5173) and the Express API (3001) are live during tests.
 *
 * colorScheme: 'dark' is forced on every test so theme-related assertions are
 * deterministic regardless of the OS/browser preference.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  // Each spec file runs sequentially; tests within a file run in the declared order.
  fullyParallel: false,

  // Fail the suite immediately if any test uses `.only` (useful in CI).
  forbidOnly: !!process.env.CI,

  // Retry flaky tests once in CI; no retries locally.
  retries: process.env.CI ? 2 : 0,

  // Single worker keeps the dev server stable and prevents race conditions on
  // game state (multiple tabs would compete for the same Express session).
  workers: 1,

  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:5173',

    // Force dark theme so ThemeToggle and theme-class assertions are deterministic.
    colorScheme: 'dark',

    // Capture trace on the first retry of a failing test.
    trace: 'on-first-retry',

    // Generous navigation timeout — the real server may call Anthropic on startup.
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the full dev stack from the repo root before any tests run.
  // Set reuseExistingServer so local dev (with `npm run dev` already running)
  // doesn't conflict; CI always starts a fresh server.
  webServer: {
    command: 'npm run dev',
    cwd: path.resolve(__dirname, '..'),
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    // ts-node-dev transpilation can take up to 15 s on first run.
    timeout: 60_000,
  },
})
