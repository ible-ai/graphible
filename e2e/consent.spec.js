import { test, expect } from '@playwright/test';

// A saved browser-model config is the state that used to fire window.confirm
// during page load, before the user had chosen or read anything.
const withSavedBrowserModel = async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem('graphible-setup-complete', 'true');
    localStorage.setItem(
      'graphible-model-config',
      JSON.stringify({ type: 'webllm', model: 'onnx-community/gemma-3-270m-it-ONNX', dtype: 'q4f16' })
    );
  });
};

test.describe('model download consent', () => {
  test('never blocks page load with a download prompt', async ({ page }) => {
    await withSavedBrowserModel(page);

    // A native dialog would hang the page; fail loudly rather than auto-accept.
    let nativeDialog = null;
    page.on('dialog', async (d) => {
      nativeDialog = d.message();
      await d.dismiss();
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    expect(nativeDialog, 'no native dialog on load').toBeNull();
    await expect(page.getByRole('alertdialog', { name: /Download/i })).toBeHidden();
    // The start screen is usable straight away.
    await expect(page.locator('#main-prompt')).toBeVisible();
  });

  test('asks in-app, and only once the user needs the model', async ({ page }) => {
    await withSavedBrowserModel(page);
    await page.goto('/');
    await expect(page.locator('#main-prompt')).toBeVisible();

    await page.locator('#main-prompt').fill('what is attention?');
    await page.getByRole('button', { name: /Start Exploring/ }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 20000 });
    await expect(dialog).toContainText('273 MB');
    await expect(dialog).toContainText(/never leave this device/i);
  });

  test('declining leaves the app usable rather than an empty graph', async ({ page }) => {
    await withSavedBrowserModel(page);
    page.on('dialog', (d) => d.dismiss());
    await page.goto('/');

    await page.locator('#main-prompt').fill('what is attention?');
    await page.getByRole('button', { name: /Start Exploring/ }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: /Not now/ }).click();
    await expect(dialog).toBeHidden();

    // Still able to choose a different model instead of being stranded.
    await expect(page.getByRole('button', { name: /Setup|No model detected|Demo/ }).first()).toBeVisible();
  });
});

test.describe('stale consent', () => {
  // The reported state: the wizard has been completed, an old global grant is
  // in storage, and the chosen model has never actually been approved. The app
  // believed consent was settled and went straight to "could not connect".
  const withStaleGlobalConsent = async (page) => {
    await page.addInitScript(() => {
      localStorage.setItem('graphible-setup-complete', 'true');
      localStorage.setItem('graphible-webllm-consent', 'granted');
      localStorage.setItem(
        'graphible-model-config',
        JSON.stringify({ type: 'webllm', model: 'onnx-community/gemma-3-270m-it-ONNX', dtype: 'q4f16' })
      );
    });
  };

  test('still asks about the model actually chosen', async ({ page }) => {
    await withStaleGlobalConsent(page);

    let nativeDialog = null;
    page.on('dialog', async (d) => { nativeDialog = d.message(); await d.dismiss(); });

    await page.goto('/');
    await page.locator('#main-prompt').fill('what is attention?');
    await page.getByRole('button', { name: /Start Exploring/ }).click();

    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('alertdialog')).toContainText('273 MB');
    expect(nativeDialog, 'no "could not connect" popup instead of the prompt').toBeNull();
  });

  test('a grant for one model does not silently cover another', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('graphible-setup-complete', 'true');
      // Approved a different model previously.
      localStorage.setItem(
        'graphible-webllm-consent-v2',
        JSON.stringify({ 'onnx-community/Qwen3-0.6B-ONNX': { granted: true, at: Date.now() } })
      );
      localStorage.setItem(
        'graphible-model-config',
        JSON.stringify({ type: 'webllm', model: 'onnx-community/gemma-3-270m-it-ONNX', dtype: 'q4f16' })
      );
    });
    await page.goto('/');

    await page.locator('#main-prompt').fill('hello');
    await page.getByRole('button', { name: /Start Exploring/ }).click();

    await expect(page.getByRole('alertdialog')).toContainText('Gemma 3 270M', { timeout: 20000 });
  });

  test('reopening the wizard lets a different model be chosen', async ({ page }) => {
    await withStaleGlobalConsent(page);
    await page.goto('/');

    await page.getByRole('button', { name: /^Setup$/ }).click();

    // Landing on Success left no obvious way back to the model choice.
    await expect(page.getByRole('heading', { name: /Choose your AI source/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Try the demo/i })).toBeVisible();
  });
});
