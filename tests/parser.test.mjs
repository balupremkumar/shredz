import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDictation } from '../src/core/parser.js';

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
test('quantities outside the cap are warned and dropped after conversion and expansion', () => {
  for (const text of ['0 milk', 'zero milk', '-1 milk', '-1ml milk', '1000001 milk', '1000.001 l milk', '4001 servings milk', `${'9'.repeat(310)} milk`]) {
    const result = parseDictation(text, foods);
    assert.deepEqual(result.meals, [], text);
    assert.ok(result.warnings.some(warning => /Quantity/.test(warning.message)), text);
  }
  assert.equal(parseDictation('1000000 milk', foods).meals[0].items[0].qty, 1e6);
  assert.equal(parseDictation('4000 servings milk', foods).meals[0].items[0].qty, 1e6);
  const savedMeals = [{ id: 'shake', name: 'Shake', items: [{ foodId: 'milk', qty: 250 }] }];
  for (const text of ['0 shake', '-1 shake', '4001 shake', '1000001 shake', '0 servings shake', '1000001 grams shake']) {
    const result = parseDictation(text, foods, { savedMeals });
    assert.deepEqual(result.meals, [], text); assert.ok(result.warnings.length, text);
  }
  assert.equal(parseDictation('4000 shake', foods, { savedMeals }).meals[0].items[0].qty, 1e6);
});

test('meal numbers stay in 1 to 20 and invalid markers use the default with a warning', () => {
  for (const marker of ['0', '-1', '21', '999999999999999999999', 'thirty']) {
    const result = parseDictation(`meal ${marker} milk`, foods, { defaultMeal: 3 });
    assert.equal(result.meals[0].meal, 3, marker); assert.ok(result.warnings.length, marker);
  }
  for (const marker of ['1', '20', 'twenty']) {
    const result = parseDictation(`meal ${marker} milk`, foods);
    assert.equal(result.meals[0].meal, marker === '1' ? 1 : 20); assert.deepEqual(result.warnings, []);
  }
  for (const defaultMeal of [0, 21, Infinity, NaN, 1.5]) {
    const result = parseDictation('milk', foods, { defaultMeal });
    assert.equal(result.meals[0].meal, 1); assert.ok(result.warnings.length);
  }
});
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
  assert.equal(parseDictation('milk saved', foods).save, true);
  assert.equal(parseDictation('milk, 200.5 mls. save.', foods).meals[0].items[0].qty, 200.5);
});

test('joined quantities in the reviewed whole-day dictation', () => {
  const result = parseDictation('Meal 1 2 Weetbix 200ml green milk 1 scoop whey. Meal 2 chicken breast 125g basmati rice 150g cashews 20g. Save', foods);
  assert.deepEqual(compact(result), [
    [1, [['weetbix', 2, 'item'], ['milk', 200, 'ml'], ['whey', 1, 'scoop']]],
    [2, [['chicken', 125, 'g'], ['rice', 150, 'g'], ['cashews', 20, 'g']]],
  ]);
  assert.deepEqual(result.unmatched, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.save, true);
});

test('joined quantities match spaced quantities and preserve raw spans', () => {
  for (const [joined, spaced, food, qty] of [
    ['125g', '125 g', 'chicken breast', 125],
    ['125gm', '125 gm', 'chicken breast', 125],
    ['125gms', '125 gms', 'chicken breast', 125],
    ['200ml', '200 ml', 'green milk', 200],
    ['200mls', '200 mls', 'green milk', 200],
    ['0.3kg', '0.3 kg', 'chicken breast', 300],
    ['1.5l', '1.5 l', 'green milk', 1500],
    ['1L', '1 L', 'green milk', 1000],
    ['200mL', '200 mL', 'green milk', 200],
  ]) {
    for (const suffix of [false, true]) {
      const text = suffix ? `${food} ${joined}` : `${joined} ${food}`;
      const spacedText = suffix ? `${food} ${spaced}` : `${spaced} ${food}`;
      const result = parseDictation(text, foods);
      assert.deepEqual(compact(result), compact(parseDictation(spacedText, foods)), text);
      assert.equal(result.meals[0].items[0].qty, qty, text);
      assert.equal(result.meals[0].items[0].raw, text.toLowerCase(), text);
      assert.deepEqual(result.unmatched, [], text);
      assert.deepEqual(result.warnings, [], text);
    }
  }
  const mismatch = parseDictation('200g whey', foods);
  assert.equal(mismatch.meals[0].items[0].qty, 200);
  assert.equal(mismatch.warnings.length, 1);
  assert.deepEqual(parseDictation('125xyz', foods).unmatched, [{ meal: 1, raw: '125xyz' }]);
});

