import { h, clear, icon } from './dom.js';
import { formatKcal, formatGrams, formatQty } from '../format.js';

const voiceUnavailable = "Voice isn't available here, so tap the mic on your keyboard and talk.";

export function pickRecogniserConstructor(scope) {
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

export function createSpeechSession({ recogniser, schedule, onTranscript = () => {}, onState = () => {} }) {
  let state = 'idle';
  let final = '';
  let interim = '';
  let restarts = 0;
  let pendingRestart;
  function cancelRestart() {
    if (!pendingRestart) return;
    pendingRestart.cancelled = true;
    pendingRestart.cancel?.();
    pendingRestart = undefined;
  }
  const change = next => {
    if (next !== 'listening') cancelRestart();
    state = next; onState(state);
  };
  function launch() {
    if (state !== 'listening') return;
    try { recogniser.start(); }
    catch (error) {
      change(['not-allowed', 'service-not-allowed', 'NotAllowedError'].includes(error.error || error.name) ? 'denied' : 'error');
    }
  }
  if (recogniser) {
    recogniser.onresult = event => {
      if (state !== 'listening') return;
      restarts = 0;
      const committed = [];
      const pending = [];
      for (let i = event.resultIndex || 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        (result.isFinal ? committed : pending).push(result[0].transcript.trim());
      }
      final = [final, ...committed].filter(Boolean).join(' ');
      interim = pending.filter(Boolean).join(' ');
      onTranscript({ final, interim });
    };
    recogniser.onend = () => {
      if (state !== 'listening' || pendingRestart) return;
      if (restarts >= 20) { change('error'); return; }
      restarts += 1;
      onState(state);
      const pending = { cancelled: false };
      pendingRestart = pending;
      pending.cancel = schedule(() => {
        if (pending.cancelled) return;
        pendingRestart = undefined;
        launch();
      }, 250);
    };
    recogniser.onerror = event => {
      if (state !== 'listening') return;
      if (['not-allowed', 'service-not-allowed'].includes(event.error)) change('denied');
      else if (!['no-speech', 'aborted'].includes(event.error)) change('error');
    };
  }
  return {
    get state() { return state; },
    get restarts() { return restarts; },
    start() {
      if (state === 'listening') return;
      if (!recogniser) { change('unsupported'); return; }
      recogniser.lang = 'en-NZ';
      recogniser.interimResults = true;
      recogniser.continuous = true;
      restarts = 0;
      change('listening');
      launch();
    },
    stop() {
      const wasListening = state === 'listening';
      cancelRestart();
      change('stopped');
      if (recogniser && wasListening) {
        try { recogniser.stop(); } catch { /* Already ended on the phone. */ }
      }
    },
    reset() { final = ''; interim = ''; onTranscript({ final, interim }); },
  };
}

export function shouldAutoSave({ typing, finalText, draftPreview, finalPreview }) {
  const preview = typing ? draftPreview : finalPreview;
  return Boolean(preview?.save && (typing || finalText.trim())
    && !draftPreview.unmatched.length && !preview.unmatched.length
    && preview.meals.some(meal => meal.items.length));
}

const leading = /^(?:(?:\d+(?:[.,]\d+)*|one|two|three|four|five|six|seven|eight|nine|ten|half|a|an|couple|of|servings?|serves?|grams?|g|kilograms?|kg|millilitres?|milliliters?|mils?|ml|litres?|liters?|l|items?|scoops?|slices?|pieces?)\b[\s\p{P}]*)+/iu;
export function foodName(raw) {
  return String(raw).replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '').replace(leading, '').trim();
}
export function isFoodName(raw) { return foodName(raw) !== ''; }

let draft = '';
let suppliedText;
let mealOverride;
let session;
let recogniser;
let transcript = { final: '', interim: '' };
let typing = false;
let speechBase = '';
let reason = '';
let boundPanel;
let refresh;
let focusView;
let visibilityBound = false;
let saving = false;
const removed = new Set();

