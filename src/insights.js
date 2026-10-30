import { nutritionFor, roundTotals } from './diary.js';
import { addDays, daysBetween } from './format.js';

const nutrients = ['kcal', 'protein', 'carbs', 'fat'];
const macros = ['protein', 'carbs', 'fat'];
const kcalPerGram = { protein: 4, carbs: 4, fat: 9 };

function rounded(value, factor) {
  const result = Math.round(value * factor) / factor;
  return Object.is(result, -0) ? 0 : result;
}

function foodFor(foodsById, id) {
  return Object.hasOwn(foodsById, id) ? foodsById[id] : null;
}

function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function movingAverage(weights, days = 7) {
  return weights.map(weight => {
    const window = weights.filter(other => other.date <= weight.date && daysBetween(other.date, weight.date) < days);
    const mean = window.reduce((sum, other) => sum + other.kg, 0) / window.length;
    return { date: weight.date, kg: rounded(mean, 100) };
  });
}

function averageOnOrBefore(averages, date) {
  return averages.reduce((latest, item) =>
    item.date <= date && (latest === null || item.date > latest.date) ? item : latest, null);
}

export function report(entries, weights, foodsById, endDate, days) {
  const startDate = addDays(endDate, -(days - 1));
  const inWindow = entries.filter(entry => entry.date >= startDate && entry.date <= endDate);
  const loggedDays = new Set(inWindow.map(entry => entry.date)).size;
  const sums = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const entry of inWindow) {
    const food = foodFor(foodsById, entry.foodId);
    if (!food) continue;
    const nutrition = nutritionFor(food, entry.qty);
    for (const key of nutrients) sums[key] += nutrition[key];
  }
  const averages = Object.fromEntries(nutrients.map(key => [key, loggedDays === 0 ? 0 : sums[key] / loggedDays]));
  const trend = movingAverage(weights);
  const latest = averageOnOrBefore(trend, endDate);
  const earlier = averageOnOrBefore(trend, startDate);
  return {
    days,
    loggedDays,
    ...roundTotals(averages),
    weightChange: latest && earlier ? rounded(latest.kg - earlier.kg, 10) : null,
  };
}

export function goalsFromPercent(kcal, split) {
  if (!Number.isFinite(kcal) || kcal <= 0) throw new RangeError('Calories must be a finite number greater than 0');
  const values = macros.map(key => split[key]);
  if (!values.every(value => Number.isInteger(value) && value >= 0 && value <= 100)
    || values.reduce((sum, value) => sum + value, 0) !== 100) {
    throw new RangeError('Split must be whole percentages from 0 to 100 that add up to 100');
  }
  return {
    kcal,
    ...Object.fromEntries(macros.map(key => [key, Math.round(kcal * split[key] / 100 / kcalPerGram[key])])),
  };
}

export function kcalFromGrams({ protein, carbs, fat }) {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

export function splitFromGrams(goals) {
  const calories = macros.map(key => goals[key] * kcalPerGram[key]);
  const total = calories.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return { protein: 0, carbs: 0, fat: 0 };
  const exact = calories.map(value => value * 100 / total);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] += 1;
    left -= 1;
  }
  return Object.fromEntries(macros.map((key, index) => [key, floors[index]]));
}

function csvField(value) {
  let text;
  if (typeof value === 'number') {
    text = Number.isFinite(value) ? String(value) : '';
    if (/e/i.test(text)) text = value.toFixed(20).replace(/\.?0+$/, '');
  } else {
    text = value === null || value === undefined ? '' : String(value);
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows) {
  return rows.map(row => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}

export function diaryCsv(entries, foodsById) {
  const rows = [['date', 'meal', 'food', 'qty', 'unit', 'kcal', 'protein', 'carbs', 'fat']];
  const sorted = [...entries].sort((a, b) => compare(a.date, b.date) || a.meal - b.meal);
  for (const entry of sorted) {
    const food = foodFor(foodsById, entry.foodId);
    if (!food) continue;
    const n = roundTotals(nutritionFor(food, entry.qty));
    rows.push([entry.date, entry.meal, food.name, entry.qty, food.unit, n.kcal, n.protein, n.carbs, n.fat]);
  }
  return toCsv(rows);
}

export function weightsCsv(weights) {
  const sorted = [...weights].sort((a, b) => compare(a.date, b.date));
  return toCsv([['date', 'kg'], ...sorted.map(weight => [weight.date, weight.kg])]);
}

export function recentFoods(entries, foods, today, days = 30) {
  const startDate = addDays(today, -(days - 1));
  const usage = new Map();
  for (const entry of entries) {
    if (entry.date < startDate || entry.date > today) continue;
    const current = usage.get(entry.foodId) ?? { count: 0, last: '' };
    current.count += 1;
    if (entry.date > current.last) current.last = entry.date;
    usage.set(entry.foodId, current);
  }
  const byName = (a, b) => compare(a.name.toLowerCase(), b.name.toLowerCase());
  const used = foods.filter(food => usage.has(food.id)).sort((a, b) => {
    const ua = usage.get(a.id);
    const ub = usage.get(b.id);
    return ub.count - ua.count || compare(ub.last, ua.last) || byName(a, b);
  });
  const rest = foods.filter(food => !usage.has(food.id)).sort(byName);
  return [...used, ...rest];
}

export function qtyStep(unit) {
  if (unit === 'g') return 25;
  if (unit === 'ml') return 50;
  return 1;
}

export function stepQty(qty, unit, direction) {
  const step = qtyStep(unit);
  const next = direction < 0 ? Math.max(step, qty - step) : qty + step;
  return rounded(next, 100);
}

export function needsWeighIn(weights, today) {
  return !weights.some(weight => weight.date === today);
}
