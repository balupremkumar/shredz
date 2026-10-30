import { h, clear, icon } from './dom.js';
import { dayLabel, localDate, formatKcal, formatMacro, formatKg, formatChange,
  formatQty, parseNumber } from '../format.js';

function button(text, className, click) {
  return h('button', { class: className, text, attrs: { type: 'button' }, on: { click } });
}

function problem() {
  return h('p', { class: 'problem-line', attrs: { role: 'alert', hidden: true } });
}

// Keep pending taps local too; writes cause the shell to replace these nodes.
async function submit(control, work, app, success, errorLine) {
  if (control.disabled) return;
  control.disabled = true;
  const result = await work();
  control.disabled = false;
  if (!result.ok) {
    if (errorLine) {
      errorLine.textContent = result.error;
      errorLine.hidden = false;
    } else app.toast(result.error);
    return;
  }
  success(result);
}

function copy(control, work, app, close = false) {
  return submit(control, work, app, result => {
    if (close) app.actions.closeSheet();
    app.toast(`Copied ${result.added} items, ${formatKcal(result.kcal)} kcal`);
  });
}

function weighIn(root, app, day) {
  const host = h('div');
  root.appendChild(host);
  function edit(focus = false) {
    clear(host);
    const errorLine = problem();
    const input = h('input', { class: 'input weigh-in__input', attrs: {
      id: 'diary-weight', type: 'text', inputmode: 'decimal', enterkeyhint: 'done',
      'aria-label': 'Morning weight in kg', placeholder: 'kg',
      value: day.weight !== null ? formatKg(day.weight)
        : day.lastWeight !== null ? formatKg(day.lastWeight) : '',
    }, on: { focus: event => event.target.select() } });
    const save = button('Log', 'pill pill--primary', () => log());
    const log = () => submit(save, () => app.actions.logWeight(day.date, input.value),
      app, () => app.toast('Weight logged'), errorLine);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); log(); }
    });
    host.appendChild(h('div', { class: 'weigh-in' },
      h('label', { text: 'Morning weight', attrs: { for: 'diary-weight' } }), input,
      h('span', { text: 'kg' }), save));
    host.appendChild(errorLine);
    if (focus) { input.focus(); input.select(); }
  }
  if (day.weight === null) edit();
  else host.appendChild(h('button', { class: 'weigh-in weigh-in--done',
    attrs: { type: 'button' }, on: { click: () => edit(true) } },
  h('span', { class: 'muted', text: 'Morning weight' }),
  h('span', { class: 'weigh-in__value', text: `${formatKg(day.weight)} kg` }),
  day.weekChange !== null ? h('span', { class: 'weigh-in__meta',
    text: `${formatChange(day.weekChange)} this week` }) : null));
}

function copyDayButton(app, day, className) {
  const control = button(`Copy ${dayLabel(day.lastLoggedDate, localDate())}`, className,
    () => copy(control, () => app.actions.copyLastLoggedDay(day.date), app));
  return control;
}

