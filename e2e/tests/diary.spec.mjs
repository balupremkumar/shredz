import { test, expect } from '@playwright/test';
import { openApp, FOODS, localDate, usualDay, expectFood, expectNoSideScroll } from './helpers.mjs';

test('first run shows an empty, usable diary', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.getByText(/Nothing logged for Today/)).toBeVisible();
  await expect(page.getByLabel('Morning weight in kg')).toBeVisible();
  await expect(page.getByRole('button', { name: /Dictate/ })).toBeVisible();
  await expectNoSideScroll(page);
  expect(errors).toEqual([]);
});

test('morning weigh-in is one tap: prefilled from yesterday, log, collapses, persists', async ({ page }) => {
  await openApp(page, { foods: FOODS, weights: [{ date: localDate(-8), kg: 83.0 }, { date: localDate(-1), kg: 82.5 }] });
  const input = page.getByLabel('Morning weight in kg');
  await expect(input).toHaveValue('82.5');
  await input.fill('82.1');
  await page.getByRole('button', { name: 'Log' }).click();
  await expect(page.locator('.weigh-in--done')).toContainText('82.1 kg');
  await expect(page.locator('.weigh-in--done')).toContainText('this week');
  await page.reload();
  await expect(page.locator('.weigh-in--done')).toContainText('82.1 kg');
});

test('weigh-in row layout: label, input and Log sit on one compact line', async ({ page }) => {
  await openApp(page, { foods: FOODS, weights: [{ date: localDate(-1), kg: 82.5 }] });
  const box = await page.locator('.weigh-in').boundingBox();
  expect(box.height).toBeLessThan(110);
  const log = await page.getByRole('button', { name: 'Log' }).boundingBox();
  expect(log.height).toBeLessThan(60);
});

test('add a food by tapping: search, quantity, totals update', async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await page.getByRole('button', { name: 'Add food' }).first().click();
  await page.locator('.sheet input').first().fill('chick');
  await page.locator('.sheet').getByText('Chicken breast').click();
  await page.locator('.sheet input').first().fill('125');
  await page.locator('.sheet').getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('main .section').first()).toContainText('Chicken breast');
  await expectFood(page, '206');
});

test('copy yesterday fills an empty day in one tap', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate(-1)) });
  await page.locator('.dock').getByRole('button', { name: /Copy/ }).click();
  await expect(page.locator('main .section .row')).toHaveCount(6);
  await expectFood(page, '839');
  await expect(page.locator('.dock').getByRole('button', { name: /Copy/ })).toHaveCount(0);
});

test('copy a single meal from an earlier day', async ({ page }) => {
  const today = localDate();
  await openApp(page, { foods: FOODS, entries: [...usualDay(localDate(-1)), ...usualDay(today).slice(0, 3)] });
  // Meal 2 is missing today: the next-meal block offers to copy it from yesterday.
  await page.getByRole('button', { name: /Copy Meal 2 from Yesterday/ }).click();
  await expectFood(page, '839');
});

test('edit and delete an entry', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate()) });
  await page.locator('main .row', { hasText: 'Chicken breast' }).click();
  await page.locator('.sheet input').first().fill('200');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await expectFood(page, '963');
  await page.locator('main .row', { hasText: 'Cashews' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Delete' }).click();
  await expectFood(page, '847');
});

test('date navigation and data survive a reload', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate(-1)) });
  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(page.locator('.topbar')).toContainText('Yesterday');
  await expectFood(page, '839');
  await page.reload();
  await page.getByRole('button', { name: 'Previous day' }).click();
  await expectFood(page, '839');
});

for (const width of [375, 390, 430]) {
  test(`no sideways scroll at ${width}px on every tab`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openApp(page, { foods: FOODS, entries: usualDay(localDate()), weights: [{ date: localDate(), kg: 82.4 }] });
    for (const tab of ['Diary', 'Foods', 'Weight']) {
      await page.locator('.tabbar').getByRole('button', { name: tab }).click();
      await expectNoSideScroll(page);
    }
  });
}
