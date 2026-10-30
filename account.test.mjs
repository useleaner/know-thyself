import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { initAccountPage, clearAccountCopies } from './conta.js';
const require = createRequire(import.meta.url);
const auth = require('./lib/google-auth.cjs');
const profiles = require('./lib/profile-store.cjs');
const users = require('./lib/user-store.cjs');
const { createHandler } = require('./api/account.js');
const id = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const user = { sub: 'google-synthetic', email: 'alba@example.com', name: 'Alba', email_verified: true };
const env = { GOOGLE_CLIENT_ID: '123-test.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-secret', APP_ORIGIN: 'https://app.example', SESSION_SECRET: 'test-session-secret-'.repeat(4), ALLOWED_GOOGLE_EMAILS: '*', ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), KT_ACCESS: '' };
function setup(t) {
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => Object.entries(before).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value));
  return auth.configuration();
}
function cookie(config, accountId = id) { return `${auth.SESSION_COOKIE}=${auth.seal({ accountId, user }, config, 'session', auth.SESSION_SECONDS)}`; }
async function request(handle, config, options = {}) {
  const headers = { cookie: cookie(config), origin: env.APP_ORIGIN, 'x-requested-with': 'XmlHttpRequest', 'content-type': 'application/json', ...options.headers };
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(value) { this.body = JSON.parse(value); } };
  await handle({ method: options.method || 'DELETE', headers, body: options.body ?? { confirmation: user.email } }, res);
  return res;
}

test('account deletion requires current signed identity, method, origin, explicit email and bounded JSON', async t => {
  const config = setup(t); let calls = 0;
  const handle = createHandler({ remove: async current => { calls++; assert.equal(current.accountId, id); return id; }, accountFor: async current => current.accountId });
  for (const headers of [{ cookie: '' }, { cookie: `${auth.SESSION_COOKIE}=${auth.seal({ user }, config, 'session', 60)}` }]) assert.equal((await request(handle, config, { headers })).statusCode, 401);
  for (const method of ['POST', 'PUT', 'PATCH', 'HEAD']) assert.equal((await request(handle, config, { method })).statusCode, 405);
  for (const headers of [{ origin: 'https://other.example' }, { 'x-requested-with': '' }, { 'content-type': 'text/plain' }]) assert.equal((await request(handle, config, { headers })).statusCode, 403);
  for (const body of [{ confirmation: 'other@example.com' }, {}, { confirmation: user.email, accountId: otherId }, '{', 'x'.repeat(1025), 'null', '[]']) assert.equal((await request(handle, config, { body })).statusCode, 400);
  assert.equal(calls, 0);
  const current = await request(handle, config, { method: 'GET' });
  assert.deepEqual(current.body, { email: user.email, accountId: id });
  const removed = await request(handle, config, { body: { confirmation: ' ALBA@EXAMPLE.COM ' } });
  assert.equal(removed.statusCode, 200); assert.equal(calls, 1);
  assert.deepEqual(removed.body, { ok: true, accountId: id });
  assert.equal(removed.headers['set-cookie'].length, 3);
  assert.ok(removed.headers['set-cookie'].every(value => /Max-Age=0/.test(value)));
});

test('failed deletion never clears session; removed accounts require reentry and hide storage errors', async t => {
  const config = setup(t);
  for (const [error, code] of [['database secret', 503], ['account_inactive', 401]]) {
    const handle = createHandler({ remove: async () => { throw new Error(error); }, accountFor: async () => { throw new Error(error); } });
    for (const method of ['GET', 'DELETE']) {
      const result = await request(handle, config, { method });
      assert.equal(result.statusCode, code); assert.equal(result.headers['set-cookie'], undefined);
      assert.doesNotMatch(JSON.stringify(result.body), /database secret/);
    }
  }
});

test('session account lookup never creates an identity and old cookies cannot address recreated account', async t => {
  setup(t); let current = id; const calls = [];
  const sql = async (strings, ...values) => { const query = strings.join('?'); calls.push(query); assert.match(query, /^SELECT id FROM kt_accounts WHERE id/); assert.equal(values[0], id); return current === values[0] ? [{ id: current }] : []; };
  assert.equal(await profiles.accountFor({ ...user, accountId: id }, sql), id);
  current = null;
  await assert.rejects(profiles.accountFor({ ...user, accountId: id }, sql), /account_inactive/);
  current = otherId;
  await assert.rejects(profiles.accountFor({ ...user, accountId: id }, sql), /account_inactive/);
  await assert.rejects(profiles.accountFor(user, sql), /account_inactive/);
  assert.ok(calls.every(query => !/INSERT|UPDATE/.test(query)));
});

test('removal deletes the session account in one cascade statement and never includes personal payload', async t => {
  setup(t); const queries = [];
  const sql = async (strings, ...values) => { const query = strings.join('?'); queries.push({ query, values }); return [{ id }]; };
  assert.equal(await users.remove({ ...user, accountId: id }, sql), id);
  assert.equal(queries.length, 2);
  assert.match(queries[1].query, /^DELETE FROM kt_accounts WHERE id = \? RETURNING id$/);
  assert.deepEqual(queries[1].values, [id]);
  for (const file of ['lib/profile-schema.sql', 'lib/notification-schema.sql']) {
    assert.match(readFileSync(new URL(file, import.meta.url), 'utf8'), /REFERENCES kt_accounts\(id\) ON DELETE CASCADE/);
  }
});

