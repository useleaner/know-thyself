import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationLink, pendingNotification, clearPendingNotification } from './notification-link.js';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const origin = 'https://know.example/';
const params = new URLSearchParams({ mode: 'transits', profile: 'alba', at: '2026-10-21T11:00:00.000Z', aspect: 'transit-sun~trine~mars' });
const target = `/universo.html?${params}`;

test('notification links preserve person, exact instant and directed aspect, discarding unknown parameters', () => {
  const link = notificationLink(`${target}&extra=ignored`, origin);
  assert.equal(link.url, target);
  assert.equal(link.profile, 'alba');
  assert.equal(link.date.toISOString(), params.get('at'));
  assert.equal(link.aspect, 'transit-sun~trine~mars');
});

test('notification links reject external URLs, wrong routes and malformed dates/aspects', () => {
  for (const value of [undefined, null, 'javascript:alert(1)', `https://evil.example${target}`, `//evil.example${target}`, target.replace('universo', 'perfil'), target.replace('trine', 'unknown'), target.replace('transit-sun', 'partner-sun'), target.replace('2026-10-21', '2026-02-30'), target.replace('profile=alba', 'profile='), target.replace('mode=transits', 'mode=natal')]) {
    assert.equal(notificationLink(value, origin), null, String(value));
  }
});

test('login remembers only a validated notification destination and clears it after account selection', () => {
  const data = new Map(), storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const launcher = `${origin}?notification=${encodeURIComponent(target)}`;
  assert.equal(pendingNotification(launcher, storage).url, target);
  assert.equal(pendingNotification(`${origin}universo.html`, storage).url, target);
  clearPendingNotification(storage);
  assert.equal(pendingNotification(origin, storage), null);
  assert.equal(pendingNotification(`${origin}?notification=${encodeURIComponent('https://evil.example/')}`, storage), null);
  assert.equal(pendingNotification(launcher, { setItem() { throw Error('blocked'); } }), null);
});

async function worker() {
  const listeners = new Map(), shown = [], opened = [];
  const self = {
    location: new URL(`${origin}sw.js`), addEventListener: (kind, callback) => listeners.set(kind, callback),
    registration: { showNotification: async (...args) => shown.push(args) },
    clients: { matchAll: async () => [], openWindow: async value => opened.push(value) }
  };
  const source = (await readFile(new URL('./sw.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/, '');
  vm.runInNewContext(source, { self, notificationLink, URL, encodeURIComponent });
  const fire = async (kind, values) => { let pending; listeners.get(kind)({ ...values, waitUntil(promise) { pending = promise; } }); await pending; };
  return { fire, self, shown, opened };
}

test('push displays the supplied reading and safely falls back for malformed payloads', async () => {
  const w = await worker();
  await w.fire('push', { data: { json: () => ({ title: 'Aspecto', body: 'Leitura', url: target, tag: 'daily-alba' }) } });
  assert.equal(w.shown[0][0], 'Aspecto');
  assert.equal(w.shown[0][1].body, 'Leitura');
  assert.equal(w.shown[0][1].data.url, target);
  await w.fire('push', { data: { json() { throw Error('bad json'); } } });
  assert.equal(w.shown[1][0], 'Know Thyself');
  assert.equal(w.shown[1][1].data.url, '/');
});

test('notification click routes through login and cannot open a supplied external address', async () => {
  const w = await worker();
  let closed = 0;
  await w.fire('notificationclick', { notification: { data: { url: target }, close() { closed++; } } });
  assert.equal(closed, 1);
  assert.equal(new URL(w.opened[0]).searchParams.get('notification'), target);
  await w.fire('notificationclick', { notification: { data: { url: 'https://evil.example/' }, close() {} } });
  assert.equal(w.opened[1], origin);
});

test('notification click reuses and focuses an existing window before opening another', async () => {
  const w = await worker();
  let navigated, focused = false;
  w.self.clients.matchAll = async () => [{ url: origin, async navigate(value) { navigated = value; }, async focus() { focused = true; } }];
  await w.fire('notificationclick', { notification: { data: { url: target }, close() {} } });
  assert.equal(new URL(navigated).searchParams.get('notification'), target);
  assert.equal(focused, true);
  assert.deepEqual(w.opened, []);
});
