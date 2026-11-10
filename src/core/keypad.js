/**
 * @input The keypad's current text, whether it is untouched since opening, and one key
 * @output The next text and "fresh" flag; plus the parsed number
 * @position Pure rules behind src/ui/components/Keypad.tsx (DESIGN-V3 6.1), tested in tests/keypad.test.mjs
 */

export const MAX_DIGITS = 5;
export const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

/** One key press. The first key after opening replaces the value that was there. */
export function pressKey({ text, fresh }, key) {
  if (key === 'clear') return { text: '', fresh: false };
  if (key === 'del') return { text: fresh ? '' : text.slice(0, -1), fresh: false };
  let next = fresh ? '' : text;
  if (key === '.') {
    if (next.includes('.')) return { text: next, fresh: false };
    return { text: `${next || '0'}.`, fresh: false };
  }
  if (!/^[0-9]$/.test(key)) return { text, fresh };
  if (next === '0') next = '';
  if (next.replace('.', '').length >= MAX_DIGITS) return { text: next, fresh: false };
  return { text: next + key, fresh: false };
}

/** The number the text stands for, or null when it is empty or only a point. */
export function keypadValue(text) {
  if (text === '' || text === '.') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Text for a starting number: 150 stays "150", 82.4 stays "82.4", 0.5 stays "0.5". */
export function keypadText(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(Math.round(value * 100) / 100);
}

/** Move a value by a step and keep one decimal place tidy (82.4 + 0.1 is 82.5, not 82.50000001). */
export function nudge(text, step) {
  const value = keypadValue(text) ?? 0;
  const next = Math.max(0, Math.round((value + step) * 10) / 10);
  return keypadText(next);
}