test('trailing saved and save it commands accept punctuation and case', () => {
  const expected = { meals: [{ meal: 1, items: [
    { foodId: 'weetbix', qty: 2, unit: 'item', raw: '2 weetbix' },
  ] }], unmatched: [], warnings: [], save: true };
  assert.deepEqual(parseDictation('Meal number one, 2 Weet-Bix. Saved.', foods), expected);
  for (const suffix of ['save', 'saved', 'save it', 'SAVED', 'SAVE IT']) {
    for (const punctuation of ['', '.', '?!', ',;:()[]{}']) {
      assert.deepEqual(parseDictation(`Meal number one, 2 Weet-Bix. ${suffix}${punctuation}`, foods), expected);
      assert.deepEqual(parseDictation(`${suffix}${punctuation}`, foods),
        { meals: [], unmatched: [], warnings: [], save: true });
    }
  }
  for (const text of ['saved milk', 'save it milk', 'unsaved', 'save items', 'saved it']) {
    assert.equal(parseDictation(text, foods).save, false, text);
  }
});

const savedMeals = [{ id: 'usual', name: 'Usual breakfast', aliases: ['usual brekkie'], items: [
  { foodId: 'weetbix', qty: 2 }, { foodId: 'milk', qty: 200 }, { foodId: 'whey', qty: 1 },
] }];
const usual = [['weetbix', 2, 'item'], ['milk', 200, 'ml'], ['whey', 1, 'scoop']];

test('saved meals expand in place', () => {
  const result = parseDictation('Meal one, usual breakfast. Save.', foods, { savedMeals });
  assert.deepEqual(compact(result), [[1, usual]]);
  assert.ok(result.meals[0].items.every(item => item.savedMealId === 'usual'));
  assert.equal(result.save, true);
  assert.deepEqual(result.unmatched, []);
  assert.deepEqual(result.warnings, []);
  const mixed = parseDictation('Meal 2, usual brekkie and 20 grams of cashews', foods, { savedMeals });
  assert.deepEqual(compact(mixed), [[2, [...usual, ['cashews', 20, 'g']]]]);
  assert.equal('savedMealId' in mixed.meals[0].items[3], false);
});

test('saved meal multipliers and unit warning', () => {
  const doubled = parseDictation('2 usual breakfast', foods, { savedMeals });
  assert.deepEqual(compact(doubled), [[1, [['weetbix', 4, 'item'], ['milk', 400, 'ml'], ['whey', 2, 'scoop']]]]);
  const grams = parseDictation('200 grams of usual breakfast', foods, { savedMeals });
  assert.deepEqual(compact(grams), [[1, usual]]);
  assert.equal(grams.warnings.length, 1);
  assert.equal(grams.warnings[0].foodId, null);
  assert.equal(grams.warnings[0].meal, 1);
});

test('longest match across foods and saved meals; duplicates never merge saved items', () => {
  const pool = [...foods, Object.freeze({ ...foods[0], id: 'oats', name: 'Breakfast oats', aliases: [] })];
  const both = parseDictation('breakfast oats and usual breakfast', pool, { savedMeals });
  assert.deepEqual(compact(both), [[1, [['oats', 2, 'item'], ...usual]]]);
  const twice = parseDictation('usual breakfast and usual breakfast', foods, { savedMeals });
  assert.equal(twice.meals[0].items.length, 6);
});

test('saved meal item with a missing food is skipped with a warning', () => {
  const broken = [{ id: 'b', name: 'Broken', aliases: [], items: [{ foodId: 'gone', qty: 1 }, { foodId: 'milk', qty: 100 }] }];
  const result = parseDictation('broken', foods, { savedMeals: broken });
  assert.deepEqual(compact(result), [[1, [['milk', 100, 'ml']]]]);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0].message, /Broken/);
});


