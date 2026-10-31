import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechSession, pickRecogniserConstructor, foodName, isFoodName, sheets } from '../src/ui/dictate.js';

class Recogniser {
  constructor() { this.starts = 0; this.stops = 0; Recogniser.last = this; }
  start() { this.starts += 1; if (this.failure) throw this.failure; }
  stop() { this.stops += 1; }
  result(text, isFinal = true) {
    const result = [{ transcript: text }]; result.isFinal = isFinal;
    this.onresult({ resultIndex: 0, results: [result] });
  }
}
function fixture() {
  const recogniser = new Recogniser();
  const texts = [], states = [];
  const session = createSpeechSession({ recogniser, onTranscript: text => texts.push(text), onState: state => states.push(state) });
  return { recogniser, texts, states, session };
}
test('speech config, interim replacement, finals join, double start and reset', () => {
  const { recogniser: r, session: s, texts } = fixture();
  assert.equal(s.state, 'idle'); s.start(); s.start();
  assert.equal(r.starts, 1); assert.equal(s.state, 'listening');
  assert.equal(r.lang, 'en-NZ'); assert.equal(r.interimResults, true); assert.equal(r.continuous, true);
  r.result('green', false); assert.deepEqual(texts.at(-1), { final: '', interim: 'green' });
  r.result('green milk', false); assert.deepEqual(texts.at(-1), { final: '', interim: 'green milk' });
  r.result('green milk'); r.result('banana');
  assert.deepEqual(texts.at(-1), { final: 'green milk banana', interim: '' });
  s.reset(); assert.deepEqual(texts.at(-1), { final: '', interim: '' });
});
test('resultIndex prevents old final results being appended again', () => {
  const { recogniser: r, session: s, texts } = fixture(); s.start(); r.result('milk');
  const a = [{ transcript: 'milk' }], b = [{ transcript: 'banana' }]; a.isFinal = b.isFinal = true;
  r.onresult({ resultIndex: 1, results: [a, b] });
  assert.equal(texts.at(-1).final, 'milk banana');
});
test('restart on end, cap 20, new result resets cap, stop prevents restart', () => {
  const { recogniser: r, session: s } = fixture(); s.start();
  for (let i = 0; i < 20; i += 1) r.onend();
  assert.equal(r.starts, 21); assert.equal(s.state, 'listening');
  r.result('milk'); r.onend(); assert.equal(r.starts, 22);
  for (let i = 0; i < 20; i += 1) r.onend();
  assert.equal(s.state, 'error'); assert.equal(r.starts, 41);
  s.start(); s.stop(); const starts = r.starts; r.onend();
  assert.equal(s.state, 'stopped'); assert.equal(r.stops, 1); assert.equal(r.starts, starts);
});
test('denied, ignored errors, generic errors, thrown start and unsupported', () => {
  for (const error of ['not-allowed', 'service-not-allowed']) {
    const { recogniser: r, session: s } = fixture(); s.start(); r.onerror({ error });
    assert.equal(s.state, 'denied'); r.onend(); assert.equal(r.starts, 1);
  }
  const { recogniser: r, session: s } = fixture(); s.start();
  for (const error of ['no-speech', 'aborted']) { r.onerror({ error }); assert.equal(s.state, 'listening'); }
  r.onerror({ error: 'network' }); assert.equal(s.state, 'error');
  r.failure = { name: 'NotAllowedError' }; s.start(); assert.equal(s.state, 'denied');
  r.failure = new Error('start failed'); s.start(); assert.equal(s.state, 'error');
  const unsupported = createSpeechSession({ recogniser: null }); unsupported.start(); assert.equal(unsupported.state, 'unsupported');
});
test('constructor selection', () => {
  const other = class {};
  assert.equal(pickRecogniserConstructor({ SpeechRecognition: Recogniser, webkitSpeechRecognition: other }), Recogniser);
  assert.equal(pickRecogniserConstructor({ webkitSpeechRecognition: other }), other);
  assert.equal(pickRecogniserConstructor({}), null);
});
test('food names discard amounts, punctuation and units', () => {
  for (const raw of ['3 servings', '100 grams', 'two scoops', '200 mils', 'half a scoop', '1,000 ml', 'of', '', '... servings!', 'a couple of pieces']) {
    assert.equal(foodName(raw), '', raw); assert.equal(isFoodName(raw), false, raw);
  }
  for (const word of 'servings serving serves serve grams gram g kilograms kilogram kg millilitres milliliters mils mil ml litres liters l items item scoops scoop slices slice pieces piece'.split(' ')) {
    assert.equal(foodName(`2 ${word}`), '', word);
  }
  for (const [raw, expected] of [['3 bananas', 'bananas'], ['a serving of banana', 'banana'], ['2 wheaties', 'wheaties'], ['100 grams of chicken breast', 'chicken breast'], ['Weet-Bix', 'Weet-Bix'], [' a couple of bananas! ', 'bananas'], ['1.5 scoops whey', 'whey']]) {
    assert.equal(foodName(raw), expected); assert.equal(isFoodName(raw), true);
  }
});

