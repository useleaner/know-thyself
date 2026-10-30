import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createECDH, randomBytes } from 'node:crypto';
const require = createRequire(import.meta.url);
const auth = require('./lib/google-auth.cjs');
const store = require('./lib/notification-store.cjs');
const crypto = require('./lib/crypto.cjs');
const schedule = require('./lib/notification-schedule.cjs');
const { createHandler } = require('./api/notifications.js');
const { createHandler: createCron } = require('./api/cron-notifications.js');

const ec = createECDH('prime256v1'); ec.generateKeys();
const vapid = { VAPID_PUBLIC_KEY: ec.getPublicKey().toString('base64url'), VAPID_PRIVATE_KEY: ec.getPrivateKey().toString('base64url'), VAPID_SUBJECT: 'mailto:owner@example.com' };
const env = { ...vapid, ENCRYPTION_KEY: randomBytes(32).toString('base64'), CRON_SECRET: 'synthetic-cron-secret-'.repeat(3), GOOGLE_CLIENT_ID: '123-test.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-client-secret', APP_ORIGIN: 'https://app.example', SESSION_SECRET: 'synthetic-session-secret-'.repeat(3), ALLOWED_GOOGLE_EMAILS: '*' };
const user = { sub: 'synthetic-google-sub', name: 'Fictício', email: 'synthetic@example.com', email_verified: true };
const pref = { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic', keys: { p256dh: ec.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }, profileId: 'synthetic', time: '08:00', timeZone: 'America/Sao_Paulo', language: 'pt-BR' };
const profile = { id: 'synthetic', name: 'Pessoa fictícia', birthDate: '1991-06-17', birthTime: '04:23', timezone: 'America/Sao_Paulo', lat: -23.55, lon: -46.6333 };
const now = new Date('2026-10-21T11:01:00.000Z');

function configured(t, overrides = {}) {
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env, overrides);
  t.after(() => Object.entries(before).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value));
}
function headers() {
  const config = auth.configuration();
  return { cookie: `${auth.SESSION_COOKIE}=${auth.seal({ accountId: '00000000-0000-4000-8000-000000000001', user }, config, 'session', 300)}`, origin: env.APP_ORIGIN, 'x-requested-with': 'XmlHttpRequest', 'content-type': 'application/json' };
}
async function request(handler, method, body, inputHeaders = {}) {
  const res = { headers: {}, setHeader(key, value) { this.headers[key.toLowerCase()] = value; }, end(value) { this.body = JSON.parse(value); } };
  await handler({ method, body, headers: inputHeaders }, res);
  return res;
}
function repository(extra = {}) {
  return { accountFor: async () => 'account-owned-by-session', profileState: async () => ({ state: { profiles: [profile], activeId: 'another-profile', settings: { zodiac: 'tropical' } } }), write: async (_, preference) => store.publicPreference(preference), read: async () => null, remove: async () => {}, ...extra };
}
function row(extra = {}) { return { endpoint_hash: 'endpoint-hmac', account_id: 'account-owned-by-session', data: crypto.encrypt(JSON.stringify(pref)), next_due_at: '2026-10-21T11:00:00.000Z', last_day: null, lease_id: 'lease', ...extra }; }
const cronHeaders = () => ({ authorization: `Bearer ${env.CRON_SECRET}` });

test('Push configuration is fail-closed and requires matching VAPID keys', t => {
  configured(t);
  assert.deepEqual(store.configuration(), { publicKey: vapid.VAPID_PUBLIC_KEY, privateKey: vapid.VAPID_PRIVATE_KEY, subject: vapid.VAPID_SUBJECT });
  for (const change of [{ VAPID_PUBLIC_KEY: '' }, { VAPID_PRIVATE_KEY: 'broken' }, { VAPID_SUBJECT: 'http://localhost/' }, { VAPID_SUBJECT: 'mailto:invalid' }, { VAPID_SUBJECT: 'https://user:password@example.com/' }]) assert.equal(store.configuration({ ...env, ...change }), null);
});

