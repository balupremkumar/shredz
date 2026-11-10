// Dictation corpus runner. Cases live in tests/fixtures/dictation-corpus.json.
//
// Case shape: { id, category, text | chunks[], expected, note?, status }
//   status "must" and "should" run as tests; "ambiguous" is skipped (owner decision pending).
//   Multi-chunk cases are joined with a single space, which is what the Dictate textarea
//   holds after two iOS dictation bursts (src/ui/dictate.js parses the whole textarea value).
//   expected = { meals: [{ meal, items: [{ foodId, qty, unit }] }], unmatched: [keyword], save }
//   This is the parser output minus raw/warnings. unmatched entries are keywords: the count must
//   match and each actual unmatched raw must contain the keyword at the same index.
// Set CORPUS_REPORT=<path> to also write a per-case pass/fail JSON report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDictation } from '../src/core/parser.js';

const corpus = JSON.parse(fs.readFileSync(new URL('./fixtures/dictation-corpus.json', import.meta.url), 'utf8'));

const spec = [
  ['chicken', 'Chicken breast (cooked)', 'g', 150, ['chicken', 'chicken breast']],
  ['rice', 'Basmati rice (cooked)', 'g', 150, ['rice', 'basmati', 'basmati rice']],
  ['weetbix', 'Weet-Bix', 'item', 2, ['weetbix', 'weet bix', 'wheat bix', 'wheetbix']],
  ['ricecake', 'SunRice thin rice cake', 'item', 2, ['rice cake', 'rice cakes', 'ricecake', 'ricecakes']],
  ['toast', 'Tip Top white toast slice', 'item', 2, ['bread', 'toast', 'white bread', 'slice of bread', 'slices of bread',
    'slice of toast', 'slices of toast', 'piece of toast', 'pieces of toast', 'tip top']],
  ['egg', 'Egg (size 7)', 'item', 2, ['egg', 'eggs']],
  ['cheese', 'Pams cheese wedge', 'item', 1, ['cheese', 'cheese triangle', 'cheese triangles', 'cheese wedge', 'cheese wedges']],
  ['potato', 'Potato (boiled)', 'g', 200, ['potato', 'potatoes', 'white potato', 'white potatoes']],
  ['kumara', 'Sweet potato / kumara (boiled)', 'g', 200, ['sweet potato', 'sweet potatoes', 'kumara']],
  ['bar', 'Tasti protein bar', 'item', 1, ['protein bar', 'tasti bar', 'tasti protein bar']],
  ['milk', 'Green top milk (Anchor Trim)', 'ml', 200, ['milk', 'green milk', 'green top', 'green top milk', 'trim milk']],
  ['whey', 'Scorpion whey', 'scoop', 1, ['whey', 'protein', 'protein shake', 'scorpion', 'scorpion whey']],
  ['cashews', 'Cashews (roasted)', 'g', 20, ['cashew', 'cashews', 'cashew nuts']],
];
const foods = Object.freeze(spec.map(([id, name, unit, defaultQty, aliases]) => Object.freeze({
  id, name, unit, defaultQty, aliases: Object.freeze(aliases),
  baseQty: 100, kcal: 1, protein: 1, carbs: 1, fat: 1,
})));

function run(testCase) {
  const text = testCase.chunks ? testCase.chunks.join(' ') : testCase.text;
  const result = parseDictation(text, foods);
  const actual = {
    meals: result.meals.map(({ meal, items }) => ({ meal, items: items.map(({ foodId, qty, unit }) => ({ foodId, qty, unit })) })),
    unmatched: result.unmatched.map(({ raw }) => raw),
    save: result.save,
  };
  return { text, actual };
}

function check(testCase) {
  const { text, actual } = run(testCase);
  const message = `${testCase.id} [${testCase.category}] ${JSON.stringify(text)}`;
  assert.deepEqual(actual.meals, testCase.expected.meals, message);
  assert.equal(actual.save, testCase.expected.save, `${message} save flag`);
  assert.equal(actual.unmatched.length, testCase.expected.unmatched.length,
    `${message} unmatched ${JSON.stringify(actual.unmatched)} vs ${JSON.stringify(testCase.expected.unmatched)}`);
  testCase.expected.unmatched.forEach((keyword, index) => {
    assert.ok(actual.unmatched[index].includes(keyword), `${message} unmatched[${index}] ${JSON.stringify(actual.unmatched[index])} lacks ${keyword}`);
  });
}

const report = [];
for (const testCase of corpus) {
  const title = `${testCase.id} ${testCase.status} ${JSON.stringify(testCase.chunks ?? testCase.text)}`;
  if (testCase.status === 'ambiguous') {
    test(title, { skip: 'ambiguous: owner decision pending' }, () => {});
    continue;
  }
  test(title, () => {
    let ok = true;
    let actual;
    try { actual = run(testCase).actual; check(testCase); } catch (error) { ok = false; throw error; } finally {
      report.push({ id: testCase.id, category: testCase.category, status: testCase.status, ok, actual });
    }
  });
}

if (process.env.CORPUS_REPORT) {
  process.on('exit', () => fs.writeFileSync(process.env.CORPUS_REPORT, JSON.stringify(report, null, 2)));
}
