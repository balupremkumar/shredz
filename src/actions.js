import { DEFAULT_SETTINGS } from './store.js';
import * as diary from './diary.js';
import { parseDictation } from './parser.js';
import * as backup from './backup.js';
import { addDays, parseNumber } from './format.js';

export function createApp({ store, makeId, today }) {
  let state = {
    data: { foods: [], entries: [], weights: [], settings: structuredClone(DEFAULT_SETTINGS) },
    date: null, tab: 'diary', sheet: null, ready: false,
  };
  const listeners = new Set();
  let pending = Promise.resolve();
  const getState = () => structuredClone(state);
  const failure = error => ({ ok: false, error: error instanceof Error ? error.message : String(error) });
  function attempt(fn) {
    try { return fn(); } catch (error) { return failure(error); }
  }
  function change(patch) {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) {
      // A broken renderer must not turn a successful write into a failed action.
      try { listener(getState()); } catch { /* Other subscribers still receive the change. */ }
    }
    return { ok: true };
  }
  function write(fn) {
    const result = pending.then(async () => {
      try { return await fn(); } catch (error) { return failure(error); }
    });
    pending = result.then(() => undefined);
    return result;
  }
  const updateData = patch => change({ data: { ...state.data, ...patch } });
  const foodsById = () => Object.fromEntries(state.data.foods.map(food => [food.id, food]));
  function newEntries(date, meal, items) {
    return items.map(({ foodId, qty }) => ({ id: makeId(), date, meal, foodId, qty }));
  }
  async function append(entries) {
    const foods = foodsById();
    if (entries.some(entry => !Object.hasOwn(foods, entry.foodId))) {
      throw new Error('Food does not exist in the catalogue');
    }
    await store.saveEntries(entries);
    updateData({ entries: [...state.data.entries, ...entries] });
    return { ok: true, added: entries.length,
      kcal: diary.dayTotals(entries, foods, entries[0]?.date).kcal };
  }
  const actions = {
    setDate: date => attempt(() => change({ date })),
    goToday: () => attempt(() => change({ date: today() })),
    prevDay: () => attempt(() => change({ date: addDays(state.date, -1) })),
    nextDay: () => attempt(() => change({ date: addDays(state.date, 1) })),
    setTab: tab => attempt(() => {
      if (!['diary', 'foods', 'weight', 'settings'].includes(tab)) throw new Error('Unknown tab');
      return change({ tab });
    }),
    openSheet: (name, props = {}) => attempt(() => change({ sheet: { name, props: structuredClone(props) } })),
    closeSheet: () => change({ sheet: null }),
    addItems: (date, meal, items) => write(() => append(newEntries(date, meal, items))),
    addParsed: (date, result) => write(() => append(result.meals.flatMap(
      ({ meal, items }) => newEntries(date, meal, items)))),
    updateEntryQty: (id, qty) => write(async () => {
      const entry = state.data.entries.find(entry => entry.id === id);
      if (!entry) throw new Error('Diary entry does not exist');
      const updated = { ...entry, qty };
      await store.saveEntry(updated);
      return updateData({ entries: state.data.entries.map(entry => entry.id === id ? updated : entry) });
    }),
    deleteEntry: id => write(async () => {
      await store.deleteEntry(id);
      return updateData({ entries: state.data.entries.filter(entry => entry.id !== id) });
    }),
    copyMeal: options => write(() => append(
      diary.copyMeal(state.data.entries, options, makeId).slice(state.data.entries.length))),
    copyDay: options => write(() => append(
      diary.copyDay(state.data.entries, options, makeId).slice(state.data.entries.length))),
    copyLastLoggedDay: toDate => write(() => {
      const fromDate = diary.lastLoggedDate(state.data.entries, toDate);
      if (!fromDate) throw new Error('No earlier logged day to copy');
      return append(diary.copyDay(state.data.entries, { fromDate, toDate }, makeId)
        .slice(state.data.entries.length));
    }),
    logWeight: (date, input) => write(async () => {
      const kg = typeof input === 'string' ? parseNumber(input) : input;
      const weights = diary.upsertWeight(state.data.weights, date, kg);
      await store.saveWeight({ date, kg });
      return updateData({ weights });
    }),
    deleteWeight: date => write(async () => {
      await store.deleteWeight(date);
      return updateData({ weights: state.data.weights.filter(weight => weight.date !== date) });
    }),
    saveFood: food => write(async () => {
      const saved = { ...food, id: food.id || makeId(), name: food.name.trim(),
        aliases: [...new Set((food.aliases || []).map(alias => alias.trim().toLowerCase()).filter(Boolean))] };
      await store.saveFood(saved);
      updateData({ foods: [...state.data.foods.filter(food => food.id !== saved.id), saved] });
      return { ok: true, id: saved.id };
    }),
    deleteFood: id => write(async () => {
      await store.deleteFood(id);
      return updateData({ foods: state.data.foods.filter(food => food.id !== id) });
    }),
    saveGoals: goals => write(async () => {
      const settings = { goals: structuredClone(goals) };
      await store.saveSettings(settings);
      return updateData({ settings });
    }),
    exportBackup: nowIso => attempt(() => ({ ok: true,
      fileName: backup.backupFileName(today()),
      text: backup.exportBackup(state.data, nowIso) })),
    importBackup: (text, mode) => write(async () => {
      if (!['replace', 'merge'].includes(mode)) throw new Error('Import mode must be replace or merge');
      const incoming = backup.parseBackup(text,
        mode === 'merge' ? new Set(state.data.foods.map(food => food.id)) : new Set());
      const data = mode === 'merge' ? backup.mergeData(state.data, incoming)
        : { ...incoming, settings: incoming.settings ?? structuredClone(DEFAULT_SETTINGS) };
      await store.replaceAll(data);
      change({ data });
      return { ok: true, summary: backup.summarise(data) };
    }),
  };
  const select = {
    day(date = state.date) {
      const { entries, weights, settings } = state.data;
      const totals = diary.dayTotals(entries, foodsById(), date);
      const last = weights.filter(weight => weight.date <= date)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      return structuredClone({ date, view: diary.dayView(entries, foodsById(), date), totals,
        goals: settings.goals, remaining: diary.remaining(settings.goals, totals),
        weight: weights.find(weight => weight.date === date)?.kg ?? null,
        lastWeight: last?.kg ?? null, weekChange: diary.weightChange(weights, date, 7),
        lastLoggedDate: diary.lastLoggedDate(entries, date), nextMeal: diary.nextMealNumber(entries, date) });
    },
    foods: () => structuredClone([...state.data.foods].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()))),
    weights(days = 30) {
      const start = addDays(state.date, 1 - days);
      return structuredClone(state.data.weights.filter(weight =>
        weight.date >= start && weight.date <= state.date).sort((a, b) => a.date.localeCompare(b.date)));
    },
    preview(text) {
      const parsed = parseDictation(text, state.data.foods,
        { defaultMeal: diary.nextMealNumber(state.data.entries, state.date) });
      const entries = parsed.meals.flatMap(({ meal, items }) =>
        items.map(item => ({ ...item, meal, date: state.date })));
      const foods = foodsById();
      return { ...parsed, lines: parsed.meals.map(({ meal, items }) => ({ meal, count: items.length,
        kcal: diary.mealTotals(entries, foods, state.date, meal).kcal })),
      kcal: diary.dayTotals(entries, foods, state.date).kcal };
    },
  };
  return {
    init: () => write(async () => {
      const data = await store.loadAll();
      return change({ data, date: today(), tab: 'diary', sheet: null, ready: true });
    }),
    getState,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    actions, select,
  };
}
