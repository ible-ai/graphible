import { test, expect } from '@playwright/test';

// Reopening the model panel used to rewrite the running choice: the Code
// Assist controls defaulted instead of seeding from the config, so the panel
// came back on the wrong client showing the wrong model - and Apply then sent
// that. Silently swapping the model out from under a user is worse than any
// error message, because nothing says it happened.
test.describe('the model panel shows what is running', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('graphible-setup-complete', 'true');
      localStorage.setItem('graphible-model-config', JSON.stringify({
        type: 'code-assist', provider: 'google', authProvider: 'antigravity', model: 'gemini-3.1-pro-high',
      }));
      localStorage.setItem('graphible-antigravity-refresh', 'stub-grant');
      window.open = () => null;
    });
    await page.goto('/');
    await expect(page.locator('#main-prompt')).toBeVisible();
  });

  // The start screen embeds the same panel; its trigger is labelled with the
  // model id in use.
  const openPanel = (page) =>
    page.locator('button').filter({ hasText: /gemini|No model detected|Demo/i }).first().click();

  test('reopens on the client and model that are running', async ({ page }) => {
    await openPanel(page);
    await page.getByRole('button', { name: /External API/ }).click();

    // The saved client, not the default one.
    await expect(page.getByRole('button', { name: /^Antigravity/ }))
      .toHaveClass(/bg-slate-800/);

    // The saved model, not the catalog's recommendation.
    const row = page.locator('label').filter({ hasText: 'Gemini 3.1 Pro (high)' });
    await expect(row).toBeVisible();
    await expect(row.locator('div.bg-purple-500')).toBeVisible();
  });

  test('a seed catalog never overrules the running model', async ({ page }) => {
    // Discovery has not answered here, so only the seeds are known. A model
    // absent from them must still survive, or every reopen resets it.
    // Added after the beforeEach script, so this one wins on the next load.
    await page.addInitScript(() => localStorage.setItem('graphible-model-config', JSON.stringify({
      type: 'code-assist', authProvider: 'antigravity', model: 'gemini-4-not-yet-seeded',
    })));
    await page.goto('/');
    await expect(page.locator('#main-prompt')).toBeVisible();

    await openPanel(page);
    await page.getByRole('button', { name: /External API/ }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('graphible-model-config')).model);
    expect(saved).toBe('gemini-4-not-yet-seeded');
  });
});
