import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { APP_VERSION } from '../src/version.js';

const root = new URL('../', import.meta.url);
const worker = await readFile(new URL('sw.js', root), 'utf8');
const pwa = await readFile(new URL('src/pwa.js', root), 'utf8');
const files = JSON.parse(worker.match(/const FILES = (\[[\s\S]*?\]);/)[1]
  .replace(/'/g, '"').replace(/,\s*]/, ']'));

test('manifest describes a relative, standalone portrait app with its icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));
  for (const [key, value] of Object.entries({
    name: 'Macro Diary', short_name: 'Macro Diary', start_url: './', scope: './',
    display: 'standalone', orientation: 'portrait',
    background_color: '#070B12', theme_color: '#070B12',
  })) assert.equal(manifest[key], value, key);
  assert.ok(manifest.description.trim());
  for (const size of [192, 512]) {
    assert.ok(manifest.icons.some(icon => icon.src === `./icons/icon-${size}.png`
      && icon.sizes === `${size}x${size}` && icon.type === 'image/png'
      && icon.purpose === 'any maskable'));
  }
  assert.ok(manifest.icons.some(icon => icon.src === './icons/icon.svg'
    && icon.sizes === 'any' && icon.type === 'image/svg+xml'));
  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith('./'));
    assert.ok((await stat(new URL(icon.src, root))).isFile());
  }
});

test('precache contains the full app and only existing relative paths', async () => {
  assert.equal(new Set(files).size, files.length);
  for (const path of files) {
    assert.ok(path.startsWith('./'), path);
    assert.ok(!path.startsWith('/') && !path.startsWith('http'), path);
    await stat(new URL(path, root));
  }
  for (const path of ['./', './index.html', './styles.css', './manifest.webmanifest',
    './fonts/schibsted-grotesk-latin.woff2', './icons/icon-180.png',
    './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg']) {
    assert.ok(files.includes(path), path);
  }
  for (const directory of ['src', 'src/ui']) {
    for (const name of await readdir(new URL(`${directory}/`, root))) {
      if (name.endsWith('.js')) assert.ok(files.includes(`./${directory}/${name}`), name);
    }
  }
  assert.equal(worker.match(/const VERSION = '([^']+)'/)[1], APP_VERSION);
});

function workerContext(cache, fetch) {
  const handlers = {};
  const deleted = [];
  const context = {
    URL, fetch,
    Request: class extends Request {
      constructor(url, options) { super(new URL(url, 'https://example.test/macro-diary/'), options); }
    },
    self: {
      location: { origin: 'https://example.test' },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting: async () => {}, clients: { claim: async () => {} },
    },
    caches: {
      open: async () => cache,
      keys: async () => ['unrelated', 'macro-diary-old', `macro-diary-${APP_VERSION}`],
      delete: async name => { deleted.push(name); },
    },
  };
  runInNewContext(worker, context);
  return { handlers, deleted };
}

