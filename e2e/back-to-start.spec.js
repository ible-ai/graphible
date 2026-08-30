import { test, expect } from '@playwright/test';

// Returning to the start screen is deliberately non-destructive: the graph
// stays in state so the trip is reversible. That is only safe because
// submitting a new initial prompt calls resetGraph, so kept nodes cannot leak
// into the next graph - both halves are asserted here.
test.describe('back to the start screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('graphible-setup-complete', 'true');
      localStorage.setItem('graphible-model-config', JSON.stringify({ type: 'demo' }));
    });
  });

  const generate = async (page, prompt) => {
    await page.locator('#main-prompt').fill(prompt);
    await page.locator('#main-prompt').press('Enter');
    await expect(page.locator('.node-component').first()).toBeVisible({ timeout: 15000 });
  };

  const home = (page) => page.getByRole('button', { name: 'Back to the start screen' });
  const backToGraph = (page) => page.getByRole('button', { name: /Back to graph/ });

  test('the header button shows the start screen and keeps the graph', async ({ page }) => {
    await page.goto('/');
    await generate(page, 'what is attention?');
    const nodeCount = await page.locator('.node-component').count();

    await home(page).click();

    await expect(page.locator('#main-prompt')).toBeVisible();
    // The header lives inside the !showPromptCenter block, so it goes with it.
    await expect(home(page)).toHaveCount(0);

    await backToGraph(page).click();
    await expect(page.locator('.node-component')).toHaveCount(nodeCount);
  });

  test('Escape returns to the graph from the start screen', async ({ page }) => {
    await page.goto('/');
    await generate(page, 'what is attention?');
    await home(page).click();

    // The textarea is autofocused, and Escape there is not text entry.
    await page.locator('#main-prompt').press('Escape');
    await expect(page.locator('#main-prompt')).toBeHidden();
    await expect(page.locator('.node-component').first()).toBeVisible();
  });

  test('offers no way back before a graph exists', async ({ page }) => {
    await page.goto('/');
    await expect(backToGraph(page)).toHaveCount(0);

    // And Escape on a bare start screen does nothing rather than blanking it.
    await page.locator('#main-prompt').press('Escape');
    await expect(page.locator('#main-prompt')).toBeVisible();
  });

  test('a new prompt from the start screen replaces the kept graph', async ({ page }) => {
    await page.goto('/');
    await generate(page, 'what is attention?');
    const first = await page.locator('.node-component').count();

    await home(page).click();
    await generate(page, 'what is a transformer?');

    // Not first + second: the kept nodes must not survive the new generation.
    await expect(page.locator('.node-component')).toHaveCount(first);
  });

  test('typing on the graph does not reach the hidden start prompt', async ({ page }) => {
    await page.goto('/');
    await generate(page, 'what is attention?');

    // CenteredPrompt's global listener runs before its own early return, so it
    // used to swallow keystrokes meant for the canvas.
    await page.locator('body').press('z');
    // Any alphanumeric also opens NewPromptBox, which covers the header.
    await page.keyboard.press('Escape');
    await home(page).click();
    await expect(page.locator('#main-prompt')).not.toHaveValue('z');
  });
});
