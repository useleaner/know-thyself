import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const auth = require('./lib/google-auth.cjs');
const { isAdmin } = require('./lib/admin-auth.cjs');
const { createHandler } = require('./api/admin-users.js');
const proxy = require('./proxy.js');
const store = require('./lib/user-store.cjs');
const settings = {
  GOOGLE_CLIENT_ID: '123-test.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-client-secret',
  APP_ORIGIN: 'https://know-thyself.example', APP_ADDITIONAL_ORIGINS: '',
  SESSION_SECRET: 'test-secret-'.repeat(4), ALLOWED_GOOGLE_EMAILS: '*', ADMIN_EMAILS: 'admin@example.com',
  ENCRYPTION_KEY: Buffer.alloc(32, 4).toString('base64'), KT_ACCESS: ''
};
const admin = { sub: 'test-admin', email: 'admin@example.com', name: 'Admin sintético', email_verified: true };
const id = '00000000-0000-4000-8000-000000000001';
function setup(t, overrides = {}) {
  const values = { ...settings, ...overrides };
  const before = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => Object.entries(before).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value));
  return auth.configuration();
}
function cookie(user = admin, config = auth.configuration(), now) {
  return `${auth.SESSION_COOKIE}=${auth.seal({ accountId: '00000000-0000-4000-8000-000000000001', user }, config, 'session', auth.SESSION_SECONDS, now)}`;
}
async function request(handler, { headers = {}, method = 'GET', query = '' } = {}) {
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(body) { this.body = JSON.parse(body); } };
  await handler({ method, headers, url: '/api/admin-users' + query }, res);
  return res;
}
test('admin access denies missing, wildcard, malformed lists and non-admins', () => {
  for (const ADMIN_EMAILS of ['', '*', 'admin@example.com,', 'admin@example.com,broken', 'admin@example.com;other@example.com']) assert.equal(isAdmin(admin, { ADMIN_EMAILS }), false);
  assert.equal(isAdmin(admin, { ADMIN_EMAILS: ' ADMIN@EXAMPLE.COM , second@example.com ' }), true);
  assert.equal(isAdmin({ ...admin, email: 'other@example.com' }, settings), false);
  assert.equal(isAdmin(null, settings), false);
});
test('list API never touches database for unauthenticated, expired, tampered or ordinary sessions', async t => {
  const config = setup(t);
  const handler = createHandler({ accountFor: async user => user.accountId, list() { assert.fail('must not read DB'); } });
  for (const header of [undefined, cookie(admin, config, Date.now() - auth.SESSION_SECONDS * 1000 - 1000), cookie().slice(0, -8)]) {
    const res = await request(handler, { headers: { cookie: header } });
    assert.equal(res.statusCode, 401); assert.equal(res.headers['cache-control'], 'private, no-store');
  }
  assert.equal((await request(handler, { headers: { cookie: cookie({ ...admin, email: 'regular@example.com' }) } })).statusCode, 403);
  process.env.ADMIN_EMAILS = '';
  assert.equal((await request(handler, { headers: { cookie: cookie() } })).statusCode, 403);
});
test('admin API is GET-only, validates the cursor, passes the bound cursor and handles database failure', async t => {
  setup(t);
  const headers = { cookie: cookie() }; const calls = [];
  const handler = createHandler({ accountFor: async user => user.accountId, list: async cursor => { calls.push(cursor); return { users: [{ id, name: 'Alba', email: 'alba@example.com', created_at: '2026-10-21T00:00:00Z', last_login_at: null }], nextCursor: null }; } });
  for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) assert.equal((await request(handler, { headers, method })).statusCode, 405);
  for (const query of ['?cursor=', '?cursor=bad', '?cursor=1%27%20OR%201=1', `?cursor=${id}&cursor=${id}`]) assert.equal((await request(handler, { headers, query })).statusCode, 400);
  assert.deepEqual(calls, []);
  const res = await request(handler, { headers, query: `?cursor=${id}` });
  assert.equal(res.statusCode, 200); assert.deepEqual(calls, [id]); assert.equal(res.body.users[0].name, 'Alba');
  const fail = await request(createHandler({ accountFor: async user => user.accountId, list: async () => { throw new Error('secret connection'); } }), { headers });
  assert.equal(fail.statusCode, 503); assert.deepEqual(fail.body, { error: 'users_unavailable' });
});
test('admin page and resources enforce separate privilege even with Vercel bypass; revoked app access also denies', t => {
  setup(t);
  for (const path of ['/admin', '/admin.html', '/admin.js', '/admin.css', '/api/admin-users']) {
    const req = value => new Request(settings.APP_ORIGIN + path, { headers: value ? { cookie: value } : {} });
    assert.equal(proxy(req()).status, 403);
    assert.equal(proxy(req(cookie({ ...admin, email: 'ordinary@example.com' }))).status, 403);
    assert.equal(proxy(req(cookie())), undefined);
    process.env.KT_ACCESS = 'vercel';
    assert.equal(proxy(req()).status, 403);
    assert.equal(proxy(req(cookie())), undefined);
    process.env.KT_ACCESS = '';
  }
  process.env.ALLOWED_GOOGLE_EMAILS = 'someone@example.com';
  assert.equal(proxy(new Request(settings.APP_ORIGIN + '/admin.html', { headers: { cookie: cookie(admin, auth.configuration({ ...settings })) } })).status, 403);
});
test('user list selects only metadata and paginates with a bound keyset, without reading birth states', async () => {
  const rows = Array.from({ length: 51 }, (_, n) => ({ id: String(n) }));
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    assert.match(query, /SELECT id, name, email, created_at, last_login_at FROM kt_accounts/);
    assert.match(query, /ORDER BY created_at DESC, id DESC LIMIT 51/);
    assert.doesNotMatch(query, /kt_profile_states|email_hash|google_hash|SELECT \*/);
    assert.deepEqual(values, [id, id]); return rows;
  };
  const result = await store.list(id, sql);
  assert.equal(result.users.length, 50); assert.equal(result.nextCursor, '49');
  assert.deepEqual(await store.list(null, async () => []), { users: [], nextCursor: null });
});
test('login metadata reuses stable account id and updates identity only, preserving Google name on email login', async t => {
  setup(t);
  const calls = [];
  const sql = async (strings, ...values) => { const query = strings.join('?'); calls.push({ query, values }); return [{ id }]; };
  await store.recordLogin(admin, sql);
  assert.equal(calls.length, 2);
  assert.match(calls[0].query, /SELECT id FROM kt_accounts WHERE google_hash/);
  assert.match(calls[1].query, /UPDATE kt_accounts SET/);
  assert.deepEqual(calls[1].values, [false, admin.name, admin.email, id]);
  assert.doesNotMatch(calls.map(c => c.query).join(' '), /kt_profile_states|DELETE|TRUNCATE/);
  calls.length = 0;
  await store.recordLogin({ sub: 'email:ADMIN@example.com', email: 'ADMIN@example.com', name: 'ADMIN@example.com' }, sql);
  assert.match(calls[0].query, /INSERT INTO kt_accounts/);
  assert.equal(calls[0].values[1], null);
  assert.deepEqual(calls[1].values, [true, 'ADMIN@example.com', 'admin@example.com', id]);
});

