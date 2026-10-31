import { h, fieldAttrs } from './dom.js';
import { parseNumber, formatKcal, formatQty } from '../format.js';
import { kcalFromGrams } from '../insights.js';

export const STEPS = ['goals', 'foods', 'try'];

export function welcomeReducer(state, action) {
  if (state.done) return state;
  switch (action.type) {
    case 'next':
    case 'skip': return state.step === 3 ? { ...state, done: true } : { ...state, step: state.step + 1 };
    case 'back': return state.step === 1 ? state : { ...state, step: state.step - 1 };
    case 'finish': return { ...state, done: true };
    default: return state;
  }
}

export function progressBars(step) {
  return STEPS.map((_, index) => index < step);
}

export function shouldShowWelcome({ flag, finished, entryCount, weightCount }) {
  return flag !== '1' && !finished && entryCount === 0 && weightCount === 0;
}

export function readWelcomeFlag(storage) {
  try { return storage.getItem('shredz.welcomeDone') === '1'; } catch { return false; }
}

export function writeWelcomeFlag(storage) {
  try { storage.setItem('shredz.welcomeDone', '1'); } catch { /* Storage may be blocked. */ }
}

const keys = ['protein', 'carbs', 'fat'];
const readGoal = value => parseNumber(String(value ?? ''));

export function goalPreview(goals) {
  const values = keys.map(key => readGoal(goals[key]));
  if (values.some(value => value === null || value < 0)) return { ok: false };
  return { ok: true, kcal: kcalFromGrams(Object.fromEntries(keys.map((key, i) => [key, values[i]]))) };
}

export function foodRows(foods, limit = 6) {
  return { rows: foods.slice(0, limit).map(food => ({ name: food.name,
    text: `${formatKcal(food.kcal)} kcal per ${formatQty(food.baseQty, food.unit)}` })),
  more: Math.max(0, foods.length - limit) };
}

let flow = { step: 1, done: false };
let flag;
let draft;
let practice = '';
let focusKey;
let saving = false;
let saveError = '';

export function isActive(state) {
  if (flag === undefined) {
    try { flag = readWelcomeFlag(globalThis.localStorage); } catch { flag = false; }
  }
  return shouldShowWelcome({ flag: flag ? '1' : null, finished: flow.done,
    entryCount: state.data.entries.length, weightCount: state.data.weights.length });
}

function advance(app, type) {
  flow = welcomeReducer(flow, { type });
  focusKey = undefined;
  if (flow.done) {
    try { writeWelcomeFlag(globalThis.localStorage); } catch { /* Dismiss for this session. */ }
  }
  app.rerender();
}

function button(text, click, primary = false) {
  return h('button', { class: primary ? 'pill pill--primary' : 'link-btn', text,
    attrs: { type: 'button' }, on: { click } });
}

function goalsStep(body, dock, app) {
  const saved = app.select.settings().goals;
  if (!draft) draft = Object.fromEntries(keys.map(key => [key, String(saved[key] ?? '')]));
  const inputs = {};
  const calories = h('p', { class: 'muted', attrs: { 'aria-live': 'polite' } });
  const problem = h('p', { class: 'problem-line', attrs: { id: 'welcome-problem', role: 'alert' } });
  problem.textContent = saveError;
  problem.hidden = !saveError;
  const refresh = () => {
    const preview = goalPreview(draft);
    calories.textContent = `Calories (worked out): ${preview.ok ? formatKcal(preview.kcal) : '?'} kcal`;
  };
  const labels = ['Protein g', 'Carbs g', 'Fat g'];
  keys.forEach((key, index) => {
    const id = `welcome-${key}`;
    const input = h('input', { class: 'input', attrs: { ...fieldAttrs('number'), id,
      value: draft[key], 'aria-describedby': 'welcome-problem' }, on: {
      focus: () => { focusKey = key; },
      input: () => { draft[key] = input.value; focusKey = key; refresh(); },
    } });
    inputs[key] = input;
    body.appendChild(h('div', { class: 'field' },
      h('label', { class: 'field__label', text: labels[index], attrs: { for: id } }), input));
  });
  body.appendChild(calories);
  body.appendChild(problem);
  body.appendChild(h('p', { class: 'muted', text: 'Change any time in Settings.' }));
  refresh();
  dock.appendChild(button('Skip', () => { if (!saving) advance(app, 'skip'); }));
  const next = button('Next', async () => {
    if (saving) return;
    const goals = {};
    for (const [index, key] of keys.entries()) {
      goals[key] = readGoal(draft[key]);
      inputs[key].setAttribute('aria-invalid', String(goals[key] === null || goals[key] < 0));
      if (goals[key] === null || goals[key] < 0) {
        problem.textContent = `${labels[index]}: enter zero or a positive number.`;
        problem.hidden = false;
        inputs[key].focus();
        return;
      }
    }
    problem.hidden = true;
    saveError = '';
    if (keys.some(key => goals[key] !== saved[key])) {
      saving = true;
      next.disabled = true;
      const result = await app.actions.saveGoalSettings({ goalMode: 'grams', ...goals });
      saving = false;
      next.disabled = false;
      if (!result.ok) {
        saveError = result.error;
        app.rerender();
        return;
      }
    }
    advance(app, 'next');
  }, true);
  next.disabled = saving;
  dock.appendChild(next);
  return () => { if (focusKey) inputs[focusKey].focus(); };
}

