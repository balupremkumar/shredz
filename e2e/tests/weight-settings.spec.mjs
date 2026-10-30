import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp, FOODS, localDate, usualDay, expectFood } from './helpers.mjs';

const weights = [
  { date: localDate(-29), kg: 84.1 }, { date: localDate(-15), kg: 83.2 },
  { date: localDate(-1), kg: 82.5 }, { date: localDate(0), kg: 82.4 },
];

test('weight tab: chart by date, newest-first list, log with a comma decimal', async ({ page }) => {
  await openApp(page, { foods: FOODS, weights });
  await page.locator('.tabbar').getByRole('button', { name: 'Weight' }).click();
  await expect(page.locator('.chart svg polyline')).toHaveCount(1);
  const rows = page.locator('main button.row');
  await expect(rows.first()).toContainText('82.4 kg');
  const input = page.getByLabel('Weight in kg');
  await input.fill('82,1');
  await page.locator('main').getByRole('button', { name: 'Save' }).click();
  await expect(rows.first()).toContainText('82.1 kg');
});

test('weight tab: edit and delete a past weigh-in', async ({ page }) => {
  await openApp(page, { foods: FOODS, weights });
  await page.locator('.tabbar').getByRole('button', { name: 'Weight' }).click();
  await page.locator('main .row', { hasText: '83.2 kg' }).click();
  await page.locator('.sheet input').first().fill('83.0');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main')).toContainText('83.0 kg');
  await page.locator('main .row', { hasText: '83.0 kg' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('main')).not.toContainText('83.0 kg');
});

test('goals saved in settings drive the diary summary', async ({ page }) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate()) });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel(/Calories/).fill('2300');
  await page.getByLabel(/Protein/).fill('170');
  await page.getByLabel(/Carbs/).fill('240');
  await page.getByLabel(/Fat/).fill('65');
  await page.getByRole('button', { name: 'Save goals' }).click();
  await page.locator('.tabbar').getByRole('button', { name: 'Diary' }).click();
  await expect(page.locator('.summary')).toContainText('2,300');
  await expect(page.locator('.summary')).toContainText('1,461');
  await expect(page.locator('.macros')).toContainText('/ 170');
});

test('backup: export, wipe, import with replace restores everything; a bad file is refused', async ({ page }, info) => {
  await openApp(page, { foods: FOODS, entries: usualDay(localDate()), weights });
  await page.getByRole('button', { name: 'Settings' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export backup' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`macro-diary-${new Date().toISOString().slice(0, 10)}.json`);
  const file = info.outputPath('backup.json');
  await download.saveAs(file);
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  expect(backup.entries).toHaveLength(6);

  // Wipe the database, reopen to an empty diary.
  await page.evaluate(() => new Promise(res => { const r = indexedDB.deleteDatabase('macro-diary'); r.onsuccess = r.onerror = r.onblocked = res; }));
  await page.reload();
  await expect(page.getByText(/Nothing logged for Today/)).toBeVisible();

  // A bad file shows its problems and changes nothing.
  await page.getByRole('button', { name: 'Settings' }).click();
  const bad = info.outputPath('bad.json');
  require_write(bad, JSON.stringify({ app: 'macro-diary', schema: 1, entries: [{ id: 'x', date: 'nope', meal: 0, foodId: 'zz', qty: -1 }] }));
  await chooseBackup(page, bad);
  await page.getByRole('button', { name: 'Replace everything' }).click();
  await expect(page.locator('.sheet')).toContainText(/entries\[0\]/);
  await page.locator('.sheet').getByRole('button', { name: 'Cancel' }).click();

  await chooseBackup(page, file);
  await page.getByRole('button', { name: 'Replace everything' }).click();
  await expect(page.locator('.toast')).toContainText('Imported 6 entries');
  await page.locator('.tabbar').getByRole('button', { name: 'Diary' }).click();
  await expectFood(page, '839');
});

async function chooseBackup(page, path) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import backup' }).click(),
  ]);
  await chooser.setFiles(path);
  await expect(page.locator('.sheet')).toContainText('Import backup');
}

import { writeFileSync } from 'node:fs';
function require_write(path, text) { writeFileSync(path, text); }
