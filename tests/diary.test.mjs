import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nutritionFor, roundTotals, mealTotals, dayTotals, dayView, remaining,
  nextMealNumber, copyMeal, copyDay, lastLoggedDate, upsertWeight, weightChange,
} from '../src/core/diary.js';

const chicken = Object.freeze({ id: 'chicken', name: 'Chicken breast', aliases: [], unit: 'g',
  baseQty: 100, defaultQty: 125, kcal: 165, protein: 31, carbs: 0, fat: 3.6 });
const weetbix = Object.freeze({ ...chicken, id: 'weetbix', name: 'Weet-Bix', unit: 'item',
  baseQty: 1, defaultQty: 2, kcal: 54, protein: 1.8, carbs: 10, fat: 0.2 });
const foods = Object.freeze({ chicken, weetbix });
const date = '2026-10-31';
const before = '2026-10-29';
const entry = (id, meal, foodId = 'chicken', qty = 125, day = date) =>
  ({ id, date: day, meal, foodId, qty });
const zero = { kcal: 0, protein: 0, carbs: 0, fat: 0, missing: 0 };

function freezeRecords(records) {
  return Object.freeze(records.map(record => Object.freeze(record)));
}

test('nutrition scales g, ml, item and scoop foods without rounding', () => {
  assert.deepEqual(nutritionFor(chicken, 125), { kcal: 206.25, protein: 38.75, carbs: 0, fat: 4.5 });
  assert.deepEqual(nutritionFor({ ...chicken, unit: 'ml' }, 125), nutritionFor(chicken, 125));
  assert.deepEqual(nutritionFor(weetbix, 2), { kcal: 108, protein: 3.6, carbs: 20, fat: 0.4 });
  assert.deepEqual(nutritionFor({ ...weetbix, unit: 'scoop' }, 0.5),
    { kcal: 27, protein: 0.9, carbs: 5, fat: 0.1 });
});

test('roundTotals removes floating noise and negative zero', () => {
  assert.deepEqual(roundTotals({ kcal: 10.5, protein: 12.299999999, carbs: -0.01, fat: -0 }),
    { kcal: 11, protein: 12.3, carbs: 0, fat: 0 });
});

test('totals filter date and meal, sum before rounding, and count missing foods', () => {
  const tiny = Object.freeze({ ...chicken, baseQty: 1, kcal: 0.4, protein: 0.04, carbs: 0.04, fat: 0.04 });
  const entries = freezeRecords([
    entry('a', 1, 'tiny', 1), entry('b', 1, 'tiny', 1), entry('c', 2, 'tiny', 1),
    entry('d', 1, 'unknown'), entry('e', 2, 'unknown'), entry('f', 1, 'tiny', 100, before),
  ]);
  const lookup = Object.freeze({ tiny });
  assert.deepEqual(mealTotals(entries, lookup, date, 1), { kcal: 1, protein: 0.1, carbs: 0.1, fat: 0.1, missing: 1 });
  assert.deepEqual(dayTotals(entries, lookup, date), { kcal: 1, protein: 0.1, carbs: 0.1, fat: 0.1, missing: 2 });
  assert.deepEqual(dayTotals([], lookup, date), zero);
  assert.deepEqual(mealTotals(entries, lookup, date, 3), zero);
  assert.equal(dayTotals([entry('x', 1, 'toString')], {}, date).missing, 1);
});

test('dayView sorts meals, preserves entry order, and retains missing entries', () => {
  const entries = freezeRecords([entry('a', 3), entry('b', 1, 'weetbix', 2),
    entry('c', 3, 'unknown'), entry('d', 3), entry('e', 2, 'chicken', 125, before)]);
  const snapshot = structuredClone(entries);
  const view = dayView(entries, foods, date);
  assert.equal(view.date, date);
  assert.deepEqual(view.meals.map(meal => meal.meal), [1, 3]);
  assert.deepEqual(view.meals[1].entries.map(item => item.id), ['a', 'c', 'd']);
  assert.deepEqual(view.meals[1].entries[0], { ...entries[0], food: chicken,
    nutrition: { kcal: 206, protein: 38.8, carbs: 0, fat: 4.5 } });
  assert.deepEqual(view.meals[1].entries[1], { ...entries[2], food: null, nutrition: null });
  assert.deepEqual(view.meals[1].totals, { kcal: 413, protein: 77.5, carbs: 0, fat: 9, missing: 1 });
  assert.deepEqual(view.totals, { kcal: 521, protein: 81.1, carbs: 20, fat: 9.4, missing: 1 });
  assert.deepEqual(entries, snapshot);
  assert.deepEqual(dayView([], foods, date), { date, meals: [], totals: zero });
});

