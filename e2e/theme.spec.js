import { test, expect } from '@playwright/test';

// Dark mode is a `dark` class on <html>. The OS preference sets it unless the
// user has picked a theme with the toggle, which is remembered.

const THEME_KEY = 'graphible-theme';

const isDark = (page) => page.evaluate(() => document.documentElement.classList.contains('dark'));

// Relative luminance of an element's computed color, 0 (black) to 1 (white),
// ignoring its alpha. Tailwind 4 computes colors as oklch, so the color is
// painted onto a transparent canvas and read back as sRGB rather than parsed.
const luminance = (locator, property = 'backgroundColor') =>
  locator.evaluate((el, prop) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getComputedStyle(el)[prop];
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }, property);

const loadDemoGraph = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();
  await page.getByRole('button', { name: /Try the demo/i }).click();
  await expect(page.locator('.node-component').first()).toBeVisible();
  await expect(page.locator('.details-panel')).toBeVisible();
};

const skipWizard = async (page) => {
  await page.goto('/');
  await page.getByTitle('Close setup').click();
  await expect(page.locator('#main-prompt')).toBeVisible();
};

test.describe('OS preference', () => {
  test.describe('dark', () => {
    test.use({ colorScheme: 'dark' });

    test('applies the dark theme with nothing stored', async ({ page }) => {
      await skipWizard(page);

      expect(await isDark(page)).toBe(true);
      await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
      // The start card, not just the class: a surface that stayed white would pass the check above.
      expect(await luminance(page.locator('#main-prompt'))).toBeLessThan(0.05);
      expect(await luminance(page.locator('#main-prompt'), 'color')).toBeGreaterThan(0.6);
    });

    test('is set before the app script runs, so the page never flashes light', async ({ page }) => {
      // With the bundle blocked, only index.html's inline script can have set it.
      await page.route(/\/assets\/.*\.js$/, (route) => route.abort());
      await page.goto('/');
      expect(await isDark(page)).toBe(true);
    });
  });

  test.describe('light', () => {
    test.use({ colorScheme: 'light' });

    test('stays light with nothing stored', async ({ page }) => {
      await skipWizard(page);

      expect(await isDark(page)).toBe(false);
      await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
      expect(await luminance(page.locator('#main-prompt'))).toBeGreaterThan(0.8);
    });
  });
});

test.describe('theme toggle', () => {
  test.use({ colorScheme: 'light' });

  test('switches the toolbar, canvas, and nodes, and persists across a reload', async ({ page }) => {
    await loadDemoGraph(page);
    const node = page.locator('.node-component').filter({ hasText: 'Activation Functions' });
    expect(await luminance(node)).toBeGreaterThan(0.8);

    await page.getByRole('button', { name: 'Switch to dark theme' }).click();

    expect(await isDark(page)).toBe(true);
    expect(await page.evaluate((k) => localStorage.getItem(k), THEME_KEY)).toBe('dark');
    // Nodes are memoized with a hand-written comparator and painted with
    // inline styles; this fails if the theme change never reaches them.
    await expect.poll(() => luminance(node)).toBeLessThan(0.05);
    expect(await luminance(page.locator('.details-panel'))).toBeLessThan(0.05);
    expect(await luminance(page.locator('.minimap-container'))).toBeLessThan(0.05);

    await page.reload();
    expect(await isDark(page)).toBe(true);
    await skipWizardIfShown(page);
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
  });

  test('switching back to the OS theme forgets the override', async ({ page }) => {
    await skipWizard(page);

    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    expect(await isDark(page)).toBe(true);
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    expect(await isDark(page)).toBe(false);

    // Following the OS again, rather than pinned to light.
    expect(await page.evaluate((k) => localStorage.getItem(k), THEME_KEY)).toBeNull();
  });

  test.describe('over a dark OS', () => {
    test.use({ colorScheme: 'dark' });

    test('forces light, and keeps it after a reload', async ({ page }) => {
      await skipWizard(page);
      expect(await isDark(page)).toBe(true);

      await page.getByRole('button', { name: 'Switch to light theme' }).click();
      expect(await isDark(page)).toBe(false);
      expect(await page.evaluate((k) => localStorage.getItem(k), THEME_KEY)).toBe('light');

      await page.reload();
      expect(await isDark(page)).toBe(false);
    });
  });

  test('works when storage refuses writes', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new Error('QuotaExceededError');
      };
    });
    await skipWizard(page);

    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    expect(await isDark(page)).toBe(true);
  });
});

test.describe('demo graph in dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('renders without page errors, on dark surfaces', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await loadDemoGraph(page);

    await expect(page.locator('.node-component')).toHaveCount(4);
    await expect(page.locator('svg path[marker-end]')).toHaveCount(4);
    expect(await isDark(page)).toBe(true);

    for (const surface of ['.node-component', '.details-panel', '.minimap-container']) {
      expect(await luminance(page.locator(surface).first()), surface).toBeLessThan(0.05);
    }
    // Readable text on those surfaces.
    expect(await luminance(page.locator('.node-component h3').first(), 'color')).toBeGreaterThan(0.5);
    expect(await luminance(page.locator('.details-panel .prose'), 'color')).toBeGreaterThan(0.5);

    // Exercise the rest of the graph chrome while dark.
    await page.getByRole('button', { name: 'Close details' }).click();
    await page.locator('.minimap-container button[title="Maximize"]').click();
    await page.locator('.node-component').filter({ hasText: 'Training Process' }).hover();
    await page.getByRole('button', { name: /^Connections/ }).click();
    await expect(page.getByText('Manage Connections')).toBeVisible();

    expect(errors).toEqual([]);
  });
});

// A reload of a session that has finished the wizard goes straight to the
// start screen; one that has not shows the wizard again.
async function skipWizardIfShown(page) {
  const close = page.getByTitle('Close setup');
  if (await close.isVisible().catch(() => false)) await close.click();
}
