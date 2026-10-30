import { test, expect } from '@playwright/test';
import { openApp, FOODS, SENTENCE, expectFood } from './helpers.mjs';

test("dictate Balu's sentence: live lines, say save, confirm, logged", async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await page.getByRole('button', { name: /Dictate/ }).click();
  const box = page.getByLabel('What you ate');
  // The text box must already have focus so iOS raises the keyboard with its mic.
  await expect(box).toBeFocused();
  await box.pressSequentially(SENTENCE);
  const lines = page.locator('.live-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toContainText('322 kcal');
  await expect(lines.nth(1)).toContainText('517 kcal');
  await box.pressSequentially(' Save.');
  await expect(page.locator('.sheet')).toContainText('Confirm');
  await page.locator('.sheet').getByRole('button', { name: /Add 839 kcal/ }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expectFood(page, '839');
  await expect(page.locator('main .section .row')).toHaveCount(6);
});

test('unrecognised food: add it as a food and come back to confirm', async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await page.getByRole('button', { name: /Dictate/ }).click();
  await page.getByLabel('What you ate').fill('Meal 1, 2 Weet-Bix and 3 bananas');
  await expect(page.locator('.problem-line:not([hidden])')).toContainText('bananas');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.row--problem')).toContainText('3 bananas');
  await page.getByRole('button', { name: 'Add as food' }).click();
  await expect(page.locator('.sheet')).toContainText('New food');
  await expect(page.locator('.sheet input').first()).toHaveValue(/banana/i);
  await page.locator('.sheet select').first().selectOption('item');
  await page.getByLabel(/Calories/).fill('105');
  await page.getByLabel(/Protein/).fill('1.3');
  await page.getByLabel(/Carbs/).fill('27');
  await page.getByLabel(/Fat/).fill('0.4');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.sheet')).toContainText('Confirm');
  await expect(page.locator('.row--problem')).toHaveCount(0);
  await page.locator('.sheet').getByRole('button', { name: /Add 425 kcal/ }).click();
  await expectFood(page, '425');
});

test('cancel on confirm returns to dictate with the text kept', async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await page.getByRole('button', { name: /Dictate/ }).click();
  await page.getByLabel('What you ate').fill('2 Weet-Bix');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('What you ate')).toHaveValue('2 Weet-Bix');
});
