import { h } from './dom.js';
import { addDays, daysBetween, dayLabel, shortDate, localDate, formatKg, formatChange, formatKcal, formatGrams } from '../format.js';

function weightInput(value, id) {
  return h('input', {
    class: 'input weigh-in__input',
    attrs: {
      id, type: 'text', inputmode: 'decimal', enterkeyhint: 'done',
      'aria-label': 'Weight in kg', value: value === null ? '' : formatKg(value),
      autocomplete: 'off',
    },
    on: { focus: event => event.target.select() },
  });
}

function problemLine() {
  return h('p', { class: 'problem-line', attrs: { role: 'alert', hidden: true } });
}

function showProblem(problem, result) {
  problem.textContent = result.error;
  problem.hidden = false;
}

function svgElement(tag, attrs, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function chart(weights, trend, date, today) {
  if (weights.length < 2) {
    return h('p', { class: 'empty', text: 'Log at least two days to see your trend.' });
  }
  const start = addDays(date, -29);
  const values = [...weights, ...trend].map(weight => weight.kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = min === max ? 1 : 0.5;
  const bottom = min - padding;
  const top = max + padding;
  const x = day => 44 + daysBetween(start, day) / 29 * 284;
  const y = kg => 128 - (kg - bottom) / (top - bottom) * 112;
  const svg = svgElement('svg', {
    viewBox: '0 0 340 160', width: '100%', role: 'img',
    'aria-label': `Weight trend from ${shortDate(start)} to ${shortDate(date)}, in kg`,
  });
  for (const kg of [top, (top + bottom) / 2, bottom]) {
    svg.appendChild(svgElement('line', {
      x1: 44, x2: 328, y1: y(kg), y2: y(kg), stroke: 'var(--line)',
    }));
    svg.appendChild(svgElement('text', {
      x: 36, y: y(kg) + 4, 'text-anchor': 'end', fill: 'var(--muted)',
    }, formatKg(kg)));
  }
  svg.appendChild(svgElement('polyline', {
    points: weights.map(weight => `${x(weight.date)},${y(weight.kg)}`).join(' '),
    fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1,
  }));
  for (const weight of weights) {
    svg.appendChild(svgElement('circle', {
      cx: x(weight.date), cy: y(weight.kg), r: 2, fill: 'var(--muted)',
    }));
  }
  if (trend.length) {
    svg.appendChild(svgElement('polyline', {
      points: trend.map(point => `${x(point.date)},${y(point.kg)}`).join(' '),
      fill: 'none', stroke: '#43A6F5', 'stroke-width': 2.5,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    }));
  }
  for (const [day, anchor, label] of [
    [start, 'start', shortDate(start)],
    [addDays(start, 14), 'middle', shortDate(addDays(start, 14))],
    [date, 'end', date === today ? 'Today' : shortDate(date)],
  ]) {
    svg.appendChild(svgElement('text', {
      x: x(day), y: 152, 'text-anchor': anchor, fill: 'var(--muted)',
    }, label));
  }
  return h('div', { class: 'chart' }, svg,
    h('p', { class: 'muted', text: 'Line: 7-day average. Dots: daily.' }));
}

function reportSection(app) {
  const reports = [app.select.report(7), app.select.report(30)];
  const rows = [
    ['Calories', report => formatKcal(report.kcal)],
    ['Protein', report => formatGrams(report.protein)],
    ['Carbs', report => formatGrams(report.carbs)],
    ['Fat', report => formatGrams(report.fat)],
    ['Weight change', report => (report.weightChange === null ? 'n/a' : `${formatChange(report.weightChange)} kg`)],
  ];
  return h('section', { class: 'section' },
    h('div', { class: 'section__head' }, h('h2', { text: 'Report' })),
    h('div', { class: 'list' },
      h('div', { class: 'row' },
        h('span', { class: 'row__body' }),
        h('span', { class: 'row__kcal num', text: '7 days' }),
        h('span', { class: 'row__kcal num', text: '30 days' })),
      rows.map(([label, value]) => h('div', { class: 'row' },
        h('span', { class: 'row__body' }, h('span', { class: 'row__name', text: label })),
        reports.map(report => h('span', { class: 'row__kcal num', text: value(report) }))))),
    h('p', { class: 'muted', text: reports.map(report => `${report.loggedDays} of ${report.days} days logged`).join(', ') }),
  );
}

export function render(root, app) {
  const date = app.state.date;
  const today = localDate();
  const day = app.select.day();
  const input = weightInput(day.weight ?? day.lastWeight, 'weight-entry');
  const problem = problemLine();
  let saving = false;
  const save = async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    const result = await app.actions.logWeight(date, input.value);
    saving = false;
    if (result.ok) app.toast('Weight logged');
    else showProblem(problem, result);
  };
  root.appendChild(h('form', { class: 'section', on: { submit: save } },
    h('div', { class: 'section__head' },
      h('label', { text: date === today ? "Today's weight" : `Weight on ${dayLabel(date, today)}`, attrs: { for: 'weight-entry' } })),
    h('div', { class: 'row' }, input,
      h('span', { class: 'muted', text: 'kg' }),
      h('button', { class: 'pill pill--primary', text: 'Save', attrs: { type: 'submit' } })),
    problem,
  ));
  root.appendChild(reportSection(app));
  root.appendChild(h('section', { class: 'section' },
    h('div', { class: 'section__head' }, h('h2', { text: 'Last 30 days' })),
    chart(app.select.weights(30), app.select.weightTrend(30), date, today),
  ));
  const weights = app.select.weights(90);
  const recent = weights.slice(-14).reverse().map((weight, index) => {
    const older = weights[weights.length - 2 - index];
    return h('button', {
      class: 'row', attrs: { type: 'button' },
      on: { click: () => app.actions.openSheet('weight-edit', { date: weight.date }) },
    },
    h('span', { class: 'row__body' },
      h('span', { class: 'row__name', text: dayLabel(weight.date, today) })),
    h('span', { class: 'row__kcal' },
      h('span', { class: 'num', text: `${formatKg(weight.kg)} kg` }),
      h('span', { class: 'row__qty num', text: formatChange(older ? weight.kg - older.kg : null) })),
    );
  });
  root.appendChild(h('section', { class: 'section' },
    h('div', { class: 'section__head' }, h('h2', { text: 'Recent' })),
    recent.length ? h('div', { class: 'list' }, recent)
      : h('p', { class: 'empty', text: 'Log your first weight above.' }),
  ));
}

function editWeight(root, app, { date }) {
  const input = weightInput(app.select.day(date).weight, 'weight-edit-input');
  const problem = problemLine();
  let busy = false;
  const finish = async action => {
    if (busy) return;
    busy = true;
    const result = await action();
    busy = false;
    if (result.ok) app.actions.closeSheet();
    else showProblem(problem, result);
  };
  root.appendChild(h('div', { class: 'sheet__head' },
    h('h2', { text: shortDate(date) }),
    h('button', {
      class: 'link-btn', text: 'Cancel', attrs: { type: 'button' },
      on: { click: () => app.actions.closeSheet() },
    }),
  ));
  root.appendChild(h('form', {
    on: { submit: event => {
      event.preventDefault();
      finish(() => app.actions.logWeight(date, input.value));
    } },
  },
  h('div', { class: 'sheet__body' },
    h('div', { class: 'field' },
      h('label', { class: 'field__label', text: 'Weight in kg', attrs: { for: 'weight-edit-input' } }),
      input), problem),
  h('div', { class: 'sheet__foot' },
    h('button', { class: 'pill pill--primary', text: 'Save', attrs: { type: 'submit' } }),
    h('button', {
      class: 'pill pill--danger', text: 'Delete', attrs: { type: 'button' },
      on: { click: () => finish(() => app.actions.deleteWeight(date)) },
    })),
  ));
  input.focus();
}

export const sheets = { 'weight-edit': editWeight };