test('users migration stays additive and excludes the notification schema; invalid target never opens database', async () => {
  const { spawnSync } = await import('node:child_process');
  const cwd = new URL('./', import.meta.url);
  for (const target of ['users', 'invalid']) {
    const program = `
      const assert = require('node:assert/strict');
      const profiles = require('./lib/profile-store.cjs');
      const calls = [];
      profiles.database = () => {
        assert.equal(${JSON.stringify(target)}, 'users');
        const sql = { query: query => { calls.push(query); return query; }, transaction: async queries => {
          assert.ok(queries.some(q => q.includes('ADD COLUMN IF NOT EXISTS name')));
          assert.ok(queries.some(q => q.includes('ADD COLUMN IF NOT EXISTS email')));
          assert.ok(queries.some(q => q.includes('ADD COLUMN IF NOT EXISTS last_login_at')));
          assert.ok(queries.every(q => !/notification|DROP |DELETE FROM |TRUNCATE |UPDATE /i.test(q)));
        }};
        return sql;
      };
      process.argv[2] = ${JSON.stringify(target)};
      require('./scripts/migrate.cjs');
      setImmediate(() => { if (${JSON.stringify(target)} === 'users') assert.equal(calls.length, 6); else assert.equal(calls.length, 0); });
    `;
    const result = spawnSync(process.execPath, ['-e', program], { cwd, encoding: 'utf8' });
    assert.equal(result.status, target === 'users' ? 0 : 1, result.stderr);
    assert.doesNotMatch(result.stderr, /AssertionError/);
  }
});

test('deleted administrator cannot read users even with an unexpired signed cookie', async t => {
  setup(t);
  const handle = createHandler({ accountFor: async () => { throw new Error('account_inactive'); }, list: async () => assert.fail('inactive account must not read users') });
  const result = await request(handle, { headers: { cookie: cookie() } });
  assert.equal(result.statusCode, 401); assert.deepEqual(result.body, { error: 'unauthorized' });
});
