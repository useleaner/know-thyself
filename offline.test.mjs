import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { notificationLink } from './notification-link.js';

async function worker({ offline = false, cached = new Response('offline') } = {}) {
  const listeners = new Map(), added = [], deleted = [], requests = [];
  const self = {
    location: new URL('https://know.example/sw.js'),
    addEventListener: (type, callback) => listeners.set(type, callback),
    skipWaiting: async () => {}, clients: { claim: async () => {} }
  };
  const caches = {
    open: async () => ({ add: async request => added.push(request) }),
    keys: async () => ['know-thyself-offline-v0', 'another-app-cache', 'know-thyself-offline-v1'],
    delete: async key => deleted.push(key),
    match: async (url, options) => { assert.equal(url, 'https://know.example/offline.html'); assert.equal(options.cacheName, 'know-thyself-offline-v1'); return cached; }
  };
  const source = (await readFile(new URL('./sw.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/, '');
  vm.runInNewContext(source, {
    self, caches, Request, Response, URL, notificationLink,
    fetch: async (request, options) => { assert.equal(options.cache, 'no-store'); requests.push(request); if (offline) throw Error('offline'); return new Response('network'); }
  });
  async function fire(type, values = {}) {
    let pending, response;
    listeners.get(type)({ ...values, waitUntil(value) { pending = value; }, respondWith(value) { response = value; } });
    await pending;
    return response;
  }
  return { fire, added, deleted, requests };
}

test('worker only precaches the public offline screen and cleans only its own obsolete cache', async () => {
  const w = await worker();
  await w.fire('install');
  assert.equal(w.added.length, 1);
  assert.equal(w.added[0].url, 'https://know.example/offline.html');
  assert.equal(w.added[0].credentials, 'omit');
  await w.fire('activate');
  assert.deepEqual(w.deleted, ['know-thyself-offline-v0']);
});

test('navigation uses network, then offline fallback on failure; APIs and assets are never intercepted', async () => {
  const online = await worker();
  const request = { mode: 'navigate', url: 'https://know.example/universo.html?mode=transits' };
  assert.equal(await (await online.fire('fetch', { request })).text(), 'network');
  const offline = await worker({ offline: true });
  assert.equal(await (await offline.fire('fetch', { request })).text(), 'offline');
  for (const request of [
    { mode: 'cors', url: 'https://know.example/api/profiles' },
    { mode: 'no-cors', url: 'https://know.example/app.js' },
    { mode: 'navigate', url: 'https://other.example/' }
  ]) assert.equal(await offline.fire('fetch', { request }), undefined);
  assert.equal(offline.requests.length, 1);
});

test('offline screen is self-contained, selects PT/EN safely and retries the requested location', async () => {
  const html = await readFile(new URL('./offline.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /(?:src|href)=|<link\b/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const [saved, browser, pathname, english] of [
    ['en', 'pt-BR', '/universo.html', true], ['pt-BR', 'en-US', '/offline.html', false], [null, 'en-US', '/universo.html', true], ['blocked', 'pt-BR', '/universo.html', false]
  ]) {
    let retry, action;
    const nodes = Object.fromEntries(['h1', 'p', 'button'].map(tag => [tag, { textContent: '', addEventListener(type, handler) { retry = handler; } }]));
    const document = { documentElement: { lang: 'pt-BR' }, querySelector: tag => nodes[tag] };
    const location = { pathname, reload() { action = 'reload'; }, replace(url) { action = url; } };
    vm.runInNewContext(script, { document, navigator: { language: browser }, localStorage: { getItem() { if (saved === 'blocked') throw Error('blocked'); return saved; } }, location });
    assert.equal(document.documentElement.lang, english ? 'en' : 'pt-BR');
    if (english) assert.equal(nodes.button.textContent, 'Try again');
    retry();
    assert.equal(action, pathname === '/offline.html' ? './universo.html' : 'reload');
  }
});
