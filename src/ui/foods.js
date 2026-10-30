import { h } from './dom.js';
import { formatKcal, formatMacro, formatQty, parseNumber } from '../format.js';

export function render(root, app) {
  const foods = app.select.foods();
  root.appendChild(h('p', { class: 'muted', text: 'Your foods. Dictation matches these names.' }));
  if (!foods.length) {
    root.appendChild(h('p', { class: 'empty', text: 'No foods yet. Add the foods you eat most and dictation will recognise them.' }));
    return;
  }
  root.appendChild(h('div', { class: 'list' }, foods.map(food =>
    h('button', {
      class: 'row', attrs: { type: 'button' },
      on: { click: () => app.actions.openSheet('food-edit', { id: food.id }) },
    }, h('span', { class: 'row__body' },
      h('span', { class: 'row__name', text: food.name }),
      h('span', { class: 'row__qty', text: `per ${formatQty(food.baseQty, food.unit)}: ${formatKcal(food.kcal)} kcal, P ${formatMacro(food.protein)} C ${formatMacro(food.carbs)} F ${formatMacro(food.fat)}` }),
    )),
  )));
}

export function dock(root, app) {
  root.appendChild(h('button', {
    class: 'pill pill--primary pill--block', text: 'Add food', attrs: { type: 'button' },
    on: { click: () => app.actions.openSheet('food-edit', {}) },
  }));
}

function foodEdit(root, app, props = {}) {
  const food = props.id ? app.select.foods().find(item => item.id === props.id) : null;
  const problem = h('p', { class: 'problem-line', attrs: { role: 'alert', hidden: true } });
  function showProblem(message, input) {
    problem.textContent = message;
    problem.hidden = false;
    if (input) input.focus();
  }
  function finish() {
    if (props.returnTo) app.actions.openSheet(props.returnTo.name, props.returnTo.props);
    else app.actions.closeSheet();
  }
  root.appendChild(h('div', { class: 'sheet__head' },
    h('h2', { text: props.id ? 'Edit food' : 'New food' }),
    h('button', { class: 'link-btn', text: 'Cancel', attrs: { type: 'button' }, on: { click: finish } }),
  ));
  if (props.id && !food) {
    showProblem('This food is no longer available.');
    root.appendChild(h('div', { class: 'sheet__body' }, problem));
    return;
  }

  const inputs = {};
  function field(key, label, value, attrs = {}) {
    const input = h('input', { class: 'input', attrs: {
      id: `food-edit-${key}`, type: 'text', value, enterkeyhint: 'done', ...attrs,
    } });
    inputs[key] = input;
    return h('div', { class: 'field' },
      h('label', { class: 'field__label', text: label, attrs: { for: `food-edit-${key}` } }), input,
    );
  }
  const initialUnit = food?.unit || 'g';
  const amountFor = unit => unit === 'g' || unit === 'ml' ? 100 : 1;
  const unit = h('select', { class: 'select', attrs: { id: 'food-edit-unit' } },
    [['g', 'grams'], ['ml', 'millilitres'], ['item', 'items'], ['scoop', 'scoops']].map(([value, text]) =>
      h('option', { text, attrs: { value, selected: value === initialUnit } })),
  );
  const numericFields = [
    ['baseQty', 'Nutrition per', food?.baseQty ?? amountFor(initialUnit), true],
    ['kcal', 'Calories', food?.kcal ?? 0, false],
    ['protein', 'Protein (g)', food?.protein ?? 0, false],
    ['carbs', 'Carbs (g)', food?.carbs ?? 0, false],
    ['fat', 'Fat (g)', food?.fat ?? 0, false],
    ['defaultQty', 'Usual amount', food?.defaultQty ?? amountFor(initialUnit), true],
  ];
  const form = h('form', {
    class: 'sheet__body', attrs: { id: 'food-edit-form', novalidate: true },
    on: { submit: save },
  },
  field('name', 'Name', food?.name ?? props.name ?? ''),
  h('div', { class: 'field' },
    h('label', { class: 'field__label', text: 'Unit', attrs: { for: 'food-edit-unit' } }), unit),
  numericFields.map(([key, label, value]) => field(key, label, value, { inputmode: 'decimal' })),
  field('aliases', 'Other names you might say', (food?.aliases || []).join(', '), { placeholder: 'weetbix, wheat bix' }),
  problem);

  // Existing quantities are deliberate; new defaults follow the unit until edited.
  let baseEdited = Boolean(food);
  let usualEdited = Boolean(food);
  inputs.baseQty.addEventListener('input', () => { baseEdited = true; });
  inputs.defaultQty.addEventListener('input', () => { usualEdited = true; });
  unit.addEventListener('change', () => {
    if (!baseEdited) inputs.baseQty.value = String(amountFor(unit.value));
    if (!usualEdited) inputs.defaultQty.value = String(amountFor(unit.value));
  });

  let busy = false;
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const name = inputs.name.value.trim();
    if (!name) {
      showProblem('Name is required.', inputs.name);
      return;
    }
    const values = {};
    for (const [key, label, , positive] of numericFields) {
      const value = parseNumber(inputs[key].value);
      if (value === null || (positive ? value <= 0 : value < 0)) {
        showProblem(`${label} must be ${positive ? 'greater than 0' : '0 or more'}.`, inputs[key]);
        return;
      }
      values[key] = value;
    }
    busy = true;
    const result = await app.actions.saveFood({
      ...(food || {}), name, unit: unit.value, ...values,
      aliases: inputs.aliases.value.split(',').map(alias => alias.trim()).filter(Boolean),
    });
    busy = false;
    if (!result.ok) {
      showProblem(result.error);
      return;
    }
    app.toast(`Saved ${name}`);
    finish();
  }

  const footer = h('div', { class: 'sheet__foot' },
    h('button', { class: 'pill pill--primary pill--block', text: 'Save', attrs: { type: 'submit', form: 'food-edit-form' } }),
  );
  if (food) footer.appendChild(h('button', {
    class: 'pill pill--danger pill--block', text: 'Delete food', attrs: { type: 'button' },
    on: { click: async () => {
      if (busy) return;
      busy = true;
      const result = await app.actions.deleteFood(food.id);
      busy = false;
      if (!result.ok) {
        showProblem("This food is in your diary, so it can't be deleted.");
        return;
      }
      finish();
    } },
  }));
  root.appendChild(form);
  root.appendChild(footer);
  if (!food) inputs.name.focus();
}

export const sheets = { 'food-edit': foodEdit };
