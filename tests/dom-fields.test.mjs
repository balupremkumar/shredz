import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldAttrs, isRiskyFieldToken, hardenFields } from '../src/ui/dom.js';

const common = { autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
  'data-1p-ignore': '', 'data-lpignore': 'true', 'data-form-type': 'other' };
const kinds = {
  search: { type: 'search', inputmode: 'search', enterkeyhint: 'search', autocapitalize: 'none' },
  number: { type: 'text', inputmode: 'decimal', enterkeyhint: 'done', autocapitalize: 'none' },
  text: { type: 'text', enterkeyhint: 'done', autocapitalize: 'words' },
  note: { enterkeyhint: 'enter', autocapitalize: 'sentences' },
};

function field(tagName, attrs = {}) {
  const values = new Map(Object.entries(attrs));
  return { tagName,
    getAttribute: key => values.has(key) ? values.get(key) : null,
    setAttribute: (key, value) => values.set(key, String(value)),
    removeAttribute: key => values.delete(key), hasAttribute: key => values.has(key) };
}

function harden(...fields) {
  hardenFields({ querySelectorAll(selector) {
    assert.equal(selector, 'input, textarea');
    return fields;
  } });
}

test('each field kind returns its complete attributes without risky values or names', () => {
  for (const [kind, attrs] of Object.entries(kinds)) {
    const result = fieldAttrs(kind);
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.deepEqual(result, { ...common, ...attrs });
    assert.equal(Object.hasOwn(result, 'name'), false);
    for (const value of Object.values(result)) assert.equal(isRiskyFieldToken(value), false);
    result.autocomplete = 'changed';
    assert.equal(fieldAttrs(kind).autocomplete, 'off');
  }
  for (const kind of ['password', '', 'toString', undefined, null]) assert.throws(() => fieldAttrs(kind), TypeError);
});

test('risky tokens match substrings regardless of case and ignore non-strings', () => {
  for (const token of ['name', 'email', 'mail', 'card', 'cc', 'pass', 'user', 'login', 'addr',
    'phone', 'tel', 'zip', 'postal', 'otp', 'code']) {
    assert.equal(isRiskyFieldToken(`prefix-${token.toUpperCase()}-suffix`), true);
  }
  for (const value of ['', 'quantity', 'food-edit-fat', 'search', null, undefined, 123, {}, []]) {
    assert.equal(isRiskyFieldToken(value), false);
  }
});

test('hardening chooses each kind and forces the six shared opt-outs', () => {
  for (const [kind, tag, initial] of [
    ['search', 'INPUT', { type: 'SEARCH' }], ['number', 'INPUT', { type: 'text', inputmode: 'decimal' }],
    ['number', 'INPUT', { type: 'text', inputmode: 'numeric' }], ['text', 'INPUT', {}],
    ['note', 'TEXTAREA', {}],
  ]) {
    const item = field(tag, { ...initial, autocomplete: 'cc-number', autocorrect: 'on',
      spellcheck: 'true', 'data-1p-ignore': 'false', 'data-lpignore': 'false', 'data-form-type': 'login' });
    harden(item);
    for (const [key, value] of Object.entries({ ...common, ...kinds[kind] })) {
      if (key !== 'type') assert.equal(item.getAttribute(key), initial[key] ?? value);
    }
    assert.equal(item.getAttribute('type'), initial.type ?? null);
  }
});

test('skipped input types retain all attributes', () => {
  for (const type of ['checkbox', 'radio', 'range', 'date', 'file', 'button', 'submit', 'hidden']) {
    const item = field('INPUT', { type: type.toUpperCase(), name: 'username', autocomplete: 'on' });
    harden(item);
    assert.equal(item.getAttribute('name'), 'username');
    assert.equal(item.getAttribute('autocomplete'), 'on');
    assert.equal(item.hasAttribute('data-1p-ignore'), false);
  }
});

test('existing field hints, type and risky id are retained, risky names are removed', () => {
  const item = field('INPUT', { type: 'text', id: 'food-edit-name', name: 'userName',
    inputmode: 'numeric', autocapitalize: '', enterkeyhint: 'next' });
  const safe = field('INPUT', { name: 'quantity' });
  harden(item, safe);
  for (const [key, value] of Object.entries({ type: 'text', id: 'food-edit-name', inputmode: 'numeric',
    autocapitalize: '', enterkeyhint: 'next' })) assert.equal(item.getAttribute(key), value);
  assert.equal(item.hasAttribute('name'), false);
  assert.equal(safe.getAttribute('name'), 'quantity');
});
