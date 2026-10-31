import test from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, welcomeReducer, progressBars, shouldShowWelcome, readWelcomeFlag,
  writeWelcomeFlag, goalPreview, foodRows } from '../src/ui/welcome.js';
import { fieldAttrs } from '../src/ui/dom.js';

const foods = Array.from({ length: 13 }, (_, i) => ({ id: String(i), name: `Food ${i}`,
  kcal: 141, baseQty: 100, unit: 'g' }));

test('pure flow covers every action at every step without mutation', () => {
  assert.deepEqual(STEPS, ['goals', 'foods', 'try']);
  for (let step = 1; step <= 3; step++) {
    const state = Object.freeze({ step, done: false });
    for (const type of ['next', 'skip']) assert.deepEqual(welcomeReducer(state, { type }),
      { step: Math.min(3, step + 1), done: step === 3 });
    assert.deepEqual(welcomeReducer(state, { type: 'back' }), { step: Math.max(1, step - 1), done: false });
    assert.deepEqual(welcomeReducer(state, { type: 'finish' }), { step, done: true });
    assert.equal(welcomeReducer(state, { type: 'unknown' }), state);
    const done = Object.freeze({ step, done: true });
    for (const type of ['next', 'skip', 'back', 'finish', 'unknown']) {
      assert.equal(welcomeReducer(done, { type }), done);
    }
    assert.deepEqual(progressBars(step), [1, 2, 3].map(n => n <= step));
  }
});

test('visibility requires an unfinished fresh diary and an unset flag', () => {
  for (const flag of ['1', null, false, '0']) for (const finished of [false, true]) {
    for (const entryCount of [0, 1]) for (const weightCount of [0, 1]) {
      assert.equal(shouldShowWelcome({ flag, finished, entryCount, weightCount }),
        flag !== '1' && !finished && !entryCount && !weightCount);
    }
  }
});

function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('storage is safe when absent or throwing, and uses the agreed key', () => {
  for (const store of [null, { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } }]) {
    assert.equal(readWelcomeFlag(store), false);
    assert.doesNotThrow(() => writeWelcomeFlag(store));
  }
  const store = storage();
  assert.equal(readWelcomeFlag(store), false);
  writeWelcomeFlag(store);
  assert.equal(store.getItem('shredz.welcomeDone'), '1');
  assert.equal(readWelcomeFlag(store), true);
});

test('goal previews accept numbers, zero and decimal commas, reject invalid values', () => {
  assert.deepEqual(goalPreview({ protein: 180, carbs: 250, fat: 70 }), { ok: true, kcal: 2350 });
  assert.deepEqual(goalPreview({ protein: '0', carbs: '1,5', fat: '2' }), { ok: true, kcal: 24 });
  for (const value of ['', 'abc', '-1', NaN, Infinity, null]) {
    for (const key of ['protein', 'carbs', 'fat']) {
      assert.deepEqual(goalPreview({ protein: 1, carbs: 1, fat: 1, [key]: value }), { ok: false });
    }
  }
});

test('food rows format units and count leftovers', () => {
  for (const count of [0, 6, 13]) {
    const result = foodRows(foods.slice(0, count));
    assert.equal(result.rows.length, Math.min(count, 6));
    assert.equal(result.more, Math.max(0, count - 6));
    for (const row of result.rows) assert.equal(row.text, '141 kcal per 100 g');
  }
  assert.equal(foodRows(foods, 2).more, 11);
});

