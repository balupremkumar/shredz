import test from 'node:test';
import assert from 'node:assert/strict';
import { dayLabel, localDate } from '../src/format.js';
import { ringArc, calorieLine, mealHeadText, quantityPreview, quickAmounts, render, sheets } from '../src/ui/diary.js';

test('ring arc handles empty, partial, complete and over-goal days', () => {
  const circumference = 2 * Math.PI * 66;
  for (const [eaten, goal, fraction, over] of [
    [0, 2400, 0, false], [600, 2400, 0.25, false], [2400, 2400, 1, false],
    [2600, 2400, 1, true], [0, 0, 0, false], [100, 0, 0, true], [100, -1, 0, true],
  ]) {
    assert.deepEqual(ringArc({ eaten, goal }), {
      circumference, dash: circumference * fraction, gap: circumference, fraction, over,
    });
  }
  assert.equal(ringArc({ eaten: 1, goal: 2, radius: 10 }).circumference, 20 * Math.PI);
});

test('calorie text uses absolute remaining calories and explicit over wording', () => {
  assert.deepEqual(calorieLine({ goal: 2400, eaten: 884 }), {
    left: 1516, over: false, centre: '1,516', caption: 'kcal left',
    equation: '2,400 goal \u2212 884 eaten = 1,516 left',
  });
  assert.deepEqual(calorieLine({ goal: 2400, eaten: 2600 }), {
    left: -200, over: true, centre: '200', caption: 'kcal over',
    equation: '2,400 goal \u2212 2,600 eaten = 200 over',
  });
  for (const goal of [0, 2400]) {
    const line = calorieLine({ goal, eaten: 0 });
    assert.equal(line.centre, goal === 0 ? '0' : '2,400');
    assert.equal(line.caption, 'kcal left');
  }
  assert.equal(calorieLine({ goal: 0, eaten: 1 }).caption, 'kcal over');
  assert.equal(calorieLine({ goal: 100, eaten: 100 }).centre, '0');
});

test('meal heading rounds calories and protein for the grouped list', () => {
  assert.equal(mealHeadText({ kcal: 1234.6, protein: 37.5 }), '1,235 kcal \u00b7 38 g protein');
  assert.equal(mealHeadText({ kcal: 0, protein: 0 }), '0 kcal \u00b7 0 g protein');
});

test('quantity preview scales nutrition and formats live macros', () => {
  const food = { baseQty: 100, kcal: 158.4, protein: 30, carbs: 3.12, fat: 2.64 };
  const preview = quantityPreview(food, 125);
  assert.deepEqual(preview, { kcal: 198, protein: 37.5, carbs: 3.9, fat: 3.3,
    text: '198 kcal \u00b7 37.5 g protein \u00b7 3.9 g carbs \u00b7 3.3 g fat' });
  assert.equal(quantityPreview(food, 50).kcal, 79.2);
  for (const qty of [0, -1, NaN, Infinity, -Infinity, null, undefined, '125']) {
    assert.deepEqual(quantityPreview(food, qty), {
      kcal: null, protein: null, carbs: null, fat: null, text: '-',
    });
  }
});

test('quick amounts match every supported unit and return independent arrays', () => {
  for (const unit of ['item', 'scoop']) assert.deepEqual(quickAmounts(unit), [0.5, 1, 2, 3]);
  for (const unit of ['g', 'ml']) assert.deepEqual(quickAmounts(unit), [50, 100, 150, 200]);
  const amounts = quickAmounts('g');
  amounts[0] = 999;
  assert.equal(quickAmounts('g')[0], 50);
});

// Minimal DOM surface for exercising local input and action flows without a browser dependency.
class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this.textContent = '';
    this.value = '';
  }
  setAttribute(key, value) {
    this.attrs[key] = String(value);
    if (key === 'value') this.value = String(value);
  }
  addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  replaceChildren() { this.children = []; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  get firstChild() { return this.children[0]; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  async fire(type, extra = {}) {
    for (const listener of this.listeners[type] ?? []) {
      await listener({ target: this, preventDefault() {}, ...extra });
    }
    // submit deliberately keeps the DOM event handler synchronous.
    await Promise.resolve();
  }
}

const descendants = root => [root, ...root.children.flatMap(descendants)];
const byText = (root, text) => descendants(root).find(node => node.textContent === text);
const byClass = (root, name) => descendants(root).filter(node => node.className?.split(' ').includes(name));
const byLabel = (root, label) => descendants(root).find(node => node.attrs['aria-label'] === label);
const food = { id: 'chicken', name: 'Chicken', unit: 'g', baseQty: 100, defaultQty: 100,
  kcal: 158.4, protein: 30, carbs: 3.12, fat: 2.64 };

function fixture(t, { missing = false, empty = false } = {}) {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: tag => new Element(tag),
    createElementNS: (ns, tag) => new Element(tag),
    createTextNode: text => Object.assign(new Element('#text'), { textContent: text }) };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });
  const totals = { kcal: 198, protein: 37.5, carbs: 3.9, fat: 3.3 };
  const entry = { id: 'entry', qty: 125, food: missing ? null : food, nutrition: missing ? null : totals };
  const meal = { meal: 2, totals, entries: [entry] };
  const day = { date: '2026-10-31', goals: { kcal: 2400, protein: 180, carbs: 240, fat: 80 },
    totals: empty ? { kcal: 0, protein: 0, carbs: 0, fat: 0 } : totals,
    view: { meals: empty ? [] : [meal] }, weight: null, lastWeight: 82.4, weekChange: null,
    lastLoggedDate: '2026-10-30', nextMeal: empty ? 1 : 3 };
  const calls = [];
  const actions = Object.fromEntries(['openSheet', 'closeSheet', 'updateEntryQty', 'deleteEntry', 'addItems',
    'addSavedMeal', 'copyLastLoggedDay', 'logWeight', 'setTab'].map(name => [name, (...args) => {
    calls.push([name, ...args]);
    return Promise.resolve({ ok: true });
  }]));
  const app = { state: { date: day.date }, actions, toast: text => calls.push(['toast', text]),
    select: { day: date => date ? { ...day, totals, view: { meals: [meal] } } : day,
      recentFoods: () => [food], savedMeals: () => [{ id: 'saved', name: 'Lunch', items: [{ foodId: food.id, qty: 100 }] }] } };
  return { root: new Element('panel'), app, calls };
}

