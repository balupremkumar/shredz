import test from 'node:test';
import assert from 'node:assert/strict';
import { pressKey, keypadValue, keypadText, nudge, MAX_DIGITS } from '../src/core/keypad.js';

const type = (start, keys) => keys.reduce((state, key) => pressKey(state, key), start);

test('the first key after opening replaces the value that was there', () => {
  assert.deepEqual(pressKey({ text: '150', fresh: true }, '2'), { text: '2', fresh: false });
  assert.deepEqual(type({ text: '150', fresh: true }, ['2', '0', '0']), { text: '200', fresh: false });
});

test('later keys append, and a leading zero is replaced', () => {
  assert.equal(type({ text: '', fresh: false }, ['0', '5']).text, '5');
  assert.equal(type({ text: '1', fresh: false }, ['5', '0']).text, '150');
});

test('one decimal point only, and a point on an empty value shows 0.', () => {
  assert.equal(type({ text: '', fresh: false }, ['.']).text, '0.');
  assert.equal(type({ text: '150', fresh: true }, ['.', '5']).text, '0.5');
  assert.equal(type({ text: '82', fresh: false }, ['.', '4', '.', '1']).text, '82.41');
});

test('at most five digits, the point not counted', () => {
  const full = type({ text: '', fresh: false }, ['1', '2', '3', '4', '5', '6']);
  assert.equal(full.text, '12345');
  assert.equal(MAX_DIGITS, 5);
  assert.equal(type({ text: '', fresh: false }, ['1', '2', '.', '3', '4', '5', '6']).text, '12.345');
});

test('delete removes one character; on an untouched value it clears; clear empties', () => {
  assert.equal(pressKey({ text: '150', fresh: false }, 'del').text, '15');
  assert.deepEqual(pressKey({ text: '150', fresh: true }, 'del'), { text: '', fresh: false });
  assert.equal(pressKey({ text: '', fresh: false }, 'del').text, '');
  assert.deepEqual(pressKey({ text: '150', fresh: false }, 'clear'), { text: '', fresh: false });
});

test('unknown keys change nothing', () => {
  assert.deepEqual(pressKey({ text: '15', fresh: true }, 'x'), { text: '15', fresh: true });
});

test('value and text round trip', () => {
  assert.equal(keypadValue(''), null);
  assert.equal(keypadValue('.'), null);
  assert.equal(keypadValue('0.'), 0);
  assert.equal(keypadValue('82.4'), 82.4);
  assert.equal(keypadText(150), '150');
  assert.equal(keypadText(82.4), '82.4');
  assert.equal(keypadText(null), '');
});

test('nudge moves by a tenth without float noise and never below zero', () => {
  assert.equal(nudge('82.4', 0.1), '82.5');
  assert.equal(nudge('82.4', -0.1), '82.3');
  assert.equal(nudge('82.9', 0.1), '83');
  assert.equal(nudge('0', -0.1), '0');
  assert.equal(nudge('', 0.1), '0.1');
});
