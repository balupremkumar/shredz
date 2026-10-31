// Repro for the owner's dictation bug: "Weet-Bix, 3 servings," then "Chicken breast, 100 grams,"
// via iOS keyboard dictation into the Speak sheet's text box. Uses the owner's real food list,
// loaded with fs at run time (git-ignored file, never copied into this spec) and skipped when missing.
// Correct behaviour: Weet-Bix 3 items and Chicken breast 100 g in the "I heard" list, nothing unrecognised,
// and a unit word like "servings" is never offered as a food name. v2 has no Confirm step: Save N items
// (or saying "save") commits.
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
  await page.getByRole('button', { name: 'Speak' }).click();
  const box = page.getByLabel('What you ate');
  await expect(box).toBeFocused();
  return box;
}

const sheetOf = page => page.locator('.sheet');
const rowsText = page => sheetOf(page).locator('.row').allInnerTexts().then(r => r.map(t => t.replace(/\s+/g, ' ').trim()));
const qtyOf = (scope, name) => scope.locator('.row').filter({ hasText: name }).locator('.row__qty').first();

// Asserted live on the I heard list, then on the diary once saved.
async function expectCorrect(page, label, { auto = false } = {}) {
  const sheet = sheetOf(page);
  if (!auto) {
    await expect(sheet.locator('.row')).toHaveCount(2);
    console.log(`[${label}] I heard rows:`, JSON.stringify(await rowsText(page)));
    await expect(page.locator('.row--problem')).toHaveCount(0);
    await expect(qtyOf(sheet, 'Weet-Bix')).toHaveText(/^3 items/);
    await expect(qtyOf(sheet, 'Chicken breast')).toHaveText(/^100 g/);
    await sheet.getByRole('button', { name: 'Save 2 items' }).click();
  }
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('Added 2 items');
  const main = page.locator('main');
  await expect(main.locator('.row').filter({ hasText: 'Weet-Bix' }).locator('.row__qty').first()).toHaveText(/^3 items/);
  await expect(main.locator('.row').filter({ hasText: 'Chicken breast' }).locator('.row__qty').first()).toHaveText(/^100 g/);
  await expect(main.locator('.row--problem')).toHaveCount(0);
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
      await expectCorrect(page, name, { auto: /save$/.test(chunks.at(-1)) });
    });
  }

  test('whole utterance replaced at the end (set value then input)', async ({ page }) => {
    const box = await start(page);
    await dictateChunk(box, 'Weet-Bix, 3 servings,');
    await dictateChunk(box, ' Chicken breast, 100 grams,');
    await dictateReplace(box, 'Weet-Bix, 3 servings, Chicken breast, 100 grams.');
    await expectCorrect(page, 'replace');
  });

  const OWNER_PLUS_UNKNOWN = ['Weet-Bix, 3 servings,', ' Chicken breast, 100 grams,', ' 2 bananas,'];

  test('This is... on a genuinely unknown word: owner amounts stay correct', async ({ page }) => {
    const box = await start(page);
    for (const c of OWNER_PLUS_UNKNOWN) await dictateChunk(box, c);
    const problem = page.locator('.row--problem');
    await expect(problem).toHaveCount(1);
    await expect(problem).toContainText('bananas');
    await problem.getByRole('button', { name: 'This is...' }).click();
    await problem.locator('select').selectOption({ index: 1 });
    await problem.getByRole('button', { name: 'Learn' }).click();
    await expect(page.locator('.row--problem')).toHaveCount(0);
    const sheet = sheetOf(page);
    console.log('[this-is] I heard rows after learn:', JSON.stringify(await rowsText(page)));
    await expect(qtyOf(sheet, 'Weet-Bix')).toHaveText(/^3 items/);
    await expect(sheet.locator('.row__qty', { hasText: /^100 g/ })).toHaveCount(1);
  });

  test('Add on a genuinely unknown word: no junk "servings" food, owner amounts correct', async ({ page }) => {
    const box = await start(page);
    for (const c of OWNER_PLUS_UNKNOWN) await dictateChunk(box, c);
    await page.locator('.row--problem').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(sheetOf(page)).toContainText('New food');
    await expect(sheetOf(page).locator('input').first()).toHaveValue(/banana/i);
    await sheetOf(page).locator('select').first().selectOption('item');
    await page.getByLabel(/Calories/).fill('100');
    await page.getByLabel(/Protein/).fill('1');
    await page.getByLabel(/Carbs/).fill('1');
    await page.getByLabel(/Fat/).fill('1');
    await sheetOf(page).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.row--problem')).toHaveCount(0);
    const rows = await rowsText(page);
    console.log('[add] I heard rows:', JSON.stringify(rows));
    await expect(sheetOf(page).locator('.row')).toHaveCount(3); // a bogus "servings" food would make 4
    expect(rows.join('|')).not.toMatch(/serving/i);
    await expect(qtyOf(sheetOf(page), 'Weet-Bix')).toHaveText(/^3 items/);
    await expect(qtyOf(sheetOf(page), 'Chicken breast')).toHaveText(/^100 g/);
  });
});
