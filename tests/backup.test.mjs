import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BACKUP_SCHEMA, BackupError, backupFileName, exportBackup, parseBackup,
  mergeData, summarise } from '../src/backup.js';

const ts = '2026-10-31T08:00:00.000Z';
function fixture() {
  const foods = [
    ['chicken', 'Chicken breast', 'g', 100, 125, 165, 31, 0, 3.6],
    ['milk', 'Milk', 'ml', 100, 250, 64, 3.3, 4.8, 3.6],
    ['egg', 'Egg', 'item', 1, 2, 72, 6.3, 0.4, 4.8],
    ['whey', 'Whey', 'scoop', 1, 1, 120, 24, 3, 1.5],
    ['rice', 'Cooked rice', 'g', 100, 150, 130, 2.7, 28, 0.3],
    ['apple', 'Apple', 'item', 1, 1, 95, 0.5, 25, 0.3],
  ].map(([id, name, unit, baseQty, defaultQty, kcal, protein, carbs, fat]) =>
    ({ id, name, aliases: [name.toLowerCase()], unit, baseQty, defaultQty, kcal, protein, carbs, fat }));
  return { foods, entries: [
    { id: 'a', date: '2026-10-30', meal: 1, foodId: 'egg', qty: 2 },
    { id: 'b', date: '2026-10-30', meal: 2, foodId: 'chicken', qty: 125 },
    { id: 'c', date: '2026-10-31', meal: 1, foodId: 'milk', qty: 250 },
    { id: 'd', date: '2026-10-31', meal: 2, foodId: 'whey', qty: 1 },
  ], weights: [
    { date: '2026-10-29', kg: 82.5 }, { date: '2026-10-30', kg: 82.3 },
    { date: '2026-10-31', kg: 82.1 },
  ], settings: { goals: { kcal: 2200, protein: 150, carbs: 250, fat: 65 } } };
}
const encode = data => exportBackup(data, ts);
function rejects(text, line) {
  assert.throws(() => parseBackup(text), error => {
    assert.ok(error instanceof BackupError);
    assert.equal(error.name, 'BackupError');
    assert.ok(error.problems.includes(line), JSON.stringify(error.problems));
    assert.ok(error.message.includes(line));
    return true;
  });
}

test('realistic backup round trip, envelope, formatting and dated file name', () => {
  const data = fixture();
  const text = encode(data);
  assert.deepEqual(parseBackup(text), data);
  assert.equal(BACKUP_SCHEMA, 1);
  assert.deepEqual(JSON.parse(text), { app: 'macro-diary', schema: 1, exportedAt: ts, ...data });
  assert.equal(text, JSON.stringify(JSON.parse(text), null, 2));
  assert.equal(backupFileName('2026-10-31'), 'macro-diary-2026-10-31.json');
});

test('foods-only imports fill defaults, including missing aliases', () => {
  const food = fixture().foods[0];
  delete food.aliases;
  assert.deepEqual(parseBackup(JSON.stringify({ app: 'macro-diary', schema: 1, foods: [food] })),
    { foods: [{ ...food, aliases: [] }], entries: [], weights: [], settings: null });
  assert.deepEqual(parseBackup(encode({ foods: [], entries: [], weights: [], settings: null })),
    { foods: [], entries: [], weights: [], settings: null });
});

test('invalid JSON, app and future or non-numeric schema report specific problems', () => {
  rejects('{', 'backup: text is not valid JSON');
  rejects('null', 'backup: must be an object');
  rejects('[]', 'backup: must be an object');
  for (const [key, value, line] of [
    ['app', 'other', 'app: must be macro-diary'],
    ['schema', 2, 'schema: must be a number no greater than 1'],
    ['schema', '1', 'schema: must be a number no greater than 1'],
  ]) {
    rejects(JSON.stringify({ ...JSON.parse(encode(fixture())), [key]: value }), line);
  }
});