function storage(values = {}) { const map = new Map(Object.entries(values)); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; }
function uiFixture(request) {
  const nodes = Object.fromEntries(['account-delete-form', 'account-confirmation', 'account-confirm', 'account-delete', 'account-status', 'account-retry', 'account-signin', 'account-email'].map(key => [key, { hidden: true, disabled: false, value: '', checked: false, textContent: '', addEventListener(type, fn) { this[type] = fn; }, setAttribute() {}, focus() { this.focused = true; }, reportValidity() { return true; } }]));
  const navigations = [], local = storage(), drafts = storage();
  return { nodes, navigations, local, drafts, options: { root: { querySelector: selector => nodes[selector.slice(1)] }, request, navigate: url => navigations.push(url), storage: local, drafts } };
}
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('deletion UI preserves confirmation on failure, blocks duplicates and navigates only after confirmed success', async () => {
  let attempt = 0, writes = 0;
  const f = uiFixture(async (_, options) => options.method === 'GET' ? response(200, { email: user.email, accountId: id }) : (++writes, attempt++ === 0 ? response(503, {}) : response(200, { ok: true, accountId: id })));
  await initAccountPage(f.options);
  f.nodes['account-confirmation'].value = user.email;
  f.nodes['account-confirm'].checked = true;
  await f.nodes['account-delete-form'].submit({ preventDefault() {} });
  assert.equal(f.nodes['account-confirmation'].value, user.email);
  assert.equal(f.nodes['account-confirm'].checked, true);
  assert.deepEqual(f.navigations, []);
  assert.match(f.nodes['account-status'].textContent, /tente novamente/);
  const saving = f.nodes['account-delete-form'].submit({ preventDefault() {} });
  await f.nodes['account-delete-form'].submit({ preventDefault() {} });
  await saving;
  assert.equal(writes, 2); assert.deepEqual(f.navigations, ['./']);
});

test('account UI retries failed load and offers reentry on expired deletion without erasing input', async () => {
  let reads = 0;
  const f = uiFixture(async (_, options) => options.method === 'GET' ? (++reads === 1 ? response(503, {}) : response(200, { email: user.email, accountId: id })) : response(401, {}));
  await initAccountPage(f.options);
  assert.equal(f.nodes['account-retry'].hidden, false);
  await f.nodes['account-retry'].click();
  assert.equal(f.nodes['account-delete-form'].hidden, false);
  f.nodes['account-confirmation'].value = user.email; f.nodes['account-confirm'].checked = true;
  await f.nodes['account-delete-form'].submit({ preventDefault() {} });
  assert.equal(f.nodes['account-signin'].hidden, false);
  assert.equal(f.nodes['account-confirmation'].value, user.email); assert.deepEqual(f.navigations, []);
});

test('deletion cleanup removes only account-owned copies and preserves another account or ownerless legacy', () => {
  const key = 'know-thyself.birth-profiles.v1', draft = 'know-thyself.profile-draft.v1';
  const local = storage({ [key]: 'saved', [`${key}.imported`]: id, [`${key}.import-declined.${id}`]: '1', [`${key}.import-declined.${otherId}`]: '1' });
  const drafts = storage({ [`${draft}.${id}`]: JSON.stringify({ owner: id }), [`${draft}.${otherId}`]: JSON.stringify({ owner: otherId }), [draft]: JSON.stringify({ owner: otherId }) });
  clearAccountCopies(id, local, drafts);
  assert.equal(local.getItem(key), null); assert.equal(local.getItem(`${key}.imported`), null);
  assert.equal(local.getItem(`${key}.import-declined.${otherId}`), '1');
  assert.equal(drafts.getItem(`${draft}.${id}`), null); assert.ok(drafts.getItem(`${draft}.${otherId}`)); assert.ok(drafts.getItem(draft));
  const ownerless = storage({ [key]: 'preserve' }); clearAccountCopies(id, ownerless, drafts); assert.equal(ownerless.getItem(key), 'preserve');
});


test('inactive account returns401 for profile reads and writes without leaking storage errors', async t => {
  const config = setup(t);
  const handler = require('./api/profiles.js').createHandler({ accountFor: async () => { throw new Error('account_inactive'); } });
  for (const method of ['GET', 'PUT']) {
    const response = await request(handler, config, { method, body: { accountId: id, revision: 0, state: { version: 1, profiles: [], activeId: null } } });
    assert.equal(response.statusCode, 401); assert.deepEqual(response.body, { error: 'unauthorized' });
  }
});


test('confirmed deletion clears owned copies and exits without waiting for browser push APIs', async t => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  t.after(() => navigatorDescriptor ? Object.defineProperty(globalThis, 'navigator', navigatorDescriptor) : delete globalThis.navigator);
  for (const pending of ['registration', 'subscription', 'unsubscribe']) {
    const never = () => new Promise(() => {});
    const f = uiFixture(async (_, options) => options.method === 'GET' ? response(200, { email: user.email, accountId: id }) : response(200, { ok: true, accountId: id }));
    const key = 'know-thyself.profile-draft.v1.' + id;
    f.drafts.setItem(key, JSON.stringify({ owner: id }));
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: { getRegistration: pending === 'registration' ? never : async () => ({ pushManager: { getSubscription: pending === 'subscription' ? never : async () => ({ unsubscribe: never }) } }) } } });
    await initAccountPage(f.options);
    f.nodes['account-confirmation'].value = user.email; f.nodes['account-confirm'].checked = true;
    let timer;
    try {
      await Promise.race([f.nodes['account-delete-form'].submit({ preventDefault() {} }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('optional push cleanup blocked redirect: ' + pending)), 200); })]);
    } finally { clearTimeout(timer); }
    assert.deepEqual(f.navigations, ['./']); assert.equal(f.drafts.getItem(key), null);
  }
});