test('servings use one item or scoop and the mass or volume default', () => {
  for (const [text, id, qty] of [['3 servings weetbix', 'weetbix', 3], ['a serve whey', 'whey', 1], ['chicken breast two servings', 'chicken', 200], ['milk 2 serves', 'milk', 500]]) {
    const result = parseDictation(text, foods);
    assert.equal(result.meals[0].items[0].foodId, id);
    assert.equal(result.meals[0].items[0].qty, qty);
    assert.deepEqual(result.unmatched, []);
  }
});

test('unit quantities reserve compatible neighbours before bare numbers', () => {
  assert.deepEqual(compact(parseDictation('milk 2 scoops whey', foods)), [[1, [['milk', 250, 'ml'], ['whey', 2, 'scoop']]]]);
  assert.deepEqual(compact(parseDictation('weetbix 3 chicken breast 120 grams', foods)), [[1, [['weetbix', 3, 'item'], ['chicken', 120, 'g']]]]);
});

test('comma full stop and and close items while allowing orphan amounts', () => {
  for (const separator of [',', '.', 'and']) {
    const result = parseDictation('chicken breast 120 grams ' + separator + ' rice 160 grams', foods);
    assert.deepEqual(compact(result), [[1, [['chicken', 120, 'g'], ['rice', 160, 'g']]]]);
  }
  assert.equal(parseDictation('chicken breast. 120 grams.', foods).meals[0].items[0].qty, 120);
});

test('grams of a food binds forward across a preceding food', () => {
  assert.deepEqual(compact(parseDictation('rice, 120 grams of chicken breast', foods)), [[1, [['rice', 100, 'g'], ['chicken', 120, 'g']]]]);
});

test('corrections replace an amount and repeated food', () => {
  for (const correction of ['actually', 'no wait', 'sorry', 'scratch that']) {
    assert.deepEqual(compact(parseDictation('rice 100 grams ' + correction + ' 150 grams', foods)), [[1, [['rice', 150, 'g']]]]);
    assert.deepEqual(compact(parseDictation('3 weetbix ' + correction + ' 2 weetbix', foods)), [[1, [['weetbix', 2, 'item']]]]);
  }
});

test('couple dozen and fractional number phrases', () => {
  for (const [text, qty] of [['a couple of weetbix', 2], ['half a dozen weetbix', 6], ['a dozen weetbix', 12], ['half an weetbix', 0.5], ['one and a half weetbix', 1.5], ['one point five weetbix', 1.5]]) {
    assert.equal(parseDictation(text, foods).meals[0].items[0].qty, qty, text);
  }
});

test('adjacent aliases collapse to one mention', () => {
  const result = parseDictation('whey protein 2 scoops', foods);
  assert.deepEqual(compact(result), [[1, [['whey', 2, 'scoop']]]]);
  assert.deepEqual(result.unmatched, []);
});

test('thousands commas and compound number words stay in one quantity', () => {
  for (const text of ['1,000 ml milk', 'one thousand ml milk', 'a thousand ml milk']) {
    assert.equal(parseDictation(text, foods).meals[0].items[0].qty, 1000);
  }
  assert.equal(parseDictation('one hundred and twenty five grams chicken breast', foods).meals[0].items[0].qty, 125);
});

test('close mis-hears and plurals preserve exact collision pairs', () => {
  const catalogue = [...foods,
    { id: 'cake', name: 'Rice cake', aliases: ['rice cake'], unit: 'item', defaultQty: 2 },
    { id: 'bar', name: 'Tasti protein bar', aliases: ['protein bar', 'tasti bar'], unit: 'item', defaultQty: 1 },
    { id: 'potato', name: 'Potato', aliases: ['potato'], unit: 'g', defaultQty: 200 },
    { id: 'kumara', name: 'Sweet potato', aliases: ['sweet potato', 'kumara'], unit: 'g', defaultQty: 200 },
  ];
  for (const [text, ids] of [['rice and rice cakes', ['rice', 'cake']], ['protein and protein bars', ['whey', 'bar']], ['potato and sweet potato', ['potato', 'kumara']], ['weet bicks', ['weetbix']], ['kumera', ['kumara']], ['chicken breasts', ['chicken']], ['chicken breath', ['chicken']], ['tasty bar', ['bar']]]) {
    const result = parseDictation(text, catalogue);
    assert.deepEqual(result.meals[0].items.map(item => item.foodId), ids, text);
    assert.deepEqual(result.unmatched, [], text);
  }
});
