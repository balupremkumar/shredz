import { test, expect } from '@playwright/test';
import { openApp, FOODS, localDate, usualDay, expectFood, expectNoSideScroll } from './helpers.mjs';

const today = localDate();

test('plus and minus step an item and never go below one step', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(today) });
  await page.getByRole('button', { name: 'More Weet-Bix' }).click();
  await expectFood(page, '894');
  await page.getByRole('button', { name: 'Less Weet-Bix' }).click();
  await page.getByRole('button', { name: 'Less Weet-Bix' }).click();
  await page.getByRole('button', { name: 'Less Weet-Bix' }).click();
  await expectFood(page, '784');
  await page.getByRole('button', { name: 'More Chicken breast' }).click();
  await expectFood(page, '826');
});

test('swipe an item left to delete it', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(today) });
  const row = page.locator('main .row', { hasText: 'Cashews' }).first();
  const box = await row.boundingBox();
  const y = box.y + box.height / 2;
  await page.touchscreen.tap(box.x + box.width - 140, y).catch(() => {});
  await row.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: box.x + box.width - 100, clientY: y, isPrimary: true, pointerId: 7 });
  for (const dx of [20, 50, 90, 130]) {
    await row.dispatchEvent('pointermove', { pointerType: 'touch', clientX: box.x + box.width - 100 - dx, clientY: y, isPrimary: true, pointerId: 7 });
  }
  await row.dispatchEvent('pointerup', { pointerType: 'touch', clientX: box.x + box.width - 230, clientY: y, isPrimary: true, pointerId: 7 });
  await page.getByRole('button', { name: 'Delete Cashews' }).click();
  await expectFood(page, '723');
});

test('save a meal, then add it to another day from Add food first', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate(-1)) });
  await page.getByRole('button', { name: 'Previous day' }).click();
  await page.locator('main .section', { hasText: 'Meal 1' }).getByRole('button', { name: 'Save meal' }).click();
  await page.locator('.sheet input').first().fill('Usual breakfast');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Next day' }).click();
  await page.getByRole('button', { name: 'Add food' }).first().click();
  await expect(page.locator('.sheet')).toContainText('Saved meals');
  await page.locator('.sheet .row', { hasText: 'Usual breakfast' }).click();
  await expectFood(page, '322');
});

test('dictating a saved meal name logs its items', async ({ page }) => {
  await openApp(page, { foods: FOODS, savedMeals: [{ id: 'sm1', name: 'Usual breakfast', aliases: [], items: [{ foodId: 'wb', qty: 2 }, { foodId: 'gm', qty: 200 }, { foodId: 'wp', qty: 1 }] }] });
  await page.getByRole('button', { name: /Dictate/ }).click();
  await page.getByLabel('What you ate').pressSequentially('Meal one, usual breakfast. Save.');
  await expect(page.locator('.sheet')).toContainText('from Usual breakfast');
  await page.locator('.sheet').getByRole('button', { name: /Add 322 kcal/ }).click();
  await expectFood(page, '322');
});

test('learn an unrecognised word as another name for a food', async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await page.getByRole('button', { name: /Dictate/ }).click();
  await page.getByLabel('What you ate').fill('2 wheaties');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'This is...' }).click();
  await page.getByLabel(/Which food is/).selectOption({ label: 'Weet-Bix' });
  await page.getByRole('button', { name: 'Learn' }).click();
  await expect(page.locator('.row--problem')).toHaveCount(0);
  await page.locator('.sheet').getByRole('button', { name: /Add 110 kcal/ }).click();
  await expectFood(page, '110');
  await page.getByRole('button', { name: /Dictate/ }).click();
  await page.getByLabel('What you ate').fill('3 wheaties');
  await expect(page.locator('.live-line')).toContainText('165 kcal');
});

test('copy this day to another date', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(today) });
  await page.getByRole('button', { name: 'Copy this day to...' }).click();
  await page.locator('.sheet input[type="date"]').fill(localDate(1));
  await page.locator('.sheet').getByRole('button', { name: 'Copy' }).click();
  await expect(page.locator('.topbar')).toContainText('Tomorrow');
  await expectFood(page, '839');
});

test('goal modes: calories and % split, then grams', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(today) });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Calories and %' }).click();
  await page.getByLabel(/^Calories/).fill('2400');
  await page.getByLabel(/Protein %/).fill('30');
  await page.getByLabel(/Carbs %/).fill('40');
  await page.getByLabel(/Fat %/).fill('31');
  await expect(page.locator('main .problem-line:not([hidden])')).toBeVisible();
  await page.getByLabel(/Fat %/).fill('30');
  await expect(page.locator('main')).toContainText('180 g protein, 240 g carbs, 80 g fat');
  await page.getByRole('button', { name: 'Save goals' }).click();
  await page.locator('.tabbar').getByRole('button', { name: 'Diary' }).click();
  await expect(page.locator('.macros')).toContainText('/ 240');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Grams', exact: true }).click();
  await page.getByLabel(/Protein \(?g/).fill('200');
  await expect(page.locator('main')).toContainText('2,480 kcal');
});

test('CSV exports and larger text', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(today), weights: [{ date: today, kg: 82.4 }] });
  await page.getByRole('button', { name: 'Settings' }).click();
  const [diary] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export diary CSV' }).click()]);
  expect(diary.suggestedFilename()).toBe(`macro-diary-diary-${today}.csv`);
  const [weights] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export weights CSV' }).click()]);
  expect(weights.suggestedFilename()).toBe(`macro-diary-weights-${today}.csv`);
  await page.getByLabel('Larger text').check();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'large');
  await page.setViewportSize({ width: 375, height: 812 });
  for (const tab of ['Diary', 'Foods', 'Weight']) {
    await page.locator('.tabbar').getByRole('button', { name: tab }).click();
    await expectNoSideScroll(page);
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'large');
});

test('weight tab shows the report and the 7-day average line', async ({ page }) => {
  const weights = [-20, -14, -7, -3, -1, 0].map((o, i) => ({ date: localDate(o), kg: [84, 83.6, 83.1, 82.8, 82.6, 82.4][i] }));
  await openApp(page, { foods: FOODS, entries: [...usualDay(today), ...usualDay(localDate(-1), 'y')], weights });
  await page.locator('.tabbar').getByRole('button', { name: 'Weight' }).click();
  await expect(page.locator('main')).toContainText('7 days');
  await expect(page.locator('main')).toContainText('30 days');
  await expect(page.locator('main')).toContainText('2 of 7 days logged');
  await expect(page.locator('.chart svg polyline')).toHaveCount(2);
  await expect(page.locator('main')).toContainText('7-day average');
});