test('remaining permits negative values and rounds all nutrients', () => {
  assert.deepEqual(remaining({ kcal: 2000, protein: 100, carbs: 200, fat: 60 },
    { kcal: 2100.2, protein: 105.16, carbs: 120.23, fat: 60.01, missing: 1 }),
  { kcal: -100, protein: -5.2, carbs: 79.8, fat: 0 });
});

test('meal numbering and last logged date handle unsorted entries and gaps', () => {
  const entries = [entry('a', 3), entry('b', 8, 'chicken', 1, before),
    entry('c', 1), entry('d', 1, 'chicken', 1, '2026-11-01')];
  assert.equal(nextMealNumber(entries, date), 4);
  assert.equal(nextMealNumber(entries, '2026-10-30'), 1);
  assert.equal(lastLoggedDate(entries, date), before);
  assert.equal(lastLoggedDate(entries, '2026-11-02'), '2026-11-01');
  assert.equal(lastLoggedDate(entries, before), null);
  assert.equal(lastLoggedDate([], date), null);
});

test('copyMeal appends fresh retargeted entries and leaves frozen source unchanged', () => {
  const entries = freezeRecords([entry('a', 1), entry('b', 2), entry('c', 1, 'unknown'),
    entry('target', 4, 'weetbix', 2, before)]);
  const snapshot = structuredClone(entries);
  let id = 0;
  const copied = copyMeal(entries, { fromDate: date, fromMeal: 1, toDate: before, toMeal: 4 }, () => `new-${++id}`);
  assert.deepEqual(copied, [...snapshot, { ...snapshot[0], id: 'new-1', date: before, meal: 4 },
    { ...snapshot[2], id: 'new-2', date: before, meal: 4 }]);
  assert.notEqual(copied, entries);
  assert.notEqual(copied[4], entries[0]);
  assert.deepEqual(entries, snapshot);
  assert.deepEqual(copyMeal(entries, { fromDate: date, fromMeal: 9, toDate: before, toMeal: 4 },
    () => assert.fail('empty meal must not allocate ids')), entries);
});

test('copyDay keeps meal numbers and source order, including copying onto itself', () => {
  const entries = freezeRecords([entry('a', 3), entry('target', 1, 'chicken', 1, before), entry('b', 1)]);
  const snapshot = structuredClone(entries);
  let id = 0;
  const copied = copyDay(entries, { fromDate: date, toDate: before }, () => `new-${++id}`);
  assert.deepEqual(copied, [...snapshot, { ...snapshot[0], id: 'new-1', date: before },
    { ...snapshot[2], id: 'new-2', date: before }]);
  assert.notEqual(copied, entries);
  assert.notEqual(copied[3], entries[0]);
  assert.equal(copyDay(entries, { fromDate: date, toDate: date }, () => `same-${++id}`).length, 5);
  assert.deepEqual(copyDay(entries, { fromDate: '2026-01-01', toDate: date },
    () => assert.fail('empty day must not allocate ids')), entries);
  assert.deepEqual(entries, snapshot);
});

test('upsertWeight adds and replaces records, deduplicates dates, sorts without mutation', () => {
  const weights = freezeRecords([{ date, kg: 81 }, { date: before, kg: 82 }, { date, kg: 83 }]);
  const snapshot = structuredClone(weights);
  assert.deepEqual(upsertWeight(weights, date, 80.5), [{ date: before, kg: 82 }, { date, kg: 80.5 }]);
  assert.deepEqual(upsertWeight(weights, '2026-10-30', 81.5).map(weight => weight.date),
    [before, '2026-10-30', date, date]);
  assert.deepEqual(upsertWeight([], date, 0.1), [{ date, kg: 0.1 }]);
  assert.deepEqual(weights, snapshot);
  for (const kg of [0, -1, NaN, 500, Infinity, -Infinity, '80', null, undefined]) {
    assert.throws(() => upsertWeight(weights, date, kg), RangeError);
  }
});

test('weightChange uses latest record on or before UTC cutoff across month and DST boundaries', () => {
  const weights = freezeRecords([{ date: '2026-10-01', kg: 80.12 }, { date: '2026-09-25', kg: 82 },
    { date: '2026-09-30', kg: 81.23 }, { date: '2026-09-23', kg: 83.45 }]);
  assert.equal(weightChange(weights, '2026-10-01', 1), -1.1);
  assert.equal(weightChange(weights, '2026-10-01', 7), -3.3);
  assert.equal(weightChange(weights, '2026-09-30', 5), -0.8);
  assert.equal(weightChange(weights, '2026-10-02', 1), null);
  assert.equal(weightChange(weights, '2026-10-01', 30), null);
  assert.equal(weightChange([], date, 7), null);
  assert.equal(weightChange([{ date: '2024-03-01', kg: 81 }, { date: '2024-02-29', kg: 80 }],
    '2024-03-01', 1), 1);
});
