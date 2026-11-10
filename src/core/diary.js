const nutrients = ['kcal', 'protein', 'carbs', 'fat'];

export function nutritionFor(food, qty) {
  return Object.fromEntries(nutrients.map(key => [key, food[key] * qty / food.baseQty]));
}

function rounded(value, factor) {
  const result = Math.round(value * factor) / factor;
  return Object.is(result, -0) ? 0 : result;
}

export function roundTotals(t) {
  return Object.fromEntries(nutrients.map(key => [key, rounded(t[key], key === 'kcal' ? 1 : 10)]));
}

function totalsFor(entries, foodsById) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let missing = 0;
  for (const entry of entries) {
    const food = Object.hasOwn(foodsById, entry.foodId) ? foodsById[entry.foodId] : null;
    if (!food) {
      missing += 1;
      continue;
    }
    const nutrition = nutritionFor(food, entry.qty);
    for (const key of nutrients) totals[key] += nutrition[key];
  }
  return { ...roundTotals(totals), missing };
}

export function mealTotals(entries, foodsById, date, meal) {
  return totalsFor(entries.filter(entry => entry.date === date && entry.meal === meal), foodsById);
}

export function dayTotals(entries, foodsById, date) {
  return totalsFor(entries.filter(entry => entry.date === date), foodsById);
}

export function dayView(entries, foodsById, date) {
  const dayEntries = entries.filter(entry => entry.date === date);
  const mealNumbers = [...new Set(dayEntries.map(entry => entry.meal))].sort((a, b) => a - b);
  const meals = mealNumbers.map(meal => {
    const mealEntries = dayEntries.filter(entry => entry.meal === meal);
    return {
      meal,
      entries: mealEntries.map(entry => {
        const food = Object.hasOwn(foodsById, entry.foodId) ? foodsById[entry.foodId] : null;
        return { ...entry, food, nutrition: food ? roundTotals(nutritionFor(food, entry.qty)) : null };
      }),
      totals: totalsFor(mealEntries, foodsById),
    };
  });
  return { date, meals, totals: totalsFor(dayEntries, foodsById) };
}

export function remaining(goals, totals) {
  return roundTotals(Object.fromEntries(nutrients.map(key => [key, goals[key] - totals[key]])));
}

export function nextMealNumber(entries, date) {
  return entries.reduce((highest, entry) => entry.date === date ? Math.max(highest, entry.meal) : highest, 0) + 1;
}

export function copyMeal(entries, { fromDate, fromMeal, toDate, toMeal }, makeId) {
  const copies = entries.filter(entry => entry.date === fromDate && entry.meal === fromMeal)
    .map(entry => ({ ...entry, id: makeId(), date: toDate, meal: toMeal }));
  return [...entries, ...copies];
}

export function copyDay(entries, { fromDate, toDate }, makeId) {
  const copies = entries.filter(entry => entry.date === fromDate)
    .map(entry => ({ ...entry, id: makeId(), date: toDate }));
  return [...entries, ...copies];
}

export function lastLoggedDate(entries, beforeDate) {
  return entries.reduce((latest, entry) =>
    entry.date < beforeDate && (latest === null || entry.date > latest) ? entry.date : latest, null);
}

export function upsertWeight(weights, date, kg) {
  if (!Number.isFinite(kg) || kg <= 0 || kg >= 500) {
    throw new RangeError('Weight must be a finite number greater than 0 and under 500 kg');
  }
  return [...weights.filter(weight => weight.date !== date).map(weight => ({ ...weight })), { date, kg }]
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

export function weightChange(weights, date, days) {
  const current = weights.find(weight => weight.date === date);
  if (!current) return null;
  const cutoff = new Date(`${date}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const previous = weights.reduce((latest, weight) =>
    weight.date <= cutoffDate && (latest === null || weight.date > latest.date) ? weight : latest, null);
  return previous ? rounded(current.kg - previous.kg, 10) : null;
}