test('Push endpoints reject private/foreign hosts, credentials, fragments and alternate ports', () => {
  for (const endpoint of ['https://fcm.googleapis.com/fcm/send/a', 'https://web.push.apple.com/a', 'https://updates.push.services.mozilla.com/a', 'https://wns2.notify.windows.com/a']) assert.equal(store.validateEndpoint(endpoint), endpoint);
  for (const endpoint of ['http://fcm.googleapis.com/a', 'https://127.0.0.1/a', 'https://169.254.169.254/a', 'https://localhost/a', 'https://fcm.googleapis.com.evil.example/a', 'https://evilpush.apple.com/a', 'https://fcm.googleapis.com:444/a', 'https://user:password@fcm.googleapis.com/a', 'https://fcm.googleapis.com/a#fragment', 'https://evil.example@localhost/a']) assert.throws(() => store.validateEndpoint(endpoint));
});

test('subscription validation checks EC point, auth length, time, timezone and language', () => {
  assert.deepEqual(store.validatePreference(pref), pref);
  for (const change of [{ time: '24:00' }, { time: '8:00' }, { timeZone: 'Not/AZone' }, { timeZone: '' }, { language: 'es' }, { profileId: '' }, { subscription: { ...pref.subscription, keys: { ...pref.subscription.keys, auth: 'abcd' } } }, { subscription: { ...pref.subscription, keys: { ...pref.subscription.keys, p256dh: Buffer.alloc(65, 4).toString('base64url') } } }]) assert.throws(() => store.validatePreference({ ...pref, ...change }));
});

test('notifications API authenticates all methods and hides private VAPID material', async t => {
  configured(t);
  const handler = createHandler(repository({ accountFor: () => { throw new Error('GET must not access db'); } }));
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) assert.equal((await request(handler, method, pref)).statusCode, 401);
  const response = await request(handler, 'GET', null, headers());
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { configured: true, publicKey: vapid.VAPID_PUBLIC_KEY });
  assert.equal(response.headers['cache-control'], 'private, no-store');
  process.env.VAPID_PRIVATE_KEY = '';
  assert.deepEqual((await request(handler, 'GET', null, headers())).body, { configured: false, publicKey: null });
});

test('CSRF protection covers every state or endpoint-reading request', async t => {
  configured(t);
  const handler = createHandler(repository());
  for (const method of ['POST', 'PUT', 'DELETE']) {
    for (const change of [{ origin: 'https://evil.example' }, { origin: undefined }, { 'x-requested-with': undefined }, { 'content-type': 'text/plain' }]) assert.equal((await request(handler, method, pref, { ...headers(), ...change })).statusCode, 403);
  }
  assert.equal((await request(handler, 'PATCH', pref, headers())).statusCode, 405);
});

test('API binds subscription and explicit profile to the session owner', async t => {
  configured(t);
  const calls = [];
  const handler = createHandler(repository({ write: async (...args) => { calls.push(args); return store.publicPreference(args[1]); }, read: async (...args) => { calls.push(args); return null; }, remove: async (...args) => { calls.push(args); } }));
  const saved = await request(handler, 'PUT', { ...pref, accountId: 'attacker-choice' }, headers());
  assert.equal(saved.statusCode, 200);
  assert.deepEqual(saved.body, { preference: store.publicPreference(pref) });
  assert.deepEqual(calls[0], ['account-owned-by-session', pref]);
  assert.equal((await request(handler, 'PUT', { ...pref, profileId: 'foreign-profile' }, headers())).body.error, 'invalid_profile');
  assert.deepEqual((await request(handler, 'POST', { endpoint: pref.subscription.endpoint }, headers())).body, { preference: null });
  assert.deepEqual((await request(handler, 'DELETE', { endpoint: pref.subscription.endpoint }, headers())).body, { disabled: true });
  assert.deepEqual(calls.slice(1), Array.from({ length: 2 }, () => ['account-owned-by-session', pref.subscription.endpoint]));
  const conflict = createHandler(repository({ write: async () => null }));
  assert.equal((await request(conflict, 'PUT', pref, headers())).statusCode, 409);
});

test('malformed, oversized, unconfigured and unavailable requests fail without saving', async t => {
  configured(t);
  const handler = createHandler(repository({ write: () => { throw new Error('must not write'); } }));
  for (const body of ['{', null, {}, { ...pref, time: 'oops' }, 'x'.repeat(13000)]) assert.equal((await request(handler, 'PUT', body, headers())).statusCode, 400);
  process.env.VAPID_PRIVATE_KEY = '';
  assert.equal((await request(handler, 'PUT', pref, headers())).statusCode, 503);
  process.env.VAPID_PRIVATE_KEY = env.VAPID_PRIVATE_KEY;
  const failing = createHandler(repository({ accountFor: async () => { throw new Error('db'); } }));
  assert.equal((await request(failing, 'POST', { endpoint: pref.subscription.endpoint }, headers())).statusCode, 503);
});

