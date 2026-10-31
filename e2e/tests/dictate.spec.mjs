import { test, expect } from '@playwright/test';
import { openApp, FOODS, SENTENCE, expectFood } from './helpers.mjs';

const speak = page => page.getByRole('button', { name: 'Speak' }).click();
const sheet = page => page.locator('.sheet');

test("speak Balu's sentence: I heard list, say save, logged with no confirm step", async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await speak(page);
  const box = page.getByLabel('What you ate');
  // Headless WebKit has no speech recognition, so the sheet opens the text box, focused for the keyboard mic.
  await expect(box).toBeFocused();
  await box.pressSequentially(SENTENCE);
  await expect(sheet(page).locator('section', { hasText: 'I heard' })).toContainText('839 kcal');
  await expect(sheet(page).locator('.row')).toHaveCount(6);
  await expect(sheet(page).getByRole('button', { name: 'Save 6 items' })).toBeEnabled();
  await box.pressSequentially(' Save.');
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('Added 6 items, 839 kcal');
  await expectFood(page, '839');
  await expect(page.locator('main .section .row')).toHaveCount(6);
});

test('the docked Save N items button commits', async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await speak(page);
  await page.getByLabel('What you ate').fill('Meal 1, 2 Weet-Bix and 200 mils of green milk');
  await sheet(page).getByRole('button', { name: 'Save 2 items' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expectFood(page, '202');
});

test('unrecognised food: Add it as a food, come back, and Save', async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await speak(page);
  await page.getByLabel('What you ate').fill('Meal 1, 2 Weet-Bix and 3 bananas');
  const problem = page.locator('.row--problem');
  await expect(problem).toContainText('Not recognised: 3 bananas');
  await expect(sheet(page).getByRole('button', { name: 'Save 1 item', exact: true })).toBeVisible();
  await problem.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(sheet(page)).toContainText('New food');
  await expect(sheet(page).locator('input').first()).toHaveValue(/banana/i);
  await sheet(page).locator('select').first().selectOption('item');
  await page.getByLabel(/Calories/).fill('105');
  await page.getByLabel(/Protein/).fill('1.3');
  await page.getByLabel(/Carbs/).fill('27');
  await page.getByLabel(/Fat/).fill('0.4');
  await sheet(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.row--problem')).toHaveCount(0);
  await expect(sheet(page).locator('section', { hasText: 'I heard' })).toContainText('425 kcal');
  await sheet(page).getByRole('button', { name: 'Save 2 items' }).click();
  await expectFood(page, '425');
});

test('Remove drops an unrecognised row; unit words are never offered as foods', async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await speak(page);
  await page.getByLabel('What you ate').fill('Meal 1, 2 Weet-Bix, 3 servings');
  const problem = page.locator('.row--problem');
  await expect(problem).toContainText('Not a food name');
  await expect(problem.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0);
  await expect(problem.getByRole('button', { name: 'This is...' })).toHaveCount(0);
  await problem.getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('.row--problem:visible')).toHaveCount(0);
  await expect(sheet(page).getByRole('button', { name: 'Save 1 item', exact: true })).toBeEnabled();
});

test('Cancel closes the sheet, logs nothing and the next Speak starts empty', async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await speak(page);
  await page.getByLabel('What you ate').fill('2 Weet-Bix');
  await sheet(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expectFood(page, '0');
  await speak(page);
  await expect(page.getByLabel('What you ate')).toHaveValue('');
});