function button(text, className, click) {
  return h('button', { class: className, text, attrs: { type: 'button' }, on: { click } });
}
async function open(app, name, props) {
  session?.stop();
  const result = await app.actions.openSheet(name, props);
  if (!result.ok) app.toast(result.error);
}
function clearDraft() {
  refresh = undefined; focusView = undefined; boundPanel = undefined;
  draft = ''; suppliedText = undefined; mealOverride = undefined;
  transcript = { final: '', interim: '' }; removed.clear();
  session?.stop(); session = undefined; recogniser = undefined;
  speechBase = ''; typing = false; reason = '';
}
function dictate(root, app, props = {}) {
  if (props.text !== undefined && props.text !== suppliedText) {
    draft = props.text; suppliedText = props.text;
    transcript = { final: '', interim: '' };
    speechBase = draft;
    session?.reset();
  }
  // Rebind before any event: the shell replaces the panel on every state change.
  boundPanel = root;
  const Constructor = typeof window === 'undefined' ? null : pickRecogniserConstructor(window);
  const head = h('div', { class: 'sheet__head' });
  const body = h('div', { class: 'sheet__body' });
  const dock = h('div', { class: 'sheet__dock' });
  root.appendChild(head); root.appendChild(body); root.appendChild(dock);
  let preview;
  let saveButton;
  let textarea;
  let prefix = draft;
  let autoSaveText;

  let rendering = false;
  function focusText() {
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
  }
  async function save(parsed = preview) {
    if (saving || !parsed.meals.some(meal => meal.items.length)) return;
    saving = true; saveButton.disabled = true;
    session?.stop();
    const result = await app.actions.addParsed(app.state.date, parsed);
    if (!result.ok) {
      saving = false; saveButton.disabled = false; app.toast(result.error); return;
    }
    clearDraft();
    const closed = await app.actions.closeSheet();
    saving = false;
    if (!closed.ok) app.toast(closed.error);
    app.toast(`Added ${result.added} items, ${formatKcal(result.kcal)} kcal`);
  }
  function problem(item, section) {
    const key = `${item.meal}:${item.raw}`;
    if (removed.has(key)) return;
    const word = foodName(item.raw);
    const row = h('div', { class: 'row row--problem' });
    const error = h('p', { class: 'problem-line' });
    error.hidden = true;
    function actions() {
      clear(row);
      row.appendChild(h('div', { class: 'row__body' },
        h('div', { class: 'row__name', text: `Not recognised: ${item.raw}` }),
        word ? [button('Add', 'link-btn', () => open(app, 'food-edit', {
          name: word, returnTo: { name: 'dictate', props: { text: draft } },
        })), button('This is...', 'link-btn', picker)] : h('p', { class: 'muted', text: 'Not a food name' }),
        button('Remove', 'link-btn', () => { removed.add(key); row.hidden = true; error.hidden = true; })));
    }
    function picker() {
      clear(row);
      const select = h('select', { class: 'select', attrs: { 'aria-label': `Which food is ${word}?` } },
        h('option', { text: '', attrs: { value: '' } }),
        app.select.recentFoods().map(food => h('option', { text: food.name, attrs: { value: food.id } })));
      row.appendChild(h('div', { class: 'row__body' }, select,
        button('Learn', 'pill pill--primary', async () => {
          if (!select.value) { error.textContent = 'Pick a food first'; error.hidden = false; return; }
          const result = await app.actions.addAlias(select.value, word);
          if (!result.ok) { error.textContent = result.error; error.hidden = false; return; }
          app.toast(`Learned ${word} as ${result.food.name}`);
          refresh?.();
        }), button('Cancel', 'link-btn', () => { error.hidden = true; actions(); })));
    }
    actions(); section.appendChild(row); section.appendChild(error);
  }
  function render() {
    if (rendering) return;
    rendering = true;
    const hadFocus = textarea && typeof document !== 'undefined' && document.activeElement === textarea;
    prefix = mealOverride && !/^\s*meal\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(draft)
      ? `meal ${mealOverride}, ${draft}` : draft;
    preview = app.select.preview(prefix);
    const count = preview.meals.reduce((sum, meal) => sum + meal.items.length, 0);
    const meal = mealOverride || preview.meals[0]?.meal || preview.lines?.[0]?.meal || 1;
    clear(head); clear(body); clear(dock);
    head.appendChild(button('Cancel', 'link-btn', async () => {
      clearDraft();
      const result = await app.actions.closeSheet();
      if (!result.ok) app.toast(result.error);
    }));
    head.appendChild(h('h2', { text: `Meal ${meal}` }));
    const next = button(`Meal ${meal + 1} \u203a`, 'link-btn', () => { mealOverride = meal + 1; render(); });
    head.appendChild(next);
    if (typing) {
      if (reason) body.appendChild(h('p', { class: 'muted', text: reason }));
      textarea = textarea || h('textarea', { class: 'textarea', attrs: {
        'aria-label': 'What you ate', autocapitalize: 'sentences', autocorrect: 'off', spellcheck: 'false',
        autocomplete: 'off', enterkeyhint: 'enter',
      }, on: { input: () => { draft = textarea.value; transcript = { final: '', interim: '' }; render(); } } });
      textarea.value = draft; body.appendChild(textarea);
      body.appendChild(h('p', { class: 'muted', text: 'Try: meal one, 2 Weet-Bix, green milk 200 mils... then say save.' }));
    } else {
      textarea = undefined;
      const listening = session?.state === 'listening';
      const mic = button('', 'speak-mic', () => {
        if (session.state === 'listening') session.stop();
        else session.start();
      });
      mic.setAttribute('aria-label', listening ? 'Tap to stop' : 'Tap to talk again');
      mic.appendChild(icon('mic'));
      body.appendChild(h('div', { class: 'speak-stage' }, mic,
        h('p', { class: 'speak-status', text: listening ? 'Listening. Tap to stop.' : 'Tap to talk again' })));
      body.appendChild(h('p', { class: 'speak-transcript', attrs: { 'aria-live': 'polite' } },
        h('span', { text: [speechBase, transcript.final].filter(Boolean).join(' ') }),
        h('span', { class: 'speak-transcript__interim', text: transcript.interim ? ` ${transcript.interim}` : '' })));
      if (!draft && session?.restarts >= 2) body.appendChild(h('p', { class: 'muted', text: "Didn't catch that, try again" }));
    }
    if (draft.trim()) {
      const section = h('section', { class: 'section' }, h('div', { class: 'section__head' },
        h('h3', { text: 'I heard' }), h('span', { text: `${formatKcal(preview.kcal)} kcal` })));
      const foods = new Map(app.select.foods().map(food => [food.id, food]));
      const saved = new Map(app.select.savedMeals().map(meal => [meal.id, meal.name]));
      for (const group of preview.meals) {
        if (preview.meals.length > 1) section.appendChild(h('p', { class: 'section__sub', text: `Meal ${group.meal}` }));
        for (const item of group.items) {
          const food = foods.get(item.foodId);
          section.appendChild(h('div', { class: 'row' }, h('div', { class: 'row__body' },
            h('div', { class: 'row__name', text: food.name }),
            h('span', { class: 'row__qty speak-subtitle', text: formatQty(item.qty, food.unit) + (saved.has(item.savedMealId) ? ` from ${saved.get(item.savedMealId)}` : '') + ` · ${formatGrams(food.protein * item.qty / food.baseQty)} protein` })),
          h('span', { class: 'row__kcal', text: `${formatKcal(food.kcal * item.qty / food.baseQty)} kcal` })));
        }
      }
      for (const item of preview.unmatched) problem(item, section);
      body.appendChild(section);
    }
    for (const warning of preview.warnings) body.appendChild(h('p', { class: 'problem-line', text: warning.message }));
    if (preview.save && preview.unmatched.length) body.appendChild(h('p', { class: 'muted', text: 'Fix the words in red, then tap Save.' }));
    if (preview.save && !count) body.appendChild(h('p', { class: 'muted', text: 'Nothing to save yet' }));
    if (!typing) body.appendChild(h('p', { class: 'muted', text: 'Say "meal two" to switch meals, "save" to finish.' }));
    if (!typing || Constructor) dock.appendChild(button(typing ? 'Use the mic' : 'Type instead', 'link-btn', () => {
      if (!typing) { typing = true; session?.stop(); render(); focusText(); }
      else { typing = false; reason = ''; speechBase = draft; session.reset(); session.start(); render(); }
    }));
    saveButton = button(`Save ${count} ${count === 1 ? 'item' : 'items'}`, 'pill pill--primary', () => save());
    saveButton.disabled = saving || !count; dock.appendChild(saveButton);
    rendering = false;
    if (hadFocus) focusText();
    const finalText = [speechBase, transcript.final].filter(Boolean).join(' ');
    const finalPreview = typing ? preview : app.select.preview(mealOverride ? `meal ${mealOverride}, ${finalText}` : finalText);
    if (autoSaveText !== draft && shouldAutoSave({ typing, finalText, draftPreview: preview, finalPreview })) {
      autoSaveText = draft; void save(typing ? preview : finalPreview);
    }
  }
  refresh = render;
  focusView = focusText;
  if (!session) {
    speechBase = draft;
    transcript = { final: '', interim: '' };
    typing = !Constructor;
    reason = Constructor ? '' : voiceUnavailable;
    if (Constructor) {
      try { recogniser = new Constructor(); }
      catch { typing = true; reason = voiceUnavailable; }
    }
    session = createSpeechSession({ recogniser,
      schedule: (fn, ms) => { const timer = setTimeout(fn, ms); return () => clearTimeout(timer); },
      onTranscript: text => {
        transcript = text;
        draft = [speechBase, text.final, text.interim].filter(Boolean).join(' ');
        refresh?.();
      },
      onState: state => {
        if (state === 'denied' || state === 'error') {
          typing = true;
          reason = state === 'denied' ? 'Microphone is off for Shredz, so use the mic on your keyboard.'
            : 'Speech stopped here, so use the mic on your keyboard.';
        }
        refresh?.();
        if (typing) focusView?.();
      },
    });
    if (recogniser) {
      const current = session;
      for (const name of ['onresult', 'onend', 'onerror']) {
        const handler = recogniser[name];
        recogniser[name] = event => {
          if (current !== session) return;
          if (boundPanel?.isConnected === false) {
            current.stop(); session = undefined; recogniser = undefined; return;
          }
          handler(event);
        };
      }
    }
    if (!typing) session.start();
  }
  if (!visibilityBound && typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') session?.stop();
    });
    visibilityBound = true;
  }
  render();
  if (typing) focusText();
}

const confirm = (root, app, props) => dictate(root, app, props);
dictate.onClose = clearDraft;
confirm.onClose = clearDraft;
export const sheets = { dictate, confirm };
