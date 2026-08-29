import { test, expect } from '@playwright/test';

// The live site shipped links to /favicon-32x32.png and /favicon-16x16.png
// that had never existed, plus two competing rel="icon" declarations. Google
// showed no favicon. These assertions fail if an icon reference goes stale.
test.describe('favicons', () => {
  test('every declared icon and the manifest resolve', async ({ page, request }) => {
    await page.goto('/');

    const hrefs = await page.$$eval(
      'link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]',
      (links) => links.map((l) => l.getAttribute('href'))
    );
    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      const res = await request.get(new URL(href, page.url()).toString());
      expect(res.status(), `${href} should resolve`).toBe(200);
    }
  });

  test('serves favicon.ico at the site root, where Google looks for it', async ({ request, baseURL }) => {
    const res = await request.get(new URL('/favicon.ico', baseURL).toString());
    expect(res.status()).toBe(200);

    const body = await res.body();
    // ICO header: reserved 0, type 1, then the image count.
    expect(body.readUInt16LE(0)).toBe(0);
    expect(body.readUInt16LE(2)).toBe(1);

    const count = body.readUInt16LE(4);
    expect(count).toBeGreaterThan(0);

    // Google ignores favicons below 48x48, so one entry must be at least that.
    const sizes = [];
    for (let i = 0; i < count; i++) {
      const entry = 6 + i * 16;
      sizes.push(body.readUInt8(entry) === 0 ? 256 : body.readUInt8(entry));
    }
    expect(Math.max(...sizes)).toBeGreaterThanOrEqual(48);
  });

  test('declares exactly one SVG icon, not two competing ones', async ({ page }) => {
    await page.goto('/');
    const svgIcons = await page.$$eval('link[rel~="icon"][type="image/svg+xml"]', (l) => l.length);
    expect(svgIcons).toBe(1);
  });

  test('is crawlable, and points at a sitemap', async ({ request, baseURL }) => {
    const res = await request.get(new URL('/robots.txt', baseURL).toString());
    expect(res.status()).toBe(200);

    const text = await res.text();
    expect(text).toMatch(/Allow: \//);
    expect(text).not.toMatch(/Disallow: \/\s*$/m);
  });
});