test('worker ignores foreign and non-GET requests and removes only obsolete app caches', async () => {
  const { handlers, deleted } = workerContext();
  for (const request of [
    { method: 'POST', url: 'https://example.test/macro-diary/' },
    { method: 'GET', url: 'https://other.test/file.js' },
  ]) handlers.fetch({ request, respondWith: () => assert.fail('must not intercept') });
  let activation;
  handlers.activate({ waitUntil: promise => { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, ['macro-diary-old']);
});

test('worker serves cached navigation offline and caches only successful fetches', async () => {
  const puts = [];
  let cached;
  let response;
  let fetched = 0;
  const cache = { match: async () => cached, put: async (...args) => puts.push(args) };
  const { handlers } = workerContext(cache, async () => { fetched++; return response; });
  function request(mode = 'cors') {
    let result;
    handlers.fetch({ request: { method: 'GET', url: 'https://example.test/macro-diary/file', mode },
      respondWith: promise => { result = promise; } });
    return result;
  }
  cached = { body: 'offline shell' };
  assert.equal(await request('navigate'), cached);
  assert.equal(fetched, 0);
  cached = undefined;
  response = { ok: false };
  assert.equal(await request(), response);
  assert.equal(puts.length, 0);
  response = { ok: true, clone: () => 'copy' };
  assert.equal(await request(), response);
  assert.equal(puts.length, 1);
  assert.equal(puts[0][1], 'copy');
});

function pwaContext(supported = true, readyState = 'loading') {
  const events = {};
  const registrations = [];
  let reloads = 0;
  const listen = target => (name, handler) => { events[`${target}:${name}`] = handler; };
  const context = {
    navigator: supported ? { serviceWorker: {
      addEventListener: listen('worker'),
      register: (...args) => { registrations.push(args); return Promise.resolve(); },
    } } : {},
    document: { readyState, visibilityState: 'visible', addEventListener: listen('document') },
    window: { addEventListener: listen('window') },
    location: { reload: () => { reloads++; } },
    matchMedia: () => ({ matches: false }),
  };
  runInNewContext(pwa.replace(/export function /g, 'function '), context);
  return { context, events, registrations, reloads: () => reloads };
}

test('registration waits for load and updates reload once after hiding and reopening', () => {
  const { context, events, registrations, reloads } = pwaContext();
  context.registerServiceWorker();
  context.registerServiceWorker();
  assert.equal(registrations.length, 0);
  events['window:load']();
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0][0], './sw.js');
  assert.equal(registrations[0][1].scope, './');
  events['worker:controllerchange']();
  events['document:visibilitychange']();
  assert.equal(reloads(), 0);
  context.document.visibilityState = 'hidden';
  events['document:visibilitychange']();
  assert.equal(reloads(), 0);
  context.document.visibilityState = 'visible';
  events['document:visibilitychange']();
  events['worker:controllerchange']();
  events['document:visibilitychange']();
  assert.equal(reloads(), 1);
});

test('registration supports late boot, unsupported browsers and standalone modes', () => {
  const unsupported = pwaContext(false);
  unsupported.context.registerServiceWorker();
  assert.equal(Object.keys(unsupported.events).length, 0);
  const { context, registrations } = pwaContext(true, 'complete');
  context.registerServiceWorker();
  assert.equal(registrations.length, 1);
  assert.equal(context.isStandalone(), false);
  context.navigator.standalone = true;
  assert.equal(context.isStandalone(), true);
  context.navigator.standalone = false;
  context.matchMedia = query => ({ matches: query === '(display-mode: standalone)' });
  assert.equal(context.isStandalone(), true);
});

test('worker installation reloads every precache request and stores successful responses', async () => {
  assert.match(worker, /cache:\s*'reload'/);
  assert.doesNotMatch(worker, /\baddAll\s*\(/);
  const fetched = [];
  const stored = [];
  const response = { ok: true };
  const { handlers } = workerContext({ put: async (...args) => { stored.push(args); } }, async request => {
    fetched.push(request);
    return response;
  });
  let installation;
  handlers.install({ waitUntil: promise => { installation = promise; } });
  await installation;
  assert.equal(fetched.length, files.length);
  assert.deepEqual(fetched.map(request => request.url),
    files.map(file => new URL(file, 'https://example.test/macro-diary/').href));
  for (const request of fetched) assert.equal(request.cache, 'reload');
  assert.equal(stored.length, files.length);
  for (const [request, cached] of stored) {
    assert.ok(fetched.includes(request));
    assert.equal(cached, response);
  }
});

test('worker installation rejects an unsuccessful response and does not cache it', async () => {
  const stored = [];
  const { handlers } = workerContext({ put: async request => { stored.push(request.url); } },
    async request => ({ ok: !request.url.endsWith('/index.html') }));
  let installation;
  handlers.install({ waitUntil: promise => { installation = promise; } });
  await assert.rejects(installation, /Precache failed: .\/index.html/);
  assert.ok(!stored.some(url => url.endsWith('/index.html')));
});
