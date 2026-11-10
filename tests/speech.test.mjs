import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechSession, pickRecogniserConstructor, foodName, isFoodName, shouldAutoSave } from '../src/core/speech.js';

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
  const pending = [];
  const schedule = (fn, ms) => {
    const task = { fn, ms, cancelled: false }; pending.push(task);
    return () => { task.cancelled = true; };
  };
  const runNext = () => { const task = pending.shift(); if (!task.cancelled) task.fn(); };
  const session = createSpeechSession({ recogniser, schedule, onTranscript: text => texts.push(text), onState: state => states.push(state) });
  return { recogniser, texts, states, session, pending, runNext };
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
  const { recogniser: r, session: s, runNext } = fixture(); s.start();
  for (let i = 0; i < 20; i += 1) { r.onend(); runNext(); }
  assert.equal(r.starts, 21); assert.equal(s.state, 'listening');
  r.result('milk'); r.onend(); runNext(); assert.equal(r.starts, 22);
  for (let i = 0; i < 19; i += 1) { r.onend(); runNext(); }
  r.onend();
  assert.equal(s.state, 'error'); assert.equal(r.starts, 41);
  s.start(); s.stop(); const starts = r.starts; r.onend();
  assert.equal(s.state, 'stopped'); assert.equal(r.stops, 1); assert.equal(r.starts, starts);
});
test('restart waits 250 ms and stopping cancels even an already queued callback', () => {
  const { recogniser: r, session: s, pending, runNext } = fixture();
  s.start(); r.onend();
  assert.equal(r.starts, 1); assert.equal(pending[0].ms, 250);
  runNext(); assert.equal(r.starts, 2);
  r.onend(); const task = pending[0];
  s.stop(); assert.equal(task.cancelled, true);
  s.start(); const starts = r.starts;
  task.fn(); runNext(); assert.equal(r.starts, starts);
  s.stop();
});
test('auto-save requires final save in listening mode and recognised words in both modes', () => {
  const preview = (save, unmatched = []) => ({ save, unmatched, meals: [{ items: [{ foodId: 'milk', qty: 200 }] }] });
  const options = { typing: false, finalText: 'milk', draftPreview: preview(true), finalPreview: preview(false) };
  assert.equal(shouldAutoSave(options), false, 'interim-only save');
  assert.equal(shouldAutoSave({ ...options, finalText: 'milk save', finalPreview: preview(true) }), true, 'final save');
  assert.equal(shouldAutoSave({ ...options, finalText: 'milk save', finalPreview: preview(true), draftPreview: preview(true, ['unknown']) }), false);
  assert.equal(shouldAutoSave({ ...options, typing: true }), true, 'keyboard dictation');
  assert.equal(shouldAutoSave({ ...options, typing: true, draftPreview: preview(true, ['unknown']) }), false);
  assert.equal(shouldAutoSave({ ...options, finalText: 'unknown save', finalPreview: preview(true, ['unknown']) }), false);
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