class El {
  constructor(tag) {
    this.tagName = tag; this.attrs = {}; this.listeners = {}; this.children = [];
    this.style = {}; this.dataset = {}; this.value = ''; this.content = ''; this.className = '';
  }
  setAttribute(key, value) { this.attrs[key] = value; if (key === 'value') this.value = value; }
  getAttribute(key) { return this.attrs[key] ?? null; }
  addEventListener(key, fn) { this.listeners[key] = fn; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; this.content = ''; }
  set textContent(value) { this.content = String(value); this.children = []; }
  get textContent() { return this.content + this.children.map(child => child.textContent).join(''); }
  focus() { globalThis.document.activeElement = this; this.listeners.focus?.(); }
  click() { if (!this.disabled) return this.listeners.click?.(); }
  input(value) { this.value = value; this.listeners.input?.(); }
}
const all = root => [root, ...root.children.flatMap(all)];
const byText = (root, text) => all(root).find(el => el.tagName === 'button' && el.textContent === text);
const byId = (root, id) => all(root).find(el => el.getAttribute('id') === id);
const byClass = (root, name) => all(root).filter(el => el.className.split(' ').includes(name));
let session = 0;
async function harness({ catalogue = foods, store = storage(), result = { ok: true }, redrawOnSave = false } = {}) {
  const welcome = await import(`../src/ui/welcome.js?session=${++session}`);
  globalThis.document = { createElement: tag => new El(tag), createElementNS: (_, tag) => new El(tag),
    createTextNode: text => { const el = new El('text'); el.textContent = text; return el; } };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => store });
  const root = new El('root');
  const calls = { saves: [], previews: [], renders: 0 };
  const settings = { goals: { protein: 180, carbs: 250, fat: 70, kcal: 2350 } };
  const app = { state: { data: { entries: [], weights: [] } },
    select: { settings: () => settings, foods: () => catalogue, preview: text => {
      calls.previews.push(text);
      return { meals: [{ items: catalogue.length ? [{ foodId: '0', qty: 50, unit: 'g', raw: text }] : [] }],
        unmatched: [{ raw: 'mystery' }] };
    } },
    actions: { saveGoalSettings: async input => {
      calls.saves.push(input);
      if (result.ok) settings.goals = { ...input };
      if (redrawOnSave) app.rerender();
      return result;
    } }, toast() { throw Error('Unexpected toast'); },
    rerender() { calls.renders++; root.replaceChildren(); if (welcome.isActive(app.state)) welcome.render(root, app); } };
  app.rerender();
  return { root, app, calls, welcome, store };
}

test('dialog, progress and goal fields have the required semantics; live preview and validation', async () => {
  const { root, calls } = await harness();
  const dialog = root.children[0];
  assert.equal(dialog.getAttribute('role'), 'dialog');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(dialog.getAttribute('aria-label'), 'Welcome to Shredz');
  assert.equal(dialog.style.zIndex, '25');
  assert.equal(all(root).filter(el => el.tagName === 'span' && el.style.height === '4px').length, 3);
  assert.match(root.textContent, /Step 1 of 3/);
  for (const [key, label] of [['protein', 'Protein g'], ['carbs', 'Carbs g'], ['fat', 'Fat g']]) {
    const field = byId(root, `welcome-${key}`);
    for (const [attr, value] of Object.entries(fieldAttrs('number'))) assert.equal(field.getAttribute(attr), value);
    assert.ok(all(root).some(el => el.tagName === 'label' && el.textContent === label && el.getAttribute('for') === `welcome-${key}`));
  }
  byId(root, 'welcome-protein').input('0');
  assert.match(root.textContent, /Calories \(worked out\): 1,630 kcal/);
  byId(root, 'welcome-protein').input('-1');
  await byText(root, 'Next').click();
  assert.match(root.textContent, /Protein g: enter zero or a positive number\./);
  assert.equal(byClass(root, 'problem-line')[0].hidden, false);
  assert.equal(calls.saves.length, 0);
  assert.match(root.textContent, /Your daily goals/);
  for (const el of all(root).filter(el => el.tagName === 'button')) assert.equal(el.getAttribute('type'), 'button');
});

test('changed goals save once as numbers and advance across a synchronous shell redraw', async () => {
  const { root, app, calls } = await harness({ redrawOnSave: true });
  byId(root, 'welcome-protein').input('190,5');
  app.rerender();
  assert.equal(byId(root, 'welcome-protein').value, '190,5');
  assert.equal(document.activeElement, byId(root, 'welcome-protein'));
  await byText(root, 'Next').click();
  assert.deepEqual(calls.saves, [{ goalMode: 'grams', protein: 190.5, carbs: 250, fat: 70 }]);
  assert.match(root.textContent, /Your foods/);
  assert.equal(byClass(root, 'row').length, 6);
  assert.match(root.textContent, /7 more/);
  byText(root, 'Back').click();
  assert.match(root.textContent, /Your daily goals/);
});