const invalidFields = [
  ['foods', 'id', 1, 'must be a string'],
  ['foods', 'name', '  ', 'must be a non-empty string'],
  ['foods', 'unit', 'cup', 'must be g, ml, item or scoop'],
  ['foods', 'baseQty', 0, 'must be a positive number'],
  ['foods', 'defaultQty', '2', 'must be a positive number'],
  ...['kcal', 'protein', 'carbs', 'fat'].map(key =>
    ['foods', key, -1, 'must be a finite non-negative number']),
  ['foods', 'aliases', [1], 'must be an array of strings'],
  ['foods', 'aliases', null, 'must be an array of strings'],
  ['entries', 'id', null, 'must be a string'],
  ['entries', 'date', '31-10-2026', 'must match YYYY-MM-DD'],
  ['entries', 'meal', 0, 'must be an integer at least 1'],
  ['entries', 'meal', 1.5, 'must be an integer at least 1'],
  ['entries', 'foodId', 1, 'must be a string'],
  ['entries', 'qty', '2', 'must be a positive number'],
  ['entries', 'qty', 0, 'must be a positive number'],
  ['weights', 'date', '2026-02-29', 'must be a valid YYYY-MM-DD date'],
  ['weights', 'date', '2026-13-01', 'must be a valid YYYY-MM-DD date'],
  ['weights', 'kg', 0, 'must be greater than 0 and under 500'],
  ['weights', 'kg', 500, 'must be greater than 0 and under 500'],
];
for (const [type, key, value, message] of invalidFields) {
  test(`rejects invalid ${type} ${key} ${JSON.stringify(value)}`, () => {
    const data = fixture();
    data[type][0][key] = value;
    rejects(encode(data), `${type}[0]: ${key} ${message}`);
  });
}

test('rejects malformed collections, records and settings without native errors', () => {
  for (const type of ['foods', 'entries', 'weights']) {
    rejects(encode({ ...fixture(), [type]: {} }), `${type}: must be an array`);
    for (const value of [null, [], 5]) {
      rejects(encode({ ...fixture(), [type]: [value] }), `${type}[0]: must be an object`);
    }
  }
  for (const settings of [[], 1, {}, { goals: null }, { goals: [] }]) {
    rejects(encode({ ...fixture(), settings }), 'settings: goals must be an object');
  }
  for (const key of ['kcal', 'protein', 'carbs', 'fat']) {
    const data = fixture();
    data.settings.goals[key] = '0';
    rejects(encode(data), `settings.goals: ${key} must be a finite non-negative number`);
  }
});

test('overflowing JSON numbers are not finite and leap-day weights are accepted', () => {
  rejects(encode(fixture()).replace('"baseQty": 100', '"baseQty": 1e400'),
    'foods[0]: baseQty must be a positive number');
  rejects(encode(fixture()).replace('"kcal": 165', '"kcal": 1e400'),
    'foods[0]: kcal must be a finite non-negative number');
  const data = fixture();
  data.weights[0].date = '2024-02-29';
  assert.deepEqual(parseBackup(encode(data)), data);
});

test('references must identify a file food or an explicitly known food', () => {
  const data = fixture();
  data.entries[0].foodId = 'external';
  rejects(encode(data), 'entries[0]: foodId external does not identify a known food');
  const known = new Set(['external']);
  assert.deepEqual(parseBackup(encode(data), known), data);
  assert.deepEqual([...known], ['external']);
  data.entries[0].foodId = 'toString';
  rejects(encode(data), 'entries[0]: foodId toString does not identify a known food');
});

test('collects multiple record types and caps the report at exactly 20 problems', () => {
  const data = fixture();
  data.foods[0].unit = 'cup';
  data.entries[0].qty = 0;
  data.weights[0].kg = 0;
  assert.throws(() => parseBackup(encode(data)), error => {
    assert.equal(error.problems.length, 3);
    return error instanceof BackupError;
  });
  data.foods = Array(25).fill(null);
  assert.throws(() => parseBackup(encode(data)), error => {
    assert.equal(error.problems.length, 20);
    assert.equal(error.problems[19], 'foods[19]: must be an object');
    return error instanceof BackupError;
  });
});

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test('merge resolves clashes in place, appends new ids, sorts weights and preserves inputs', () => {
  const current = fixture();
  current.weights.reverse();
  const incoming = { foods: [{ ...current.foods[1], name: 'Updated milk' },
    { ...current.foods[0], id: 'new' }],
  entries: [{ ...current.entries[1], qty: 200 }, { ...current.entries[0], id: 'new-entry' }],
  weights: [{ date: '2026-10-30', kg: 81.9 }, { date: '2026-10-28', kg: 83 }], settings: null };
  const beforeCurrent = structuredClone(current);
  const beforeIncoming = structuredClone(incoming);
  deepFreeze(current);
  deepFreeze(incoming);
  const merged = mergeData(current, incoming);
  assert.deepEqual(merged.foods, [current.foods[0], incoming.foods[0], ...current.foods.slice(2), incoming.foods[1]]);
  assert.deepEqual(merged.entries, [current.entries[0], incoming.entries[0], ...current.entries.slice(2), incoming.entries[1]]);
  assert.deepEqual(merged.weights, [incoming.weights[1], current.weights[2], incoming.weights[0], current.weights[0]]);
  assert.deepEqual(merged.settings, current.settings);
  const replacement = { goals: { kcal: 0, protein: 0, carbs: 0, fat: 0 } };
  assert.deepEqual(mergeData(current, { ...incoming, settings: replacement }).settings, replacement);
  for (const key of ['foods', 'entries', 'weights']) {
    assert.notEqual(merged[key], current[key]);
    assert.notEqual(merged[key], incoming[key]);
  }
  assert.deepEqual(current, beforeCurrent);
  assert.deepEqual(incoming, beforeIncoming);
});

