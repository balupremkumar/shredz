import { test, expect } from '@playwright/test';
import { openApp, FOODS, localDate, usualDay } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  // Emulates visual viewport events, not the real iOS keyboard or AutoFill UI.
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), {
      height: window.innerHeight, width: window.innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1,
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  });
});

async function keyboard(page, open) {
  await page.evaluate(open => {
    window.visualViewport.height = window.innerHeight - (open ? 336 : 0);
    window.visualViewport.dispatchEvent(new Event('resize'));
  }, open);
}

async function expectGeometry(page, field, withDock) {
  await expect.poll(async () => {
    const height = await page.evaluate(() => window.visualViewport.height);
    const sheet = await page.locator('.sheet').boundingBox();
    const input = await field.boundingBox();
    if (!sheet || !input) return false;
    if (sheet.y < 0 || sheet.y + sheet.height > height + 1 || input.y < 0 || input.y + input.height > height) return false;
    if (withDock) {
      const dock = await page.locator('.sheet__dock, .sheet__foot').boundingBox();
      if (!dock || dock.y + dock.height > height + 1 || input.y + input.height > dock.y) return false;
    }
    return true;
  }).toBe(true);
  await expect(field).toBeFocused();
}

for (const kind of ['add-food', 'food-edit']) {
  test(`${kind} follows the keyboard, restores the viewport and page scroll`, async ({ page }) => {
    const foods = [...FOODS, ...Array.from({ length: 24 }, (_, index) => ({
      ...FOODS[0], id: `scroll-food-${index}`, name: `Scroll food ${index}`, aliases: [],
    }))];
    const entries = [...usualDay(localDate(), 'first'), ...usualDay(localDate(), 'second')];
    const errors = await openApp(page, { foods, entries });
    if (kind === 'food-edit') await page.locator('.tabbar').getByRole('button', { name: 'Foods' }).click();
    await page.evaluate(() => window.scrollTo(0, 100));
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);
    const open = kind === 'food-edit'
      ? page.locator('.dock').getByRole('button', { name: 'Add food' })
      : page.getByRole('button', { name: 'Add food' }).first();
    // A DOM click preserves the page position being tested, without locator auto-scroll.
    await open.evaluate(button => button.click());
    await expect(page.locator('.sheet')).toBeVisible();
    expect(await page.evaluate(() => Object.hasOwn(document.documentElement.dataset, 'sheetOpen'))).toBe(true);
    const field = kind === 'food-edit'
      ? page.locator('.sheet input[inputmode="decimal"]').last()
      : page.locator('.sheet input[type="search"]');
    await field.focus();
    await keyboard(page, true);
    await expectGeometry(page, field, kind === 'food-edit');
    await expect(field).toHaveAttribute('autocomplete', 'off');

    await keyboard(page, false);
    await expect.poll(async () => {
      const box = await page.locator('.sheet').boundingBox();
      return Math.abs(box.y + box.height - await page.evaluate(() => window.innerHeight));
    }).toBeLessThanOrEqual(1);
    await page.locator('.sheet').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.sheet')).toHaveCount(0);
    expect(await page.evaluate(() => Object.hasOwn(document.documentElement.dataset, 'sheetOpen'))).toBe(false);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
    expect(errors).toEqual([]);
  });
}
