import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const auth = require('./lib/google-auth.cjs');
const handler = require('./api/auth.js');
const settings = {
  GOOGLE_CLIENT_ID: '123-test.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  APP_ORIGIN: 'https://know-thyself.example',
  APP_ADDITIONAL_ORIGINS: '',
  SESSION_SECRET: 'test-secret-'.repeat(4),
  ALLOWED_GOOGLE_EMAILS: 'test@example.com, second@example.com'
};
const googleUser = { sub: 'google-subject', name: 'Pessoa de teste', email: 'test@example.com', email_verified: true };

function configured(t, overrides = {}) {
  const before = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings, overrides);
  t.after(() => Object.entries(before).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value));
  return auth.configuration();
}

async function request(action, { method = 'GET', headers = {}, query = '', body } = {}) {
  const res = {
    headers: {}, statusCode: 200,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value = '') { this.body = value; }
  };
  await handler({ method, headers, body, url: `/api/auth?action=${action}${query}` }, res);
  return res;
}

function stateCookie(config, values = {}, now) {
  const pending = { state: 'test-state', verifier: 'v'.repeat(43), ...values };
  return `${auth.STATE_COOKIE}=${auth.seal(pending, config, 'oauth', auth.STATE_SECONDS, now)}`;
}

test('Google configuration rejects missing secrets and noncanonical or insecure origins', () => {
  assert.ok(auth.configuration(settings));
  assert.ok(auth.configuration({ ...settings, APP_ORIGIN: 'http://localhost:3000' }));
  for (const origin of ['http://example.com', 'https://example.com/', 'https://example.com/path', 'https://u:p@example.com', 'https://example.com?query=1', 'not a URL']) {
    assert.equal(auth.configuration({ ...settings, APP_ORIGIN: origin }), null);
  }
  for (const change of [{ GOOGLE_CLIENT_ID: '' }, { GOOGLE_CLIENT_ID: 'not-google' }, { GOOGLE_CLIENT_SECRET: ' ' }, { SESSION_SECRET: 'short' }, { ALLOWED_GOOGLE_EMAILS: '' }, { ALLOWED_GOOGLE_EMAILS: 'a@example.com,invalid' }, { ALLOWED_GOOGLE_EMAILS: 'a@example.com,' }]) {
    assert.equal(auth.configuration({ ...settings, ...change }), null);
  }
});

test('signed cookies reject tampering, expiry, different purposes, origins and clients', () => {
  const config = auth.configuration(settings);
  const now = Date.now();
  const token = auth.seal({ value: 'test' }, config, 'session', 60, now);
  assert.equal(auth.open(token, config, 'session', now).value, 'test');
  assert.equal(auth.open(`${token[0] === 'a' ? 'b' : 'a'}${token.slice(1)}`, config, 'session', now), null);
  assert.equal(auth.open(`${token.slice(0, -1)}${token.at(-1) === 'a' ? 'b' : 'a'}`, config, 'session', now), null);
  assert.equal(auth.open(token, config, 'oauth', now), null);
  assert.equal(auth.open(token, config, 'session', now + 60000), null);
  assert.equal(auth.open(token, { ...config, origin: 'https://other.example' }, 'session', now), null);
  assert.equal(auth.open(token, { ...config, clientId: 'another.apps.googleusercontent.com' }, 'session', now), null);
  for (const malformed of [undefined, '', 'bad', 'a.b.c', 'a'.repeat(4097)]) assert.equal(auth.open(malformed, config, 'session', now), null);
});

test('unconfigured API never creates a pretend login', async t => {
  configured(t, { GOOGLE_CLIENT_SECRET: '' });
  const session = await request('session');
  assert.deepEqual(JSON.parse(session.body), { configured: false, user: null });
  const login = await request('login');
  assert.equal(login.headers.location, '/?auth_error=not_configured');
  assert.equal(login.headers['set-cookie'], undefined);
  assert.equal((await request('callback')).headers.location, '/?auth_error=not_configured');
});

