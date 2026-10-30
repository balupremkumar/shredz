import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/actions.js';
import { createStore, createMemoryBackend, DEFAULT_SETTINGS } from '../src/store.js';
import { dayTotals, remaining } from '../src/diary.js';

const date = '2026-10-31';
const dictation = 'Meal number one, 2 Weet-Bix, green milk 200 mils and one scoop of whey protein. Meal number two, chicken breast 125 grams, basmati rice 150 grams and 20 grams of cashews. Save.';
const fixtures = [
  ['weetbix', 'Weet-Bix', 'item', 1, 2, 55, 2, 10, 0.5],
  ['milk', 'Green milk', 'ml', 100, 250, 48, 3.5, 5, 1.5],
  ['whey', 'Whey protein', 'scoop', 1, 1, 120, 24, 3, 2],
  ['chicken', 'Chicken breast', 'g', 100, 100, 165, 31, 0, 3.6],
  ['rice', 'Basmati rice', 'g', 100, 100, 130, 2.7, 28, 0.3],
  ['cashews', 'Cashews', 'g', 100, 30, 553, 18, 30, 44],
].map(([id, name, unit, baseQty, defaultQty, kcal, protein, carbs, fat]) =>
  ({ id, name, unit, baseQty, defaultQty, kcal, protein, carbs, fat, aliases: [] }));

function setup(backend = createMemoryBackend()) {
  let id = 0;
  const app = createApp({ store: createStore(backend), makeId: () => `new-${++id}`, today: () => date });
  return { app, backend };
}
async function seeded() {
  const context = setup();
  assert.deepEqual(await context.app.init(), { ok: true });
  for (const food of fixtures) assert.equal((await context.app.actions.saveFood(food)).ok, true);
  return context;
}

test('whole-day routine, preview, totals and persistence', async () => {
  const { app, backend } = await seeded();
  const preview = app.select.preview(dictation);
  assert.equal(preview.save, true);
  assert.deepEqual(preview.lines.map(line => [line.meal, line.count]), [[1, 3], [2, 3]]);
  assert.deepEqual(preview.unmatched, []);
  const result = await app.actions.addParsed(date, preview);
  assert.equal(result.ok, true);
  assert.equal(result.added, 6);
  const { data } = app.getState();
  const expected = dayTotals(data.entries, Object.fromEntries(data.foods.map(food => [food.id, food])), date);
  assert.deepEqual(app.select.day().totals, expected);
  assert.equal(result.kcal, expected.kcal);
  assert.equal(preview.kcal, expected.kcal);
  assert.deepEqual(preview.lines.map(line => line.kcal), app.select.day().view.meals.map(meal => meal.totals.kcal));
  assert.deepEqual(app.select.day().remaining, remaining(DEFAULT_SETTINGS.goals, expected));
  assert.equal(app.select.day().nextMeal, 3);
  const fresh = setup(backend).app;
  assert.equal((await fresh.init()).ok, true);
  assert.deepEqual(fresh.select.day(), app.select.day());
});

test('copy latest earlier day, individual meals and explicit days use new ids', async () => {
  const { app, backend } = await seeded();
  await app.actions.addParsed(date, app.select.preview(dictation));
  const originals = app.getState().data.entries;
  const puts = [];
  const putMany = backend.putMany.bind(backend);
  backend.putMany = async (name, records) => { puts.push({ name, records }); await putMany(name, records); };
  assert.equal((await app.actions.copyLastLoggedDay('2026-11-01')).added, 6);
  const copies = app.getState().data.entries.slice(6);
  assert.deepEqual(copies.map(entry => entry.meal), originals.map(entry => entry.meal));
  assert.equal(new Set([...originals, ...copies].map(entry => entry.id)).size, 12);
  assert.equal(puts.length, 1);
  assert.deepEqual(puts[0].records, copies);
  assert.equal((await app.actions.copyLastLoggedDay(date)).ok, false);
  assert.equal((await app.actions.copyMeal({ fromDate: date, fromMeal: 2,
    toDate: '2026-11-02', toMeal: 4 })).added, 3);
  assert.deepEqual(app.select.day('2026-11-02').view.meals.map(meal => meal.meal), [4]);
  assert.equal((await app.actions.copyDay({ fromDate: date, toDate: '2026-11-03' })).added, 6);
  assert.equal(app.select.day('2026-11-03').lastLoggedDate, '2026-11-02');
});

