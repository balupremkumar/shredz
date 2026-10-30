// Repro for the owner's dictation bug: "Weet-Bix, 3 servings," then "Chicken breast, 100 grams,"
// via iOS keyboard dictation. Uses the owner's real food list, loaded with fs at run time
// (git-ignored file, never copied into this spec) and skipped when missing.
//
// Root cause: parser.js treats "servings" as an unknown food word, so "3 servings" is kept
// together as an unmatched item (the "Keep a number introducing unknown food words" guard in
// parseMeal), Weet-Bix falls back to defaultQty 2, and "3 servings" lands in unmatched.
// Screen text produced today (Confirm sheet):
//   "Weet-Bix" / "2 items" ; "Chicken breast (cooked)" / "100 g" ;
//   row--problem "Not recognised: 3 servings" with "Add as food" / "This is..." / "Remove".
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { openApp, expectFood } from './helpers.mjs';

const FOODS_FILE = new URL('../../private/macro-diary-foods.json', import.meta.url);
const haveFoods = fs.existsSync(FOODS_FILE);
const realFoods = () => { const j = JSON.parse(fs.readFileSync(FOODS_FILE, 'utf8')); return j.foods || j; };

// iOS keyboard dictation: each chunk is inserted at the caret and fires an input event.
async function dictateChunk(box, text) {
  await box.evaluate((el, t) => {
    el.value += t;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: t }));
  }, text);
}
// iOS sometimes rewrites the whole utterance at the end: set the full value, then fire input.
async function dictateReplace(box, full) {
  await box.evaluate((el, t) => {
    el.value = t;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: t }));
  }, full);
}

async function start(page) {
  await openApp(page, { foods: realFoods() });
  await page.getByRole('button', { name: /Dictate/ }).click();
  const box = page.getByLabel('What you ate');
  await expect(box).toBeFocused();
  return box;
}

async function toConfirm(page) {
  const sheet = page.locator('.sheet');
  if (!(await sheet.textContent()).includes('Confirm')) await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toContainText('Confirm');
  return sheet;
}

const rowsText = page => page.locator('.sheet .row').allInnerTexts().then(r => r.map(t => t.replace(/\s+/g, ' ').trim()));

// The correct behaviour, asserted on the Confirm sheet then on the logged diary.
async function expectCorrect(page, label) {
  const sheet = await toConfirm(page);
  const rows = await rowsText(page);
  console.log(`[${label}] confirm rows:`, JSON.stringify(rows));
  await expect(page.locator('.row--problem')).toHaveCount(0);
  await expect(sheet.locator('.row').filter({ hasText: 'Weet-Bix' }).locator('.row__qty')).toHaveText('3 items');
  await expect(sheet.locator('.row').filter({ hasText: 'Chicken breast' }).locator('.row__qty')).toHaveText('100 g');
  await expect(sheet.locator('.row')).toHaveCount(2);
  await sheet.getByRole('button', { name: /^Add \d+ kcal/ }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expectFood(page, '300'); // 3 x 53 + 141
}

const CHUNKS = [
  ['commas', ['Weet-Bix, 3 servings,', ' Chicken breast, 100 grams,']],
  ['full stops', ['Weet-Bix, 3 servings.', ' Chicken breast, 100 grams.']],
  ['three servings', ['Weet-Bix, three servings,', ' Chicken breast, 100 grams,']],
  ['trailing save', ['Weet-Bix, 3 servings,', ' Chicken breast, 100 grams, save']],
];

test.describe('owner dictation repro (real food list)', () => {
  test.skip(!haveFoods, 'private foods file missing');

  for (const [name, chunks] of CHUNKS) {
    test(`chunked dictation, ${name}: Weet-Bix 3, chicken 100 g, nothing unmatched`, async ({ page }) => {
      const box = await start(page);
      for (const c of chunks) await dictateChunk(box, c);
      await expectCorrect(page, name);
    });
  }

  test('whole utterance replaced at the end (set value then input)', async ({ page }) => {
    const box = await start(page);
    await dictateChunk(box, 'Weet-Bix, 3 servings,');
    await dictateChunk(box, ' Chicken breast, 100 grams,');
    await dictateReplace(box, 'Weet-Bix, 3 servings, Chicken breast, 100 grams.');
    await expectCorrect(page, 'replace');
  });

  test('closest to the owner screen: 3 servings shown as unrecognised, Weet-Bix 2', async ({ page }) => {
    const box = await start(page);
    await dictateChunk(box, 'Weet-Bix, 3 servings,');
    console.log('[chunk1 live]', JSON.stringify(await page.locator('.live-line, .problem-line').allInnerTexts()));
    await dictateChunk(box, ' Chicken breast, 100 grams,');
    console.log('[chunk2 live]', JSON.stringify(await page.locator('.live-line, .problem-line').allInnerTexts()));
    // Correct: no "not recognised" line at any point.
    await expect(page.locator('.problem-line')).toHaveCount(0);
    await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
    const rows = await rowsText(page);
    console.log('[owner screen] confirm rows:', JSON.stringify(rows));
    expect(rows.join('|')).not.toMatch(/Not recognised/);
    expect(rows.join('|')).not.toMatch(/Weet-Bix 2 items/);
  });

  test('This is... on "3 servings" then chicken breast: amounts still correct', async ({ page }) => {
    const box = await start(page);
    await dictateChunk(box, 'Weet-Bix, 3 servings,');
    await dictateChunk(box, ' Chicken breast, 100 grams,');
    await toConfirm(page);
    await page.locator('.row--problem').getByRole('button', { name: 'This is...' }).click();
    await page.locator('.row--problem select').selectOption({ label: 'Chicken breast (cooked)' });
    await page.locator('.row--problem').getByRole('button', { name: 'Learn' }).click();
    await page.waitForTimeout(300);
    // Back to Edit text and Save so the taught alias is re-parsed.
    await page.getByRole('button', { name: 'Edit text' }).click();
    await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
    const rows = await rowsText(page);
    console.log('[this-is] confirm rows after learn:', JSON.stringify(rows));
    const sheet = page.locator('.sheet');
    await expect(sheet.locator('.row')).toHaveCount(2);
    await expect(sheet.locator('.row').filter({ hasText: 'Weet-Bix' }).locator('.row__qty')).toHaveText('3 items');
    await expect(sheet.locator('.row').filter({ hasText: 'Chicken breast' }).locator('.row__qty')).toHaveText('100 g');
  });

  test('Add as food on "3 servings": no junk food, amounts correct', async ({ page }) => {
    const box = await start(page);
    await dictateChunk(box, 'Weet-Bix, 3 servings,');
    await dictateChunk(box, ' Chicken breast, 100 grams,');
    await toConfirm(page);
    await page.getByRole('button', { name: 'Add as food' }).click();
    await expect(page.locator('.sheet')).toContainText('New food');
    console.log('[add-as-food] prefilled name:', await page.locator('.sheet input').first().inputValue());
    await page.locator('.sheet select').first().selectOption('item');
    await page.getByLabel(/Calories/).fill('100');
    await page.getByLabel(/Protein/).fill('1');
    await page.getByLabel(/Carbs/).fill('1');
    await page.getByLabel(/Fat/).fill('1');
    await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.sheet')).toContainText('Confirm');
    const rows = await rowsText(page);
    console.log('[add-as-food] confirm rows:', JSON.stringify(rows));
    await expect(page.locator('.sheet .row')).toHaveCount(2); // a bogus "servings" food would make 3
    await expect(page.locator('.sheet .row').filter({ hasText: 'Weet-Bix' }).locator('.row__qty')).toHaveText('3 items');
  });
});
