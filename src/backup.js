export const BACKUP_SCHEMA = 1;

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

export function exportBackup({ foods, entries, weights, settings }, exportedAt) {
  return JSON.stringify({ app: 'macro-diary', schema: BACKUP_SCHEMA, exportedAt,
    foods, entries, weights, settings }, null, 2);
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
    }
  }
  const check = (path, field, valid, message) => {
    if (!valid) problem(path, `${field} ${message}`);
  };
  const checkNutrients = (record, path) => {
    for (const key of nutrients) {
      check(path, key, nonNegative(record[key]), 'must be a finite non-negative number');
    }
  };
  const foodIds = new Set(knownFoodIds);
  data.foods = data.foods.map((food, index) => {
    const path = `foods[${index}]`;
    if (!isObject(food)) {
      problem(path, 'must be an object');
      return food;
    }
    check(path, 'id', typeof food.id === 'string', 'must be a string');
    if (typeof food.id === 'string') foodIds.add(food.id);
    check(path, 'name', typeof food.name === 'string' && food.name.trim().length > 0,
      'must be a non-empty string');
    check(path, 'unit', ['g', 'ml', 'item', 'scoop'].includes(food.unit), 'must be g, ml, item or scoop');
    for (const key of ['baseQty', 'defaultQty']) {
      check(path, key, positive(food[key]), 'must be a positive number');
    }
    checkNutrients(food, path);
    const aliases = food.aliases === undefined ? [] : food.aliases;
    check(path, 'aliases', Array.isArray(aliases) && aliases.every(alias => typeof alias === 'string'),
      'must be an array of strings');
    return { ...food, aliases };
  });
  data.entries.forEach((entry, index) => {
    const path = `entries[${index}]`;
    if (!isObject(entry)) return problem(path, 'must be an object');
    check(path, 'id', typeof entry.id === 'string', 'must be a string');
    check(path, 'date', isDate(entry.date), 'must match YYYY-MM-DD');
    check(path, 'meal', Number.isInteger(entry.meal) && entry.meal >= 1, 'must be an integer at least 1');
    check(path, 'foodId', typeof entry.foodId === 'string', 'must be a string');
    if (typeof entry.foodId === 'string' && !foodIds.has(entry.foodId)) {
      problem(path, `foodId ${entry.foodId} does not identify a known food`);
    }
    check(path, 'qty', positive(entry.qty), 'must be a positive number');
  });
  data.weights.forEach((weight, index) => {
    const path = `weights[${index}]`;
    if (!isObject(weight)) return problem(path, 'must be an object');
    check(path, 'date', isCalendarDate(weight.date), 'must be a valid YYYY-MM-DD date');
    check(path, 'kg', positive(weight.kg) && weight.kg < 500, 'must be greater than 0 and under 500');
  });
  data.settings = file.settings === undefined ? null : file.settings;
  if (data.settings !== null) {
    if (!isObject(data.settings) || !isObject(data.settings.goals)) {
      problem('settings', 'goals must be an object');
    } else {
      checkNutrients(data.settings.goals, 'settings.goals');
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
    settings: incoming.settings === null ? current.settings : incoming.settings,
  };
}

export function summarise(data) {
  return { foods: data.foods.length, entries: data.entries.length, weights: data.weights.length,
    days: new Set(data.entries.map(entry => entry.date)).size };
}
