import { test, expect } from '@playwright/test';
import { openApp, FOODS, localDate, usualDay, expectFood } from './helpers.mjs';

test('installable: manifest, icons and iOS meta are served', async ({ page, request }) => {
  await openApp(page);
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(manifestHref)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('./');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBeTruthy();
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(touch)).ok()).toBeTruthy();
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
});

test('works offline after the first visit, data intact', async ({ page, context }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate()) });
  // Wait until the service worker controls the page and has cached the app.
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!(reg && reg.active) && (await caches.keys()).some(k => k.startsWith('macro-diary-'));
  }, null, { timeout: 15000 });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.tabbar .tab')).toHaveCount(3);
  await expectFood(page, '839');
  await page.getByRole('button', { name: 'Speak' }).click();
  await expect(page.getByLabel('What you ate')).toBeVisible();
  await context.setOffline(false);
});