test('unchanged goals advance without saving; failed saves stay with a visible error', async () => {
  const first = await harness();
  await byText(first.root, 'Next').click();
  assert.equal(first.calls.saves.length, 0);
  assert.match(first.root.textContent, /Your foods/);
  const second = await harness({ result: { ok: false, error: 'Could not save goals.' }, redrawOnSave: true });
  byId(second.root, 'welcome-fat').input('80');
  await byText(second.root, 'Next').click();
  assert.match(second.root.textContent, /Your daily goals/);
  assert.match(second.root.textContent, /Could not save goals\./);
  assert.equal(byClass(second.root, 'problem-line')[0].hidden, false);
});

test('skip avoids saves, foods can be empty, typed practice only previews and survives redraws', async () => {
  const { root, app, calls } = await harness();
  byId(root, 'welcome-protein').input('999');
  byText(root, 'Skip').click();
  assert.equal(calls.saves.length, 0);
  byText(root, 'Next').click();
  assert.match(root.textContent, /Try saying a meal/);
  assert.match(root.textContent, /Two Weet-Bix and 200 mils of milk/);
  assert.match(root.textContent, /Practice only, nothing is saved. Typing works, and so does the mic on your keyboard\./);
  const input = byId(root, 'welcome-practice');
  assert.equal(input.getAttribute('aria-label'), 'Practice sentence');
  for (const [key, value] of Object.entries(fieldAttrs('note'))) assert.equal(input.getAttribute(key), value);
  assert.equal(document.activeElement, input);
  input.input('50 g Food 0 and mystery');
  assert.deepEqual(calls.previews, ['50 g Food 0 and mystery']);
  assert.equal(calls.saves.length, 0);
  assert.equal(byClass(root, 'row__name')[0].textContent, 'Food 0');
  assert.equal(byClass(root, 'row__qty')[0].textContent, '50 g');
  assert.equal(byClass(root, 'row__kcal')[0].textContent, '71 kcal');
  assert.match(root.textContent, /Not recognised: mystery/);
  app.rerender();
  assert.equal(byId(root, 'welcome-practice').value, '50 g Food 0 and mystery');
  const empty = await harness({ catalogue: [] });
  byText(empty.root, 'Skip').click();
  assert.match(empty.root.textContent, /No foods yet. Add them in the Foods tab any time\./);
  byText(empty.root, 'Skip').click();
  byId(empty.root, 'welcome-practice').input('mystery');
  assert.match(empty.root.textContent, /No foods recognised yet/);
  assert.match(empty.root.textContent, /Not recognised: mystery/);
});

test('both last-step exits persist and rerender; later sessions and existing diaries stay hidden', async () => {
  for (const exit of ['Skip', 'Start logging']) {
    const { root, app, store, welcome, calls } = await harness();
    byText(root, 'Skip').click(); byText(root, 'Skip').click();
    const renders = calls.renders;
    byText(root, exit).click();
    assert.equal(calls.renders, renders + 1);
    assert.equal(root.children.length, 0);
    assert.equal(welcome.isActive(app.state), false);
    assert.equal(store.getItem('shredz.welcomeDone'), '1');
    const later = await harness({ store });
    assert.equal(later.root.children.length, 0);
  }
  const { welcome } = await harness();
  assert.equal(welcome.isActive({ data: { entries: [{}], weights: [] } }), false);
  assert.equal(welcome.isActive({ data: { entries: [], weights: [{}] } }), false);
});

test('blocked localStorage getter is read once and finishing still dismisses for the session', async () => {
  const { root, app, welcome } = await harness();
  const isolated = await import(`../src/ui/welcome.js?session=${++session}`);
  let reads = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { reads++; throw Error('blocked'); } });
  assert.equal(isolated.isActive(app.state), true);
  assert.equal(isolated.isActive(app.state), true);
  assert.equal(reads, 1);
  byText(root, 'Skip').click(); byText(root, 'Skip').click();
  assert.doesNotThrow(() => byText(root, 'Start logging').click());
  assert.equal(welcome.isActive(app.state), false);
  assert.equal(root.children.length, 0);
});
