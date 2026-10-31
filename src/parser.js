const numberWords = new Map([
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
].map((word, index) => [word, index + 1]));

for (const [word, value] of Object.entries({ thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, zero: 0 })) numberWords.set(word, value);

const fillers = new Set(('i had have ate eaten just say ill also then plus and with of '
  + 'some the for my number it was that is please on make').split(' '));

const units = new Map();
for (const [names, unit, factor] of [
  ['g gm gms gram grams', 'g', 1],
  ['kg kilo kilos', 'g', 1000],
  ['ml mls mil mils mills millilitre millilitres milliliter milliliters', 'ml', 1],
  ['l litre litres liter liters', 'ml', 1000],
  ['scoop scoops', 'scoop', 1],
  ['serving servings serve serves', 'serving', 1],
  ['slice slices piece pieces', 'item', 1],
]) {
  for (const name of names.split(' ')) units.set(name, { unit, factor });
}

function normalise(text) {
  return text.toLowerCase().replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/[?!]/g, ' , ').replace(/&/g, ' and ').replace(/-(?!\d)|['\u2019]/g, '')
    .replace(/[^\p{L}\p{N}\s.,-]/gu, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' , ')
    .replace(/,/g, ' , ').replace(/\b(?:actually|no wait|scratch that|sorry)\b/g, ' correction ')
    .replace(/\s+/g, ' ').trim();
}

function squash(text) {
  return normalise(text).replace(/[\s,]/g, '');
}

function stem(word) {
  return word.endsWith('ies') ? word.slice(0, -3) + 'y'
    : word.endsWith('oes') ? word.slice(0, -2)
      : word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i += 1) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j += 1) {
      next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] !== b[j])));
    }
    row = next;
  }
  return row[b.length];
}

