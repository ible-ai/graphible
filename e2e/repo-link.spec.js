import { test, expect } from '@playwright/test';

// The site's README pages are standalone, so the app's own link is the only
// path from it to the source.

const REPO = 'https://github.com/ible-ai/graphible';

const repoLink = (page) => page.getByRole('link', { name: 'Source on GitHub' });

const overlaps = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// Every other visible control on the page, by bounding box.
const otherControlBoxes = (page) =>
  page.$$eval('button, a, input, textarea, select, .minimap-container, .details-panel', (els) =>
    els
      .filter((el) => el.getAttribute('aria-label') !== 'Source on GitHub')
      .map((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30) || el.className,
          x: r.x, y: r.y, width: r.width, height: r.height,
          visible: r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        };
      })
      .filter((b) => b.visible)
  );

const expectClear = async (page) => {
  const link = await repoLink(page).boundingBox();
  const viewport = page.viewportSize();
  expect(link.x).toBeGreaterThanOrEqual(0);
  expect(link.y + link.height).toBeLessThanOrEqual(viewport.height);
  // Not hidden under another layer, which toBeVisible does not check.
  const onTop = await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return hit?.closest('a')?.getAttribute('aria-label') === 'Source on GitHub';
  }, { x: link.x + link.width / 2, y: link.y + link.height / 2 });
  expect(onTop).toBe(true);
  for (const box of await otherControlBoxes(page)) {
    expect(overlaps(link, box), `overlaps ${box.name}`).toBe(false);
  }
};

const openDemo = async (page) => {
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();
  await page.getByRole('button', { name: /Try the demo/i }).click();
  await expect(page.locator('.node-component').first()).toBeVisible();
  await expect(page.locator('.details-panel')).toBeVisible();
};

test('links to the repo in a new tab, safely', async ({ page }) => {
  await page.goto('/');
  const link = repoLink(page);
  await expect(link).toHaveAttribute('href', REPO);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

for (const [width, height] of [[390, 844], [1280, 800], [1512, 982]]) {
  test(`is visible and clear of other controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await openDemo(page);

    // While viewing a graph.
    await expect(repoLink(page)).toBeVisible();
    await expectClear(page);

    // And on the start screen, which is fixed over everything else.
    await page.getByRole('button', { name: 'Back to the start screen' }).click();
    await expect(page.locator('#main-prompt')).toBeVisible();
    await expect(repoLink(page)).toBeVisible();
    await expectClear(page);
  });
}
