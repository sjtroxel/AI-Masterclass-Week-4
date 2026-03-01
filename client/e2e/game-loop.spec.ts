import { test, expect } from '@playwright/test'

// ─── Selectors ────────────────────────────────────────────────────────────────
// Centralised so a component rename only needs one fix here.

const LOADING_TEXT    = /the chronicler is consulting the archives/i
const SUBMIT_BTN      = /submit guess/i
const NEXT_BTN        = /next round|final score/i
const PLAY_AGAIN_BTN  = /play again/i
const ROUND_LOGBOOK   = /round logbook/i
const THEME_TOGGLE    = /switch to aged map/i  // aria-label in dark mode

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Drop a pin on the Leaflet map and submit the guess for one round.
 * Waits for the ResultsOverlay to confirm the server scored the guess.
 */
async function playOneRound(page: import('@playwright/test').Page, round: number) {
  // The Submit button exists but is disabled until the player drops a pin.
  const submitBtn = page.getByRole('button', { name: SUBMIT_BTN })
  await expect(submitBtn).toBeDisabled()

  // Click near the centre of the map to drop a pin.
  // Leaflet normalises the DOM click into a map-level event which triggers
  // PinDropHandler → onPinDrop → GameBoard setGuessCoords.
  await page.locator('.leaflet-container').click({ position: { x: 400, y: 300 } })

  // Submit button should now be enabled (guessCoords is non-null).
  await expect(submitBtn).toBeEnabled()
  await submitBtn.click()

  // ResultsOverlay: wait for the round indicator which only appears post-score.
  // Timeout is generous because the real server may call Anthropic for scoring.
  await expect(
    page.getByText(new RegExp(`round ${round} of 5`, 'i'))
  ).toBeVisible({ timeout: 30_000 })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Full Game Journey', () => {
  test('completes all 5 rounds and reaches the Play Again screen', async ({ page }) => {
    await page.goto('/')

    // ── Loading state ─────────────────────────────────────────────────────────
    // The initial React render always shows the loading state before the session
    // fetch resolves, so this assertion fires on the very first paint.
    await expect(page.getByText(LOADING_TEXT)).toBeVisible({ timeout: 10_000 })

    // ── Playing phase ─────────────────────────────────────────────────────────
    // Wait for the session fetch to complete: loading text gone, Submit appears.
    await expect(page.getByText(LOADING_TEXT)).not.toBeVisible({ timeout: 30_000 })

    // ── 5 rounds ──────────────────────────────────────────────────────────────
    for (let round = 1; round <= 5; round++) {
      await playOneRound(page, round)

      // Click "Next Round →" (rounds 1–4) or "Final Score →" (round 5).
      // Both share the same button position — the text changes but role is stable.
      await page.getByRole('button', { name: NEXT_BTN }).click()

      // After rounds 1–4, wait for the Submit button to re-appear (disabled)
      // before looping — confirms the playing phase for the next round started.
      if (round < 5) {
        await expect(page.getByRole('button', { name: SUBMIT_BTN })).toBeDisabled()
      }
    }

    // ── FinalScoreScreen ──────────────────────────────────────────────────────
    await expect(page.getByRole('button', { name: PLAY_AGAIN_BTN })).toBeVisible()
    await expect(page.getByText(ROUND_LOGBOOK)).toBeVisible()

    // ── Play Again ────────────────────────────────────────────────────────────
    // Clicking "Play Again" re-triggers the session fetch → loading state reappears.
    await page.getByRole('button', { name: PLAY_AGAIN_BTN }).click()
    await expect(page.getByText(LOADING_TEXT)).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Theme Integration', () => {
  test('ThemeToggle adds theme-light class to the html element', async ({ page }) => {
    await page.goto('/')

    // Wait for the app to mount — toggle is part of App.tsx and always rendered.
    const toggle = page.getByRole('button', { name: THEME_TOGGLE })
    await expect(toggle).toBeVisible({ timeout: 10_000 })

    // Initial state: dark theme (colorScheme: 'dark' set in playwright.config.ts,
    // no localStorage entry → getInitialTheme() returns 'dark').
    await expect(page.locator('html')).not.toHaveClass(/theme-light/)

    // Switch to light ("Aged Map") theme.
    await toggle.click()

    // ThemeContext appends 'theme-light' to <html> and persists to localStorage.
    await expect(page.locator('html')).toHaveClass(/theme-light/)

    // Toggle back to dark ("Inky Night") theme.
    await page.getByRole('button', { name: /switch to inky night/i }).click()
    await expect(page.locator('html')).not.toHaveClass(/theme-light/)
  })
})