test('login uses minimal scopes, random state, PKCE S256 and secure expiring cookies', async t => {
  const config = configured(t);
  const res = await request('login');
  assert.equal(res.statusCode, 303);
  const location = new URL(res.headers.location);
  assert.equal(location.origin, 'https://accounts.google.com');
  assert.equal(location.searchParams.get('scope'), 'openid email profile');
  assert.equal(location.searchParams.get('redirect_uri'), `${settings.APP_ORIGIN}/api/auth?action=callback`);
  assert.equal(location.searchParams.get('response_type'), 'code');
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(location.searchParams.has('client_secret'), false);
  assert.equal(location.searchParams.has('access_type'), false);
  const rawCookie = res.headers['set-cookie'];
  assert.match(rawCookie, /HttpOnly; SameSite=Lax; Max-Age=600; Secure$/);
  const pending = auth.open(auth.cookies(rawCookie)[auth.STATE_COOKIE], config, 'oauth');
  assert.equal(pending.state, location.searchParams.get('state'));
  assert.equal(location.searchParams.get('code_challenge'), createHash('sha256').update(pending.verifier).digest('base64url'));
  assert.notEqual(new URL((await request('login')).headers.location).searchParams.get('state'), pending.state);
});

test('callback rejects missing, altered or expired state before contacting Google', async t => {
  const config = configured(t);
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Must not contact Google'); });
  for (const jar of ['', stateCookie(config, { state: 'different' }), `${stateCookie(config)}tampered`, stateCookie(config, {}, Date.now() - 601000)]) {
    const res = await request('callback', { headers: { cookie: jar }, query: '&state=test-state&code=code' });
    assert.equal(res.headers.location, '/?auth_error=invalid_state');
    assert.match(res.headers['set-cookie'], /Max-Age=0/);
  }
  assert.equal(globalThis.fetch.mock.calls.length, 0);
});

test('callback handles cancellation and missing code with stable error names', async t => {
  const config = configured(t);
  const headers = { cookie: stateCookie(config) };
  assert.equal((await request('callback', { headers, query: '&state=test-state&error=access_denied' })).headers.location, '/?auth_error=access_denied');
  assert.equal((await request('callback', { headers, query: '&state=test-state' })).headers.location, '/?auth_error=invalid_response');
});

test('successful callback exchanges code on the server and exposes only name/email in session API', async t => {
  const config = configured(t);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(calls.length === 1 ? { access_token: 'private-google-token', token_type: 'Bearer' } : googleUser), { status: 200 });
  });
  const res = await request('callback', { headers: { cookie: stateCookie(config) }, query: '&state=test-state&code=private-code' });
  assert.equal(res.statusCode, 303);
  assert.equal(res.headers.location, '/universo.html');
  assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
  assert.equal(calls[0].options.body.get('code_verifier'), 'v'.repeat(43));
  assert.equal(calls[0].options.body.get('client_secret'), settings.GOOGLE_CLIENT_SECRET);
  assert.equal(calls[1].url, 'https://openidconnect.googleapis.com/v1/userinfo');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer private-google-token');
  const sessionCookie = res.headers['set-cookie'].find(value => value.startsWith(`${auth.SESSION_COOKIE}=`));
  assert.match(sessionCookie, /HttpOnly; SameSite=Lax; Max-Age=28800; Secure$/);
  const session = auth.open(auth.cookies(sessionCookie)[auth.SESSION_COOKIE], config, 'session');
  assert.equal(session.user.sub, googleUser.sub);
  assert.doesNotMatch(JSON.stringify(session), /private-google-token|private-code|test-client-secret/);
  const current = await request('session', { headers: { cookie: sessionCookie.split(';')[0] } });
  assert.deepEqual(JSON.parse(current.body), { configured: true, clientId: settings.GOOGLE_CLIENT_ID, email: false, user: { name: googleUser.name, email: googleUser.email } });
  assert.equal(current.headers['cache-control'], 'private, no-store');
  assert.equal((await request('session', { headers: { cookie: `${sessionCookie.split(';')[0]}tampered` } })).body, JSON.stringify({ configured: true, clientId: settings.GOOGLE_CLIENT_ID, email: false, user: null }));
});

