import { test, expect } from '@playwright/test';

const loadDemo = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();
  await page.getByRole('button', { name: /Try the demo/i }).click();
  await expect(page.locator('.node-component').first()).toBeVisible();
};

test.describe('saved graphs', () => {
  test('survive a reload', async ({ page }) => {
    await loadDemo(page);

    await page.getByRole('button', { name: /Save\/Load/ }).click();
    await page.getByRole('button', { name: /Save Current Graph/ }).click();

    // Regression: graphs lived in sessionStorage and were gone on restart.
    await page.reload();
    await page.getByRole('button', { name: /^Load$/ }).click();
    await expect(page.getByRole('button', { name: /Load Graph/ }).first()).toBeVisible();
  });

  test('reload with their edges intact', async ({ page }) => {
    await loadDemo(page);
    await page.getByRole('button', { name: /Save\/Load/ }).click();
    await page.getByRole('button', { name: /Save Current Graph/ }).click();
    await page.reload();

    await page.getByRole('button', { name: /^Load$/ }).click();
    await page.getByRole('button', { name: /Load Graph/ }).first().click();

    await expect(page.locator('.node-component')).toHaveCount(4);
    await expect(page.locator('svg path[marker-end]')).toHaveCount(4);
  });

  test('offer export and import', async ({ page }) => {
    await loadDemo(page);
    await page.getByRole('button', { name: /Save\/Load/ }).click();

    await expect(page.getByRole('button', { name: /^Export$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Import from file/ })).toBeVisible();
  });

  test('export downloads a file that imports back', async ({ page }) => {
    await loadDemo(page);
    await page.getByRole('button', { name: /Save\/Load/ }).click();

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /^Export$/ }).click(),
    ]).then(([d]) => d);

    expect(download.suggestedFilename()).toMatch(/\.graphible\.json$/);

    const path = await download.path();
    await page.setInputFiles('input[aria-label="Import graph file"]', path);

    await expect(page.getByRole('button', { name: /Load Graph/ })).toHaveCount(1);
  });
});
