import { test, expect } from '@playwright/test';
import { openApp, FOODS, localDate, usualDay, expectFood, expectNoSideScroll } from './helpers.mjs';

test('first run shows an empty, usable diary', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.getByText(/Nothing logged for Today/)).toBeVisible();
  await expect(page.getByLabel('Morning weight in kg')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Speak' })).toBeVisible();
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
  await page.locator('.sheet input[type="search"]').fill('chick');
  await page.locator('.sheet').getByText('Chicken breast').click();
  await page.getByLabel('Quantity in g').fill('125');
  await page.locator('.sheet').getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('main .section').first()).toContainText('Chicken breast');
  await expectFood(page, '206');
});

test('copy yesterday fills an empty day in one tap', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate(-1)) });
  await page.locator('main').getByRole('button', { name: /Copy yesterday/ }).click();
  await expect(page.locator('main .section .row')).toHaveCount(6);
  await expectFood(page, '839');
  await expect(page.locator('main').getByRole('button', { name: /Copy yesterday/ })).toHaveCount(0);
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
  await page.getByLabel('Quantity in g').fill('200');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await expectFood(page, '963');
  await page.locator('main .row', { hasText: 'Cashews' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Remove from Meal 2' }).click();
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

test('empty day offers Speak, Copy yesterday and Add food by hand', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate(-1)) });
  const main = page.locator('main');
  await expect(main).toContainText('Tap Speak and say a meal');
  await expect(main.getByRole('button', { name: /Copy yesterday/ })).toBeVisible();
  await main.getByRole('button', { name: 'Add food by hand' }).click();
  await expect(page.locator('.sheet')).toContainText('Add to Meal 1');
});

test('summary equation carries goal, eaten and left', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate()) });
  const eq = page.locator('p[data-eaten]');
  await expect(eq).toHaveAttribute('data-eaten', '839');
  await expect(eq).toContainText('839 eaten');
  await expect(page.locator('.mic-fab')).toBeVisible();
});

test('quantity sheet: quick amount, then Save updates the total; no plus or minus buttons', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate()) });
  await expect(page.getByRole('button', { name: 'More Weet-Bix' })).toHaveCount(0);
  await page.locator('main .row', { hasText: 'Weet-Bix' }).click();
  await expect(page.getByLabel('Quantity in item')).toHaveValue('2');
  await page.locator('.sheet').getByRole('button', { name: '3 items', exact: true }).click();
  await expect(page.getByLabel('Quantity in item')).toHaveValue('3');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await expectFood(page, '894');
});