test('summarise counts records and distinct entry dates', () => {
  assert.deepEqual(summarise(fixture()), { foods: 6, entries: 4, weights: 3, days: 2 });
  assert.deepEqual(summarise({ foods: [], entries: [], weights: [] }),
    { foods: 0, entries: 0, weights: 0, days: 0 });
});

test('backup module imports nothing', () => {
  const source = readFileSync(new URL('../src/backup.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bimport\s*(?:[({*'"\w])/);
});

for (const [collection, field, value, message] of [
  ['entries', 'date', '2026-99-99', 'must be a valid YYYY-MM-DD date'],
  ['entries', 'date', '2026-02-29', 'must be a valid YYYY-MM-DD date'],
  ['entries', 'meal', 0, 'must be an integer at least 1'],
  ['entries', 'meal', 100, 'must be at most 99'],
  ['foods', 'name', 'a'.repeat(201), 'must contain at most 200 characters after trimming'],
  ['foods', 'aliases', Array(51).fill('a'), 'must contain at most 50 aliases'],
  ['foods', 'aliases', ['a'.repeat(101)], 'must contain at most 100 characters each'],
  ...['kcal', 'protein', 'carbs', 'fat', 'baseQty', 'defaultQty'].map(field =>
    ['foods', field, 1e7, 'must be at most 1000000']),
  ['entries', 'qty', 1e7, 'must be at most 1000000'],
  ['foods', 'id', '  ', 'must not be blank'],
  ['entries', 'id', '', 'must not be blank'],
]) {
  test(`backup rejects ${collection}.${field} beyond its allowed limit (${JSON.stringify(value)})`, () => {
    const data = fixture();
    data[collection][0][field] = value;
    rejects(encode(data), `${collection}[0]: ${field} ${message}`);
  });
}

test('backup rejects duplicate food ids, entry ids and weight dates with record paths', () => {
  for (const [collection, field] of [['foods', 'id'], ['entries', 'id'], ['weights', 'date']]) {
    const data = fixture();
    data[collection][1][field] = data[collection][0][field];
    rejects(encode(data), `${collection}[1]: ${field} must be unique within the file`);
  }
});

test('backup caps every record array at 20000', () => {
  for (const collection of ['foods', 'entries', 'weights']) {
    const data = fixture();
    data[collection] = Array(20001).fill(data[collection][0]);
    rejects(encode(data), `${collection}: must contain at most 20000 records`);
  }
});

test('backup trims food names and drops extra fields from every record and goals', () => {
  const expected = fixture();
  const data = fixture();
  data.foods[0].name = '  Chicken breast  ';
  for (const collection of ['foods', 'entries', 'weights']) data[collection][0].extra = 'discard';
  data.settings.extra = 'discard';
  data.settings.goals.extra = 'discard';
  assert.deepEqual(parseBackup(encode(data)), expected);
});

test('backup accepts limits inclusively and valid leap days', () => {
  const data = fixture();
  Object.assign(data.foods[0], { name: 'a'.repeat(200), aliases: Array(50).fill('a'.repeat(100)),
    baseQty: 1e6, defaultQty: 1e6, kcal: 1e6, protein: 1e6, carbs: 1e6, fat: 1e6 });
  Object.assign(data.entries[0], { date: '2024-02-29', meal: 99, qty: 1e6 });
  assert.deepEqual(parseBackup(encode(data)), data);
  for (const field of ['kcal', 'protein', 'carbs', 'fat']) {
    const invalid = fixture();
    invalid.settings.goals[field] = 1e7;
    rejects(encode(invalid), `settings.goals: ${field} must be at most 1000000`);
  }
});