export function render(root, app) {
  const day = app.select.day();
  weighIn(root, app, day);
  const summary = h('div', { class: 'summary' });
  const columns = [['Goal', day.goals.kcal], ['Food', day.totals.kcal], ['Remaining', day.remaining.kcal]];
  columns.forEach(([label, value], index) => {
    if (index) summary.appendChild(h('span', { class: 'summary__op', text: index === 1 ? '\u2212' : '=' }));
    const over = index === 2 && value < 0;
    summary.appendChild(h('div', { class: `summary__col${over ? ' macro--over' : ''}` },
      h('div', { class: `summary__num${index === 2 ? ' summary__num--remaining' : ''}${over ? ' macro__value' : ''}`,
        text: formatKcal(value) }), h('div', { class: 'summary__label', text: label })));
  });
  root.appendChild(summary);
  const macros = h('div', { class: 'macros' });
  for (const [key, label] of [['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']]) {
    const eaten = day.totals[key];
    const goal = day.goals[key];
    const fill = h('span', { class: 'macro__fill' });
    const ratio = goal > 0 ? eaten / goal : eaten > 0 ? 1 : 0;
    fill.style.width = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
    macros.appendChild(h('div', { class: `macro${eaten > goal ? ' macro--over' : ''}` },
      h('span', { class: 'macro__label', text: label }),
      h('span', { class: 'macro__value', text: `${formatMacro(eaten)} / ${formatMacro(goal).replace(/\.0$/, '')} g` }),
      h('div', { class: 'macro__bar' }, fill)));
  }
  root.appendChild(macros);
  if (!day.view.meals.length) root.appendChild(h('div', { class: 'empty' },
    h('p', { text: `Nothing logged for ${dayLabel(day.date, localDate())}.` }),
    day.lastLoggedDate ? copyDayButton(app, day, 'pill pill--primary') : null));
  for (const meal of day.view.meals) {
    const section = h('section', { class: 'section' },
      mealHead(meal.meal, meal.totals.kcal),
      h('p', { class: 'section__sub', text: `P ${formatMacro(meal.totals.protein)} \u00b7 C ${formatMacro(meal.totals.carbs)} \u00b7 F ${formatMacro(meal.totals.fat)} g` }));
    for (const entry of meal.entries) section.appendChild(h('button', { class: 'row',
      attrs: { type: 'button' }, on: { click: () => app.actions.openSheet('edit-entry', { id: entry.id }) } },
    h('span', { class: 'row__body' },
      h('span', { class: 'row__name', text: entry.food?.name ?? 'Unknown food' }),
      h('span', { class: 'row__qty', text: entry.food ? formatQty(entry.qty, entry.food.unit) : String(entry.qty) })),
    h('span', { class: 'row__kcal', text: entry.nutrition ? formatKcal(entry.nutrition.kcal) : '?' })));
    section.appendChild(h('div', { class: 'section__foot' }, addButton(app, meal.meal),
      button('Copy...', 'link-btn', () => app.actions.openSheet('copy-meal', { meal: meal.meal }))));
    root.appendChild(section);
  }
  const next = h('section', { class: 'section' }, mealHead(day.nextMeal));
  const foot = h('div', { class: 'section__foot' }, addButton(app, day.nextMeal));
  const previous = day.lastLoggedDate && app.select.day(day.lastLoggedDate).view.meals.find(meal => meal.meal === day.nextMeal);
  if (previous) {
    const control = button(`Copy Meal ${day.nextMeal} from ${dayLabel(day.lastLoggedDate, localDate())} (${formatKcal(previous.totals.kcal)} kcal)`,
      'link-btn', () => copy(control, () => app.actions.copyMeal({ fromDate: day.lastLoggedDate,
        fromMeal: day.nextMeal, toDate: day.date, toMeal: day.nextMeal }), app));
    foot.appendChild(control);
  }
  next.appendChild(foot);
  root.appendChild(next);
}

function mealHead(meal, kcal) {
  return h('div', { class: 'section__head' }, h('h2', { text: `Meal ${meal}` }),
    kcal === undefined ? null : h('span', { text: `${formatKcal(kcal)} kcal` }));
}

function addButton(app, meal) {
  return button('Add food', 'link-btn', () => app.actions.openSheet('add-food', { meal }));
}

export function dock(root, app) {
  const day = app.select.day();
  root.appendChild(h('button', { class: 'pill pill--primary', attrs: { type: 'button' },
    on: { click: () => app.actions.openSheet('dictate') } }, icon('mic'), 'Dictate'));
  if (!day.view.meals.length && day.lastLoggedDate) root.appendChild(copyDayButton(app, day, 'pill pill--secondary'));
}

function sheetBody(root, app, title) {
  root.appendChild(h('div', { class: 'sheet__head' }, h('h2', { text: title }),
    button('Cancel', 'link-btn', () => app.actions.closeSheet())));
  const body = h('div', { class: 'sheet__body' });
  root.appendChild(body);
  return body;
}

function quantity(body, food, initial, label, app, work, success) {
  clear(body);
  const input = h('input', { class: 'input', attrs: { type: 'text', inputmode: 'decimal',
    enterkeyhint: 'done', value: initial, 'aria-label': `Quantity in ${food.unit}` },
  on: { focus: event => event.target.select() } });
  const errorLine = problem();
  const save = button(label, 'pill pill--primary pill--block', () => saveQuantity());
  function saveQuantity() {
    const qty = parseNumber(input.value);
    if (qty === null || qty <= 0) {
      errorLine.textContent = 'Enter a quantity greater than 0.';
      errorLine.hidden = false;
      return;
    }
    submit(save, () => work(qty), app, success, errorLine);
  }
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); saveQuantity(); }
  });
  body.appendChild(h('h3', { text: food.name }));
  body.appendChild(h('label', { class: 'field' }, h('span', { class: 'field__label', text: `Quantity (${food.unit})` }), input));
  body.appendChild(errorLine);
  body.appendChild(save);
  input.focus();
  input.select();
  return errorLine;
}

