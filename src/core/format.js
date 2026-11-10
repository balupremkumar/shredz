const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const minus = '\u2212';
const dayMs = 86400000;
const utcDate = dateStr => new Date(`${dateStr}T00:00:00.000Z`);

export function localDate(d = new Date()) {
  return `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr, n) {
  const date = utcDate(dateStr);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return (utcDate(b) - utcDate(a)) / dayMs;
}

export function shortDate(dateStr) {
  const date = utcDate(dateStr);
  return `${weekdays[date.getUTCDay()]} ${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}

export function dayLabel(dateStr, todayStr) {
  const days = daysBetween(todayStr, dateStr);
  if (days === 0) return 'Today';
  if (days === -1) return 'Yesterday';
  if (days === 1) return 'Tomorrow';
  return shortDate(dateStr);
}

export function formatKcal(n) {
  const rounded = Math.round(n);
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rounded < 0 ? minus + digits : digits;
}

export function formatMacro(n) {
  const rounded = n.toFixed(1);
  return rounded === '-0.0' ? '0.0' : rounded;
}

export function formatGrams(n) {
  return `${formatMacro(n)} g`;
}

export function formatKg(n) {
  return formatMacro(n);
}

export function formatChange(n) {
  if (n === null) return '';
  const rounded = formatMacro(n);
  if (Number(rounded) === 0) return '0.0';
  return rounded.startsWith('-') ? minus + rounded.slice(1) : '+' + rounded;
}

export function formatQty(qty, unit) {
  const amount = formatMacro(qty).replace(/\.0$/, '');
  const suffix = (unit === 'item' || unit === 'scoop') && Number(amount) !== 1 ? 's' : '';
  return `${amount} ${unit}${suffix}`;
}

export function parseNumber(text) {
  const trimmed = text.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed)) return null;
  const number = Number(trimmed.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}
