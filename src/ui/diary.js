import { h, clear, icon, fieldAttrs } from './dom.js';
import { dayLabel, localDate, formatKcal, formatMacro, formatKg, formatChange,
  formatQty, parseNumber, addDays } from '../format.js';
import { nutritionFor } from '../diary.js';

export function ringArc({ eaten, goal, radius = 66 }) {
  const circumference = 2 * Math.PI * radius;
  const fraction = goal > 0 ? Math.min(1, eaten / goal) : 0;
  return { circumference, dash: circumference * fraction, gap: circumference, fraction, over: eaten > goal };
}

export function calorieLine({ goal, eaten }) {
  const left = goal - eaten;
  const over = left < 0;
  const centre = formatKcal(Math.abs(left));
  return { left, over, centre, caption: over ? 'kcal over' : 'kcal left',
    equation: `${formatKcal(goal)} goal \u2212 ${formatKcal(eaten)} eaten = ${centre} ${over ? 'over' : 'left'}` };
}

export function mealHeadText(totals) {
  return `${formatKcal(totals.kcal)} kcal \u00b7 ${Math.round(totals.protein)} g protein`;
}

export function quantityPreview(food, qty) {
  if (!Number.isFinite(qty) || qty <= 0) {
    return { kcal: null, protein: null, carbs: null, fat: null, text: '-' };
  }
  const values = nutritionFor(food, qty);
  return { ...values, text: `${formatKcal(values.kcal)} kcal \u00b7 ${formatMacro(values.protein)} g protein \u00b7 ${formatMacro(values.carbs)} g carbs \u00b7 ${formatMacro(values.fat)} g fat` };
}

export function quickAmounts(unit) {
  return unit === 'item' || unit === 'scoop' ? [0.5, 1, 2, 3] : [50, 100, 150, 200];
}

function calorieRing(eaten, goal) {
  const arc = ringArc({ eaten, goal });
  const line = calorieLine({ eaten, goal });
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 150 150');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const progress of [false, true]) {
    const circle = document.createElementNS(ns, 'circle');
    const attrs = { cx: 75, cy: 75, r: 66, fill: 'none', 'stroke-width': 14,
      stroke: progress ? (arc.over ? 'var(--red)' : 'var(--accent)') : 'var(--track)' };
    if (progress) Object.assign(attrs, { 'stroke-linecap': arc.fraction > 0 ? 'round' : 'butt',
      'stroke-dasharray': `${arc.dash} ${arc.gap}`, opacity: arc.fraction > 0 ? 1 : 0 });
    for (const [key, value] of Object.entries(attrs)) circle.setAttribute(key, String(value));
    svg.appendChild(circle);
  }
  const value = h('div', { class: 'ring__value', text: line.centre });
  if (line.over) value.style.color = 'var(--red)';
  return h('div', { class: 'ring' }, svg, h('div', { class: 'ring__centre' }, value,
    h('div', { class: 'ring__label', text: line.caption })));
}

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
      ...fieldAttrs('number'), id: 'diary-weight',
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

function copyDayButton(app, day) {
  const label = day.lastLoggedDate === addDays(day.date, -1) ? 'Copy yesterday'
    : `Copy ${dayLabel(day.lastLoggedDate, localDate())}`;
  const control = button('', 'row',
    () => copy(control, () => app.actions.copyLastLoggedDay(day.date), app));
  const previous = app.select.day(day.lastLoggedDate);
  const count = previous.view.meals.reduce((sum, meal) => sum + meal.entries.length, 0);
  control.appendChild(h('span', { class: 'row__body' },
    h('span', { class: 'row__name', text: label }),
    h('span', { class: 'row__qty', text: `${count} items \u00b7 ${formatKcal(previous.totals.kcal)} kcal` })));
  return control;
}