test('callback denies a different Google email and clears any previous app session', async t => {
  const config = configured(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(++calls === 1 ? { access_token: 'token', token_type: 'Bearer' } : { ...googleUser, email: 'other@example.com' }), { status: 200 }));
  const res = await request('callback', { headers: { cookie: stateCookie(config) }, query: '&state=test-state&code=code' });
  assert.equal(res.headers.location, '/?auth_error=access_denied');
  assert.equal(res.headers['set-cookie'].length, 2);
  for (const value of res.headers['set-cookie']) assert.match(value, /Max-Age=0; Secure$/);
});

test('session authorization validates schema and the current allowed email on every request', async t => {
  const config = configured(t);
  const header = user => `${auth.SESSION_COOKIE}=${auth.seal({ user }, config, 'session', 60)}`;
  assert.equal(auth.authorizedSession(header(googleUser), config).email, googleUser.email);
  assert.equal(auth.authorizedSession(header({ ...googleUser, email: 'other@example.com' }), config), null);
  assert.equal(auth.authorizedSession(header({ ...googleUser, email_verified: false }), config), null);
  assert.equal(auth.authorizedSession(header({ email: googleUser.email }), config), null);
  const res = await request('session', { headers: { cookie: header({ ...googleUser, email: 'other@example.com' }) } });
  assert.deepEqual(JSON.parse(res.body), { configured: true, clientId: settings.GOOGLE_CLIENT_ID, email: false, user: null });
  assert.equal(auth.authorizedSession(header(googleUser), { ...config, allowedEmails: ['changed@example.com'] }), null);
  assert.equal(auth.authorizedSession(header({ ...googleUser, email: 'second@example.com' }), config).email, 'second@example.com');
  const normalized = auth.configuration({ ...settings, ALLOWED_GOOGLE_EMAILS: ' TEST@example.com , SECOND@example.com ' });
  assert.deepEqual(normalized.allowedEmails, ['test@example.com', 'second@example.com']);
  assert.ok(auth.authorizedSession(header({ ...googleUser, email: 'TEST@EXAMPLE.COM' }), normalized));
  assert.equal(auth.authorizedSession(header(googleUser), null), null);
  const open = auth.configuration({ ...settings, ALLOWED_GOOGLE_EMAILS: '*' });
  assert.equal(open.allowedEmails, null);
  assert.equal(auth.authorizedSession(header({ ...googleUser, email: 'anyone@gmail.com' }), open).email, 'anyone@gmail.com');
  assert.equal(auth.authorizedSession(header({ ...googleUser, email_verified: false }), open), null);
});

test('Google network/token/profile failures never create a session or echo provider details', async t => {
  const config = configured(t);
  const headers = { cookie: stateCookie(config) };
  const cases = [
    [new Response('private failure', { status: 400 })],
    [new Response('not JSON', { status: 200 })],
    [new Response(JSON.stringify({ access_token: 'token', token_type: 'wrong' }), { status: 200 })],
    [new Response(JSON.stringify({ access_token: 'token', token_type: 'Bearer' }), { status: 200 }), new Response('{}', { status: 401 })],
    [new Response(JSON.stringify({ access_token: 'token', token_type: 'Bearer' }), { status: 200 }), new Response(JSON.stringify({ ...googleUser, email_verified: false }), { status: 200 })]
  ];
  for (const responses of cases) {
    const mock = t.mock.method(globalThis, 'fetch', async () => responses.shift());
    const res = await request('callback', { headers, query: '&state=test-state&code=code' });
    assert.equal(res.headers.location, '/?auth_error=google_unavailable');
    assert.equal(typeof res.headers['set-cookie'], 'string');
    assert.match(res.headers['set-cookie'], /^kt_oauth=;.*Max-Age=0/);
    mock.mock.restore();
  }
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('private network error'); });
  assert.equal((await request('callback', { headers, query: '&state=test-state&code=code' })).headers.location, '/?auth_error=google_unavailable');
});