// Tiny DOM: sheet tests use fake previews, independent of parser vocabulary.
class El {
  constructor(tag = '') { this.tagName = tag; this.children = []; this.attrs = {}; this.dataset = {}; this.events = {}; this.value = ''; this.hidden = false; this.isConnected = true; this.ownText = ''; }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key]; }
  addEventListener(key, fn) { this.events[key] = fn; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  set textContent(value) { this.ownText = value; this.children = []; }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(' '); }
  focus() { document.activeElement = this; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  click() { if (!this.disabled) return this.events.click?.(); }
}
const all = root => [root, ...root.children.flatMap(all)];
const find = (root, text) => all(root).find(el => el.tagName === 'button' && el.textContent === text);
const field = root => all(root).find(el => el.tagName === 'textarea');
const classed = (root, name) => all(root).filter(el => el.className?.split(' ').includes(name));
const food = { id: 'milk', name: 'Green milk', baseQty: 100, unit: 'ml', kcal: 50, protein: 5 };
const docEvents = {};
function environment(Constructor) {
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  const doc = { createElement: tag => new El(tag), createElementNS: (_, tag) => new El(tag), createTextNode: text => { const el = new El(); el.textContent = text; return el; },
    addEventListener: (name, fn) => { docEvents[name] = fn; }, visibilityState: 'visible' };
  globalThis.document = doc; globalThis.window = Constructor ? { SpeechRecognition: Constructor } : {};
  let root = new El('root');
  const calls = [], previews = [];
  let unmatched = [], warnings = [], fail = false;
  const app = { state: { date: '2026-10-31' }, select: {
    preview: text => {
      previews.push(text);
      const items = /milk/.test(text) ? [{ foodId: 'milk', qty: 200, unit: 'ml', savedMealId: 'shake' }] : [];
      return { meals: [{ meal: 1, items }], unmatched, warnings, save: /save/.test(text), kcal: items.length * 100 };
    }, foods: () => [food], savedMeals: () => [{ id: 'shake', name: 'Shake' }], recentFoods: () => [food],
  }, actions: {
    addParsed: async (date, preview) => { calls.push(['save', date, preview]); return fail ? { ok: false, error: 'Try again' } : { ok: true, added: 1, kcal: 100 }; },
    closeSheet: async () => { calls.push(['close']); return { ok: true }; },
    openSheet: async (...args) => { calls.push(['open', ...args]); return { ok: true }; },
    addAlias: async (...args) => { calls.push(['alias', ...args]); return { ok: true, food }; },
  }, toast: text => calls.push(['toast', text]) };
  const render = (props = {}, replace = false) => {
    if (replace) { root.isConnected = false; root = new El('root'); }
    root.replaceChildren(); sheets.dictate(root, app, props);
  };
  const input = text => { field(root).value = text; field(root).events.input(); };
  const cleanup = async () => {
    await find(root, 'Cancel')?.click();
    globalThis.document = oldDocument; globalThis.window = oldWindow;
  };
  return { get root() { return root; }, app, calls, previews, render, input, cleanup, doc,
    unmatched: value => { unmatched = value; }, warnings: value => { warnings = value; }, fail: value => { fail = value; } };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('unsupported typing, item nutrition, meal prefix, save and retained props', async () => {
  const e = environment();
  try {
    e.render({ text: '' });
    assert.equal(document.activeElement, field(e.root)); assert.equal(field(e.root).getAttribute('autocomplete'), 'off');
    assert.match(e.root.textContent, /Speech needs a newer iPhone setting/);
    assert.equal(classed(e.root, 'speak-mic').length, 0); assert.equal(find(e.root, 'Save 0 items').disabled, true);
    e.input('milk');
    assert.match(e.root.textContent, /I heard/); assert.match(e.root.textContent, /Green milk/);
    assert.match(classed(e.root, 'row__qty')[0].textContent, /200 ml from Shake/);
    assert.match(e.root.textContent, /100 kcal/); assert.match(e.root.textContent, /10.0 g protein/);
    e.render({ text: '' }); assert.equal(field(e.root).value, 'milk');
    await find(e.root, 'Meal 2 \u203a').click(); assert.equal(e.previews.at(-1), 'meal 2, milk');
    e.input('meal two milk'); assert.equal(e.previews.at(-1), 'meal two milk');
    await find(e.root, 'Save 1 item').click();
    assert.deepEqual(e.calls.map(call => call[0]), ['save', 'close', 'toast']);
    assert.equal(e.calls[2][1], 'Added 1 items, 100 kcal');
  } finally { await e.cleanup(); }
});
test('typed save commits once; empty save stays open; failed save can retry', async () => {
  const e = environment();
  try {
    e.render({ text: '' }); e.input('save'); await settle();
    assert.equal(e.calls.length, 0); assert.match(e.root.textContent, /Nothing to save yet/);
    e.fail(true); e.input('milk save'); await settle();
    assert.equal(e.calls.filter(call => call[0] === 'save').length, 1);
    assert.equal(find(e.root, 'Save 1 item').disabled, false);
    assert.deepEqual(e.calls.at(-1), ['toast', 'Try again']);
    e.fail(false); await find(e.root, 'Save 1 item').click();
    assert.equal(e.calls.filter(call => call[0] === 'save').length, 2);
  } finally { await e.cleanup(); }
});
test('unmatched units cannot add or learn; names add, learn and remove in place', async () => {
  const e = environment();
  try {
    e.unmatched([{ meal: 1, raw: '3 servings' }, { meal: 1, raw: '2 wheaties' }]);
    e.warnings([{ message: 'Check the amount' }]); e.render({ text: 'wheaties' });
    const rows = classed(e.root, 'row--problem');
    assert.equal(find(rows[0], 'Add'), undefined); assert.equal(find(rows[0], 'This is...'), undefined);
    assert.match(rows[0].textContent, /Not a food name/); assert.match(e.root.textContent, /Check the amount/);
    await find(rows[1], 'Add').click();
    assert.deepEqual(e.calls.find(call => call[0] === 'open'), ['open', 'food-edit', { name: 'wheaties', returnTo: { name: 'dictate', props: { text: 'wheaties' } } }]);
    const current = classed(e.root, 'row--problem')[1];
    find(current, 'This is...').click();
    await find(current, 'Learn').click(); assert.match(e.root.textContent, /Pick a food first/);
    all(current).find(el => el.tagName === 'select').value = 'milk';
    await find(current, 'Learn').click();
    assert.deepEqual(e.calls.find(call => call[0] === 'alias'), ['alias', 'milk', 'wheaties']);
    const row = classed(e.root, 'row--problem')[0]; find(row, 'Remove').click(); assert.equal(row.hidden, true);
    e.input('wheaties again'); assert.equal(classed(e.root, 'row--problem').length, 1);
  } finally { await e.cleanup(); }
});
test('speech starts once across renders, interim and final preview, switch typing and back, disconnect stops', async () => {
  const e = environment(Recogniser);
  try {
    e.render({ text: '' }); const r = Recogniser.last;
    assert.equal(r.starts, 1); assert.equal(field(e.root), undefined);
    assert.equal(classed(e.root, 'speak-mic')[0].getAttribute('aria-label'), 'Tap to stop');
    e.render({}, true); assert.equal(r.starts, 1);
    r.onend(); r.onend(); assert.match(e.root.textContent, /Didn't catch that/);
    r.result('milk', false); assert.match(e.root.textContent, /Green milk/);
    r.result('milk'); e.render({}, true); r.result('banana'); assert.equal(e.previews.at(-1), 'milk banana');
    find(e.root, 'Type instead').click(); assert.equal(r.stops, 1); assert.equal(document.activeElement, field(e.root));
    e.input('milk typed'); find(e.root, 'Use the mic').click(); r.result('more');
    assert.equal(e.previews.at(-1), 'milk typed more');
    e.doc.visibilityState = 'hidden'; docEvents.visibilitychange(); assert.equal(r.stops, 2);
    e.doc.visibilityState = 'visible'; classed(e.root, 'speak-mic')[0].click();
    e.root.isConnected = false; r.result('ignored'); assert.equal(r.stops, 3);
  } finally { await e.cleanup(); }
});
test('spoken save, denied fallback, thrown start and visibility lifecycle', async () => {
  const e = environment(Recogniser);
  try {
    e.render({ text: '' }); Recogniser.last.result('milk save'); await settle();
    assert.deepEqual(e.calls.slice(0, 3).map(call => call[0]), ['save', 'close', 'toast']);
    e.render(); const r = Recogniser.last; r.onerror({ error: 'not-allowed' });
    assert.match(e.root.textContent, /Microphone is off for Shredz/); assert.ok(field(e.root));
    assert.equal(document.activeElement, field(e.root));
    await find(e.root, 'Cancel').click();
    class Broken extends Recogniser { start() { throw new Error('unavailable'); } }
    window.SpeechRecognition = Broken; e.render(); assert.ok(field(e.root)); assert.match(e.root.textContent, /Speech stopped here/);
  } finally { await e.cleanup(); }
});


