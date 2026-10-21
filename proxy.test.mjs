import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const proxy = require('./proxy.js');
const auth = require('./lib/google-auth.cjs');
const settings = {
  GOOGLE_CLIENT_ID: '123-test.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  APP_ORIGIN: 'https://know-thyself.example',
  SESSION_SECRET: 'test-secret-'.repeat(4),
  ALLOWED_GOOGLE_EMAILS: 'test@example.com, second@example.com'
};
const user = { sub: 'subject', name: 'Pessoa de teste', email: 'test@example.com', email_verified: true };
const publicFiles = [
  'index.html', 'termos.html', 'privacidade.html', 'login.css', 'login.js', 'i18n.js', 'i18n-en.js', 'style.css', 'cosmos.css', 'manifest.webmanifest',
  'natal-catalog.js', 'natal-sign-texts.js', 'natal-house-texts.js', 'natal-aspect-texts.js',
  'natal-angle-texts.js', 'natal-condition-texts.js', 'natal-synthesis-texts.js', 'natal-balance-texts.js',
  'cabala-catalog.js', 'cabala-sphere-texts.js', 'cabala-path-texts.js',
  'assets/nebula.webp', 'assets/nebula-near.webp', 'assets/space-regular.ttf', 'assets/space-medium.ttf', 'assets/bricolage-semibold.ttf',
  'assets/google-g.png',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png', 'assets/icons/icon.svg'
];

function configured(t, overrides = {}) {
  const before = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings, overrides);
  t.after(() => Object.entries(before).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value));
  return auth.configuration();
}

function request(path, headers = {}) {
  return proxy(new Request(`${settings.APP_ORIGIN}${path}`, { headers }));
}

function session(config, value = user, now = Date.now()) {
  return `${auth.SESSION_COOKIE}=${auth.seal({ user: value }, config, 'session', auth.SESSION_SECONDS, now)}`;
}

test('Vercel registers a Node proxy without excluding private paths from its matcher', async () => {
  const config = JSON.parse(await readFile(new URL('./vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.proxy.entrypoint, 'proxy.js');
  assert.equal(config.proxy.matcher, undefined);
});

test('the login page and its exact static dependencies remain public with no configuration', t => {
  configured(t, { GOOGLE_CLIENT_SECRET: '' });
  assert.equal(request('/'), undefined);
  assert.equal(request('/api/auth?action=session'), undefined);
  for (const file of publicFiles) assert.equal(request(`/${file}`), undefined, file);
  assert.equal(request('/assets/tree-preview-personal.svg').status, 401);
  assert.equal(request('/assets/solar/planet-surfaces-v01.png').status, 401);
});

test('KT_ACCESS=vercel opens private paths only when set explicitly; server files stay hidden', t => {
  configured(t, { GOOGLE_CLIENT_SECRET: '', KT_ACCESS: 'vercel' });
  t.after(() => delete process.env.KT_ACCESS);
  assert.equal(request('/universo.html'), undefined);
  assert.equal(request('/app.js'), undefined);
  assert.equal(request('/proxy.js').status, 404);
  assert.equal(request('/lib/google-auth.cjs').status, 404);
  delete process.env.KT_ACCESS;
  assert.equal(request('/universo.html').status, 303);
});

test('anonymous requests cannot fetch personal HTML, data, modules or private images', t => {
  configured(t);
  for (const path of ['/universo.html', '/previews/antes/index.html']) {
    const res = request(path);
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/');
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
  }
  for (const path of ['/app.js', '/map-data.js', '/sample-chart.js', '/tree.js', '/study-data.js', '/assets/tree-preview-personal.svg']) assert.equal(request(path).status, 401, path);
  assert.equal(request('/private-page', { accept: 'text/html' }).status, 303);
});

test('ajustes and perfil pages stay behind the session', t => {
  const config = configured(t);
  for (const path of ['/ajustes.html', '/perfil.html']) {
    assert.equal(request(path).status, 303, path);
    assert.equal(request(path, { cookie: session(config) }), undefined, path);
  }
  for (const path of ['/ajustes.js']) assert.equal(request(path).status, 401, path);
});

test('only a valid unexpired session for the allowed Google account permits private files', t => {
  const config = configured(t);
  assert.equal(request('/universo.html', { cookie: session(config) }), undefined);
  assert.equal(request('/app.js', { cookie: session(config) }), undefined);
  assert.equal(request('/assets/tree-preview-personal.svg', { cookie: session(config) }), undefined);
  for (const cookie of [
    `${session(config)}tampered`,
    session(config, user, Date.now() - (auth.SESSION_SECONDS + 1) * 1000),
    session(config, { ...user, email: 'other@example.com' }),
    session(config, { ...user, email_verified: false }),
    session(config, { email: user.email })
  ]) {
    assert.equal(request('/universo.html', { cookie }).status, 303);
    assert.equal(request('/map-data.js', { cookie }).status, 401);
  }
});

test('server sources, env files and tests stay unavailable even to authenticated visitors', t => {
  const config = configured(t);
  const headers = { cookie: session(config) };
  for (const path of ['/lib/google-auth.cjs', '/lib', '/proxy.js', '/vercel.json', '/.env', '/.env.local', '/.env.example', '/api/auth.js', '/auth.test.mjs', '/tests/private.js', '/.git/config', '/%6cib/google-auth.cjs']) {
    assert.equal(request(path).status, 404, path);
    assert.equal(request(path, headers).status, 404, path);
  }
});

test('changing or removing account configuration revokes access to already signed sessions', t => {
  const config = configured(t);
  const cookie = session(config);
  process.env.ALLOWED_GOOGLE_EMAILS = 'changed@example.com';
  assert.equal(request('/map-data.js', { cookie }).status, 401);
  delete process.env.ALLOWED_GOOGLE_EMAILS;
  assert.equal(request('/map-data.js', { cookie }).status, 401);
});

test('every nonpublic file in the project is denied to an anonymous request', async t => {
  configured(t);
  async function files(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? files(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`) : `${prefix}${entry.name}`));
    return nested.flat();
  }
  const publicSet = new Set(publicFiles);
  for (const file of await files(new URL('./', import.meta.url))) {
    if (publicSet.has(file) || file.startsWith('.vercel/')) continue;
    const response = request(`/${file}`);
    assert.ok(response instanceof Response, file);
    assert.ok([401, 404, 303].includes(response.status), file);
  }
});

test('public login files do not embed the app HTML', async () => {
  const login = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(login, /id="app-content"|src="app\.js"|map-data\.js/);
});

// Login importa traduções antes de existir uma sessão: todo o grafo precisa passar.
test('anonymous login can load every transitive translation import', async t => {
  configured(t);
  const visited = new Set();
  async function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    assert.equal(request(`/${file}`), undefined, file);
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    for (const match of source.matchAll(/(?:import|export)[^;]*?from\s*['"]\.\/([^'"]+)['"]/g)) await visit(match[1]);
  }
  await visit('i18n.js');
  for (const file of ['natal-readings.js', 'cabala-readings.js', 'profiles.js']) assert.equal(request(`/${file}`).status, 401, file);
});