test('logout requires POST and exact Origin before clearing both cookies', async t => {
  configured(t);
  const get = await request('logout');
  assert.equal(get.statusCode, 405);
  assert.equal(get.headers.allow, 'POST');
  for (const origin of [undefined, 'https://attacker.example', `${settings.APP_ORIGIN}.attacker.example`]) {
    const rejected = await request('logout', { method: 'POST', headers: { origin } });
    assert.equal(rejected.statusCode, 403);
    assert.equal(rejected.headers['set-cookie'], undefined);
  }
  const res = await request('logout', { method: 'POST', headers: { origin: settings.APP_ORIGIN } });
  assert.deepEqual(JSON.parse(res.body), { ok: true });
  assert.equal(res.headers['set-cookie'].length, 2);
  for (const value of res.headers['set-cookie']) assert.match(value, /Max-Age=0; Secure$/);
});

test('API rejects unknown actions and methods, and returns no user without a valid session', async t => {
  configured(t);
  assert.equal((await request('unknown')).statusCode, 404);
  for (const action of ['session', 'login', 'callback']) assert.equal((await request(action, { method: 'POST' })).statusCode, 405);
  assert.deepEqual(JSON.parse((await request('session')).body), { configured: true, clientId: settings.GOOGLE_CLIENT_ID, email: false, user: null });
});

test('e-mail com código: envia pelo Resend, confere o código e abre a sessão', async t => {
  const config = configured(t, { ALLOWED_GOOGLE_EMAILS: '*', RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'Know Thyself <login@example.com>' });
  t.after(() => { delete process.env.RESEND_API_KEY; delete process.env.RESEND_FROM_EMAIL; });
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { sent.push({ url, body: JSON.parse(options.body), auth: options.headers.Authorization }); return { ok: true }; });
  const origin = { origin: settings.APP_ORIGIN };
  assert.equal((await request('email-start', { method: 'POST', headers: { origin: 'https://evil.example' }, body: { email: 'a@b.co' } })).statusCode, 403);
  assert.equal((await request('email-start', { method: 'POST', headers: origin, body: { email: 'not-an-email' } })).statusCode, 400);
  const start = await request('email-start', { method: 'POST', headers: origin, body: { email: ' Pessoa@Gmail.com ' } });
  assert.equal(start.statusCode, 200);
  assert.equal(sent[0].url, 'https://api.resend.com/emails');
  assert.deepEqual(sent[0].body.to, ['pessoa@gmail.com']);
  assert.equal(sent[0].auth, 'Bearer re_test');
  const code = sent[0].body.text.match(/(\d{4}) (\d{4})/).slice(1).join('');
  assert.equal(start.body.includes(code), false);
  const cookie = start.headers['set-cookie'].split(';')[0];
  const wrong = String((Number(code) + 1) % 1e8).padStart(8, '0');
  assert.deepEqual(JSON.parse((await request('email-verify', { method: 'POST', headers: { ...origin, cookie }, body: { code: wrong } })).body), { error: 'invalid_code' });
  assert.deepEqual(JSON.parse((await request('email-verify', { method: 'POST', headers: origin, body: { code } })).body), { error: 'expired' });
  const ok = await request('email-verify', { method: 'POST', headers: { ...origin, cookie }, body: { code: `${code.slice(0, 4)} ${code.slice(4)}` } });
  assert.equal(ok.statusCode, 200);
  const session = ok.headers['set-cookie'].find(value => value.startsWith(`${auth.SESSION_COOKIE}=`)).split(';')[0];
  assert.equal(auth.authorizedSession(session, config).email, 'pessoa@gmail.com');
  assert.equal(JSON.parse((await request('session', { headers: { cookie: session } })).body).email, true);
});

test('Google popup creates the session in the caller, using its exact origin and no redirect cookie', async t => {
  const config = configured(t);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(calls.length === 1 ? { access_token: 'token', token_type: 'Bearer' } : googleUser));
  });
  const res = await request('google-exchange', { method: 'POST', headers: { origin: config.origin, 'x-requested-with': 'XmlHttpRequest' }, body: { code: 'single-use-google-code' } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true });
  const exchanged = calls[0].options.body;
  assert.equal(exchanged.get('code'), 'single-use-google-code');
  assert.equal(exchanged.get('redirect_uri'), config.origin);
  assert.equal(exchanged.has('code_verifier'), false);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer token');
  const cookie = res.headers['set-cookie'];
  assert.match(cookie, /HttpOnly; SameSite=Lax; Max-Age=28800; Secure/);
  assert.equal(auth.authorizedSession(cookie.split(';')[0], config).sub, googleUser.sub);
  assert.equal(res.headers.location, undefined);
  assert.doesNotMatch(res.body, /token|single-use-google-code/);
});

