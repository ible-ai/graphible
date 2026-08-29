import { test, expect } from '@playwright/test';

test.describe('startup', () => {
  // A module-level ordering mistake once left the bundle throwing "Cannot
  // access 'x' before initialization" on load: #root stayed empty and every
  // other test failed by timeout, thirty seconds at a time. This fails in a
  // second and says what actually happened.
  test('mounts without a module-level error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.locator('#loading')).toBeHidden();
    expect(errors).toEqual([]);
  });

  // Regression: the startup effect depends on loadSavedConfig,
  // handleModelChange and testLLMConnection, and its own work changes all
  // three identities - testLLMConnection depends on currentModel, which
  // handleModelChange sets. Once the effect actually ran, it re-fired forever
  // and flooded the console.
  test('initialises the saved model exactly once', async ({ page }) => {
    const init = [];
    page.on('console', (m) => {
      if (/App initialization|Using saved setup config/.test(m.text())) init.push(m.text());
    });

    await page.addInitScript(() => {
      localStorage.setItem(
        'graphible-model-config',
        JSON.stringify({ type: 'webllm', model: 'onnx-community/Qwen3-0.6B-ONNX' })
      );
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    expect(init.length).toBeLessThanOrEqual(2);
  });

  test('settles without a runaway render loop', async ({ page }) => {
    let messages = 0;
    page.on('console', () => messages++);

    await page.goto('/');
    await page.waitForTimeout(2000);
    const afterLoad = messages;

    await page.waitForTimeout(2000);
    // An idle app should be near-silent; a loop keeps logging.
    expect(messages - afterLoad).toBeLessThan(10);
  });
});