test('weights accept comma decimals, reject invalid values and provide history', async () => {
  const { app } = await seeded();
  await app.actions.logWeight('2026-10-24', 84);
  assert.equal((await app.actions.logWeight(date, '82,4')).ok, true);
  const before = app.getState();
  for (const input of ['0', 'abc', 500, Infinity]) {
    assert.equal((await app.actions.logWeight(date, input)).ok, false);
    assert.deepEqual(app.getState(), before);
  }
  assert.equal(app.select.day().weight, 82.4);
  assert.equal(app.select.day().lastWeight, 82.4);
  assert.equal(app.select.day().weekChange, -1.6);
  assert.equal(app.select.day('2026-11-01').weight, null);
  assert.equal(app.select.day('2026-11-01').lastWeight, 82.4);
  assert.equal(app.select.day('2026-10-23').lastWeight, null);
  assert.equal(app.select.day('2026-11-01').weekChange, null);
  assert.deepEqual(app.select.weights(7), [{ date, kg: 82.4 }]);
  assert.equal(app.select.weights().length, 2);
  await app.actions.logWeight(date, 82);
  assert.equal(app.getState().data.weights.length, 2);
  assert.equal((await app.actions.deleteWeight(date)).ok, true);
  assert.equal(app.select.day().weight, null);
});

test('failed writes leave state untouched and used foods cannot be deleted', async () => {
  const { app, backend } = await seeded();
  let changes = 0;
  app.subscribe(() => { changes += 1; });
  const before = app.getState();
  const put = backend.put;
  const putMany = backend.putMany;
  backend.put = async () => { throw new Error('Disk is full'); };
  backend.putMany = async () => { throw new Error('Disk is full'); };
  assert.deepEqual(await app.actions.addItems(date, 1, [{ foodId: 'milk', qty: 100 }]),
    { ok: false, error: 'Disk is full' });
  assert.equal((await app.actions.logWeight(date, 82)).ok, false);
  assert.equal((await app.actions.saveFood({ ...fixtures[0], name: 'Changed' })).ok, false);
  assert.equal((await app.actions.saveGoals(DEFAULT_SETTINGS.goals)).ok, false);
  assert.deepEqual(app.getState(), before);
  assert.equal(changes, 0);
  backend.put = put;
  backend.putMany = putMany;
  await app.actions.addItems(date, 1, [{ foodId: 'milk', qty: 100 }]);
  const used = app.getState();
  assert.match((await app.actions.deleteFood('milk')).error, /used.*entry/i);
  assert.deepEqual(app.getState(), used);
  assert.equal((await app.actions.addItems(date, 1, [{ foodId: 'unknown', qty: 1 }])).ok, false);
  assert.deepEqual(app.getState(), used);
});

test('backup replace restores data, invalid files preserve it and merge keeps entries', async () => {
  const { app } = await seeded();
  await app.actions.addParsed(date, app.select.preview(dictation));
  await app.actions.logWeight(date, 82.4);
  await app.actions.saveGoals({ kcal: 2000, protein: 160, carbs: 200, fat: 60 });
  const exported = app.actions.exportBackup('2026-10-31T12:00:00Z');
  assert.equal(exported.ok, true);
  assert.equal(exported.fileName, 'macro-diary-2026-10-31.json');
  const fresh = setup().app;
  await fresh.init();
  assert.deepEqual(await fresh.actions.importBackup(exported.text, 'replace'),
    { ok: true, summary: { foods: 6, entries: 6, weights: 1, days: 1 } });
  assert.deepEqual(fresh.getState().data, app.getState().data);
  const before = fresh.getState();
  assert.match((await fresh.actions.importBackup('{bad', 'replace')).error, /valid JSON/);
  const bad = JSON.parse(exported.text);
  bad.entries[0].foodId = 'missing';
  bad.weights[0].kg = 0;
  const error = (await fresh.actions.importBackup(JSON.stringify(bad), 'replace')).error;
  assert.match(error, /entries\[0\].*known food/);
  assert.match(error, /weights\[0\].*kg/);
  assert.equal((await fresh.actions.importBackup(exported.text, 'other')).ok, false);
  assert.deepEqual(fresh.getState(), before);
  const incoming = JSON.parse(exported.text);
  incoming.foods = [];
  incoming.entries = [{ id: 'incoming', date, meal: 3, foodId: 'milk', qty: 50 }];
  incoming.settings = null;
  assert.equal((await fresh.actions.importBackup(JSON.stringify(incoming), 'merge')).ok, true);
  assert.equal(fresh.getState().data.entries.length, 7);
  assert.deepEqual(fresh.getState().data.entries.slice(0, 6), before.data.entries);
  assert.deepEqual(fresh.getState().data.settings, before.data.settings);
});

