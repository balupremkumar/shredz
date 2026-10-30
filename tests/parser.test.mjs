import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDictation } from '../src/parser.js';

const foods = [
  ['weetbix', 'Weet-Bix', 'item', 2, ['weetbix', 'wheat bix']],
  ['milk', 'Green milk', 'ml', 250, ['green top milk', 'milk']],
  ['whey', 'Whey protein', 'scoop', 1, ['whey', 'protein']],
  ['chicken', 'Chicken breast', 'g', 100, []],
  ['rice', 'Basmati rice', 'g', 100, ['rice']],
  ['cashews', 'Cashews', 'g', 30, ['cashew', 'cashew nuts']],
].map(([id, name, unit, defaultQty, aliases]) => Object.freeze({
  id, name, unit, defaultQty, aliases: Object.freeze(aliases),
  baseQty: 100, kcal: 1, protein: 1, carbs: 1, fat: 1,
}));
Object.freeze(foods);
const compact = result => result.meals.map(({ meal, items }) => [meal,
  items.map(({ foodId, qty, unit }) => [foodId, qty, unit])]);

test('real whole-day dictation', () => {
  const result = parseDictation("Meal number one, I had We et-Bix. 2 Weet-Bix. I had green milk, 200 mils and one scoop of whey protein. Meal number 2, I'll just say I had chicken breast, 125 grams. Basmati rice, 150 grams and 20 grams of cashews. Save.", foods);
  assert.deepEqual(compact(result), [
    [1, [['weetbix', 2, 'item'], ['milk', 200, 'ml'], ['whey', 1, 'scoop']]],
    [2, [['chicken', 125, 'g'], ['rice', 150, 'g'], ['cashews', 20, 'g']]],
  ]);
  assert.deepEqual(result.unmatched, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.save, true);
});

test('meal markers, default, merging, sorting and empty meals', () => {
  assert.deepEqual(compact(parseDictation('milk', foods, { defaultMeal: 3 })),
    [[3, [['milk', 250, 'ml']]]]);
  const result = parseDictation('milk meal ten meal no 2 rice meal one whey meal #2 cashews meal 1 chicken breast meal number three weetbix', foods, { defaultMeal: 4 });
  assert.deepEqual(result.meals.map(({ meal }) => meal), [1, 2, 3, 4]);
  assert.deepEqual(result.meals[0].items.map(({ foodId }) => foodId), ['whey', 'chicken']);
  assert.deepEqual(result.meals[1].items.map(({ foodId }) => foodId), ['rice', 'cashews']);
});

test('spoken quantities and unit conversions', () => {
  for (const [text, id, qty] of [
    ['two weetbix', 'weetbix', 2], ['a scoop of whey', 'whey', 1],
    ['half a scoop of whey', 'whey', 0.5], ['half whey', 'whey', 0.5],
    ['1.5 scoops whey', 'whey', 1.5], ['0.3 kg chicken breast', 'chicken', 300],
    ['1 litre green milk', 'milk', 1000], ['200 mL milk', 'milk', 200],
    ['milk 200 mils', 'milk', 200], ['an weetbix', 'weetbix', 1],
    ['twenty grams cashews', 'cashews', 20], ['rice', 'rice', 100],
  ]) {
    const result = parseDictation(text, foods);
    assert.deepEqual(compact(result), [[1, [[id, qty, foods.find(food => food.id === id).unit]]]], text);
    assert.deepEqual(result.unmatched, [], text);
    assert.deepEqual(result.warnings, [], text);
  }
});

test('all supported unit spellings', () => {
  for (const names of ['g gm gms gram grams', 'ml mls mil mils millilitre millilitres milliliter milliliters']) {
    for (const unit of names.split(' ')) {
      assert.equal(parseDictation(`200 ${unit} milk`, foods).meals[0].items[0].qty, 200);
    }
  }
  for (const unit of 'kg kilo kilos l litre litres liter liters'.split(' ')) {
    assert.equal(parseDictation(`0.5 ${unit} milk`, foods).meals[0].items[0].qty, 500);
  }
});

test('longest matches, split names and unknown food boundaries', () => {
  for (const text of ['whey protein', 'We et-Bix', 'weet bix', 'wheat bix', 'green top milk', 'cashew nuts']) {
    const result = parseDictation(text, foods);
    assert.equal(result.meals[0].items.length, 1, text);
    assert.deepEqual(result.unmatched, [], text);
  }
  const result = parseDictation('whey and 3 bananas and milk 200 mils', foods);
  assert.deepEqual(compact(result), [[1, [['whey', 1, 'scoop'], ['milk', 200, 'ml']]]]);
  assert.deepEqual(result.unmatched, [{ meal: 1, raw: '3 bananas' }]);
});

test('unit mismatches retain the spoken number and identify the food', () => {
  for (const [text, id, qty, unit] of [
    ['200 grams of whey', 'whey', 200, 'scoop'],
    ['0.2 kilos weetbix', 'weetbix', 0.2, 'item'],
    ['two scoops milk', 'milk', 2, 'ml'],
  ]) {
    const result = parseDictation(text, foods);
    assert.deepEqual(compact(result), [[1, [[id, qty, unit]]]]);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].meal, 1);
    assert.equal(result.warnings[0].foodId, id);
    assert.match(result.warnings[0].message, /unit .*did not match/);
  }
  assert.deepEqual(parseDictation('200 grams green milk', foods).warnings, []);
  assert.equal(parseDictation('200 grams green milk', foods).meals[0].items[0].qty, 200);
});

test('nearest preceding food gets quantity first, then the next food', () => {
  const result = parseDictation('milk 200 mils and 2 weetbix', foods);
  assert.deepEqual(compact(result), [[1, [['milk', 200, 'ml'], ['weetbix', 2, 'item']]]]);
  assert.equal(result.meals[0].items[0].raw, 'milk 200 mils');
  assert.equal(result.meals[0].items[1].raw, '2 weetbix');
  assert.equal(parseDictation('half a scoop of whey', foods).meals[0].items[0].raw, 'half a scoop of whey');
});

test('duplicate mentions retain explicit quantities and preserve two explicit portions', () => {
  for (const text of ['weetbix 3 weetbix', '2 weetbix and weetbix']) {
    assert.equal(parseDictation(text, foods).meals[0].items.length, 1);
  }
  assert.deepEqual(compact(parseDictation('2 weetbix 3 weetbix', foods)),
    [[1, [['weetbix', 2, 'item'], ['weetbix', 3, 'item']]]]);
  assert.equal(parseDictation('weetbix and weetbix', foods).meals[0].items.length, 2);
});

test('leftovers, filler and trailing save', () => {
  assert.deepEqual(parseDictation('42 grams', foods).unmatched, [{ meal: 1, raw: '42 grams' }]);
  assert.deepEqual(parseDictation('purple fruit and orange fruit', foods, { defaultMeal: 3 }).unmatched,
    [{ meal: 3, raw: 'purple fruit' }, { meal: 3, raw: 'orange fruit' }]);
  assert.deepEqual(parseDictation("I had have ate eaten just say I'll also then plus & with of some the for my number it was that is", foods).unmatched, []);
  assert.deepEqual(parseDictation('', foods), { meals: [], unmatched: [], warnings: [], save: false });
  assert.equal(parseDictation('SAVE!!!', foods).save, true);
  assert.equal(parseDictation('save milk', foods).save, false);
  assert.equal(parseDictation('milk saved', foods).save, false);
  assert.equal(parseDictation('milk, 200.5 mls. save.', foods).meals[0].items[0].qty, 200.5);
});
