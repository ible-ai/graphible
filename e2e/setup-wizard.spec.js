import { test, expect } from '@playwright/test';

const openWizard = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();
};

test.describe('setup wizard navigation', () => {
  // Regression: every non-demo transition called navigateToStep in the same
  // event that set the state the accessibility gate reads, so the gate saw the
  // previous render and refused with "Cannot navigate to step". Choosing any
  // real model did nothing on first click.
  test('advances from the browser option to consent, then to setup', async ({ page }) => {
    const warnings = [];
    page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));

    await openWizard(page);
    await page.getByRole('button', { name: /AI in your browser/ }).click();

    await expect(page.getByRole('heading', { name: 'Review & Consent' })).toBeVisible();
    await expect(page.getByText(/One-time Download Required/i)).toBeVisible();
    await expect(page.getByText('273 MB').first()).toBeVisible();

    await page.getByRole('button', { name: /Proceed/ }).click();
    await expect(page.getByRole('heading', { name: 'Quick Setup' })).toBeVisible();

    expect(warnings.filter((w) => /Cannot navigate to step/.test(w))).toEqual([]);
  });

  test('advances from the cloud option to its API key form', async ({ page }) => {
    await openWizard(page);
    await page.getByText('Advanced options').click();
    await page.getByRole('button', { name: /Cloud AI/ }).click();

    await expect(page.getByRole('heading', { name: 'Review & Consent' })).toBeVisible();
    // Cloud sends prompts off-device, so consent must say so.
    await expect(page.getByText(/sent to external servers/i)).toBeVisible();

    await page.getByRole('button', { name: /Proceed/ }).click();
    await expect(page.getByText(/Google AI API Key/i)).toBeVisible();
  });

  test('declining consent explains why and stays put', async ({ page }) => {
    await openWizard(page);
    await page.getByRole('button', { name: /AI in your browser/ }).click();
    await page.getByRole('button', { name: /Go Back/ }).click();

    await expect(page.getByText(/requires your consent/i)).toBeVisible();
  });

  test('demo loads a graph immediately and closes the wizard', async ({ page }) => {
    await openWizard(page);
    await page.getByRole('button', { name: /Try the demo/i }).click();

    await expect(page.locator('.node-component')).toHaveCount(4);
    await expect(page.getByRole('heading', { name: 'Welcome to Graphible' })).toBeHidden();
  });

  test('back returns to the choice step', async ({ page }) => {
    await openWizard(page);
    await page.getByRole('button', { name: /AI in your browser/ }).click();
    await expect(page.getByRole('heading', { name: 'Review & Consent' })).toBeVisible();

    await page.getByTitle('Go back (←)').click();
    await expect(page.getByRole('heading', { name: /Choose your AI source/i })).toBeVisible();
  });
});
