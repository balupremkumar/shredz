import { DEFAULT_SETTINGS } from './store.js';
import * as diary from './diary.js';
import { parseDictation } from './parser.js';
import * as backup from './backup.js';
import { addDays, parseNumber } from './format.js';
import * as insights from './insights.js';

export function createApp({ store, makeId, today }) {
  let state = {
    data: { foods: [], entries: [], weights: [], savedMeals: [], settings: structuredClone(DEFAULT_SETTINGS) },
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
  async function persistSavedMeal(meal) {
    const saved = { ...meal, id: meal.id || makeId(), name: String(meal.name ?? '').trim(),
      aliases: [...new Set((meal.aliases || []).map(alias => alias.trim().toLowerCase()).filter(Boolean))],
      items: (meal.items || []).map(({ foodId, qty }) => ({ foodId, qty })) };
    await store.saveSavedMeal(saved);
    const rest = state.data.savedMeals.filter(item => item.id !== saved.id);
    updateData({ savedMeals: [...rest, saved] });
    return saved;
  }
  const saveSettings = async patch => {
    const settings = { ...structuredClone(state.data.settings), ...patch };
    if (['protein', 'carbs', 'fat'].some(macro => settings.goals?.[macro] > 5000)) {
      throw new Error('Grams must be numbers from 0 to 5000');
    }
    await store.saveSettings(settings);
    return updateData({ settings });
  };
  const normaliseWord = word => String(word ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const squashWord = word => String(word ?? '').toLowerCase().replace(/[\s\-'’]/g, '');
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
    saveGoals: goals => write(() => saveSettings({ goals: structuredClone(goals) })),
    saveGoalSettings: input => write(async () => {
      const { goalMode } = input || {};
      if (goalMode === 'percent') {
        const split = input.split || {};
        const sum = ['protein', 'carbs', 'fat'].reduce((total, key) => total + Number(split[key]), 0);
        if (sum !== 100) throw new Error('Percentages must add up to 100');
        return saveSettings({ goalMode, goals: insights.goalsFromPercent(input.kcal, split),
          split: structuredClone(split) });
      }
      if (goalMode === 'grams') {
        const { protein, carbs, fat } = input;
        if (![protein, carbs, fat].every(value => Number.isFinite(value) && value >= 0 && value <= 5000)) {
          throw new Error('Grams must be numbers from 0 to 5000');
        }
        const goals = { protein, carbs, fat };
        return saveSettings({ goalMode, goals: { ...goals, kcal: insights.kcalFromGrams(goals) },
          split: insights.splitFromGrams(goals) });
      }
      throw new Error('Goal mode must be grams or percent');
    }),
    setLargeText: on => write(() => saveSettings({ largeText: Boolean(on) })),
    saveSavedMeal: meal => write(async () => ({ ok: true, id: (await persistSavedMeal(meal)).id })),
    deleteSavedMeal: id => write(async () => {
      await store.deleteSavedMeal(id);
      return updateData({ savedMeals: state.data.savedMeals.filter(meal => meal.id !== id) });
    }),
    saveMealAsSaved: ({ date, meal, name }) => write(async () => {
      const items = state.data.entries.filter(entry => entry.date === date && entry.meal === meal)
        .map(({ foodId, qty }) => ({ foodId, qty }));
      if (!items.length) throw new Error('That meal has no items to save');
      return { ok: true, id: (await persistSavedMeal({ name, items })).id };
    }),
    addSavedMeal: (date, meal, savedMealId) => write(() => {
      const saved = state.data.savedMeals.find(item => item.id === savedMealId);
      if (!saved) throw new Error('Saved meal does not exist');
      return append(newEntries(date, meal, saved.items));
    }),
    addAlias: (foodId, word) => write(async () => {
      const food = state.data.foods.find(item => item.id === foodId);
      if (!food) throw new Error('Food does not exist');
      const alias = normaliseWord(word);
      if (!alias) throw new Error('Word is empty');
      const squashed = squashWord(alias);
      const taken = [...state.data.foods.filter(item => item.id !== foodId), ...state.data.savedMeals]
        .find(item => [item.name, ...(item.aliases || [])].some(text => squashWord(text) === squashed));
      if (taken) throw new Error(`Already used for ${taken.name}`);
      if ([food.name, ...(food.aliases || [])].some(text => squashWord(text) === squashed)) return { ok: true, food: structuredClone(food) };
      const saved = { ...food, aliases: [...(food.aliases || []), alias] };
      await store.saveFood(saved);
      updateData({ foods: state.data.foods.map(item => item.id === foodId ? saved : item) });
      return { ok: true, food: structuredClone(saved) };
    }),
    stepEntry: (id, direction) => write(async () => {
      const entry = state.data.entries.find(entry => entry.id === id);
      if (!entry) throw new Error('Diary entry does not exist');
      const food = foodsById()[entry.foodId];
      if (!food) throw new Error('Food does not exist in the catalogue');
      const updated = { ...entry, qty: insights.stepQty(entry.qty, food.unit, direction) };
      await store.saveEntry(updated);
      return updateData({ entries: state.data.entries.map(item => item.id === id ? updated : item) });
    }),
    exportCsv: kind => attempt(() => {
      if (!['diary', 'weights'].includes(kind)) throw new Error('CSV kind must be diary or weights');
      const text = kind === 'diary' ? insights.diaryCsv(state.data.entries, foodsById())
        : insights.weightsCsv(state.data.weights);
      return { ok: true, fileName: `shredz-${kind}-${today()}.csv`, text };
    }),
    exportBackup: nowIso => attempt(() => ({ ok: true,
      fileName: backup.backupFileName(today()),
      text: backup.exportBackup(state.data, nowIso) })),
    importBackup: (text, mode) => write(async () => {
      if (!['replace', 'merge'].includes(mode)) throw new Error('Import mode must be replace or merge');
      const incoming = backup.parseBackup(text,
        mode === 'merge' ? new Set(state.data.foods.map(food => food.id)) : new Set());
      const data = mode === 'merge' ? backup.mergeData(state.data, incoming)
        : { ...incoming, savedMeals: incoming.savedMeals ?? [],
          settings: incoming.settings ?? structuredClone(DEFAULT_SETTINGS) };
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
    savedMeals: () => structuredClone([...state.data.savedMeals].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()))),
    recentFoods: () => structuredClone(insights.recentFoods(state.data.entries, state.data.foods, today())),
    report: days => insights.report(state.data.entries, state.data.weights, foodsById(), today(), days),
    weightTrend(days = 30) {
      const start = addDays(state.date, 1 - days);
      const sorted = [...state.data.weights].sort((a, b) => a.date.localeCompare(b.date));
      return insights.movingAverage(sorted).filter(point => point.date >= start && point.date <= state.date);
    },
    needsWeighIn: () => insights.needsWeighIn(state.data.weights, today()),
    settings: () => structuredClone(state.data.settings),
    preview(text) {
      const parsed = parseDictation(text, state.data.foods,
        { defaultMeal: diary.nextMealNumber(state.data.entries, state.date),
          savedMeals: state.data.savedMeals });
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
