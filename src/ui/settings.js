import { h } from './dom.js';
import { parseNumber } from '../format.js';
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

async function exportBackup(app) {
  try {
    const result = await app.actions.exportBackup(new Date().toISOString());
    if (!result.ok) {
      app.toast(result.error);
      return;
    }
    const file = new File([result.text], result.fileName, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Macro Diary backup' });
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
  } catch (error) {
    if (error.name !== 'AbortError') app.toast(error.message || 'Could not export the backup.');
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

export function render(root, app) {
  const goals = app.select.day().goals;
  const fields = [
    ['kcal', 'Calories (kcal)'], ['protein', 'Protein (g)'],
    ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)'],
  ];
  const inputs = {};
  const problem = h('p', { class: 'problem-line', attrs: { id: 'goals-problem', role: 'alert', hidden: true } });
  const save = h('button', {
    class: 'pill pill--primary pill--block', text: 'Save goals', attrs: { type: 'submit' },
  });
  const form = h('form', { on: { submit: async event => {
    event.preventDefault();
    if (save.disabled) return;
    const next = {};
    for (const [key, label] of fields) {
      const value = parseNumber(inputs[key].value);
      const invalid = value === null || value < 0;
      inputs[key].setAttribute('aria-invalid', String(invalid));
      if (invalid) {
        problem.textContent = `${label}: enter zero or a positive number.`;
        problem.hidden = false;
        inputs[key].focus();
        return;
      }
      next[key] = value;
    }
    problem.hidden = true;
    save.disabled = true;
    const result = await app.actions.saveGoals(next);
    save.disabled = false;
    if (result.ok) app.toast('Goals saved');
    else {
      problem.textContent = result.error;
      problem.hidden = false;
    }
  } } }, fields.map(([key, label]) => {
    const input = h('input', { class: 'input', attrs: {
      id: `goal-${key}`, type: 'text', inputmode: 'decimal', enterkeyhint: 'done',
      value: goals[key], 'aria-describedby': 'goals-problem',
    } });
    inputs[key] = input;
    return h('div', { class: 'field' },
      h('label', { class: 'field__label', text: label, attrs: { for: `goal-${key}` } }), input,
    );
  }), problem, h('div', { class: 'field' }, save));

  const installed = (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
    || navigator.standalone === true;
  root.appendChild(section('Daily goals', form));
  root.appendChild(section('Backup',
    h('p', { class: 'muted', text: 'Your diary lives only on this phone. Export a backup now and then and keep it in Files or iCloud Drive.' }),
    h('div', { class: 'field' }, button('Export backup', 'pill pill--secondary pill--block', () => exportBackup(app))),
    h('div', { class: 'field' }, button('Import backup', 'pill pill--secondary pill--block', () => chooseBackup(app))),
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
  root.appendChild(section(`Macro Diary ${APP_VERSION}`,
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