export function render(root, app) {
  const day = app.select.day();
  const summary = h('div', { class: 'summary' }, calorieRing(day.totals.kcal, day.goals.kcal));
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
  summary.appendChild(macros);
  const line = calorieLine({ goal: day.goals.kcal, eaten: day.totals.kcal });
  const equation = h('p', { class: 'muted', text: line.equation, dataset: {
    goal: formatKcal(day.goals.kcal), eaten: formatKcal(day.totals.kcal), left: formatKcal(line.left),
  } });
  equation.style.textAlign = 'center';
  equation.style.fontSize = 'var(--text-secondary)';
  equation.style.marginTop = 'var(--space-2)';
  root.appendChild(equation);
  weighIn(root, app, day);
  if (!day.view.meals.length) root.appendChild(h('section', { class: 'section' },
    h('div', { class: 'section__head' }, h('h2', { text: `Nothing logged for ${dayLabel(day.date, localDate())}.` })),
    h('div', { class: 'row' }, h('div', { class: 'row__body' },
      h('div', { class: 'row__name', text: 'Tap Speak and say a meal' }),
      h('div', { class: 'row__qty', text: '"Meal one, two Weet-Bix and 200 mils of milk"' }))),
    day.lastLoggedDate ? copyDayButton(app, day) : null,
    button('Add food by hand', 'row', () => app.actions.openSheet('add-food', { meal: day.nextMeal }))));
  for (const meal of day.view.meals) {
    const section = h('section', { class: 'section' },
      mealHead(meal.meal, meal.totals));
    for (const entry of meal.entries) section.appendChild(itemRow(app, entry));
    section.appendChild(h('div', { class: 'section__foot' }, addButton(app, meal.meal),
      button('Copy...', 'link-btn', () => app.actions.openSheet('copy-meal', { meal: meal.meal })),
      button('Save meal', 'link-btn', () => app.actions.openSheet('save-meal', { meal: meal.meal }))));
    root.appendChild(section);
  }
  if (day.view.meals.length) root.appendChild(h('div', { class: 'section__foot section__foot--bare' },
    button('Copy this day to...', 'link-btn', () => app.actions.openSheet('copy-day'))));
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
  root.appendChild(h('button', { class: 'mic-fab', attrs: { type: 'button', 'aria-label': 'Speak' },
    on: { click: () => app.actions.openSheet('dictate') } }, icon('mic'), 'Speak'));
  const spacer = h('div', { attrs: { 'aria-hidden': 'true' } });
  spacer.style.minHeight = 'calc(var(--space-8) * 4)';
  root.appendChild(spacer);
}

const DELETE_WIDTH = 88;
const OPEN_AT = 72;
let openSwipe = null;

function closeSwipe() {
  if (!openSwipe) return;
  const { wrap, front } = openSwipe;
  openSwipe = null;
  wrap.dataset.state = 'closed';
  front.style.transform = '';
}

// One listener for the page: a touch outside the open row closes it.
if (typeof document !== 'undefined') document.addEventListener('pointerdown', event => {
  if (openSwipe && !openSwipe.wrap.contains(event.target)) closeSwipe();
}, true);

