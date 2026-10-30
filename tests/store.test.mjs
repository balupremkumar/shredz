import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DB_NAME, DB_VERSION, DEFAULT_SETTINGS,
  createMemoryBackend, createIdbBackend, createStore,
} from '../src/store.js';

const makeFood = (overrides = {}) => ({
  id: 'oats', name: 'Oats', aliases: ['porridge'], unit: 'g',
  baseQty: 100, defaultQty: 60, kcal: 380, protein: 13, carbs: 68, fat: 7,
  ...overrides,
});
const makeEntry = (overrides = {}) => ({
  id: 'breakfast', date: '2026-10-31', meal: 1, foodId: 'oats', qty: 60,
  ...overrides,
});
const makeWeight = (overrides = {}) => ({ date: '2026-10-31', kg: 80, ...overrides });
const makeSettings = () => ({ goals: { kcal: 2200, protein: 160, carbs: 240, fat: 60 } });
const makeData = () => ({
  foods: [makeFood()], entries: [makeEntry()], weights: [makeWeight()], settings: makeSettings(),
});
const setup = () => createStore(createMemoryBackend());

test('constants, lazy IndexedDB creation and import without IndexedDB', async () => {
  assert.equal(DB_NAME, 'macro-diary');
  assert.equal(DB_VERSION, 1);
  assert.deepEqual(DEFAULT_SETTINGS, { goals: { kcal: 2400, protein: 180, carbs: 250, fat: 70 } });
  assert.equal(globalThis.indexedDB, undefined);
  const backend = createIdbBackend();
  await assert.rejects(backend.getAll('foods'), /IndexedDB is unavailable/);
  const source = await readFile(new URL('../src/store.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bimport\s*(?:[('"{*]|[\w$]+\s+from\b)/);
});

test('empty store supplies independent default settings', async () => {
  const store = setup();
  const empty = await store.loadAll();
  assert.deepEqual(empty, { foods: [], entries: [], weights: [], settings: DEFAULT_SETTINGS });
  empty.settings.goals.kcal = 1;
  assert.equal((await store.loadAll()).settings.goals.kcal, 2400);
  assert.equal(DEFAULT_SETTINGS.goals.kcal, 2400);
});

test('all record types round-trip and saved and loaded objects are isolated', async () => {
  const store = setup();
  const data = makeData();
  const expected = structuredClone(data);
  await store.saveFood(data.foods[0]);
  await store.saveEntry(data.entries[0]);
  await store.saveWeight(data.weights[0]);
  await store.saveSettings(data.settings);
  data.foods[0].aliases.push('changed');
  data.entries[0].qty = 1;
  data.weights[0].kg = 1;
  data.settings.goals.kcal = 1;
  const loaded = await store.loadAll();
  assert.deepEqual(loaded, expected);
  loaded.foods[0].aliases.push('changed again');
  loaded.entries[0].qty = 2;
  loaded.weights[0].kg = 2;
  loaded.settings.goals.kcal = 2;
  assert.deepEqual(await store.loadAll(), expected);
});

test('memory backend clones both put methods and getAll, and supports clear and remove', async () => {
  const backend = createMemoryBackend();
  const first = makeFood();
  const second = makeFood({ id: 'rice' });
  await backend.put('foods', first);
  await backend.putMany('foods', [second]);
  first.aliases.push('changed');
  second.aliases.push('changed');
  const loaded = await backend.getAll('foods');
  assert.deepEqual(loaded.map(record => record.aliases), [['porridge'], ['porridge']]);
  loaded[0].aliases.length = 0;
  assert.deepEqual((await backend.getAll('foods'))[0].aliases, ['porridge']);
  await backend.remove('foods', 'oats');
  assert.deepEqual((await backend.getAll('foods')).map(record => record.id), ['rice']);
  await backend.clear('foods');
  assert.deepEqual(await backend.getAll('foods'), []);
  await assert.rejects(backend.getAll('unknown'), TypeError);
});

const foodBadCases = [
  null, { id: '' }, { name: '' }, { name: '   ' }, { name: ' Oats' }, { name: 'Oats ' },
  { unit: 'cup' }, { baseQty: 0 }, { baseQty: Infinity }, { baseQty: '100' },
  { defaultQty: -1 }, { defaultQty: NaN }, { aliases: null }, { aliases: 'oats' }, { aliases: [1] },
  ...['kcal', 'protein', 'carbs', 'fat'].flatMap(name => [
    { [name]: -1 }, { [name]: Infinity }, { [name]: NaN }, { [name]: '1' },
  ]),
];
const entryBadCases = [
  null, { id: '' }, { id: undefined }, { date: '31-10-2026' }, { date: '2026-1-01' }, { date: undefined },
  { meal: 0 }, { meal: 1.5 }, { meal: '1' }, { foodId: '' }, { foodId: undefined },
  { qty: 0 }, { qty: -1 }, { qty: Infinity }, { qty: NaN }, { qty: '60' },
];
const weightBadCases = [
  null, { date: '' }, { date: '2026-1-01' }, { date: 20261031 },
  { kg: 0 }, { kg: -1 }, { kg: 500 }, { kg: 501 }, { kg: Infinity }, { kg: NaN }, { kg: '80' },
];
const settingsBadCases = [
  null, {}, { goals: null }, { goals: [] },
  ...['kcal', 'protein', 'carbs', 'fat'].flatMap(name =>
    [-1, Infinity, NaN, '1', undefined].map(value => ({ goals: { ...makeSettings().goals, [name]: value } }))),
];

for (const [label, method, make, cases] of [
  ['food', 'saveFood', makeFood, foodBadCases],
  ['entry', 'saveEntry', makeEntry, entryBadCases],
  ['weight', 'saveWeight', makeWeight, weightBadCases],
  ['settings', 'saveSettings', value => value, settingsBadCases],
]) {
  test(`${label} rejects every invalid field before any backend write`, async () => {
    let writes = 0;
    const backend = {
      put: async () => { writes++; },
      putMany: async () => { writes++; },
      clear: async () => { writes++; },
    };
    const store = createStore(backend);
    for (const bad of cases) {
      const value = bad === null ? null : make(bad);
      await assert.rejects(store[method](value), error => {
        assert.ok(error instanceof TypeError);
        assert.ok(error.message.length > 0);
        return true;
      });
    }
    assert.equal(writes, 0);
  });
}

test('missing aliases become an empty array; allowed units and zero nutrition work', async () => {
  const store = setup();
  for (const unit of ['g', 'ml', 'item', 'scoop']) {
    const food = makeFood({ id: unit, unit, kcal: 0, protein: 0, carbs: 0, fat: 0 });
    delete food.aliases;
    await store.saveFood(food);
  }
  assert.deepEqual((await store.loadAll()).foods.map(record => record.aliases), [[], [], [], []]);
  await store.saveSettings({ goals: { kcal: 0, protein: 0, carbs: 0, fat: 0 } });
  assert.equal((await store.loadAll()).settings.goals.kcal, 0);
});

test('food deletion protects history until all referencing entries are deleted', async () => {
  const store = setup();
  await store.saveFood(makeFood());
  await store.saveEntries([makeEntry(), makeEntry({ id: 'lunch', meal: 2 })]);
  await assert.rejects(store.deleteFood('oats'), /food is used/i);
  await store.deleteEntry('breakfast');
  await assert.rejects(store.deleteFood('oats'), /food is used/i);
  assert.equal((await store.loadAll()).foods.length, 1);
  await store.deleteEntry('lunch');
  await store.deleteFood('oats');
  assert.deepEqual((await store.loadAll()).foods, []);
});

test('weights upsert by date, sort ascending and delete by date', async () => {
  const store = setup();
  await store.saveWeight(makeWeight());
  await store.saveWeight(makeWeight({ date: '2026-10-01', kg: 82 }));
  await store.saveWeight(makeWeight({ kg: 79 }));
  assert.deepEqual((await store.loadAll()).weights, [
    { date: '2026-10-01', kg: 82 }, { date: '2026-10-31', kg: 79 },
  ]);
  await store.deleteWeight('2026-10-01');
  assert.deepEqual((await store.loadAll()).weights, [{ date: '2026-10-31', kg: 79 }]);
});

test('saveEntries uses one batch and entries load sorted by date then meal', async () => {
  const backend = createMemoryBackend();
  const original = backend.putMany.bind(backend);
  const batches = [];
  backend.putMany = async (name, records) => { batches.push(name); await original(name, records); };
  const store = createStore(backend);
  await store.saveEntries([
    makeEntry({ id: 'late', meal: 3 }),
    makeEntry({ id: 'early', date: '2026-10-01', meal: 4 }),
    makeEntry({ id: 'middle', meal: 1 }),
  ]);
  assert.deepEqual(batches, ['entries']);
  assert.deepEqual((await store.loadAll()).entries.map(record => record.id), ['early', 'middle', 'late']);
  await store.saveEntry(makeEntry({ id: 'middle', meal: 2, qty: 90 }));
  assert.equal((await store.loadAll()).entries.find(record => record.id === 'middle').qty, 90);
});

test('invalid batches and replacements leave all existing records intact', async () => {
  const backend = createMemoryBackend();
  const store = createStore(backend);
  const original = makeData();
  await store.replaceAll(original);
  let writes = 0;
  for (const method of ['put', 'putMany', 'clear']) {
    const perform = backend[method].bind(backend);
    backend[method] = async (...args) => { writes++; return perform(...args); };
  }
  await assert.rejects(store.saveEntries([makeEntry({ id: 'new' }), makeEntry({ qty: 0 })]), TypeError);
  await assert.rejects(store.saveEntries(null), TypeError);
  for (const change of [
    { foods: [makeFood({ baseQty: 0 })] }, { entries: [makeEntry({ meal: 0 })] },
    { weights: [makeWeight({ kg: 500 })] }, { settings: { goals: {} } },
    { foods: null }, { weights: null }, { entries: null },
  ]) {
    await assert.rejects(store.replaceAll({ ...makeData(), ...change }), TypeError);
  }
  assert.equal(writes, 0);
  assert.deepEqual(await store.loadAll(), original);
});

test('replaceAll replaces all four record types and removes obsolete keys', async () => {
  const backend = createMemoryBackend();
  const store = createStore(backend);
  await store.replaceAll(makeData());
  await backend.put('settings', { key: 'obsolete', goals: {} });
  const replacement = {
    foods: [makeFood({ id: 'rice', name: 'Rice' })],
    entries: [makeEntry({ id: 'dinner', foodId: 'rice', meal: 3 })],
    weights: [makeWeight({ date: '2026-11-01', kg: 79 })],
    settings: { goals: { kcal: 2000, protein: 150, carbs: 200, fat: 65 } },
  };
  const expected = structuredClone(replacement);
  await store.replaceAll(replacement);
  replacement.foods[0].aliases.push('changed');
  replacement.settings.goals.kcal = 1;
  assert.deepEqual(await store.loadAll(), expected);
  assert.deepEqual(await backend.getAll('settings'), [{ key: 'settings', ...expected.settings }]);
  await store.replaceAll({ foods: [], entries: [], weights: [], settings: makeSettings() });
  assert.deepEqual(await store.loadAll(), { foods: [], entries: [], weights: [], settings: makeSettings() });
});

test('failed memory replacement preserves every old store after staging earlier records', async () => {
  const backend = createMemoryBackend();
  const store = createStore(backend);
  const previous = makeData();
  await store.replaceAll(previous);
  const replace = backend.replaceAll.bind(backend);
  let calls = 0;
  backend.replaceAll = async replacement => {
    calls++;
    // Fail a later put after new foods and entries have been staged.
    replacement.weights.push({ kg: 75 });
    await replace(replacement);
  };
  backend.clear = async () => assert.fail('must not clear outside replacement');
  backend.putMany = async () => assert.fail('must not put outside replacement');
  const incoming = makeData();
  incoming.foods[0].name = 'Changed';
  incoming.entries[0].qty = 90;
  await assert.rejects(store.replaceAll(incoming), /Record needs a key/);
  assert.equal(calls, 1);
  assert.deepEqual(await store.loadAll(), previous);
});
