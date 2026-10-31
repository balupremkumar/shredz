import { test, expect } from '@playwright/test';
import { openApp, FOODS, localDate, usualDay, expectNoSideScroll } from './helpers.mjs';

// The sheet and the page must both fit the width: no sideways scroll on any screen.
async function expectSheetFits(page) {
  const over = await page.locator('.sheet').evaluate(el => el.scrollWidth - el.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
  await expectNoSideScroll(page);
}
const tab = (page, name) => page.locator('.tabbar').getByRole('button', { name }).click();

for (const scheme of ['light', 'dark']) {
  for (const width of [375, 390, 430]) {
    test(`no sideways scroll at ${width}px in ${scheme} on every screen`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 844 });
      const today = localDate();
      const errors = await openApp(page, { foods: FOODS, entries: usualDay(today), weights: [{ date: today, kg: 82.4 }] });

      await expectNoSideScroll(page); // Diary

      await page.getByRole('button', { name: 'Speak' }).click(); // Speak sheet (typing mode in headless WebKit)
      await page.getByLabel('What you ate').fill('Meal 1, 2 Weet-Bix and 200 mils of green milk, 3 bananas, and a very long unrecognised sentence about nothing in particular');
      await expect(page.locator('.sheet .row--problem').first()).toBeVisible();
      await expectSheetFits(page);
      await page.locator('.sheet').getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('.sheet')).toHaveCount(0);

      await page.locator('main .row', { hasText: 'Chicken breast' }).click(); // Quantity sheet
      await expect(page.getByLabel('Quantity in g')).toBeVisible();
      await expectSheetFits(page);
      await page.locator('.sheet').getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('.sheet')).toHaveCount(0);

      await tab(page, 'Weight');
      await page.getByRole('button', { name: '7 and 30 day averages' }).click();
      await expectNoSideScroll(page);
      await tab(page, 'Foods');
      await expectNoSideScroll(page);
      await page.getByRole('button', { name: 'Settings' }).click();
      await expectNoSideScroll(page);
      expect(errors).toEqual([]);
    });
  }
}