function itemRow(app, entry) {
  const name = entry.food?.name ?? 'Unknown food';
  const front = h('div', { class: 'row' },
    h('button', { class: 'row__open', attrs: { type: 'button' },
      on: { click: () => app.actions.openSheet('edit-entry', { id: entry.id }) } },
    h('span', { class: 'row__body' },
      h('span', { class: 'row__name', text: name }),
      h('span', { class: 'row__qty', text: entry.food ? formatQty(entry.qty, entry.food.unit) : String(entry.qty) })),
    h('span', { class: 'row__kcal' },
      h('span', { text: entry.nutrition ? formatKcal(entry.nutrition.kcal) : '?' }),
      h('span', { class: 'row__qty muted', text: entry.nutrition ? `${Math.round(entry.nutrition.protein)} g protein` : '?' }))));
  const remove = h('button', { class: 'row-swipe__delete', text: 'Delete',
    attrs: { type: 'button', 'aria-label': `Delete ${name}` },
    on: { click: () => app.actions.deleteEntry(entry.id).then(result => {
      if (!result.ok) app.toast(result.error);
    }) } });
  const wrap = h('div', { class: 'row-swipe', dataset: { state: 'closed' } }, remove, front);
  let start = null;
  let dragged = false;
  let offset = 0;
  front.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    start = { x: event.clientX, y: event.clientY, base: openSwipe?.wrap === wrap ? -DELETE_WIDTH : 0 };
    dragged = false;
  });
  front.addEventListener('pointermove', event => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!dragged) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      dragged = true;
      if (openSwipe && openSwipe.wrap !== wrap) closeSwipe();
      wrap.dataset.state = 'drag';
      front.setPointerCapture(event.pointerId);
    }
    offset = Math.min(0, Math.max(-DELETE_WIDTH, start.base + dx));
    front.style.transform = `translateX(${offset}px)`;
  });
  const finish = () => {
    if (!start) return;
    start = null;
    if (!dragged) return;
    setTimeout(() => { dragged = false; }, 50);
    if (offset < -OPEN_AT) {
      wrap.dataset.state = 'open';
      front.style.transform = `translateX(${-DELETE_WIDTH}px)`;
      openSwipe = { wrap, front };
    } else {
      wrap.dataset.state = 'closed';
      front.style.transform = '';
      if (openSwipe?.wrap === wrap) openSwipe = null;
    }
  };
  front.addEventListener('pointerup', finish);
  front.addEventListener('pointercancel', finish);
  // A drag or a tap on an open row must not open the edit sheet.
  front.addEventListener('click', event => {
    if (dragged) { dragged = false; event.preventDefault(); event.stopPropagation(); return; }
    if (openSwipe?.wrap === wrap) { event.preventDefault(); event.stopPropagation(); closeSwipe(); }
  }, true);
  return wrap;
}

function mealHead(meal, totals) {
  return h('div', { class: 'section__head' }, h('h2', { text: `Meal ${meal}` }),
    totals === undefined ? null : h('span', { text: mealHeadText(totals) }));
}

function addButton(app, meal) {
  return button('Add food', 'link-btn', () => app.actions.openSheet('add-food', { meal }));
}

function sheetBody(root, app, title) {
  root.appendChild(h('div', { class: 'sheet__head' },
    button('Cancel', 'link-btn', () => app.actions.closeSheet()), h('h2', { text: title })));
  const body = h('div', { class: 'sheet__body' });
  root.appendChild(body);
  return body;
}

// Keep previews and validation local while the keyboard is open.
function quantityControl(food, initial, save, app, work, success) {
  const input = h('input', { class: 'input', attrs: { ...fieldAttrs('number'),
    value: initial, 'aria-label': `Quantity in ${food.unit}` },
  on: { focus: event => event.target.select() } });
  const preview = h('p', { class: 'muted', attrs: { 'aria-live': 'polite' } });
  const errorLine = problem();
  function update() {
    preview.textContent = quantityPreview(food, parseNumber(input.value)).text;
    errorLine.hidden = true;
  }
  function saveQuantity() {
    const qty = parseNumber(input.value);
    if (qty === null || qty <= 0) {
      errorLine.textContent = 'Enter a quantity greater than 0.';
      errorLine.hidden = false;
      return;
    }
    submit(save, () => work(qty), app, success, errorLine);
  }
  save.addEventListener('click', saveQuantity);
  input.addEventListener('input', update);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); saveQuantity(); }
  });
  update();
  return { input, preview, errorLine, update };
}

