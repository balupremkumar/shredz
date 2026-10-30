import { expect } from '@playwright/test';
import { seed, localDate, FOODS, SENTENCE } from '../fixtures.mjs';
export { seed, localDate, FOODS, SENTENCE };

// Opens the app on a clean database and collects page errors for the test to assert on.
export async function openApp(page, data) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('index.html');
  await page.waitForSelector('.tabbar .tab');
  if (data) await seed(page, data);
  return errors;
}

export const entry = (id, date, meal, foodId, qty) => ({ id, date, meal, foodId, qty });

// Balu's usual day: 839 kcal over two meals.
export function usualDay(date, prefix = date) {
  return [
    entry(`${prefix}-1`, date, 1, 'wb', 2), entry(`${prefix}-2`, date, 1, 'gm', 200), entry(`${prefix}-3`, date, 1, 'wp', 1),
    entry(`${prefix}-4`, date, 2, 'cb', 125), entry(`${prefix}-5`, date, 2, 'br', 150), entry(`${prefix}-6`, date, 2, 'cs', 20),
  ];
}

// Auto-retrying check of the Food figure in the summary (actions save asynchronously).
export async function expectFood(page, kcal) {
  await expect(page.locator('.summary .summary__col').nth(1).locator('.summary__num')).toHaveText(kcal);
}

export async function expectNoSideScroll(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}