function quantityAt(tokens, start) {
  const word = tokens[start].word;
  const at = i => tokens[i]?.word;
  const joined = /^(-?\d+(?:\.\d+)?)([a-z]+)$/.exec(word);
  if (joined && units.has(joined[2])) {
    return { start, end: start + 1, value: Number(joined[1]), spoken: units.get(joined[2]) };
  }
  let value;
  let end = start;
  if (/^-?\d+(?:\.\d+)?$/.test(word)) { value = Number(word); end += 1; }
  else if (word === 'half') {
    value = 0.5; end += 1;
    if (at(end) === 'a' || at(end) === 'an') end += 1;
    if (at(end) === 'dozen') { value = 6; end += 1; }
  } else if ((word === 'a' && at(start + 1) === 'couple') || word === 'couple') {
    value = 2; end += word === 'a' ? 2 : 1;
    if (at(end) === 'of') end += 1;
  } else {
    let group = 0;
    let total = 0;
    while (end < tokens.length) {
      const w = at(end);
      const n = numberWords.get(w) ?? ((w === 'a' || w === 'an') ? 1 : undefined);
      if (n !== undefined) {
        if (end > start && n >= 10 && group % 100 !== 0) break;
        if (end > start && n < 10 && group % 10 !== 0) break;
        group += n;
      } else if (w === 'hundred') group = (group || 1) * 100;
      else if (w === 'thousand') { total += (group || 1) * 1000; group = 0; }
      else if (w === 'dozen') group = (group || 1) * 12;
      else if (w === 'and' && end > start && (numberWords.has(at(end + 1)) && group >= 100)) { end += 1; continue; }
      else break;
      end += 1;
    }
    if (end > start) value = total + group;
  }
  if (value === undefined) return null;
  if (at(end) === 'and' && at(end + 1) === 'a' && at(end + 2) === 'half') { value += 0.5; end += 3; }
  if (at(end) === 'point' && (numberWords.has(at(end + 1)) || /^\d$/.test(at(end + 1)))) {
    value += Number(numberWords.get(at(end + 1)) ?? at(end + 1)) / 10; end += 2;
  }
  const spoken = units.get(at(end));
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
      if (units.has(tokens[start].word)) continue;
      let name = '';
      for (let end = start + 1; end <= Math.min(start + 4, tokens.length); end += 1) {
        if (tokens[end - 1].word === ',' || tokens[end - 1].word === 'and') break;
        name += tokens[end - 1].word;
        const singular = tokens.slice(start, end).map(t => stem(t.word)).join('');
        if (names.has(name) || [...names].some(n => stem(n) === singular)) candidates.push({ start, end, food, order, length: name.length });
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
  // Fuzzy spans may extend an exact alias of the same food, never a different food.
  const exact = candidates.filter(c => !candidates.some(other => other.length > c.length && other.start <= c.start && other.end >= c.end));
  foods.forEach((food, order) => {
    const names = [food.name, ...(food.aliases ?? [])].map(squash);
    for (let start = 0; start < tokens.length; start += 1) {
      let name = '';
      for (let end = start + 1; end <= Math.min(start + 4, tokens.length); end += 1) {
        const word = tokens[end - 1].word;
        if (['a', 'an', 'half', 'couple', 'dozen'].includes(word) || !/^[a-z]+$/.test(word) || fillers.has(word) || units.has(word) || numberWords.has(word) || word === 'correction') break;
        name += word;
        if (exact.some(c => c.start < end && c.end > start && c.food !== food)) continue;
        if (name.length < 5) continue;
        if (names.some(n => Math.abs(n.length - name.length) <= 3 && distance(n, name) <= (Math.max(n.length, name.length) >= 8 ? Math.ceil(Math.max(n.length, name.length) * 0.25) : Math.floor(Math.max(n.length, name.length) * 0.25)))) {
          candidates.push({ start, end, food, order, length: name.length, fuzzy: true });
        }
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
  for (let i = mentions.length - 1; i > 0; i -= 1) {
    const previous = mentions[i - 1];
    if (previous.food && previous.food === mentions[i].food && previous.end === mentions[i].start) {
      previous.end = mentions[i].end;
      mentions.splice(i, 1);
    }
  }

  const quantities = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (labels[index]) continue;
    const quantity = quantityAt(tokens, index);
    if (quantity && !labels.slice(index, quantity.end).some(Boolean)) {
      quantities.push(quantity);
      labels.fill('quantity', index, quantity.end);
      index = quantity.end - 1;
    } else if (fillers.has(tokens[index].word) || tokens[index].word === ',' || tokens[index].word === 'and' || tokens[index].word === 'correction') labels[index] = 'filler';
  }
  const clear = (start, end) => !labels.slice(start, end).includes(null)
    && !labels.slice(start, end).includes('food');
  const compatible = (q, m) => !q.spoken || (m.food && (q.spoken.unit === 'serving'
    || q.spoken.unit === m.food.unit || (['g', 'ml'].includes(q.spoken.unit) && ['g', 'ml'].includes(m.food.unit))));
  const separators = (start, end) => tokens.slice(start, end).filter(t => t.word === ',' || t.word === 'and').length;
  // Unit quantities reserve their foods before bare numbers claim the remaining neighbour.
  for (const quantity of [...quantities].sort((a, b) => Number(Boolean(b.spoken)) - Number(Boolean(a.spoken)) || a.start - b.start)) {
    const before = mentions.filter(m => m.end <= quantity.start).at(-1);
    const after = mentions.find(m => m.start >= quantity.end);
    const correction = before && tokens.slice(before.end, quantity.start).some(t => t.word === 'correction');
    const forward = tokens[quantity.end]?.word === 'of';
    let following = quantity.end;
    while (['of', 'the'].includes(tokens[following]?.word)) following += 1;
    if (labels[following] === null && (forward || !before || separators(before.end, quantity.start))) continue;
    if (quantity.start > 0 && labels[quantity.start - 1] === null) continue;
    const options = [before, after].filter(m => m && (!m.quantity || (m === before && correction))
      && clear(Math.min(m.end, quantity.end), Math.max(m.start, quantity.start)));
    options.sort((a, b) => {
      const score = m => (compatible(quantity, m) ? 0 : 100)
        + ((forward || (correction && after?.food === before?.food)) && m === before ? 20 : 0)
        + separators(m === before ? m.end : quantity.end, m === before ? quantity.start : m.start) * 3
        + (m === after ? 1 : 0);
      return score(a) - score(b);
    });
    const target = options[0];
    if (target) {
      if (correction) {
        for (const earlier of quantities.filter(q => q.start >= before.end && q.end <= quantity.start)) labels.fill('used', earlier.start, earlier.end);
      }
      target.quantity = quantity;
      labels.fill('used', quantity.start, quantity.end);
    }
  }
  // A repeated food after a correction replaces its earlier mention.
  for (let i = 1; i < mentions.length; i += 1) {
    const current = mentions[i];
    const previous = mentions[i - 1];
    if (current.food === previous.food && tokens.slice(previous.end, current.start).some(t => t.word === 'correction')) previous.replaced = true;
  }

  // Keep an unused amount and its unknown food in a single leftover span.
  for (const q of quantities) {
    if (labels[q.start] !== 'quantity') continue;
    let end = q.end;
    while (['of', 'the'].includes(tokens[end]?.word)) end += 1;
    if (labels[end] === null) labels.fill(null, q.end, end);
  }

  const explicitIds = new Set(mentions.filter(mention => mention.food && mention.quantity).map(mention => mention.food.id));
  const items = [];
  const validQty = (qty, foodId) => {
    if (Number.isFinite(qty) && qty > 0 && qty <= 1e6) return true;
    result.warnings.push({ meal, foodId, message: 'Quantity must be greater than 0 and at most 1000000.' });
    return false;
  };
  for (const mention of mentions) {
    const { food, quantity, savedMeal } = mention;
    if (mention.replaced) continue;
    if (quantity && !validQty(quantity.value, food?.id ?? null)) continue;
    if (savedMeal) {
      let multiplier = 1;
      if (quantity?.spoken) {
        result.warnings.push({ meal, foodId: null,
          message: `Spoken unit ${raw(quantity.start, quantity.end)} ignored for saved meal ${savedMeal.name}.` });
      } else if (quantity) multiplier = quantity.value;
      if (!validQty(multiplier, null)) continue;
      const span = raw(Math.min(mention.start, quantity?.start ?? mention.start),
        Math.max(mention.end, quantity?.end ?? mention.end));
      for (const item of savedMeal.items ?? []) {
        const itemFood = foods.find(candidate => candidate.id === item.foodId);
        if (!itemFood) {
          result.warnings.push({ meal, foodId: null,
            message: `Saved meal ${savedMeal.name} skipped ${item.foodId}: food not found.` });
          continue;
        }
        const qty = item.qty * multiplier;
        if (!validQty(qty, item.foodId)) continue;
        items.push({ foodId: item.foodId, qty, unit: itemFood.unit,
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
        if (quantity.spoken.unit === 'serving') {
          qty *= massOrVolume(food.unit) ? food.defaultQty : 1;
        } else if (quantity.spoken.unit === food.unit
          || (massOrVolume(quantity.spoken.unit) && massOrVolume(food.unit))) {
          qty *= quantity.spoken.factor;
        } else {
          result.warnings.push({ meal, foodId: food.id,
            message: `Spoken unit ${raw(quantity.start, quantity.end)} did not match food unit ${food.unit}.` });
        }
      }
    }
    if (!validQty(qty, food.id)) continue;
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
  let normalised = normalise(text).replace(/(?:\s*,\s*)+$/g, '').trim();
  const saveSuffix = /(?:^| )(?:save(?: it)?|saved)$/;
  const save = saveSuffix.test(normalised);
  if (save) normalised = normalised.replace(saveSuffix, '').trim();
  const result = { meals: [], unmatched: [], warnings: [], save };
  const segments = new Map();
  const append = (meal, content) => {
    if (!segments.has(meal)) segments.set(meal, []);
    segments.get(meal).push(content);
  };
  const markers = new RegExp(`\\bmeal\\s+(?:(?:number|no)\\s+)?(-?\\d+|${[...numberWords.keys()].join('|')}|to|too)\\b`, 'g');
  if (!Number.isInteger(defaultMeal) || defaultMeal < 1 || defaultMeal > 20) {
    result.warnings.push({ meal: 1, foodId: null, message: 'Default meal must be from 1 to 20. Using meal 1.' });
    defaultMeal = 1;
  }
  let meal = defaultMeal;
  let start = 0;
  for (const marker of normalised.matchAll(markers)) {
    append(meal, normalised.slice(start, marker.index).trim());
    meal = ['to', 'too'].includes(marker[1]) ? 2 : numberWords.get(marker[1]) ?? Number(marker[1]);
    if (meal < 1 || meal > 20) {
      result.warnings.push({ meal: defaultMeal, foodId: null, message: `Meal ${marker[1]} must be from 1 to 20. Using meal ${defaultMeal}.` });
      meal = defaultMeal;
    }
    start = marker.index + marker[0].length;
  }
  append(meal, normalised.slice(start).trim());
  for (const [number, chunks] of segments) {
    parseMeal(chunks.filter(Boolean).join(' '), number, foods, savedMeals, result);
  }
  result.meals.sort((a, b) => a.meal - b.meal);
  return result;
}
