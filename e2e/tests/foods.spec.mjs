import { test, expect } from '@playwright/test';
import { openApp, FOODS, localDate, usualDay } from './helpers.mjs';

test('create a food, see it listed, edit its calories', async ({ page }) => {
  await openApp(page);
  await page.locator('.tabbar').getByRole('button', { name: 'Foods' }).click();
  await page.locator('.dock').getByRole('button', { name: 'Add food' }).click();
  await page.getByLabel(/Name/).fill('Weet-Bix');
  await page.locator('.sheet select').first().selectOption('item');
  await page.getByLabel(/Calories/).fill('55');
  await page.getByLabel(/Protein/).fill('1.8');
  await page.getByLabel(/Carbs/).fill('10.5');
  await page.getByLabel(/Fat/).fill('0.3');
  await page.getByLabel(/Other names/).fill('weetbix, wheat bix');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main')).toContainText('per 1 item: 55 kcal, P 1.8 C 10.5 F 0.3');
  await page.locator('main .row', { hasText: 'Weet-Bix' }).click();
  await page.getByLabel(/Calories/).fill('56');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main')).toContainText('per 1 item: 56 kcal');
});

test('a food used in the diary cannot be deleted', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate()) });
  await page.locator('.tabbar').getByRole('button', { name: 'Foods' }).click();
  await page.locator('main .row', { hasText: 'Cashews' }).click();
  await page.getByRole('button', { name: 'Delete food' }).click();
  await expect(page.locator('.sheet')).toContainText('in your diary');
});

test('an invalid number is rejected inline and nothing is saved', async ({ page }) => {
  await openApp(page);
  await page.locator('.tabbar').getByRole('button', { name: 'Foods' }).click();
  await page.locator('.dock').getByRole('button', { name: 'Add food' }).click();
  await page.getByLabel(/Name/).fill('Bad');
  await page.getByLabel(/Calories/).fill('abc');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.sheet .problem-line')).toBeVisible();
  await page.locator('.sheet').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('main')).not.toContainText('Bad');
});
