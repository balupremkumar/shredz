import { test, expect } from '@playwright/test';
import { openApp, FOODS, expectFood } from './helpers.mjs';

// A fake SpeechRecognition: tests push results through window.__say(items, resultIndex).
// Each item is { text, final }. Results are array-likes with isFinal and [0].transcript.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__recs = [];
    class FakeRecognition {
      constructor() { this.started = 0; this.stopped = 0; window.__recs.push(this); }
      start() { this.started += 1; }
      stop() { this.stopped += 1; }
      abort() { this.stopped += 1; }
    }
    window.SpeechRecognition = FakeRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
    window.__say = (items, resultIndex = 0) => {
      const rec = window.__recs.at(-1);
      const results = items.map(i => Object.assign([{ transcript: i.text, confidence: 0.9 }], { isFinal: !!i.final }));
      rec.onresult({ resultIndex, results });
    };
  });
});

const sheet = page => page.locator('.sheet');
const say = (page, items, resultIndex) => page.evaluate(([i, r]) => window.__say(i, r), [items, resultIndex]);

test('Speak listens: listening UI, interim text shows live, I heard list, Save commits', async ({ page }) => {
  const errors = await openApp(page, { foods: FOODS });
  await page.getByRole('button', { name: 'Speak' }).click();
  await expect(sheet(page)).toContainText('Listening. Tap to stop.');
  await expect(sheet(page).getByRole('button', { name: 'Tap to stop' })).toBeVisible();
  await expect(page.getByLabel('What you ate')).toHaveCount(0);
  expect(await page.evaluate(() => window.__recs.at(-1).started)).toBeGreaterThan(0);
  await expect(sheet(page).getByRole('button', { name: 'Save 0 items' })).toBeDisabled();

  // Interim: shown as heard, not yet final.
  await say(page, [{ text: 'meal one 2 Weet-Bix', final: false }]);
  await expect(sheet(page)).toContainText('2 Weet-Bix');
  await expect(sheet(page).locator('.row')).toHaveCount(1);

  // Final, then a second phrase with an interim tail.
  await say(page, [{ text: 'meal one 2 Weet-Bix', final: true }, { text: 'and green milk 200 mils', final: false }]);
  await expect(sheet(page).locator('.row')).toHaveCount(2);
  await expect(sheet(page).locator('section', { hasText: 'I heard' })).toContainText('202 kcal');
  const save = sheet(page).getByRole('button', { name: 'Save 2 items' });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(sheet(page)).toHaveCount(0);
  await expectFood(page, '202');
  // Saving stops the recogniser.
  expect(await page.evaluate(() => window.__recs.at(-1).stopped)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('saying "save" commits immediately with no confirm step', async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await page.getByRole('button', { name: 'Speak' }).click();
  await expect(sheet(page)).toContainText('Listening');
  await say(page, [{ text: 'meal one 2 Weet-Bix', final: true }, { text: 'save', final: true }]);
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('Added 1 items');
  await expectFood(page, '110');
});

test('tapping the mic stops listening, tapping again resumes', async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await page.getByRole('button', { name: 'Speak' }).click();
  await sheet(page).getByRole('button', { name: 'Tap to stop' }).click();
  await expect(sheet(page).getByRole('button', { name: 'Tap to talk again' })).toBeVisible();
  await expect(sheet(page)).toContainText('Tap to talk again');
  const started = await page.evaluate(() => window.__recs.at(-1).started);
  await sheet(page).getByRole('button', { name: 'Tap to talk again' }).click();
  await expect(sheet(page)).toContainText('Listening. Tap to stop.');
  expect(await page.evaluate(() => window.__recs.at(-1).started)).toBeGreaterThan(started);
});

test('a denied microphone falls back to the text box with a plain reason', async ({ page }) => {
  await openApp(page, { foods: FOODS });
  await page.getByRole('button', { name: 'Speak' }).click();
  await expect(sheet(page)).toContainText('Listening');
  await page.evaluate(() => window.__recs.at(-1).onerror({ error: 'not-allowed' }));
  await expect(sheet(page)).toContainText('Microphone is off for Shredz');
  await expect(page.getByLabel('What you ate')).toBeVisible();
});
