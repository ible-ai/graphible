import { test, expect } from '@playwright/test';

// The canvas zooms on the wheel through a non-passive listener on document.
// It used to preventDefault every wheel event it saw, so a trackpad scroll
// over the details panel zoomed the graph behind it and the panel never
// scrolled. These drive real wheel input at real coordinates, which is the
// only way to see whether the browser's own scrolling survived.

const loadDemo = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();
  await page.getByRole('button', { name: /Try the demo/i }).click();
  await expect(page.locator('.node-component').first()).toBeVisible();
  await expect(page.locator('.details-panel')).toBeVisible();
};

// The camera is applied as one transform on the canvas's first child.
const cameraTransform = (page) =>
  page.locator('[data-graph-canvas] > div').first().evaluate((el) => el.style.transform);

// Focusing a node animates the camera; wait for it to settle so a later
// comparison measures the wheel and not the tail of that animation.
const settledCamera = async (page) => {
  let previous = await cameraTransform(page);
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(100);
    const current = await cameraTransform(page);
    if (current === previous) return current;
    previous = current;
  }
  return previous;
};

// The panel's scrolling body, with enough content in it to overflow. The
// thread view of a leaf stacks every node from the root down.
const openOverflowingPanel = async (page) => {
  await page.setViewportSize({ width: 1280, height: 560 });
  await loadDemo(page);
  await page.locator('.node-component').filter({ hasText: 'Activation Functions' }).click();
  await page.getByRole('button', { name: /whole thread/i }).click();

  const body = page.locator('.details-panel .overflow-y-auto').first();
  const overflows = await body.evaluate((el) => el.scrollHeight > el.clientHeight + 20);
  expect(overflows, 'the panel body must overflow for this test to mean anything').toBe(true);
  return body;
};

const centreOf = async (locator) => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test.describe('wheel over the details panel', () => {
  test('scrolls the panel and leaves the graph camera alone', async ({ page }) => {
    const body = await openOverflowingPanel(page);
    const before = await settledCamera(page);

    const { x, y } = await centreOf(body);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 240);

    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await cameraTransform(page)).toBe(before);
  });

  test('a trackpad pinch over the panel does not zoom the graph', async ({ page }) => {
    const body = await openOverflowingPanel(page);
    const before = await settledCamera(page);

    // macOS delivers a pinch as wheel events with ctrlKey set.
    const { x, y } = await centreOf(body);
    await page.mouse.move(x, y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -120);
    await page.keyboard.up('Control');
    await page.waitForTimeout(150);

    expect(await cameraTransform(page)).toBe(before);
  });

  test('the wheel over the open canvas still zooms', async ({ page }) => {
    await openOverflowingPanel(page);
    const before = await settledCamera(page);

    // Left edge, clear of the panel docked on the right and of the nodes.
    await page.mouse.move(60, 400);
    await page.mouse.wheel(0, -120);

    await expect.poll(() => cameraTransform(page)).not.toBe(before);
  });
});

test('wheel over a modal does not zoom the graph behind it', async ({ page }) => {
  await loadDemo(page);
  const before = await settledCamera(page);

  await page.getByRole('button', { name: /Save\/Load/ }).click();
  const dialog = page.getByRole('heading', { name: 'Saved Graphs' });
  await expect(dialog).toBeVisible();

  const { x, y } = await centreOf(dialog);
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(150);

  expect(await cameraTransform(page)).toBe(before);
});
