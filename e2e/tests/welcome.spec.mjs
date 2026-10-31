import { test, expect } from '@playwright/test';
import { openApp, FOODS, localDate, usualDay } from './helpers.mjs';

const dialog = page => page.getByRole('dialog', { name: 'Welcome to Shredz' });

test('fresh install: step 1, Skip and Next move on, Start logging lands on the Diary, never again after reload', async ({ page }) => {
  const errors = await openApp(page, { foods: FOODS }, { welcome: true });
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText('Step 1 of 3');
  await expect(dialog(page)).toContainText('Your daily goals');

  // Skip on step 1 goes to step 2.
  await dialog(page).getByRole('button', { name: 'Skip' }).click();
  await expect(dialog(page)).toContainText('Step 2 of 3');
  await expect(dialog(page)).toContainText('Your foods');
  await expect(dialog(page)).toContainText('Weet-Bix');
  await dialog(page).getByRole('button', { name: 'Back' }).click();
  await expect(dialog(page)).toContainText('Step 1 of 3');

  // Next on step 1 (goals unchanged) goes to step 2, Next again to step 3.
  await dialog(page).getByRole('button', { name: 'Next' }).click();
  await expect(dialog(page)).toContainText('Step 2 of 3');
  await dialog(page).getByRole('button', { name: 'Next' }).click();
  await expect(dialog(page)).toContainText('Step 3 of 3');
  await expect(dialog(page)).toContainText('Try saying a meal');

  // Practice only: nothing is saved.
  await page.getByLabel('Practice sentence').fill('2 Weet-Bix');
  await expect(dialog(page)).toContainText('Weet-Bix');
  await dialog(page).getByRole('button', { name: 'Start logging' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('.tabbar .tab--active')).toContainText('Diary');
  await expect(page.getByText(/Nothing logged for Today/)).toBeVisible();

  await page.reload();
  await page.waitForSelector('.tabbar .tab');
  await expect(dialog(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('shredz.welcomeDone'))).toBe('1');
  expect(errors).toEqual([]);
});

test('Skip through all three steps also finishes the welcome for good', async ({ page }) => {
  await openApp(page, { foods: FOODS }, { welcome: true });
  for (let step = 1; step <= 3; step += 1) {
    await expect(dialog(page)).toContainText(`Step ${step} of 3`);
    await dialog(page).getByRole('button', { name: 'Skip' }).click();
  }
  await expect(dialog(page)).toHaveCount(0);
  await page.reload();
  await page.waitForSelector('.tabbar .tab');
  await expect(dialog(page)).toHaveCount(0);
});

test('step 1 refuses a bad number and saves changed goals', async ({ page }) => {
  await openApp(page, { foods: FOODS }, { welcome: true });
  await page.getByLabel('Protein g').fill('abc');
  await dialog(page).getByRole('button', { name: 'Next' }).click();
  await expect(dialog(page).locator('.problem-line:not([hidden])')).toContainText('Protein g');
  await expect(dialog(page)).toContainText('Step 1 of 3');
  await page.getByLabel('Protein g').fill('170');
  await page.getByLabel('Carbs g').fill('240');
  await page.getByLabel('Fat g').fill('65');
  await expect(dialog(page)).toContainText('2,225 kcal');
  await dialog(page).getByRole('button', { name: 'Next' }).click();
  await expect(dialog(page)).toContainText('Step 2 of 3');
  await dialog(page).getByRole('button', { name: 'Skip' }).click();
  await dialog(page).getByRole('button', { name: 'Start logging' }).click();
  await expect(page.locator('p[data-eaten]')).toHaveAttribute('data-goal', '2,225');
});

test('an install with existing entries never sees the welcome, even without the flag', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate()) }, { welcome: true });
  await expect(page.locator('p[data-eaten]')).toHaveAttribute('data-eaten', '839');
  await expect(dialog(page)).toHaveCount(0);
});
