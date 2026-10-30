import { h } from './dom.js';
import { parseNumber, formatKcal, formatMacro } from '../format.js';
import { APP_VERSION } from '../version.js';

function button(text, className, click) {
  return h('button', {
    class: className, text, attrs: { type: 'button' }, on: { click },
  });
}

function section(title, ...children) {
  return h('section', { class: 'section' },
    h('div', { class: 'section__head' }, h('h2', { text: title })), ...children,
  );
}

async function shareOrDownload(app, result, type, title) {
  const file = new File([result.text], result.fileName, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title });
  } else {
    const url = URL.createObjectURL(file);
    const link = h('a', { attrs: { href: url, download: result.fileName, hidden: true } });
    try {
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      // Let the browser start reading the download before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

async function exportBackup(app) {
  try {
    const result = await app.actions.exportBackup(new Date().toISOString());
    if (!result.ok) {
      app.toast(result.error);
      return;
    }
    await shareOrDownload(app, result, 'application/json', 'Shredz backup');
  } catch (error) {
    if (error.name !== 'AbortError') app.toast(error.message || 'Could not export the backup.');
  }
}

async function exportCsv(app, kind) {
  try {
    const result = await app.actions.exportCsv(kind);
    if (!result.ok) {
      app.toast(result.error);
      return;
    }
    await shareOrDownload(app, result, 'text/csv', `Shredz ${kind} CSV`);
  } catch (error) {
    if (error.name !== 'AbortError') app.toast(error.message || 'Could not export the CSV.');
  }
}

function chooseBackup(app) {
  const picker = h('input', {
    attrs: { type: 'file', accept: 'application/json,.json', hidden: true },
    on: {
      cancel: () => picker.remove(),
      change: async () => {
        const file = picker.files[0];
        picker.remove();
        if (!file) return;
        try {
          const text = await file.text();
          app.actions.openSheet('import-confirm', { text, fileName: file.name });
        } catch (error) {
          app.toast(error.message || 'Could not read the backup.');
        }
      },
    },
  });
  document.body.appendChild(picker);
  picker.click();
}

const wholeNumber = n => formatMacro(n).replace(/\.0$/, '');

function goalsSection(app, settings) {
  let mode = settings.goalMode === 'grams' ? 'grams' : 'percent';
  const goals = settings.goals;
  const split = settings.split || {};
  const defs = {
    percent: [['kcal', 'Calories (kcal)', goals.kcal], ['protein', 'Protein %', split.protein],
      ['carbs', 'Carbs %', split.carbs], ['fat', 'Fat %', split.fat]],
    grams: [['protein', 'Protein g', goals.protein], ['carbs', 'Carbs g', goals.carbs],
      ['fat', 'Fat g', goals.fat]],
  };
  const inputs = { percent: {}, grams: {} };
  const panels = {};
  const pills = {};
  const problem = h('p', { class: 'problem-line', attrs: { id: 'goals-problem', role: 'alert', hidden: true } });
  const percentLine = h('p', { class: 'muted' });
  const totalLine = h('p', { class: 'muted' });
  const gramsLine = h('p', { class: 'muted' });

  const read = (m, key) => {
    const value = parseNumber(inputs[m][key].value);
    return value === null || value < 0 ? null : value;
  };
  const refresh = () => {
    const kcal = read('percent', 'kcal');
    const p = read('percent', 'protein');
    const c = read('percent', 'carbs');
    const f = read('percent', 'fat');
    const grams = (pct, per) => (kcal === null || pct === null ? '?' : formatKcal(kcal * pct / 100 / per));
    percentLine.textContent = `= ${grams(p, 4)} g protein, ${grams(c, 4)} g carbs, ${grams(f, 9)} g fat`;
    const sum = p === null || c === null || f === null ? null : p + c + f;
    totalLine.textContent = `Total ${sum === null ? '?' : wholeNumber(sum)}%`;
    totalLine.className = sum !== null && Math.abs(sum - 100) < 1e-9 ? 'muted' : 'problem-line';
    const gp = read('grams', 'protein');
    const gc = read('grams', 'carbs');
    const gf = read('grams', 'fat');
    if (gp === null || gc === null || gf === null) {
      gramsLine.textContent = '= ? kcal';
    } else {
      const total = gp * 4 + gc * 4 + gf * 9;
      const pct = kcal4 => (total > 0 ? Math.round(kcal4 / total * 100) : 0);
      gramsLine.textContent = `= ${formatKcal(total)} kcal (${pct(gp * 4)}% / ${pct(gc * 4)}% / ${pct(gf * 9)}%)`;
    }
  };

  for (const m of ['percent', 'grams']) {
    panels[m] = h('div', { attrs: { hidden: m !== mode } },
      defs[m].map(([key, label, value]) => {
        const input = h('input', { class: 'input', attrs: {
          id: `goal-${m}-${key}`, type: 'text', inputmode: m === 'percent' && key !== 'kcal' ? 'numeric' : 'decimal',
          enterkeyhint: 'done', value: value ?? '', 'aria-describedby': 'goals-problem',
        }, on: { input: refresh } });
        inputs[m][key] = input;
        return h('div', { class: 'field' },
          h('label', { class: 'field__label', text: label, attrs: { for: `goal-${m}-${key}` } }), input);
      }),
      m === 'percent' ? [percentLine, totalLine] : gramsLine);
  }

  const setMode = next => {
    mode = next;
    problem.hidden = true;
    for (const m of ['percent', 'grams']) {
      panels[m].hidden = m !== mode;
      pills[m].className = m === mode ? 'pill pill--primary' : 'pill pill--secondary';
      pills[m].setAttribute('aria-pressed', String(m === mode));
    }
  };
  for (const [m, label] of [['percent', 'Calories and %'], ['grams', 'Grams']]) {
    pills[m] = h('button', {
      class: m === mode ? 'pill pill--primary' : 'pill pill--secondary', text: label,
      attrs: { type: 'button', 'aria-pressed': String(m === mode) }, on: { click: () => setMode(m) },
    });
  }

  const save = h('button', {
    class: 'pill pill--primary pill--block', text: 'Save goals', attrs: { type: 'submit' },
  });
  const fail = (key, message) => {
    inputs[mode][key].setAttribute('aria-invalid', 'true');
    problem.textContent = message;
    problem.hidden = false;
    inputs[mode][key].focus();
  };
  const form = h('form', { on: { submit: async event => {
    event.preventDefault();
    if (save.disabled) return;
    const next = {};
    for (const [key, label] of defs[mode]) {
      const value = read(mode, key);
      inputs[mode][key].setAttribute('aria-invalid', String(value === null));
      if (value === null) {
        fail(key, `${label}: enter zero or a positive number.`);
        return;
      }
      next[key] = value;
    }
    let input;
    if (mode === 'percent') {
      const sum = next.protein + next.carbs + next.fat;
      if (Math.abs(sum - 100) > 1e-9) {
        fail('protein', `Percentages add up to ${wholeNumber(sum)}, not 100.`);
        return;
      }
      input = { goalMode: 'percent', kcal: next.kcal,
        split: { protein: next.protein, carbs: next.carbs, fat: next.fat } };
    } else {
      input = { goalMode: 'grams', protein: next.protein, carbs: next.carbs, fat: next.fat };
    }
    problem.hidden = true;
    save.disabled = true;
    const result = await app.actions.saveGoalSettings(input);
    save.disabled = false;
    if (result.ok) app.toast('Goals saved');
    else {
      problem.textContent = result.error;
      problem.hidden = false;
    }
  } } },
  h('div', { class: 'field' }, h('div', { class: 'row' }, pills.percent, pills.grams)),
  panels.percent, panels.grams, problem, h('div', { class: 'field' }, save));
  refresh();
  return section('Daily goals', form);
}

function savedMealsSection(app, meals) {
  if (!meals.length) return null;
  return section('Saved meals',
    h('div', { class: 'list' }, meals.map(meal => h('div', { class: 'row' },
      h('span', { class: 'row__body' },
        h('span', { class: 'row__name', text: meal.name }),
        h('span', { class: 'row__qty', text: `${meal.items.length} ${meal.items.length === 1 ? 'item' : 'items'}` })),
      button('Delete', 'link-btn', async () => {
        const result = await app.actions.deleteSavedMeal(meal.id);
        if (!result.ok) app.toast(result.error);
      })))),
    h('p', { class: 'muted', text: 'Save a meal from the Diary with Save meal.' }));
}

export function render(root, app) {
  const settings = app.select.settings();
  const installed = (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
    || navigator.standalone === true;
  root.appendChild(goalsSection(app, settings));
  const meals = savedMealsSection(app, app.select.savedMeals());
  if (meals) root.appendChild(meals);
  root.appendChild(section('Backup',
    h('p', { class: 'muted', text: 'Your diary lives only on this phone. Export a backup now and then and keep it in Files or iCloud Drive.' }),
    h('div', { class: 'field' }, button('Export backup', 'pill pill--secondary pill--block', () => exportBackup(app))),
    h('div', { class: 'field' }, button('Import backup', 'pill pill--secondary pill--block', () => chooseBackup(app))),
    h('div', { class: 'field' }, button('Export diary CSV', 'pill pill--secondary pill--block', () => exportCsv(app, 'diary'))),
    h('div', { class: 'field' }, button('Export weights CSV', 'pill pill--secondary pill--block', () => exportCsv(app, 'weights'))),
  ));
  root.appendChild(section('Display',
    h('label', { class: 'row', attrs: { for: 'large-text' } },
      h('input', {
        attrs: { id: 'large-text', type: 'checkbox', checked: settings.largeText === true },
        on: { change: async event => {
          const result = await app.actions.setLargeText(event.target.checked);
          app.toast(result.ok ? 'Text size updated' : result.error);
        } },
      }),
      h('span', { class: 'row__body' }, h('span', { class: 'row__name', text: 'Larger text' }))),
    // iOS only shows home-screen badges once notifications are allowed for the installed app.
    'setAppBadge' in navigator && 'Notification' in window && Notification.permission === 'default'
      ? h('button', { class: 'pill pill--secondary pill--block', text: 'Turn on weigh-in badge',
        attrs: { type: 'button' },
        on: { click: async () => {
          const permission = await Notification.requestPermission();
          app.toast(permission === 'granted' ? 'Badge on: the icon shows 1 until you weigh in' : 'Badge stays off');
          app.rerender();
        } } })
      : null,
  ));
  root.appendChild(section('Install on iPhone', installed
    ? h('p', { class: 'muted', text: 'Installed: running from your home screen.' })
    : [h('ol', { class: 'list' }, [
      '1. Open this page in Safari.',
      '2. Tap the Share button.',
      '3. Tap Add to Home Screen, then Add.',
    ].map(text => h('li', { class: 'row', text }))),
    h('p', { class: 'muted', text: 'It then opens full screen and works without signal.' })],
  ));
  root.appendChild(section(`Shredz ${APP_VERSION}`,
    h('p', { class: 'muted', text: 'Data stays on this phone. No account, no tracking.' }),
    button('Back to Diary', 'link-btn', () => app.actions.setTab('diary')),
  ));
}

function importConfirm(root, app, { text, fileName }) {
  const problem = h('div', { class: 'problem-line', attrs: { role: 'alert', hidden: true } });
  let busy = false;
  async function importFile(mode) {
    if (busy) return;
    busy = true;
    merge.disabled = replace.disabled = true;
    problem.hidden = true;
    const result = await app.actions.importBackup(text, mode);
    if (result.ok) {
      const { entries, foods, weights } = result.summary;
      app.actions.closeSheet();
      app.toast(`Imported ${entries} entries, ${foods} foods, ${weights} weights`);
    } else {
      problem.textContent = result.error;
      problem.hidden = false;
      busy = false;
      merge.disabled = replace.disabled = false;
    }
  }
  const merge = button('Merge into my diary', 'pill pill--secondary pill--block', () => importFile('merge'));
  const replace = button('Replace everything', 'pill pill--danger pill--block', () => importFile('replace'));
  root.appendChild(h('div', { class: 'sheet__head' },
    h('h2', { text: 'Import backup' }),
    button('Cancel', 'link-btn', () => app.actions.closeSheet()),
  ));
  root.appendChild(h('div', { class: 'sheet__body' },
    h('p', { text: fileName }),
    h('div', { class: 'field' }, merge),
    h('p', { class: 'muted', text: 'Replace deletes everything on this phone now and restores the backup.' }),
    h('div', { class: 'field' }, replace), problem,
  ));
}

export const sheets = { 'import-confirm': importConfirm };
