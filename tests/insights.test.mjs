import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  movingAverage, report, goalsFromPercent, kcalFromGrams, splitFromGrams, toCsv, diaryCsv, weightsCsv,
  recentFoods, qtyStep, stepQty, needsWeighIn,
} from '../src/insights.js';

const oats = { id: 'o', name: 'Oats', unit: 'g', baseQty: 100, kcal: 380, protein: 13, carbs: 60, fat: 7 };
const egg = { id: 'e', name: 'Egg, "large"', unit: 'item', baseQty: 1, kcal: 70, protein: 6, carbs: 0.5, fat: 5 };
const apple = { id: 'a', name: 'apple', unit: 'item', baseQty: 1, kcal: 80, protein: 0, carbs: 20, fat: 0 };
const foodsById = { o: oats, e: egg, a: apple };
const entry = (date, meal, foodId, qty) => ({ id: `${date}${meal}${foodId}`, date, meal, foodId, qty });

test('movingAverage uses calendar days and handles one record', () => {
  assert.deepEqual(movingAverage([{ date: '2026-10-01', kg: 80 }]), [{ date: '2026-10-01', kg: 80 }]);
  const result = movingAverage([
    { date: '2026-10-01', kg: 80 }, { date: '2026-10-02', kg: 81 }, { date: '2026-10-10', kg: 79 },
  ]);
  assert.deepEqual(result.map(r => r.kg), [80, 80.5, 79]);
  const edge = movingAverage([
    { date: '2026-10-01', kg: 80 }, { date: '2026-10-07', kg: 82 }, { date: '2026-10-08', kg: 84 },
  ]);
  assert.equal(edge[1].kg, 81);
  assert.equal(edge[2].kg, 83);
});

test('report counts only logged days and zeroes an empty window', () => {
  const entries = [entry('2026-10-30', 1, 'o', 100), entry('2026-10-28', 1, 'a', 1), entry('2026-09-01', 1, 'a', 1)];
  const r = report(entries, [], foodsById, '2026-10-31', 7);
  assert.deepEqual(r, { days: 7, loggedDays: 2, kcal: 230, protein: 6.5, carbs: 40, fat: 3.5, weightChange: null });
  const empty = report([], [], foodsById, '2026-10-31', 30);
  assert.deepEqual(empty, { days: 30, loggedDays: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, weightChange: null });
});

test('report weightChange needs data on both sides', () => {
  const weights = [{ date: '2026-10-20', kg: 82 }, { date: '2026-10-31', kg: 81 }];
  assert.equal(report([], weights, foodsById, '2026-10-31', 7).weightChange, -1);
  assert.equal(report([], [{ date: '2026-10-31', kg: 81 }], foodsById, '2026-10-31', 7).weightChange, null);
  assert.equal(report([], [{ date: '2026-10-20', kg: 81 }], foodsById, '2026-10-10', 7).weightChange, null);
});

test('goal maths', () => {
  assert.deepEqual(goalsFromPercent(2400, { protein: 30, carbs: 40, fat: 30 }), { kcal: 2400, protein: 180, carbs: 240, fat: 80 });
  assert.throws(() => goalsFromPercent(2400, { protein: 30, carbs: 40, fat: 31 }), RangeError);
  assert.throws(() => goalsFromPercent(2400, { protein: 30.5, carbs: 39.5, fat: 30 }), RangeError);
  assert.throws(() => goalsFromPercent(0, { protein: 30, carbs: 40, fat: 30 }), RangeError);
  assert.throws(() => goalsFromPercent(NaN, { protein: 30, carbs: 40, fat: 30 }), RangeError);
  assert.equal(kcalFromGrams({ protein: 180, carbs: 240, fat: 80 }), 2400);
  const cases = [{ protein: 1, carbs: 1, fat: 1 }, { protein: 100, carbs: 33, fat: 71 }, { protein: 7, carbs: 90, fat: 13 }, { protein: 0, carbs: 0, fat: 5 }];
  for (const g of cases) {
    const s = splitFromGrams(g);
    assert.equal(s.protein + s.carbs + s.fat, 100);
  }
  assert.deepEqual(splitFromGrams({ protein: 180, carbs: 240, fat: 80 }), { protein: 30, carbs: 40, fat: 30 });
});

test('csv output', () => {
  assert.equal(toCsv([['a', 'b,c', 'd"e', 'f\ng', 1.5]]), 'a,"b,c","d""e","f\ng",1.5\r\n');
  const csv = diaryCsv([
    entry('2026-10-31', 2, 'e', 2), entry('2026-10-30', 3, 'o', 50),
    entry('2026-10-31', 1, 'a', 1), entry('2026-10-31', 1, 'zz', 1),
  ], foodsById);
  assert.equal(csv, [
    'date,meal,food,qty,unit,kcal,protein,carbs,fat',
    '2026-10-30,3,Oats,50,g,190,6.5,30,3.5',
    '2026-10-31,1,apple,1,item,80,0,20,0',
    '2026-10-31,2,"Egg, ""large""",2,item,140,12,1,10',
    '',
  ].join('\r\n'));
  assert.equal(weightsCsv([{ date: '2026-10-02', kg: 80.5 }, { date: '2026-10-01', kg: 81 }]), 'date,kg\r\n2026-10-01,81\r\n2026-10-02,80.5\r\n');
});

test('recentFoods orders by count, recency, name, then unused A to Z', () => {
  const zed = { ...apple, id: 'z', name: 'Zed' };
  const bee = { ...apple, id: 'b', name: 'bee' };
  const foods = [zed, oats, bee, egg, apple];
  const entries = [
    entry('2026-10-30', 1, 'o', 1), entry('2026-10-29', 1, 'o', 1),
    entry('2026-10-31', 1, 'e', 1), entry('2026-10-25', 1, 'a', 1),
    entry('2026-10-25', 1, 'b', 1), entry('2026-08-01', 1, 'z', 1),
  ];
  const result = recentFoods(entries, foods, '2026-10-31');
  assert.deepEqual(result.map(f => f.id), ['o', 'e', 'a', 'b', 'z']);
  assert.equal(result.length, 5);
});

test('quantity steps and weigh-in', () => {
  assert.deepEqual(['item', 'scoop', 'g', 'ml'].map(qtyStep), [1, 1, 25, 50]);
  assert.equal(stepQty(100, 'g', 1), 125);
  assert.equal(stepQty(30, 'g', -1), 25);
  assert.equal(stepQty(25, 'g', -1), 25);
  assert.equal(stepQty(1, 'item', -1), 1);
  assert.equal(stepQty(1.5, 'scoop', 1), 2.5);
  assert.equal(needsWeighIn([{ date: '2026-10-30', kg: 80 }], '2026-10-31'), true);
  assert.equal(needsWeighIn([{ date: '2026-10-31', kg: 80 }], '2026-10-31'), false);
});
