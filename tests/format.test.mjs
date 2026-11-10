import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  localDate, addDays, daysBetween, shortDate, dayLabel, formatKcal,
  formatMacro, formatGrams, formatKg, formatChange, formatQty, parseNumber,
} from '../src/core/format.js';

test('calendar arithmetic crosses months, years and leap days in both directions', () => {
  for (const [a, n, b] of [
    ['2026-10-31', 1, '2026-11-01'], ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'], ['2028-02-28', 2, '2028-03-01'],
    ['2026-02-28', 1, '2026-03-01'], ['2026-01-01', 0, '2026-01-01'],
  ]) {
    assert.equal(addDays(a, n), b);
    assert.equal(addDays(b, -n), a);
    assert.equal(daysBetween(a, b), n);
    assert.equal(daysBetween(b, a), n === 0 ? 0 : -n);
  }
});

test('Auckland local dates and UTC arithmetic survive both NZ daylight-saving changes', () => {
  const moduleUrl = new URL('../src/core/format.js', import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import { localDate, addDays, daysBetween } from ${JSON.stringify(moduleUrl)};
    assert.equal(new Date(2026, 0, 1).getTimezoneOffset(), -780);
    assert.equal(new Date(2026, 6, 1).getTimezoneOffset(), -720);
    assert.equal(localDate(new Date(2026, 9, 31, 23, 30)), '2026-10-31');
    assert.equal(localDate(new Date(2026, 0, 5, 0, 30)), '2026-01-05');
    for (const [a, b] of [
      ['2026-09-26', '2026-09-28'], ['2026-04-04', '2026-04-06'],
    ]) {
      assert.equal(addDays(a, 2), b);
      assert.equal(addDays(b, -2), a);
      assert.equal(daysBetween(a, b), 2);
      assert.equal(daysBetween(b, a), -2);
    }
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, TZ: 'Pacific/Auckland' }, encoding: 'utf8',
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
});

test('localDate uses local fields and pads the month and day', () => {
  assert.equal(localDate(new Date(2026, 9, 31, 23, 30)), '2026-10-31');
  assert.equal(localDate(new Date(2026, 0, 5)), '2026-01-05');
});

test('fixed English dates and relative day labels', () => {
  assert.equal(shortDate('2026-10-31'), 'Sat 31 Oct');
  assert.equal(shortDate('2026-01-05'), 'Mon 5 Jan');
  assert.equal(dayLabel('2027-01-01', '2027-01-01'), 'Today');
  assert.equal(dayLabel('2026-12-31', '2027-01-01'), 'Yesterday');
  assert.equal(dayLabel('2027-01-01', '2026-12-31'), 'Tomorrow');
  assert.equal(dayLabel('2026-10-31', '2026-11-03'), 'Sat 31 Oct');
});

test('calories round, group thousands and use a true minus sign', () => {
  for (const [n, expected] of [
    [1561, '1,561'], [2400, '2,400'], [-120, '\u2212120'],
    [-0.4, '0'], [-0, '0'], [12345.6, '12,346'], [-12345.6, '\u221212,346'],
  ]) assert.equal(formatKcal(n), expected);
});

test('macros, grams and weight always show one decimal', () => {
  assert.equal(formatMacro(81.5), '81.5');
  assert.equal(formatMacro(82), '82.0');
  assert.equal(formatMacro(81.56), '81.6');
  assert.equal(formatGrams(82), '82.0 g');
  assert.equal(formatGrams(81.5), '81.5 g');
  assert.equal(formatKg(82.4), '82.4');
  assert.equal(formatKg(82), '82.0');
});

test('weight changes show signs except for rounded zero or null', () => {
  for (const [n, expected] of [
    [-0.6, '\u22120.6'], [0.1, '+0.1'], [1, '+1.0'],
    [0, '0.0'], [-0, '0.0'], [-0.04, '0.0'], [0.04, '0.0'], [null, ''],
  ]) assert.equal(formatChange(n), expected);
});

test('quantities cover every unit, plural and decimal display', () => {
  for (const [qty, unit, expected] of [
    [125, 'g', '125 g'], [125.25, 'g', '125.3 g'],
    [200, 'ml', '200 ml'], [200.5, 'ml', '200.5 ml'],
    [1, 'item', '1 item'], [2, 'item', '2 items'], [0.5, 'item', '0.5 items'],
    [1, 'scoop', '1 scoop'], [1.5, 'scoop', '1.5 scoops'],
    [0, 'scoop', '0 scoops'], [2, 'scoop', '2 scoops'],
  ]) assert.equal(formatQty(qty, unit), expected);
});

test('number parsing accepts decimal commas and dots and rejects malformed input', () => {
  for (const [text, expected] of [
    ['82,4', 82.4], [' 82.4 ', 82.4], ['0', 0], ['-0.6', -0.6],
    ['+1,5', 1.5], ['.5', 0.5], [',5', 0.5], ['82', 82],
  ]) assert.equal(parseNumber(text), expected);
  for (const text of [
    '', '   ', '8 2', '82.4.1', '82,4,1', '82,4.1', 'hello',
    'NaN', 'Infinity', '-Infinity', '82 kg', '.', ',', '0x10', '1e3',
    '9'.repeat(400),
  ]) assert.equal(parseNumber(text), null, text);
});