test('schedule uses selected local timezone, handles midnight, DST gap and fold once per local day', async () => {
  assert.equal((await schedule.nextDue(pref, new Date('2026-10-21T10:59:59Z'))).toISOString(), '2026-10-21T11:00:00.000Z');
  assert.equal((await schedule.nextDue(pref, now, '2026-10-21')).toISOString(), '2026-10-22T11:00:00.000Z');
  assert.equal((await schedule.nextDue({ time: '00:00', timeZone: 'Asia/Tokyo' }, new Date('2026-10-21T14:00:00Z'))).toISOString(), '2026-10-21T15:00:00.000Z');
  assert.equal((await schedule.nextDue({ time: '02:30', timeZone: 'America/New_York' }, new Date('2026-03-08T05:00:00Z'))).toISOString(), '2026-03-08T07:30:00.000Z');
  assert.equal((await schedule.nextDue({ time: '01:30', timeZone: 'America/New_York' }, new Date('2026-11-01T04:00:00Z'))).toISOString(), '2026-11-01T05:30:00.000Z');
  assert.equal((await schedule.nextDue({ time: '01:30', timeZone: 'America/New_York' }, new Date('2026-11-01T05:31:00Z'), '2026-11-01')).toISOString(), '2026-11-02T06:30:00.000Z');
});

test('store encrypts subscriptions, hashes endpoints and scopes reads/deletes/writes by account', async t => {
  configured(t);
  const calls = [];
  const sql = async (parts, ...values) => { calls.push({ query: parts.join('?'), values }); return [{ endpoint_hash: 'hash' }]; };
  assert.deepEqual(await store.write('session-account', pref, now, sql), store.publicPreference(pref));
  const insert = calls[0];
  assert.ok(!JSON.stringify(insert).includes(pref.subscription.endpoint));
  assert.equal(insert.values[1], 'session-account');
  assert.deepEqual(JSON.parse(crypto.decrypt(insert.values[2])), pref);
  assert.match(insert.query, /WHERE kt_push_subscriptions.account_id = EXCLUDED.account_id/);
  const readSql = async (parts, ...values) => { calls.push({ query: parts.join('?'), values }); return [{ data: insert.values[2] }]; };
  assert.deepEqual(await store.read('session-account', pref.subscription.endpoint, readSql), store.publicPreference(pref));
  await store.remove('session-account', pref.subscription.endpoint, sql);
  for (const call of calls.slice(1)) { assert.match(call.query, /account_id = \?/); assert.equal(call.values[1], 'session-account'); }
  await store.claim(now, sql);
  assert.match(calls.at(-1).query, /FOR UPDATE SKIP LOCKED/);
  assert.match(calls.at(-1).query, /lease_until IS NULL OR lease_until </);
  await store.reserve(row(), '2026-10-21', new Date('2026-10-22T11:00Z'), sql);
  assert.match(calls.at(-1).query, /AND lease_id = \?/);
});

test('cron requires strong secret, correct method and VAPID before claiming', async t => {
  configured(t);
  let claims = 0;
  const handler = createCron({ claim: async () => { claims++; return []; } });
  for (const header of [undefined, 'Bearer wrong', `Bearer ${'é'.repeat(env.CRON_SECRET.length)}`]) assert.equal((await request(handler, 'GET', null, { authorization: header })).statusCode, 401);
  assert.equal((await request(handler, 'POST', null, cronHeaders())).statusCode, 405);
  process.env.CRON_SECRET = '';
  assert.equal((await request(handler, 'GET', null, cronHeaders())).statusCode, 401);
  process.env.CRON_SECRET = env.CRON_SECRET;
  process.env.VAPID_PRIVATE_KEY = '';
  assert.equal((await request(handler, 'GET', null, cronHeaders())).statusCode, 503);
  assert.equal(claims, 0);
});