function addFood(root, app, { meal }) {
  const date = app.state.date;
  const body = sheetBody(root, app, `Add to Meal ${meal}`);
  const foods = app.select.recentFoods();
  const saved = app.select.savedMeals();
  if (!foods.length) {
    body.appendChild(h('p', { class: 'empty', text: 'No foods yet.' }));
    body.appendChild(button('Add a food', 'pill pill--primary', () => {
      const result = app.actions.setTab('foods');
      if (!result.ok) { app.toast(result.error); return; }
      app.actions.openSheet('food-edit', {});
    }));
    return;
  }
  const search = h('input', { class: 'input', attrs: { ...fieldAttrs('search'), placeholder: 'Search foods',
    'aria-label': 'Search foods' }, on: { input: () => filter() } });
  const list = h('div');
  let selected = null;
  let dock = null;
  const foodRows = new Map();
  function choose(food) {
    selected = food.id;
    for (const [id, row] of foodRows) {
      row.style.background = id === selected ? 'var(--accent-soft)' : '';
      row.setAttribute('aria-pressed', String(id === selected));
    }
    if (dock) dock.remove();
    const add = button('Add', 'pill pill--primary', () => {});
    const control = quantityControl(food, food.defaultQty, add, app,
      qty => app.actions.addItems(date, meal, [{ foodId: food.id, qty }]), () => {
        app.actions.closeSheet();
        app.toast(`Added ${food.name}`);
      });
    control.input.style.width = 'calc(var(--space-8) * 3)';
    control.input.style.flex = 'none';
    const details = h('div', { class: 'row__body' },
      h('div', { class: 'row__name', text: food.name }), control.preview, control.errorLine);
    dock = h('div', { class: 'sheet__dock' }, details, control.input, add);
    dock.style.flexWrap = 'wrap';
    details.style.flexBasis = '100%';
    root.appendChild(dock);
  }
  body.appendChild(search);
  body.appendChild(list);
  function filter() {
    clear(list);
    foodRows.clear();
    const query = search.value.trim().toLowerCase();
    const foodsById = new Map(foods.map(food => [food.id, food]));
    const savedMatches = saved.filter(pick => [pick.name, ...(pick.aliases || [])]
      .some(name => name.toLowerCase().includes(query)));
    if (savedMatches.length) list.appendChild(h('h3', { class: 'field__label', text: 'Saved meals' }));
    for (const pick of savedMatches) {
      const kcal = pick.items.reduce((sum, item) => {
        const food = foodsById.get(item.foodId);
        return food ? sum + food.kcal * item.qty / food.baseQty : sum;
      }, 0);
      const control = h('button', { class: 'row', attrs: { type: 'button' },
        on: { click: () => submit(control, () => app.actions.addSavedMeal(date, meal, pick.id), app, () => {
          app.actions.closeSheet();
          app.toast(`Added ${pick.name}`);
        }) } }, h('span', { class: 'row__body' },
        h('span', { class: 'row__name', text: pick.name }),
        h('span', { class: 'row__qty', text: `${pick.items.length} items, ${formatKcal(kcal)} kcal` })));
      list.appendChild(control);
    }
    if (savedMatches.length) list.appendChild(h('h3', { class: 'field__label', text: 'Foods' }));
    const matches = foods.filter(food => [food.name, ...(food.aliases || [])]
      .some(name => name.toLowerCase().includes(query)));
    for (const food of matches) {
      const row = h('button', { class: 'row', attrs: { type: 'button', 'aria-pressed': String(food.id === selected) },
        on: { click: () => choose(food) } }, h('span', { class: 'row__body' },
      h('span', { class: 'row__name', text: food.name }),
      h('span', { class: 'row__qty', text: `per ${formatQty(food.baseQty, food.unit)}, ${formatKcal(food.kcal)} kcal` })));
      if (food.id === selected) row.style.background = 'var(--accent-soft)';
      foodRows.set(food.id, row);
      list.appendChild(row);
    }
    if (!matches.length) list.appendChild(h('p', { class: 'empty', text: 'No matching foods.' }));
  }
  filter();
  search.focus();
}

