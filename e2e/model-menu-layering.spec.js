import { test, expect } from '@playwright/test';

// The model menu opens from the header, which is its own stacking context at
// Z.HEADER. A z-index on the menu itself cannot lift it above the details
// panel, because the panel is a sibling of the header rather than of the menu.
// The panel then sat over the menu and swallowed clicks on its controls: the
// sign-in code box was visible but could not be focused or typed into.
test.describe('model menu above the details panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('graphible-setup-complete', 'true');
      localStorage.setItem('graphible-model-config', JSON.stringify({ type: 'demo' }));
      window.open = () => null;
    });
  });

  const openMenu = async (page) => {
    await page.goto('/');
    await page.locator('#main-prompt').fill('what is attention?');
    await page.locator('#main-prompt').press('Enter');
    await expect(page.locator('.node-component').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.details-panel')).toBeVisible();
    await page.getByRole('button', { name: /Demo|model/i }).first().click();
  };

  // A narrow viewport is what makes the panel and the menu overlap; at desktop
  // widths they can miss each other and the bug hides.
  test('menu controls stay clickable with the panel open', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await openMenu(page);

    await page.getByRole('button', { name: /External API/ }).click();
    await page.getByRole('button', { name: 'Google account' }).click();
    await page.getByRole('button', { name: /Sign in to Antigravity/ }).click();

    const input = page.locator('input[placeholder^="4/0"]');
    await expect(input).toBeVisible();

    // click() fails rather than silently missing when another element is on top
    await input.click({ timeout: 5000 });
    await page.keyboard.type('4/0abc');
    await expect(input).toHaveValue('4/0abc');
  });

  test('the menu paints above the panel, not beneath it', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await openMenu(page);

    const menu = page.locator('.w-96.bg-white.rounded-xl').first();
    const box = await menu.boundingBox();
    // Whatever is painted at the menu's own centre must belong to the menu.
    const owner = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el?.closest('.details-panel') ? 'details-panel' : 'menu';
    }, { x: box.x + box.width / 2, y: box.y + 40 });

    expect(owner).toBe('menu');
  });
});

// Typing anywhere must not drive the camera. Snap-navigation listens on
// window, so without a guard every field has to remember to stopPropagation.
test('typing in a field does not move the camera', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('graphible-setup-complete', 'true');
    localStorage.setItem('graphible-model-config', JSON.stringify({ type: 'demo' }));
  });
  await page.goto('/');
  await page.locator('#main-prompt').fill('what is attention?');
  await page.locator('#main-prompt').press('Enter');
  await expect(page.locator('.node-component').first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: /Demo|model/i }).first().click();
  await page.getByRole('button', { name: /Local Model/ }).click();

  const field = page.locator('input[value*="localhost"]').first();
  await field.click();
  const before = await page.locator('.node-component').first().boundingBox();
  // a, s, d and w are the snap-navigation keys.
  await page.keyboard.type('wasd');
  await page.waitForTimeout(300);
  const after = await page.locator('.node-component').first().boundingBox();

  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
});
