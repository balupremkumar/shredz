import { expect } from '@playwright/test';
import { seed, localDate, FOODS, SENTENCE } from '../fixtures.mjs';
export { seed, localDate, FOODS, SENTENCE };

// Opens the app on a clean database and collects page errors for the test to assert on.
export async function openApp(page, data, { welcome = false } = {}) {
  const errors = [];
  // A fresh install shows the 3-step welcome; skip it unless the test is about it.
  if (!welcome) await page.addInitScript(() => { try { localStorage.setItem('shredz.welcomeDone', '1'); } catch {} });
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

// Auto-retrying check of the eaten figure in the summary equation (actions save asynchronously).
export async function expectFood(page, kcal) {
  await expect(page.locator('p[data-eaten]')).toHaveAttribute('data-eaten', kcal);
}

export async function expectNoSideScroll(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}
