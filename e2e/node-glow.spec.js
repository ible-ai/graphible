import { test, expect } from '@playwright/test';

// The root and current nodes glow in the scheme's color. Both glows were once
// written as an rgb() color with a hex alpha appended ("rgb(59, 130, 246)40"),
// which is invalid CSS: the browser dropped the whole box-shadow and neither
// node ever glowed. These read the computed shadow, so a glow that silently
// stops rendering fails here.

// The demo uses the blue scheme: blue-500 in light, blue-400 in dark. The
// alphas are each theme's glow values in graphConstants. The checks match the
// glow's own geometry (a 3px ring, a 22px resting halo) rather than just its
// color: selection uses the same blue, and when React assigns an invalid
// box-shadow the browser keeps the previous one, so a stale selection shadow
// would otherwise pass for a glow.
const ACCENT = { light: '59, 130, 246', dark: '96, 165, 250' };
const RING = { light: '0.3', dark: '0.4' };
const REST = { light: '0.2', dark: '0.32' };
const ring = (scheme) => `rgba(${ACCENT[scheme]}, ${RING[scheme]}) 0px 0px 0px 3px`;
const restingGlow = (scheme) => `rgba(${ACCENT[scheme]}, ${REST[scheme]}) 0px 0px 22px 0px`;

const shadowOf = (locator) => locator.evaluate((el) => getComputedStyle(el).boxShadow);

// Nodes transition `all` over 0.3s, so a shadow read straight after a state
// change is mid-interpolation. Poll until it settles on the expected glow.
const expectShadow = (locator, part) =>
  expect.poll(() => shadowOf(locator)).toContain(part);

for (const scheme of ['light', 'dark']) {
  test.describe(`node glow in ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Get Started', exact: true }).click();
      await page.getByRole('button', { name: /Try the demo/i }).click();
      await expect(page.locator('.node-component').first()).toBeVisible();
      await page.getByRole('button', { name: 'Close details' }).click();
    });

    test('the root glows while it is the current node', async ({ page }) => {
      const root = page.locator('.node-component').filter({ hasText: 'Neural Networks Overview' });
      await expectShadow(root, ring(scheme));
    });

    test('another current node glows, and the root keeps a resting glow', async ({ page }) => {
      const nodes = page.locator('.node-component');
      const current = nodes.filter({ hasText: 'Activation Functions' });
      await current.click();
      await page.getByRole('button', { name: 'Close details' }).click();

      // Auto context selects the new current node and its neighbours, and
      // selection has a style of its own; clear it to see the glows beneath.
      // Ctrl+mousedown toggles selection. It is dispatched rather than clicked
      // because the camera has moved and some nodes now sit under the header.
      for (const node of await nodes.all()) {
        const selected = await node.evaluate((el) => el.style.borderWidth === '3px');
        if (selected) await node.dispatchEvent('mousedown', { ctrlKey: true, metaKey: true, bubbles: true });
      }
      await expect(page.locator('.node-component[style*="border-width: 3px"]')).toHaveCount(0);

      await expectShadow(current, ring(scheme));
      await expectShadow(nodes.filter({ hasText: 'Neural Networks Overview' }), restingGlow(scheme));

      // An ordinary node gets a neutral shadow, not the glow.
      const plain = nodes.filter({ hasText: 'Training Process' });
      await expect.poll(() => shadowOf(plain)).not.toContain(`rgba(${ACCENT[scheme]}`);
      expect(await shadowOf(plain)).not.toBe('none');
    });
  });
}