test('quantity sheet previews edits, validates, applies quick amounts and saves in the header', async t => {
  const { root, app, calls } = fixture(t);
  sheets['edit-entry'](root, app, { id: 'entry' });
  const input = byLabel(root, 'Quantity in g');
  assert.equal(input.value, '125');
  assert.equal(input.focused && input.selected, true);
  assert.deepEqual(root.firstChild.children.map(node => node.textContent), ['Cancel', 'Chicken', 'Save']);
  const save = byText(root, 'Save');
  input.value = '0';
  await save.fire('click');
  assert.equal(byText(root, 'Enter a quantity greater than 0.').hidden, false);
  assert.deepEqual(calls, []);
  input.value = '50,5';
  await input.fire('input');
  assert.ok(byText(root, quantityPreview(food, 50.5).text));
  await byText(root, '150 g').fire('click');
  assert.equal(input.value, '150');
  assert.ok(byText(root, quantityPreview(food, 150).text));
  await input.fire('keydown', { key: 'Enter' });
  assert.deepEqual(calls, [['updateEntryQty', 'entry', 150], ['closeSheet']]);
});

test('missing food can still be removed from its meal', async t => {
  const { root, app, calls } = fixture(t, { missing: true });
  sheets['edit-entry'](root, app, { id: 'entry' });
  assert.equal(descendants(root).filter(node => node.tagName === 'input').length, 0);
  assert.equal(byText(root, 'Save'), undefined);
  await byText(root, 'Remove from Meal 2').fire('click');
  assert.deepEqual(calls, [['deleteEntry', 'entry'], ['closeSheet']]);
});

test('add-food selection waits for Add and survives filtering with the typed quantity', async t => {
  const { root, app, calls } = fixture(t);
  sheets['add-food'](root, app, { meal: 2 });
  const search = byLabel(root, 'Search foods');
  assert.equal(descendants(root).find(node => node.tagName === 'input'), search);
  assert.equal(search.focused, true);
  await byText(root, 'Chicken').parent.parent.fire('click');
  assert.deepEqual(calls, []);
  const dock = byClass(root, 'sheet__dock')[0];
  assert.equal(root.children.at(-1), dock);
  assert.equal(byClass(root, 'sheet__body')[0].children.includes(dock), false);
  const input = byLabel(dock, 'Quantity in g');
  input.value = '125';
  await input.fire('input');
  assert.ok(byText(dock, quantityPreview(food, 125).text));
  search.value = 'no match';
  await search.fire('input');
  assert.equal(root.children.at(-1), dock);
  assert.equal(input.value, '125');
  await byText(dock, 'Add').fire('click');
  assert.deepEqual(calls, [['addItems', '2026-10-31', 2, [{ foodId: 'chicken', qty: 125 }]],
    ['closeSheet'], ['toast', 'Added Chicken']]);
});

test('saved meals still add immediately', async t => {
  const { root, app, calls } = fixture(t);
  sheets['add-food'](root, app, { meal: 2 });
  await byText(root, 'Lunch').parent.parent.fire('click');
  assert.deepEqual(calls, [['addSavedMeal', '2026-10-31', 2, 'saved'], ['closeSheet'], ['toast', 'Added Lunch']]);
});

test('empty diary renders equation hooks, copy details, manual add and Speak', async t => {
  const { root, app, calls } = fixture(t, { empty: true });
  render(root, app);
  assert.equal(byClass(root, 'summary')[0].children[1].className, 'macros');
  const arc = byClass(root, 'ring')[0].firstChild.children[1];
  assert.equal(arc.attrs.opacity, '0');
  assert.equal(arc.attrs['stroke-linecap'], 'butt');
  const equation = descendants(root).find(node => Object.hasOwn(node.dataset, 'eaten'));
  assert.deepEqual(equation.dataset, { goal: '2,400', eaten: '0', left: '2,400' });
  assert.equal(equation.parent, root);
  assert.ok(byText(root, `Nothing logged for ${dayLabel('2026-10-31', localDate())}.`));
  assert.ok(byText(root, '1 items \u00b7 198 kcal'));
  await byText(root, 'Copy yesterday').parent.parent.fire('click');
  assert.equal(calls[0][0], 'copyLastLoggedDay');
  await byText(root, 'Add food by hand').fire('click');
  await byLabel(root, 'Speak').fire('click');
  assert.deepEqual(calls.slice(-2), [['openSheet', 'add-food', { meal: 1 }], ['openSheet', 'dictate']]);
  assert.equal(root.children.at(-1).attrs['aria-hidden'], 'true');
  assert.equal(byLabel(root, 'Morning weight in kg').attrs.autocomplete, 'off');
});