test('navigation, notifications, normalisation, edits, goals and snapshot isolation', async () => {
  const { app } = setup();
  assert.equal(app.getState().ready, false);
  let calls = 0;
  const unsubscribe = app.subscribe(() => { calls += 1; });
  await app.init();
  assert.equal(calls, 1);
  assert.deepEqual(app.getState(), { data: { foods: [], entries: [], weights: [], settings: DEFAULT_SETTINGS },
    date, tab: 'diary', sheet: null, ready: true });
  app.actions.prevDay();
  assert.equal(app.getState().date, '2026-10-30');
  app.actions.nextDay();
  assert.equal(app.getState().date, date);
  app.actions.setDate('2026-11-01');
  app.actions.goToday();
  assert.equal(app.getState().date, date);
  for (const tab of ['diary', 'foods', 'weight', 'settings']) {
    assert.equal(app.actions.setTab(tab).ok, true);
    assert.equal(app.getState().tab, tab);
  }
  assert.equal(app.actions.setTab('wrong').ok, false);
  app.actions.openSheet('weigh-in', { date });
  assert.deepEqual(app.getState().sheet, { name: 'weigh-in', props: { date } });
  app.actions.closeSheet();
  assert.equal(app.getState().sheet, null);
  unsubscribe();
  const count = calls;
  const food = { ...fixtures[0], id: undefined, name: '  zebra  ', aliases: [' BIX ', 'bix', '', '  '] };
  const saved = await app.actions.saveFood(food);
  assert.equal(typeof saved.id, 'string');
  assert.equal(saved.ok, true);
  assert.deepEqual(app.select.foods()[0].aliases, ['bix']);
  assert.equal(app.select.foods()[0].name, 'zebra');
  await app.actions.saveFood({ ...fixtures[1], name: 'apple' });
  assert.deepEqual(app.select.foods().map(food => food.name), ['apple', 'zebra']);
  app.getState().data.foods[0].name = 'mutated';
  app.select.foods()[0].aliases.push('mutated');
  assert.equal(app.select.foods()[1].name, 'zebra');
  assert.deepEqual(app.select.foods()[0].aliases, []);
  await app.actions.addItems(date, 2, [{ foodId: 'milk', qty: 100 }]);
  const id = app.getState().data.entries[0].id;
  assert.equal((await app.actions.updateEntryQty(id, 200)).ok, true);
  assert.equal(app.select.day().view.meals[0].entries[0].qty, 200);
  assert.equal((await app.actions.updateEntryQty(id, 0)).ok, false);
  assert.equal((await app.actions.updateEntryQty('missing', 1)).ok, false);
  assert.equal((await app.actions.deleteEntry(id)).ok, true);
  assert.equal((await app.actions.deleteFood('milk')).ok, true);
  assert.equal(app.select.day().nextMeal, 1);
  assert.equal((await app.actions.saveGoals({ kcal: 1, protein: 2, carbs: 3, fat: 4 })).ok, true);
  assert.deepEqual(app.select.day().goals, { kcal: 1, protein: 2, carbs: 3, fat: 4 });
  app.select.day().goals.kcal = 500;
  assert.equal(app.select.day().goals.kcal, 1);
  assert.equal(calls, count);
});

test('pending writes publish only after success and concurrent edits are retained', async () => {
  const { app, backend } = await seeded();
  const original = backend.putMany.bind(backend);
  let release;
  backend.putMany = async (...args) => {
    await new Promise(resolve => { release = resolve; });
    await original(...args);
  };
  const first = app.actions.addItems(date, 1, [{ foodId: 'milk', qty: 100 }]);
  await Promise.resolve();
  assert.equal(app.getState().data.entries.length, 0);
  const second = app.actions.addItems(date, 2, [{ foodId: 'rice', qty: 150 }]);
  backend.putMany = original;
  release();
  assert.equal((await first).ok, true);
  assert.equal((await second).ok, true);
  assert.equal(app.getState().data.entries.length, 2);
  app.subscribe(() => { throw new Error('Renderer failed'); });
  assert.equal((await app.actions.logWeight(date, 82)).ok, true);
});

test('initial load failures resolve as readable errors', async () => {
  const backend = createMemoryBackend();
  backend.getAll = async () => { throw new Error('Cannot read diary'); };
  const { app } = setup(backend);
  assert.deepEqual(await app.init(), { ok: false, error: 'Cannot read diary' });
  assert.equal(app.getState().ready, false);
});