function addFood(root, app, { meal }) {
  const date = app.state.date;
  const body = sheetBody(root, app, `Add to Meal ${meal}`);
  const foods = app.select.foods();
  if (!foods.length) {
    body.appendChild(h('p', { class: 'empty', text: 'No foods yet.' }));
    body.appendChild(button('Add a food', 'pill pill--primary', () => {
      const result = app.actions.setTab('foods');
      if (!result.ok) { app.toast(result.error); return; }
      app.actions.openSheet('food-edit', {});
    }));
    return;
  }
  const search = h('input', { class: 'input', attrs: { type: 'search', placeholder: 'Search foods',
    'aria-label': 'Search foods' }, on: { input: () => filter() } });
  const list = h('div');
  body.appendChild(search);
  body.appendChild(list);
  function filter() {
    clear(list);
    const query = search.value.trim().toLowerCase();
    const matches = foods.filter(food => [food.name, ...(food.aliases || [])]
      .some(name => name.toLowerCase().includes(query)));
    for (const food of matches) list.appendChild(h('button', { class: 'row', attrs: { type: 'button' },
      on: { click: () => quantity(body, food, food.defaultQty, 'Add', app,
        qty => app.actions.addItems(date, meal, [{ foodId: food.id, qty }]), () => {
          app.actions.closeSheet();
          app.toast(`Added ${food.name}`);
        }) } }, h('span', { class: 'row__body' },
    h('span', { class: 'row__name', text: food.name }),
    h('span', { class: 'row__qty', text: `per ${formatQty(food.baseQty, food.unit)}, ${formatKcal(food.kcal)} kcal` }))));
    if (!matches.length) list.appendChild(h('p', { class: 'empty', text: 'No matching foods.' }));
  }
  filter();
  search.focus();
}

function editEntry(root, app, { id }) {
  const body = sheetBody(root, app, 'Edit entry');
  const entry = app.select.day().view.meals.flatMap(meal => meal.entries).find(entry => entry.id === id);
  if (!entry) { body.appendChild(h('p', { class: 'empty', text: 'Entry no longer exists.' })); return; }
  const close = () => app.actions.closeSheet();
  let errorLine;
  if (entry.food) errorLine = quantity(body, entry.food, entry.qty, 'Save', app,
    qty => app.actions.updateEntryQty(id, qty), close);
  else {
    body.appendChild(h('p', { class: 'empty', text: 'Food no longer exists. Delete this entry and add another food.' }));
    errorLine = problem();
    body.appendChild(errorLine);
  }
  const remove = button('Delete', 'pill pill--danger pill--block', () =>
    submit(remove, () => app.actions.deleteEntry(id), app, close, errorLine));
  body.appendChild(remove);
}

function copyMeal(root, app, { meal }) {
  const date = app.state.date;
  const body = sheetBody(root, app, `Copy Meal ${meal} from`);
  const dates = [...new Set(app.state.data.entries.filter(entry => entry.date < date && entry.meal === meal)
    .map(entry => entry.date))].sort().reverse().slice(0, 7);
  for (const fromDate of dates) {
    const source = app.select.day(fromDate).view.meals.find(item => item.meal === meal);
    const control = button(`${dayLabel(fromDate, localDate())}, ${source.entries.length} items, ${formatKcal(source.totals.kcal)} kcal`,
      'row', () => copy(control, () => app.actions.copyMeal({ fromDate, fromMeal: meal, toDate: date, toMeal: meal }), app, true));
    body.appendChild(control);
  }
  if (!dates.length) body.appendChild(h('p', { class: 'empty', text: `No earlier Meal ${meal} to copy.` }));
}

export const sheets = { 'add-food': addFood, 'edit-entry': editEntry, 'copy-meal': copyMeal };
