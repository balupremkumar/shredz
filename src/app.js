/* Screen module contract:
 * src/ui/diary.js, foods.js, weight.js and settings.js export render(root, app).
 * They may export dock(root, app), which fills the dock (hidden when absent),
 * and sheets, an object mapping sheet names to (root, app, props) => void.
 * src/ui/dictate.js exports only sheets, owning 'dictate' and 'confirm'.
 * app is { state, actions, select, toast(message), rerender() }.
 * Screens keep transient input in their own DOM and never trigger a full
 * re-render while typing; they update only their own preview nodes.
 * The shell re-renders main, top bar, dock, tab bar and sheet on every state change.
 */
import { createStore, createIdbBackend } from './store.js';
import { createApp } from './actions.js';
import { localDate, dayLabel, shortDate } from './format.js';
import { h, clear, icon } from './ui/dom.js';
import * as diary from './ui/diary.js';
import * as foods from './ui/foods.js';
import * as weight from './ui/weight.js';
import * as settings from './ui/settings.js';
import * as dictate from './ui/dictate.js';
import { registerServiceWorker } from './pwa.js';

const screens = { diary, foods, weight, settings };
const titles = { diary: 'Diary', foods: 'Foods', weight: 'Weight', settings: 'Settings' };
const sheets = Object.assign({}, ...Object.values(screens).map(screen => screen.sheets), dictate.sheets);
const root = document.getElementById('app');
const topbar = document.getElementById('topbar');
const main = document.getElementById('main');
const dock = document.getElementById('dock');
const tabbar = document.getElementById('tabbar');
const sheetRoot = document.getElementById('sheet-root');
const toastRoot = document.getElementById('toast-root');
let toastTimer;

function toast(message) {
  clearTimeout(toastTimer);
  clear(toastRoot);
  toastRoot.appendChild(h('div', { class: 'toast', text: message, attrs: { role: 'status' } }));
  toastTimer = setTimeout(() => clear(toastRoot), 3000);
}

// Home-screen badge while today's weight is missing. iOS shows it only for the installed
// app after notification permission is granted; elsewhere the calls quietly do nothing.
function updateBadge(needed) {
  if (!('setAppBadge' in navigator)) return;
  const call = needed ? navigator.setAppBadge(1) : navigator.clearAppBadge();
  call.catch(() => {});
}

function iconButton(name, label, click) {
  return h('button', { class: 'icon-btn', attrs: { type: 'button', 'aria-label': label }, on: { click } }, icon(name));
}

async function boot() {
  main.appendChild(h('div', { class: 'empty', text: 'Loading Shredz...' }));
  let controller;
  try {
    const store = createStore(createIdbBackend());
    controller = createApp({ store, makeId: () => crypto.randomUUID(), today: () => localDate() });
    await controller.init();
  } catch {
    clear(root);
    root.appendChild(h('div', { class: 'empty', attrs: { role: 'alert' } },
      h('p', { text: 'Storage is not available. If this is a private browsing tab, open Shredz from your home screen instead.' }),
      h('button', { class: 'pill pill--primary', text: 'Try again', attrs: { type: 'button' }, on: { click: () => location.reload() } }),
    ));
    return;
  }

  let previousToday = localDate();
  const { actions, select } = controller;
  function render() {
    const state = controller.getState();
    const screen = screens[state.tab];
    const app = { state, actions, select, toast, rerender: render };
    if (state.data.settings.largeText) document.documentElement.dataset.text = 'large';
    else delete document.documentElement.dataset.text;
    updateBadge(select.needsWeighIn());
    for (const element of [topbar, main, dock, tabbar, sheetRoot]) clear(element);
    if (state.tab === 'diary') {
      topbar.appendChild(h('div', { class: 'datenav' },
        iconButton('chev-left', 'Previous day', () => actions.prevDay()),
        h('button', { attrs: { type: 'button' }, on: { click: () => actions.goToday() } },
          h('b', { text: dayLabel(state.date, localDate()) }),
          h('small', { class: 'muted', text: shortDate(state.date) }),
        ),
        iconButton('chev-right', 'Next day', () => actions.nextDay()),
      ));
    } else {
      topbar.appendChild(h('h1', { text: titles[state.tab] }));
    }
    topbar.appendChild(iconButton('gear', 'Settings', () => actions.setTab('settings')));
    screen.render(main, app);
    dock.hidden = typeof screen.dock !== 'function';
    if (!dock.hidden) screen.dock(dock, app);
    for (const tab of ['diary', 'foods', 'weight']) {
      const active = state.tab === tab;
      tabbar.appendChild(h('button', {
        class: active ? 'tab tab--active' : 'tab',
        attrs: { type: 'button', 'aria-current': active ? 'page' : null },
        on: { click: () => actions.setTab(tab) },
      }, icon(tab), h('span', { text: titles[tab] })));
    }
    if (state.sheet) {
      const sheet = Object.hasOwn(sheets, state.sheet.name) ? sheets[state.sheet.name] : null;
      if (typeof sheet !== 'function') {
        actions.closeSheet();
        return;
      }
      const panel = h('section', { class: 'sheet', attrs: { role: 'dialog', 'aria-modal': 'true', tabindex: '-1' } });
      sheetRoot.appendChild(h('div', { class: 'sheet-backdrop', on: { click: () => actions.closeSheet() } }));
      sheetRoot.appendChild(panel);
      sheet(panel, app, state.sheet.props);
      // A sheet may focus its own field (the dictate box must, so iOS raises the keyboard).
      if (!panel.contains(document.activeElement)) panel.focus();
    }
  }

  controller.subscribe(render);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && controller.getState().sheet) actions.closeSheet();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const today = localDate();
    const wasToday = controller.getState().date === previousToday;
    const changed = today !== previousToday;
    previousToday = today;
    if (wasToday && changed) actions.goToday();
    else if (changed) render();
  });
  render();
}

boot();
registerServiceWorker();
