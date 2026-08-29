import { test, expect } from '@playwright/test';

// The demo backend returns one canned node, so both modes are observable
// without a real model.
const startFresh = async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem('graphible-setup-complete', 'true');
    localStorage.setItem('graphible-model-config', JSON.stringify({ type: 'demo' }));
  });
  await page.goto('/');
};

test.describe('response mode', () => {
  test('offers the choice on the start screen and defaults to Graph', async ({ page }) => {
    await startFresh(page);

    const toggle = page.getByRole('button', { name: /^(Graph|Single)$/ });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('Graph');
    await expect(page.getByText('Break the answer into connected nodes')).toBeVisible();
  });

  test('switches to Single and explains what it does', async ({ page }) => {
    await startFresh(page);

    await page.getByRole('button', { name: /^Graph$/ }).click();
    await expect(page.getByRole('button', { name: /^Single$/ })).toBeVisible();
    await expect(page.getByText('Keep the whole answer in one node')).toBeVisible();
  });

  test('remembers the choice across a reload', async ({ page }) => {
    await startFresh(page);
    await page.getByRole('button', { name: /^Graph$/ }).click();
    await expect(page.getByRole('button', { name: /^Single$/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /^Single$/ })).toBeVisible();
  });

  test('single mode produces one node holding the whole reply', async ({ page }) => {
    await startFresh(page);
    await page.getByRole('button', { name: /^Graph$/ }).click();

    await page.locator('#main-prompt').fill('What is attention?');
    await page.getByRole('button', { name: /Start Exploring/ }).click();

    await expect(page.locator('.node-component')).toHaveCount(1, { timeout: 15000 });
    // The reply is kept verbatim rather than decomposed, so the raw JSON the
    // demo backend emits shows up as the node's own content.
    await expect(page.locator('.details-panel')).toContainText('Demo Node');
  });

  test('the mode toggle stays available on the graph screen', async ({ page }) => {
    await startFresh(page);
    await page.locator('#main-prompt').fill('anything');
    await page.getByRole('button', { name: /Start Exploring/ }).click();

    await expect(page.locator('.node-component').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /^(Graph|Single)$/ })).toBeVisible();
  });
});
