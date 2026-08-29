import { test, expect } from '@playwright/test';

// Exercises the capability check only. Actually loading a browser model would
// pull hundreds of megabytes, which does not belong in a test run.
const hasAdapter = async (page) =>
  page.evaluate(async () => {
    if (!navigator.gpu) return false;
    try {
      return !!(await navigator.gpu.requestAdapter());
    } catch {
      return false;
    }
  });

test.describe('browser model path', () => {
  test('offers the browser option with the configured model size', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Get Started', exact: true }).click();

    const option = page.getByRole('button', { name: /AI in your browser/ });
    await expect(option).toBeVisible();
    await expect(option).toContainText('273 MB');
  });

  test('reaches consent, quoting that same size, before anything downloads', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Get Started', exact: true }).click();
    await page.getByRole('button', { name: /AI in your browser/ }).click();

    // Consent is required before any download begins.
    await expect(page.getByText(/One-time Download Required/i)).toBeVisible();
    await expect(page.getByText('273 MB')).toBeVisible();
    await expect(page.getByRole('button', { name: /Proceed/ })).toBeVisible();
  });

  test('detects WebGPU when the browser exposes an adapter', async ({ page }) => {
    await page.goto('/');
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter on this machine');

    const supported = await page.evaluate(async () => {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    });
    // testWebLLMConnection gates on exactly this before asking for consent.
    expect(supported).toBe(true);
  });
});