test('Google popup rejects cross-site requests, missing CSRF header, invalid codes, method and configuration', async t => {
  configured(t);
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Google must not be contacted'); });
  const headers = { origin: settings.APP_ORIGIN, 'x-requested-with': 'XmlHttpRequest' };
  for (const bad of [{}, { origin: settings.APP_ORIGIN }, { ...headers, origin: 'https://evil.example' }, { ...headers, origin: 'null' }]) {
    const res = await request('google-exchange', { method: 'POST', headers: bad, body: { code: 'code' } });
    assert.equal(res.statusCode, 403);
    assert.equal(res.headers['set-cookie'], undefined);
  }
  for (const code of [undefined, null, '', ' ', 123, 'a'.repeat(2049)]) {
    assert.equal((await request('google-exchange', { method: 'POST', headers, body: { code } })).statusCode, 400);
  }
  assert.equal((await request('google-exchange', { method: 'POST', headers, body: '{broken' })).statusCode, 400);
  assert.equal((await request('google-exchange')).statusCode, 405);
  process.env.GOOGLE_CLIENT_SECRET = '';
  assert.equal((await request('google-exchange', { method: 'POST', headers, body: { code: 'code' } })).statusCode, 503);
});

test('Google popup refuses an unauthorized account, unverified email and token/network failures', async t => {
  configured(t);
  const headers = { origin: settings.APP_ORIGIN, 'x-requested-with': 'XmlHttpRequest' };
  for (const [user, expected] of [[{ ...googleUser, email: 'other@example.com' }, 403], [{ ...googleUser, email_verified: false }, 502]]) {
    let calls = 0;
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(++calls === 1 ? { access_token: 'token', token_type: 'Bearer' } : user)));
    const res = await request('google-exchange', { method: 'POST', headers, body: { code: 'code' } });
    assert.equal(res.statusCode, expected);
    assert.equal(res.headers['set-cookie'], undefined);
    mock.mock.restore();
  }
  t.mock.method(globalThis, 'fetch', () => { throw new Error('private failure'); });
  const failed = await request('google-exchange', { method: 'POST', headers, body: { code: 'code' } });
  assert.equal(failed.statusCode, 502);
  assert.equal(failed.headers['set-cookie'], undefined);
  assert.doesNotMatch(failed.body, /private failure/);
});

test('installed PWA aliases require an explicit canonical origin allowlist', () => {
  const legacy = 'https://installed.example';
  const config = auth.configuration({ ...settings, APP_ADDITIONAL_ORIGINS: legacy });
  assert.equal(auth.allowsOrigin(config, legacy), true);
  assert.equal(auth.allowsOrigin(config, settings.APP_ORIGIN), true);
  for (const origin of [undefined, 'null', 'https://evil.example', `${legacy}.evil.example`, `${legacy}/`]) {
    assert.equal(auth.allowsOrigin(config, origin), false);
  }
  for (const value of ['*', 'http://installed.example', `${legacy}/`, `${legacy}/path`, 'https://user:pass@installed.example', 123]) {
    assert.equal(auth.configuration({ ...settings, APP_ADDITIONAL_ORIGINS: value }), null);
  }
});

test('installed PWA exchanges at its own allowlisted origin and can log out there', async t => {
  const legacy = 'https://installed.example';
  const config = configured(t, { APP_ADDITIONAL_ORIGINS: legacy });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (++calls === 1) assert.equal(options.body.get('redirect_uri'), legacy);
    return new Response(JSON.stringify(calls === 1 ? { access_token: 'token', token_type: 'Bearer' } : googleUser));
  });
  const headers = { origin: legacy, 'x-requested-with': 'XmlHttpRequest' };
  const res = await request('google-exchange', { method: 'POST', headers, body: { code: 'code' } });
  assert.equal(res.statusCode, 200);
  assert.equal(auth.authorizedSession(res.headers['set-cookie'].split(';')[0], config).sub, googleUser.sub);
  assert.equal((await request('logout', { method: 'POST', headers })).statusCode, 200);
});