test('concurrent and repeated cron claims only dispatch once after durable reservation', async t => {
  configured(t);
  const item = row();
  let reserved = false, sent = 0;
  const repo = repository({ claim: async () => [item], reserve: async () => { if (reserved) return false; reserved = true; return true; } });
  const handler = createCron(repo, async (subscription, payload, options) => {
    assert.ok(reserved);
    assert.deepEqual(subscription, pref.subscription);
    const message = JSON.parse(payload);
    assert.ok(message.url.includes('profile=synthetic'));
    assert.ok(!message.url.includes('another-profile'));
    assert.equal(options.TTL, 57540);
    sent++;
  }, () => now);
  const results = await Promise.all([request(handler, 'GET', null, cronHeaders()), request(handler, 'GET', null, cronHeaders())]);
  assert.equal(results.reduce((total, response) => total + response.body.sent, 0), 1);
  assert.equal(sent, 1);
  await request(handler, 'GET', null, cronHeaders());
  assert.equal(sent, 1);
});

test('cron isolates corrupt and failed subscriptions, expires 404/410 and passes account settings/profile/language', async t => {
  configured(t);
  const items = ['good', 'gone404', 'gone410', 'retry', 'corrupt'].map((key, index) => row({ endpoint_hash: key, data: index === 4 ? 'invalid cipher' : crypto.encrypt(JSON.stringify({ ...pref, language: 'en', subscription: { ...pref.subscription, endpoint: `https://fcm.googleapis.com/fcm/send/${key}` } })) }));
  const removed = [], payloadCalls = [];
  const handler = createCron(repository({ claim: async () => items, reserve: async () => true, removeExpired: async row => { removed.push(row.endpoint_hash); } }), async subscription => {
    const id = subscription.endpoint.split('/').at(-1);
    if (id === 'gone404') throw { statusCode: 404 };
    if (id === 'gone410') throw { statusCode: 410 };
    if (id === 'retry') throw { statusCode: 503 };
  }, () => now, async (...args) => { payloadCalls.push(args); return { title: 'Fictício', body: 'Leitura', url: './universo.html' }; });
  assert.deepEqual((await request(handler, 'GET', null, cronHeaders())).body, { sent: 1, skipped: 0, removed: 2, failed: 2 });
  assert.deepEqual(removed.sort(), ['gone404', 'gone410']);
  for (const args of payloadCalls) { assert.equal(args[0].id, profile.id); assert.deepEqual(args[1], { zodiac: 'tropical' }); assert.equal(args[2].toISOString(), '2026-10-21T11:00:00.000Z'); assert.equal(args[3], 'en'); }
});

test('expired schedule advances to today before its chosen hour; same-day repeats, missing profile and absent aspect never send', async t => {
  configured(t);
  const earlier = new Date('2026-10-21T10:00:00Z');
  const reservations = [], removed = [];
  const items = [row({ endpoint_hash: 'stale', next_due_at: '2026-10-20T11:00Z' }), row({ endpoint_hash: 'repeat', last_day: '2026-10-21' }), row({ endpoint_hash: 'missing', account_id: 'missing' }), row({ endpoint_hash: 'no-aspect' })];
  const repo = repository({ claim: async () => items, profileState: async account => account === 'missing' ? { state: { profiles: [] } } : { state: { profiles: [profile] } }, reserve: async (...args) => { reservations.push(args); return true; }, removeClaim: async row => { removed.push(row.endpoint_hash); } });
  const handler = createCron(repo, () => { throw new Error('must not send'); }, () => earlier, () => null);
  assert.deepEqual((await request(handler, 'GET', null, cronHeaders())).body, { sent: 0, skipped: 3, removed: 1, failed: 0 });
  assert.equal(reservations.find(args => args[0].endpoint_hash === 'stale')[2].toISOString(), '2026-10-21T11:00:00.000Z');
  assert.deepEqual(removed, ['missing']);
});

test('notification schema stays compatible with the migration statement splitter', () => {
  const sql = readFileSync(new URL('./lib/notification-schema.sql', import.meta.url), 'utf8');
  const statements = sql.split(';').map(value => value.replace(/--[^\n]*/g, '').trim()).filter(Boolean);
  assert.equal(statements.length, 3);
  for (const statement of statements) assert.match(statement, /^CREATE (TABLE|INDEX) IF NOT EXISTS /);
  assert.ok(statements[0].includes('REFERENCES kt_accounts(id) ON DELETE CASCADE'));
});
