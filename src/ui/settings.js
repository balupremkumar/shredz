import { h } from './dom.js';
import { parseNumber, formatKcal } from '../format.js';
import { kcalFromGrams } from '../insights.js';
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

function goalsSection(app, settings) {
  const goals = settings.goals;
  const defs = [['protein', 'Protein g', goals.protein], ['carbs', 'Carbs g', goals.carbs],
    ['fat', 'Fat g', goals.fat]];
  const inputs = {};
  const problem = h('p', { class: 'problem-line', attrs: { id: 'goals-problem', role: 'alert', hidden: true } });
  const caloriesLine = h('p', { class: 'muted', attrs: { 'aria-live': 'polite' } });

  const read = key => {
    const value = parseNumber(inputs[key].value);
    return value === null || value < 0 ? null : value;
  };
  const refresh = () => {
    const protein = read('protein');
    const carbs = read('carbs');
    const fat = read('fat');
    const kcal = protein === null || carbs === null || fat === null
      ? '?' : formatKcal(kcalFromGrams({ protein, carbs, fat }));
    caloriesLine.textContent = `Calories (worked out): ${kcal} kcal`;
  };

  const fields = defs.map(([key, label, value]) => {
    const input = h('input', { class: 'input', attrs: {
      id: `goal-grams-${key}`, type: 'text', inputmode: 'decimal', autocomplete: 'off',
      enterkeyhint: 'done', value: value ?? '', 'aria-describedby': 'goals-problem',
    }, on: { input: refresh } });
    inputs[key] = input;
    return h('div', { class: 'field' },
      h('label', { class: 'field__label', text: label, attrs: { for: `goal-grams-${key}` } }), input);
  });

  const save = h('button', {
    class: 'pill pill--primary pill--block', text: 'Save goals', attrs: { type: 'submit' },
  });
  const fail = (key, message) => {
    inputs[key].setAttribute('aria-invalid', 'true');
    problem.textContent = message;
    problem.hidden = false;
    inputs[key].focus();
  };
  const form = h('form', { on: { submit: async event => {
    event.preventDefault();
    if (save.disabled) return;
    const next = {};
    for (const [key, label] of defs) {
      const value = read(key);
      inputs[key].setAttribute('aria-invalid', String(value === null));
      if (value === null) {
        fail(key, `${label}: enter zero or a positive number.`);
        return;
      }
      next[key] = value;
    }
    const input = { goalMode: 'grams', protein: next.protein, carbs: next.carbs, fat: next.fat };
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
  fields, caloriesLine, problem, h('div', { class: 'field' }, save));
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
