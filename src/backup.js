export const BACKUP_SCHEMA = 2;

const nutrients = ['kcal', 'protein', 'carbs', 'fat'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positive = value => Number.isFinite(value) && value > 0;
const nonNegative = value => Number.isFinite(value) && value >= 0;
const isDate = value => typeof value === 'string' && datePattern.test(value);

function isCalendarDate(value) {
  if (!isDate(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

export function backupFileName(date) {
  return `macro-diary-${date}.json`;
}

export function exportBackup({ foods, entries, weights, settings, savedMeals = [] }, exportedAt) {
  return JSON.stringify({ app: 'macro-diary', schema: BACKUP_SCHEMA, exportedAt,
    foods, entries, weights, savedMeals, settings }, null, 2);
}

export class BackupError extends Error {
  constructor(problems) {
    super(problems.join('\n'));
    this.name = 'BackupError';
    this.problems = [...problems];
  }
}

export function parseBackup(text, knownFoodIds = new Set()) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new BackupError(['backup: text is not valid JSON']);
  }
  if (!isObject(file)) throw new BackupError(['backup: must be an object']);
  const problems = [];
  const problem = (path, message) => {
    if (problems.length < 20) problems.push(`${path}: ${message}`);
  };
  if (file.app !== 'macro-diary') problem('app', 'must be macro-diary');
  if (!Number.isFinite(file.schema) || file.schema > BACKUP_SCHEMA) {
    problem('schema', `must be a number no greater than ${BACKUP_SCHEMA}`);
  }
  const data = {};
  for (const key of ['foods', 'entries', 'weights']) {
    data[key] = file[key] === undefined ? [] : file[key];
    if (!Array.isArray(data[key])) {
      problem(key, 'must be an array');
      data[key] = [];
    } else if (data[key].length > 20000) {
      problem(key, 'must contain at most 20000 records');
      data[key] = [];
    }
  }
  const check = (path, field, valid, message) => {
    if (!valid) problem(path, `${field} ${message}`);
  };
  const checkNutrients = (record, path) => {
    for (const key of nutrients) {
      check(path, key, nonNegative(record[key]), 'must be a finite non-negative number');
      check(path, key, !Number.isFinite(record[key]) || record[key] <= 1e6, 'must be at most 1000000');
    }
  };
  const foodIds = new Set(knownFoodIds);
  const fileFoodIds = new Set();
  const entryIds = new Set();
  const weightDates = new Set();
  const unique = (value, seen, path, field) => {
    if (seen.has(value)) problem(path, `${field} must be unique within the file`);
    seen.add(value);
  };
  const checkId = (value, path) => {
    check(path, 'id', typeof value === 'string', 'must be a string');
    if (typeof value === 'string') check(path, 'id', value.trim().length > 0, 'must not be blank');
  };
  const pick = (record, keys) => Object.fromEntries(keys.map(key => [key, record[key]]));
  data.foods = data.foods.map((food, index) => {
    const path = `foods[${index}]`;
    if (!isObject(food)) {
      problem(path, 'must be an object');
      return food;
    }
    checkId(food.id, path);
    unique(food.id, fileFoodIds, path, 'id');
    if (typeof food.id === 'string') foodIds.add(food.id);
    check(path, 'name', typeof food.name === 'string' && food.name.trim().length > 0,
      'must be a non-empty string');
    check(path, 'name', typeof food.name !== 'string' || food.name.trim().length <= 200,
      'must contain at most 200 characters after trimming');
    check(path, 'unit', ['g', 'ml', 'item', 'scoop'].includes(food.unit), 'must be g, ml, item or scoop');
    for (const key of ['baseQty', 'defaultQty']) {
      check(path, key, positive(food[key]), 'must be a positive number');
      check(path, key, !Number.isFinite(food[key]) || food[key] <= 1e6, 'must be at most 1000000');
    }
    checkNutrients(food, path);
    const aliases = food.aliases === undefined ? [] : food.aliases;
    check(path, 'aliases', Array.isArray(aliases) && aliases.every(alias => typeof alias === 'string'),
      'must be an array of strings');
    if (Array.isArray(aliases)) {
      check(path, 'aliases', aliases.length <= 50, 'must contain at most 50 aliases');
      check(path, 'aliases', aliases.every(alias => typeof alias !== 'string' || alias.length <= 100),
        'must contain at most 100 characters each');
    }
    return { ...pick(food, ['id', 'unit', 'baseQty', 'defaultQty', ...nutrients]),
      name: typeof food.name === 'string' ? food.name.trim() : food.name, aliases };
  });
  data.entries = data.entries.map((entry, index) => {
    const path = `entries[${index}]`;
    if (!isObject(entry)) return problem(path, 'must be an object');
    checkId(entry.id, path);
    unique(entry.id, entryIds, path, 'id');
    check(path, 'date', isDate(entry.date), 'must match YYYY-MM-DD');
    check(path, 'date', isCalendarDate(entry.date), 'must be a valid YYYY-MM-DD date');
    check(path, 'meal', Number.isInteger(entry.meal) && entry.meal >= 1, 'must be an integer at least 1');
    check(path, 'meal', !Number.isFinite(entry.meal) || entry.meal <= 99, 'must be at most 99');
    check(path, 'foodId', typeof entry.foodId === 'string', 'must be a string');
    if (typeof entry.foodId === 'string' && !foodIds.has(entry.foodId)) {
      problem(path, `foodId ${entry.foodId} does not identify a known food`);
    }
    check(path, 'qty', positive(entry.qty), 'must be a positive number');
    check(path, 'qty', !Number.isFinite(entry.qty) || entry.qty <= 1e6, 'must be at most 1000000');
    return pick(entry, ['id', 'date', 'meal', 'foodId', 'qty']);
  });
  data.weights = data.weights.map((weight, index) => {
    const path = `weights[${index}]`;
    if (!isObject(weight)) return problem(path, 'must be an object');
    check(path, 'date', isCalendarDate(weight.date), 'must be a valid YYYY-MM-DD date');
    unique(weight.date, weightDates, path, 'date');
    check(path, 'kg', positive(weight.kg) && weight.kg < 500, 'must be greater than 0 and under 500');
    return pick(weight, ['date', 'kg']);
  });
  let meals = file.savedMeals === undefined ? [] : file.savedMeals;
  if (!Array.isArray(meals)) {
    problem('savedMeals', 'must be an array');
    meals = [];
  } else if (meals.length > 20000) {
    problem('savedMeals', 'must contain at most 20000 records');
    meals = [];
  }
  const mealIds = new Set();
  data.savedMeals = meals.map((meal, index) => {
    const path = `savedMeals[${index}]`;
    if (!isObject(meal)) return problem(path, 'must be an object');
    checkId(meal.id, path);
    unique(meal.id, mealIds, path, 'id');
    check(path, 'name', typeof meal.name === 'string' && meal.name.trim().length > 0,
      'must be a non-empty string');
    check(path, 'name', typeof meal.name !== 'string' || meal.name.trim().length <= 200,
      'must contain at most 200 characters after trimming');
    const aliases = meal.aliases === undefined ? [] : meal.aliases;
    check(path, 'aliases', Array.isArray(aliases) && aliases.every(alias => typeof alias === 'string'),
      'must be an array of strings');
    if (Array.isArray(aliases)) {
      check(path, 'aliases', aliases.length <= 50, 'must contain at most 50 aliases');
      check(path, 'aliases', aliases.every(alias => typeof alias !== 'string' || alias.length <= 100),
        'must contain at most 100 characters each');
    }
    check(path, 'items', Array.isArray(meal.items) && meal.items.length >= 1 && meal.items.length <= 50,
      'must be an array of 1 to 50 items');
    const items = Array.isArray(meal.items) ? meal.items.map((item, itemIndex) => {
      const itemPath = `${path}.items[${itemIndex}]`;
      if (!isObject(item)) return problem(itemPath, 'must be an object');
      check(itemPath, 'foodId', typeof item.foodId === 'string' && item.foodId.trim().length > 0,
        'must be a non-empty string');
      if (typeof item.foodId === 'string' && item.foodId.trim().length > 0 && !foodIds.has(item.foodId)) {
        problem(itemPath, `foodId ${item.foodId} does not identify a known food`);
      }
      check(itemPath, 'qty', positive(item.qty), 'must be a positive number');
      check(itemPath, 'qty', !Number.isFinite(item.qty) || item.qty <= 1e6, 'must be at most 1000000');
      return pick(item, ['foodId', 'qty']);
    }) : [];
    return { id: meal.id, name: typeof meal.name === 'string' ? meal.name.trim() : meal.name,
      aliases, items };
  });
  data.settings = file.settings === undefined ? null : file.settings;
  if (data.settings !== null) {
    if (!isObject(data.settings) || !isObject(data.settings.goals)) {
      problem('settings', 'goals must be an object');
    } else {
      const raw = data.settings;
      checkNutrients(raw.goals, 'settings.goals');
      data.settings = { goals: pick(raw.goals, nutrients) };
      if (raw.goalMode !== undefined) {
        check('settings', 'goalMode', ['grams', 'percent'].includes(raw.goalMode), 'must be grams or percent');
        data.settings.goalMode = raw.goalMode;
      }
      if (raw.split !== undefined) {
        const parts = ['protein', 'carbs', 'fat'];
        const valid = isObject(raw.split)
          && parts.every(part => Number.isInteger(raw.split[part]) && raw.split[part] >= 0 && raw.split[part] <= 100);
        check('settings', 'split', valid, 'must hold whole numbers from 0 to 100 for protein, carbs and fat');
        if (valid) {
          check('settings', 'split', parts.reduce((sum, part) => sum + raw.split[part], 0) === 100,
            'must add to 100');
        }
        data.settings.split = isObject(raw.split) ? pick(raw.split, parts) : raw.split;
      }
      if (raw.largeText !== undefined) {
        check('settings', 'largeText', typeof raw.largeText === 'boolean', 'must be true or false');
        data.settings.largeText = raw.largeText;
      }
    }
  }
  if (problems.length) throw new BackupError(problems);
  return data;
}

function mergeRecords(current, incoming, key) {
  const records = new Map(current.map(record => [record[key], record]));
  for (const record of incoming) records.set(record[key], record);
  return [...records.values()];
}

export function mergeData(current, incoming) {
  return {
    foods: mergeRecords(current.foods, incoming.foods, 'id'),
    entries: mergeRecords(current.entries, incoming.entries, 'id'),
    weights: mergeRecords(current.weights, incoming.weights, 'date')
      .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0),
    savedMeals: mergeRecords(current.savedMeals || [], incoming.savedMeals || [], 'id'),
    settings: incoming.settings === null ? current.settings : incoming.settings,
  };
}

export function summarise(data) {
  return { foods: data.foods.length, entries: data.entries.length, weights: data.weights.length,
    savedMeals: (data.savedMeals || []).length, days: new Set(data.entries.map(entry => entry.date)).size };
}
