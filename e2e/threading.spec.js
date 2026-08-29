import { test, expect } from '@playwright/test';

const loadDemo = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();
  await page.getByRole('button', { name: /Try the demo/i }).click();
  await expect(page.locator('.node-component').first()).toBeVisible();
  await expect(page.locator('.details-panel')).toBeVisible();
};

test.describe('reading a thread', () => {
  test('shows the path from the root to the current node', async ({ page }) => {
    await loadDemo(page);
    await page.locator('.node-component').filter({ hasText: 'Neural Networks Overview' }).click();

    await page.getByRole('button', { name: /whole thread/i }).click();

    const panel = page.locator('.details-panel');
    await expect(panel).toContainText('1. Neural Networks Overview');
  });

  test('toggles back to the single node', async ({ page }) => {
    await loadDemo(page);
    await page.getByRole('button', { name: /whole thread/i }).click();
    await page.getByRole('button', { name: /this node only/i }).click();

    await expect(page.getByRole('button', { name: /whole thread/i })).toBeVisible();
  });
});

test.describe('alternatives', () => {
  test('offers sibling navigation when a point has more than one continuation', async ({ page }) => {
    await loadDemo(page);
    // Basic Architecture and Activation Functions both branch from the root.
    await page.locator('.node-component').filter({ hasText: 'Basic Architecture' }).click();

    await expect(page.getByRole('button', { name: 'Next alternative' })).toBeVisible();
    await expect(page.locator('.details-panel')).toContainText('/2');
  });

  test('moves between alternatives', async ({ page }) => {
    await loadDemo(page);
    await page.locator('.node-component').filter({ hasText: 'Basic Architecture' }).click();
    await expect(page.locator('.details-panel')).toContainText('Basic Architecture');

    await page.getByRole('button', { name: 'Next alternative' }).click();
    await expect(page.locator('.details-panel')).toContainText('Activation Functions');
  });
});

test.describe('branching from a quote', () => {
  test('offers to ask about a selected passage', async ({ page }) => {
    await loadDemo(page);

    // Select a passage inside the rendered answer.
    await page.locator('.details-panel .prose p').first().evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    await page.locator('.details-panel .prose').first().dispatchEvent('mouseup');

    await expect(page.getByRole('button', { name: /Ask about this/ })).toBeVisible();
  });

  test('carries the quote into the prompt box', async ({ page }) => {
    await loadDemo(page);

    await page.locator('.details-panel .prose p').first().evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    await page.locator('.details-panel .prose').first().dispatchEvent('mouseup');
    await page.getByRole('button', { name: /Ask about this/ }).click();

    await expect(page.getByText('Asking about this passage')).toBeVisible();
  });
});