function practiceStep(body, app) {
  body.appendChild(h('p', { text: '"Two Weet-Bix and 200 mils of milk"' }));
  body.appendChild(h('p', { class: 'muted', text: 'Practice only, nothing is saved. Typing works, and so does the mic on your keyboard.' }));
  const results = h('div', { attrs: { 'aria-live': 'polite' } });
  const refresh = () => {
    results.replaceChildren();
    if (!practice.trim()) return;
    const parsed = app.select.preview(practice);
    const foods = app.select.foods();
    const items = parsed.meals.flatMap(meal => meal.items);
    for (const item of items) {
      const food = foods.find(food => food.id === item.foodId);
      results.appendChild(h('div', { class: 'row' },
        h('div', { class: 'row__body' },
          h('div', { class: 'row__name', text: food?.name || item.raw }),
          h('div', { class: 'row__qty', text: formatQty(item.qty, item.unit) })),
        h('div', { class: 'row__kcal', text: food ? `${formatKcal(food.kcal * item.qty / food.baseQty)} kcal` : '?' })));
    }
    if (!items.length) results.appendChild(h('p', { class: 'empty', text: 'No foods recognised yet. Add foods in the Foods tab any time.' }));
    for (const item of parsed.unmatched) {
      results.appendChild(h('p', { class: 'problem-line', text: `Not recognised: ${item.raw}` }));
    }
  };
  const input = h('textarea', { class: 'input', attrs: { ...fieldAttrs('note'),
    id: 'welcome-practice', 'aria-label': 'Practice sentence', rows: '2' },
  on: { input: () => { practice = input.value; refresh(); } } });
  input.value = practice;
  body.appendChild(input);
  body.appendChild(results);
  refresh();
  return () => input.focus();
}

export function render(root, app) {
  const layer = h('section', { attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Welcome to Shredz' } });
  Object.assign(layer.style, { position: 'fixed', inset: '0', background: 'var(--bg)',
    zIndex: '25', overflowY: 'auto', display: 'flex', flexDirection: 'column',
    paddingTop: 'env(safe-area-inset-top)' });
  const body = h('div');
  body.style.padding = 'var(--space-4)';
  body.style.flex = '1 0 auto';
  const bars = h('div', { attrs: { 'aria-hidden': 'true' } });
  Object.assign(bars.style, { display: 'flex', gap: 'var(--space-2)' });
  progressBars(flow.step).forEach(reached => {
    const bar = h('span', { attrs: { 'aria-hidden': 'true' } });
    Object.assign(bar.style, { height: '4px', flex: '1', background: reached ? 'var(--accent)' : 'var(--track)' });
    bars.appendChild(bar);
  });
  body.appendChild(bars);
  body.appendChild(h('p', { class: 'muted', text: `Step ${flow.step} of 3` }));
  body.appendChild(h('h2', { text: ['Your daily goals', 'Your foods', 'Try saying a meal'][flow.step - 1] }));
  const dock = h('div', { class: 'sheet__dock' });
  let focus;
  if (flow.step === 1) focus = goalsStep(body, dock, app);
  else if (flow.step === 2) {
    const { rows, more } = foodRows(app.select.foods());
    const list = h('div', { class: 'section' });
    rows.forEach(row => list.appendChild(h('div', { class: 'row' },
      h('div', { class: 'row__body' }, h('div', { class: 'row__name', text: row.name }),
        h('div', { class: 'row__qty', text: row.text })))));
    if (!rows.length) list.appendChild(h('p', { class: 'empty', text: 'No foods yet. Add them in the Foods tab any time.' }));
    body.appendChild(list);
    if (more) body.appendChild(h('p', { class: 'muted', text: `${more} more` }));
    dock.appendChild(button('Back', () => advance(app, 'back')));
    dock.appendChild(button('Skip', () => advance(app, 'skip')));
    dock.appendChild(button('Next', () => advance(app, 'next'), true));
  } else {
    focus = practiceStep(body, app);
    dock.appendChild(button('Skip', () => advance(app, 'skip')));
    dock.appendChild(button('Start logging', () => advance(app, 'finish'), true));
  }
  layer.appendChild(body);
  layer.appendChild(dock);
  root.appendChild(layer);
  if (focus) focus();
}