function editEntry(root, app, { id }) {
  const meal = app.select.day().view.meals.find(meal => meal.entries.some(entry => entry.id === id));
  const entry = meal?.entries.find(entry => entry.id === id);
  const body = sheetBody(root, app, entry?.food?.name ?? 'Quantity');
  if (!entry) { body.appendChild(h('p', { class: 'empty', text: 'Entry no longer exists.' })); return; }
  const close = () => app.actions.closeSheet();
  let errorLine;
  if (entry.food) {
    const save = button('Save', 'link-btn', () => {});
    const head = root.firstChild;
    head.children[1].style.flex = '1';
    head.children[1].style.textAlign = 'center';
    head.children[1].style.minWidth = '0';
    head.appendChild(save);
    const control = quantityControl(entry.food, entry.qty, save, app,
      qty => app.actions.updateEntryQty(id, qty), close);
    control.input.className += ' qty-amount__input';
    const amount = h('div', { class: 'qty-amount' }, control.input,
      h('span', { class: 'muted qty-amount__unit', text: entry.food.unit }));
    const quick = h('div', { class: 'qty-quick' });
    for (const qty of quickAmounts(entry.food.unit)) {
      const pick = button(formatQty(qty, entry.food.unit), 'link-btn qty-quick__btn', () => {
        control.input.value = String(qty);
        control.update();
      });
      quick.appendChild(pick);
    }
    body.appendChild(amount);
    body.appendChild(control.preview);
    body.appendChild(quick);
    errorLine = control.errorLine;
    body.appendChild(errorLine);
    control.input.focus();
    control.input.select();
  } else {
    body.appendChild(h('p', { class: 'empty', text: 'Food no longer exists. Delete this entry and add another food.' }));
    errorLine = problem();
    body.appendChild(errorLine);
  }
  const remove = button(`Remove from Meal ${meal.meal}`, 'pill pill--danger pill--block', () =>
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

function saveMeal(root, app, { meal }) {
  const date = app.state.date;
  const body = sheetBody(root, app, `Save Meal ${meal}`);
  const input = h('input', { class: 'input', attrs: { ...fieldAttrs('text'),
    'aria-label': 'Saved meal title', value: `Meal ${meal}` }, on: { focus: event => event.target.select() } });
  const errorLine = problem();
  const save = button('Save', 'pill pill--primary pill--block', () => saveNow());
  function saveNow() {
    const name = input.value.trim();
    if (!name) {
      errorLine.textContent = 'Enter a name.';
      errorLine.hidden = false;
      return;
    }
    submit(save, () => app.actions.saveMealAsSaved({ date, meal, name }), app, () => {
      app.actions.closeSheet();
      app.toast(`Saved ${name}`);
    }, errorLine);
  }
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); saveNow(); }
  });
  body.appendChild(h('label', { class: 'field' }, h('span', { class: 'field__label', text: 'Name' }), input));
  body.appendChild(errorLine);
  body.appendChild(save);
  input.focus();
  input.select();
}

function copyDay(root, app) {
  const fromDate = app.state.date;
  const body = sheetBody(root, app, 'Copy this day to');
  const input = h('input', { class: 'input', attrs: { type: 'date', 'aria-label': 'Copy to date',
    value: localDate() } });
  const errorLine = problem();
  const save = button('Copy', 'pill pill--primary pill--block', () => copyNow());
  function copyNow() {
    const toDate = input.value;
    if (!toDate) {
      errorLine.textContent = 'Pick a day.';
      errorLine.hidden = false;
      return;
    }
    if (toDate === fromDate) {
      errorLine.textContent = 'Pick a different day';
      errorLine.hidden = false;
      return;
    }
    submit(save, () => app.actions.copyDay({ fromDate, toDate }), app, async result => {
      app.actions.closeSheet();
      await app.actions.setDate(toDate);
      app.toast(`Copied ${result.added} items to ${dayLabel(toDate, localDate())}`);
    }, errorLine);
  }
  body.appendChild(h('label', { class: 'field' }, h('span', { class: 'field__label', text: 'Day' }), input));
  body.appendChild(errorLine);
  body.appendChild(save);
}

export const sheets = { 'add-food': addFood, 'edit-entry': editEntry, 'copy-meal': copyMeal,
  'save-meal': saveMeal, 'copy-day': copyDay };
