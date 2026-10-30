import { h, clear } from './dom.js';
import { dayLabel, localDate, formatKcal, formatGrams, formatQty } from '../format.js';

let draft = '';
let suppliedText;

function button(text, className, click) {
  return h('button', { class: className, text, attrs: { type: 'button' }, on: { click } });
}

async function open(app, name, props) {
  const result = await app.actions.openSheet(name, props);
  if (!result.ok) app.toast(result.error);
}

function head(title, cancel) {
  return h('div', { class: 'sheet__head' },
    h('h2', { text: title }), button('Cancel', 'link-btn', cancel));
}

function hasItems(preview) {
  return preview.meals.some(meal => meal.items.length > 0);
}

function dictate(root, app, props = {}) {
  // A retained text prop must not overwrite edits on a shell re-render.
  if (props.text !== undefined && props.text !== suppliedText) {
    draft = props.text;
    suppliedText = props.text;
  }
  const live = h('div', { attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' } });
  const save = button('Save', 'pill pill--primary pill--block', () => open(app, 'confirm', { text: draft }));
  function updateLive(preview) {
    clear(live);
    for (const line of preview.lines) {
      live.appendChild(h('div', { class: 'live-line' },
        h('span', { text: `Meal ${line.meal}` }),
        h('span', { text: `${line.count} ${line.count === 1 ? 'item' : 'items'}` }),
        h('span', { text: `${formatKcal(line.kcal)} kcal` })));
    }
    if (preview.unmatched.length) {
      live.appendChild(h('p', { class: 'problem-line',
        text: `${preview.unmatched.length} not recognised: ${preview.unmatched.map(item => item.raw).join(', ')}` }));
    }
    save.disabled = !hasItems(preview);
  }
  const textarea = h('textarea', { class: 'textarea', attrs: {
    'aria-label': 'What you ate', autocapitalize: 'sentences', autocorrect: 'off', spellcheck: 'false',
  }, on: { input: () => {
    draft = textarea.value;
    const preview = app.select.preview(draft);
    updateLive(preview);
    if (preview.save) open(app, 'confirm', { text: draft });
  } } });
  textarea.value = draft;
  updateLive(app.select.preview(draft));
  root.appendChild(head('Dictate', async () => {
    draft = '';
    suppliedText = undefined;
    const result = await app.actions.closeSheet();
    if (!result.ok) app.toast(result.error);
  }));
  root.appendChild(h('div', { class: 'sheet__body' },
    h('p', { class: 'muted', text: 'Tap the mic on your keyboard and say: meal one, 2 Weet-Bix, green milk 200 mils... then say save.' }),
    textarea, live));
  root.appendChild(h('div', { class: 'sheet__foot' }, save));
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

function foodName(raw) {
  return raw.replace(/^(?:(?:\d+(?:[.,]\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|half|a|an|grams?|g|kilograms?|kg|millilitres?|milliliters?|mils?|ml|litres?|liters?|l|items?|scoops?|of)\b[\s,.]*)+/i, '').trim();
}

function confirm(root, app, props = {}) {
  const text = props.text ?? draft;
  draft = text;
  suppliedText = text;
  const preview = app.select.preview(text);
  const foods = new Map(app.select.foods().map(food => [food.id, food]));
  const savedNames = new Map(app.select.savedMeals().map(saved => [saved.id, saved.name]));
  const edit = () => open(app, 'dictate', { text });
  const body = h('div', { class: 'sheet__body' });
  for (const meal of preview.meals) {
    const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const rows = meal.items.map(item => {
      const food = foods.get(item.foodId);
      const nutrition = {};
      for (const key of Object.keys(totals)) {
        nutrition[key] = food[key] * item.qty / food.baseQty;
        totals[key] += nutrition[key];
      }
      return h('div', { class: 'row' },
        h('div', { class: 'row__body' },
          h('div', { class: 'row__name', text: food.name }),
          h('span', { class: 'row__qty', text: formatQty(item.qty, food.unit)
            + (item.savedMealId && savedNames.has(item.savedMealId) ? ` from ${savedNames.get(item.savedMealId)}` : '') })),
        h('span', { class: 'row__kcal', text: `${formatKcal(nutrition.kcal)} kcal` }));
    });
    body.appendChild(h('section', { class: 'section' },
      h('div', { class: 'section__head' }, h('h3', { text: `Meal ${meal.meal}` }),
        h('span', { text: `${formatKcal(totals.kcal)} kcal` })),
      h('p', { class: 'section__sub', text: `Protein ${formatGrams(totals.protein)}, carbs ${formatGrams(totals.carbs)}, fat ${formatGrams(totals.fat)}` }),
      rows));
  }
  for (const item of preview.unmatched) {
    const word = foodName(item.raw);
    const row = h('div', { class: 'row row--problem' });
    const error = h('p', { class: 'problem-line' });
    error.hidden = true;
    function showActions() {
      clear(row);
      row.appendChild(h('div', { class: 'row__body' },
        h('div', { class: 'row__name', text: `Not recognised: ${item.raw}` }),
        button('Add as food', 'link-btn', () => open(app, 'food-edit', {
          name: word, returnTo: { name: 'confirm', props: { text } },
        })),
        button('This is...', 'link-btn', showPicker),
        button('Remove', 'link-btn', () => { row.hidden = true; error.hidden = true; })));
    }
    function showPicker() {
      clear(row);
      const select = h('select', { class: 'select', attrs: { 'aria-label': `Which food is ${word}?` } },
        h('option', { text: '', attrs: { value: '' } }),
        app.select.recentFoods().map(food => h('option', { text: food.name, attrs: { value: food.id } })));
      row.appendChild(h('div', { class: 'row__body' },
        select,
        button('Learn', 'pill pill--primary', async () => {
          if (!select.value) {
            error.textContent = 'Pick a food first';
            error.hidden = false;
            return;
          }
          const food = select.options[select.selectedIndex].textContent;
          const result = await app.actions.addAlias(select.value, word);
          if (!result.ok) {
            error.textContent = result.error;
            error.hidden = false;
            return;
          }
          app.toast(`Learned ${word} as ${food}`);
        }),
        button('Cancel', 'link-btn', () => { error.hidden = true; showActions(); })));
    }
    showActions();
    body.appendChild(row);
    body.appendChild(error);
  }
  for (const warning of preview.warnings) {
    body.appendChild(h('p', { class: 'problem-line', text: warning.message }));
  }
  const add = button(`Add ${formatKcal(preview.kcal)} kcal to ${dayLabel(app.state.date, localDate())}`,
    'pill pill--primary pill--block', async () => {
      if (add.disabled) return;
      add.disabled = true;
      const result = await app.actions.addParsed(app.state.date, preview);
      if (!result.ok) {
        add.disabled = !hasItems(preview);
        app.toast(result.error);
        return;
      }
      draft = '';
      suppliedText = undefined;
      const closed = await app.actions.closeSheet();
      if (!closed.ok) app.toast(closed.error);
      app.toast(`Added ${result.added} items, ${formatKcal(result.kcal)} kcal`);
    });
  add.disabled = !hasItems(preview);
  root.appendChild(head('Confirm', edit));
  root.appendChild(body);
  root.appendChild(h('div', { class: 'sheet__foot' }, add, button('Edit text', 'link-btn', edit)));
}

export const sheets = { dictate, confirm };
