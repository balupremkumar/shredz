const numberWords = new Map([
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
].map((word, index) => [word, index + 1]));

const fillers = new Set(('i had have ate eaten just say ill also then plus and with of '
  + 'some the for my number it was that is').split(' '));

const units = new Map();
for (const [names, unit, factor] of [
  ['g gm gms gram grams', 'g', 1],
  ['kg kilo kilos', 'g', 1000],
  ['ml mls mil mils millilitre millilitres milliliter milliliters', 'ml', 1],
  ['l litre litres liter liters', 'ml', 1000],
  ['scoop scoops', 'scoop', 1],
]) {
  for (const name of names.split(' ')) units.set(name, { unit, factor });
}

function normalise(text) {
  return text.toLowerCase().replace(/&/g, ' and ')
    .replace(/[-'\u2019]/g, '')
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function squash(text) {
  return normalise(text).replace(/\s/g, '');
}

function quantityAt(tokens, start) {
  const word = tokens[start].word;
  const joined = /^(\d+(?:\.\d+)?)([a-z]+)$/.exec(word);
  if (joined && units.has(joined[2])) {
    return { start, end: start + 1, value: Number(joined[1]), spoken: units.get(joined[2]) };
  }
  let value = numberWords.get(word);
  let end = start + 1;
  if (/^\d+(?:\.\d+)?$/.test(word)) value = Number(word);
  if (word === 'a' || word === 'an') value = 1;
  if (word === 'half') {
    value = 0.5;
    if (tokens[end]?.word === 'a') end += 1;
  }
  if (value === undefined) return null;
  const spoken = units.get(tokens[end]?.word);
  if (spoken) end += 1;
  return { start, end, value, spoken };
}

function parseMeal(text, meal, foods, savedMeals, result) {
  const tokens = Array.from(text.matchAll(/\S+/g), match => ({
    word: match[0], start: match.index, end: match.index + match[0].length,
  }));
  const raw = (start, end) => text.slice(tokens[start].start, tokens[end - 1].end);
  const labels = Array(tokens.length).fill(null);
  const candidates = [];
  foods.forEach((food, order) => {
    const names = new Set([food.name, ...(food.aliases ?? [])].map(squash));
    for (let start = 0; start < tokens.length; start += 1) {
      let name = '';
      for (let end = start + 1; end <= Math.min(start + 4, tokens.length); end += 1) {
        name += tokens[end - 1].word;
        if (names.has(name)) candidates.push({ start, end, food, order, length: name.length });
      }
    }
  });
  savedMeals.forEach((savedMeal, index) => {
    const names = new Set([savedMeal.name, ...(savedMeal.aliases ?? [])].map(squash));
    const order = foods.length + index;
    for (let start = 0; start < tokens.length; start += 1) {
      let name = '';
      for (let end = start + 1; end <= Math.min(start + 4, tokens.length); end += 1) {
        name += tokens[end - 1].word;
        if (names.has(name)) candidates.push({ start, end, savedMeal, order, length: name.length });
      }
    }
  });
  // Resolve overlapping aliases by longest name, then text order and fixture order.
  candidates.sort((a, b) => b.length - a.length || a.start - b.start || a.order - b.order);
  const mentions = [];
  for (const candidate of candidates) {
    if (labels.slice(candidate.start, candidate.end).some(Boolean)) continue;
    labels.fill('food', candidate.start, candidate.end);
    mentions.push(candidate);
  }
  mentions.sort((a, b) => a.start - b.start);

  const quantities = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (labels[index]) continue;
    const quantity = quantityAt(tokens, index);
    if (quantity && !labels.slice(index, quantity.end).some(Boolean)) {
      quantities.push(quantity);
      labels.fill('quantity', index, quantity.end);
      index = quantity.end - 1;
    } else if (fillers.has(tokens[index].word)) labels[index] = 'filler';
  }
  const clear = (start, end) => !labels.slice(start, end).includes(null);
  for (const quantity of quantities) {
    // Keep a number introducing unknown food words with those words.
    let following = quantity.end;
    while (tokens[following]?.word === 'of' || tokens[following]?.word === 'the') following += 1;
    if (following < tokens.length && labels[following] === null) continue;
    const before = mentions.filter(mention => mention.end <= quantity.start).at(-1);
    const after = mentions.find(mention => mention.start >= quantity.end);
    let target;
    // A unit quantity after a saved meal belongs to a following food, not the saved meal.
    const unitForNextFood = before?.savedMeal && quantity.spoken && after?.food;
    if (before && !before.quantity && !unitForNextFood && clear(before.end, quantity.start)) target = before;
    else if (after && !after.quantity && clear(quantity.end, after.start)) target = after;
    if (target) {
      target.quantity = quantity;
      labels.fill('used', quantity.start, quantity.end);
    }
  }

  const explicitIds = new Set(mentions.filter(mention => mention.food && mention.quantity).map(mention => mention.food.id));
  const items = [];
  for (const mention of mentions) {
    const { food, quantity, savedMeal } = mention;
    if (savedMeal) {
      let multiplier = 1;
      if (quantity?.spoken) {
        result.warnings.push({ meal, foodId: null,
          message: `Spoken unit ${raw(quantity.start, quantity.end)} ignored for saved meal ${savedMeal.name}.` });
      } else if (quantity) multiplier = quantity.value;
      const span = raw(Math.min(mention.start, quantity?.start ?? mention.start),
        Math.max(mention.end, quantity?.end ?? mention.end));
      for (const item of savedMeal.items ?? []) {
        const itemFood = foods.find(candidate => candidate.id === item.foodId);
        if (!itemFood) {
          result.warnings.push({ meal, foodId: null,
            message: `Saved meal ${savedMeal.name} skipped ${item.foodId}: food not found.` });
          continue;
        }
        items.push({ foodId: item.foodId, qty: item.qty * multiplier, unit: itemFood.unit,
          raw: span, savedMealId: savedMeal.id });
      }
      continue;
    }
    if (!quantity && explicitIds.has(food.id)) continue;
    let qty = food.defaultQty;
    if (quantity) {
      qty = quantity.value;
      if (quantity.spoken) {
        const massOrVolume = unit => unit === 'g' || unit === 'ml';
        if (quantity.spoken.unit === food.unit
          || (massOrVolume(quantity.spoken.unit) && massOrVolume(food.unit))) {
          qty *= quantity.spoken.factor;
        } else {
          result.warnings.push({ meal, foodId: food.id,
            message: `Spoken unit ${raw(quantity.start, quantity.end)} did not match food unit ${food.unit}.` });
        }
      }
    }
    items.push({ foodId: food.id, qty, unit: food.unit,
      raw: raw(Math.min(mention.start, quantity?.start ?? mention.start),
        Math.max(mention.end, quantity?.end ?? mention.end)) });
  }
  if (items.length) result.meals.push({ meal, items });
  for (let start = 0; start < tokens.length;) {
    if (labels[start] !== null && labels[start] !== 'quantity') { start += 1; continue; }
    let end = start + 1;
    while (end < tokens.length && (labels[end] === null || labels[end] === 'quantity')) end += 1;
    result.unmatched.push({ meal, raw: raw(start, end) });
    start = end;
  }
}

/** Parse dictated meals without changing the supplied food catalogue. */
export function parseDictation(text, foods, { defaultMeal = 1, savedMeals = [] } = {}) {
  let normalised = normalise(text);
  const saveSuffix = /(?:^| )(?:save(?: it)?|saved)$/;
  const save = saveSuffix.test(normalised);
  if (save) normalised = normalised.replace(saveSuffix, '').trim();
  const result = { meals: [], unmatched: [], warnings: [], save };
  const segments = new Map();
  const append = (meal, content) => {
    if (!segments.has(meal)) segments.set(meal, []);
    segments.get(meal).push(content);
  };
  const markers = /\bmeal\s+(?:(?:number|no)\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/g;
  let meal = defaultMeal;
  let start = 0;
  for (const marker of normalised.matchAll(markers)) {
    append(meal, normalised.slice(start, marker.index).trim());
    meal = numberWords.get(marker[1]) ?? Number(marker[1]);
    start = marker.index + marker[0].length;
  }
  append(meal, normalised.slice(start).trim());
  for (const [number, chunks] of segments) {
    parseMeal(chunks.filter(Boolean).join(' '), number, foods, savedMeals, result);
  }
  result.meals.sort((a, b) => a.meal - b.meal);
  return result;
}
