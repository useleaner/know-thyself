const { createHash, createHmac, randomBytes, timingSafeEqual } = require('node:crypto');

const SESSION_COOKIE = 'kt_session';
const STATE_COOKIE = 'kt_oauth';
const SESSION_SECONDS = 8 * 60 * 60;
const STATE_SECONDS = 10 * 60;

function configuration(env = process.env) {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, APP_ORIGIN: origin, SESSION_SECRET: secret, ALLOWED_GOOGLE_EMAILS: emailList } = env;
  if (![clientId, clientSecret, origin, secret, emailList].every(value => typeof value === 'string' && value.trim()) || !clientId.endsWith('.apps.googleusercontent.com') || secret.trim().length < 32) return null;
  // "*" libera qualquer conta Google com e-mail verificado; lista vazia continua inválida (falha fechada).
  const allowedEmails = emailList.trim() === '*' ? null : emailList.split(',').map(email => email.trim().toLowerCase());
  if (allowedEmails?.some(email => !/^[^\s@,;]+@[^\s@,;]+$/.test(email))) return null;
  if (env.APP_ADDITIONAL_ORIGINS !== undefined && typeof env.APP_ADDITIONAL_ORIGINS !== 'string') return null;
  try {
    const origins = [...new Set([origin, ...(env.APP_ADDITIONAL_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)])];
    for (const value of origins) {
      const url = new URL(value);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.origin !== value || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return null;
    }
    return { clientId, clientSecret, origin, origins, secret, allowedEmails, secure: origin.startsWith('https:'), callback: `${origin}/api/auth?action=callback` };
  } catch {
    return null;
  }
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function seal(value, config, kind, seconds, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...value, kind, audience: config.origin, client: config.clientId, exp: Math.floor(now / 1000) + seconds })).toString('base64url');
  return `${payload}.${signature(payload, config.secret)}`;
}

function open(token, config, kind, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const [payload, received] = parts;
  const expected = signature(payload, config.secret);
  if (received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return value && value.kind === kind && value.audience === config.origin && value.client === config.clientId && Number.isInteger(value.exp) && value.exp > Math.floor(now / 1000) ? value : null;
  } catch {
    return null;
  }
}

function cookie(name, value, config, seconds) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${config.secure ? '; Secure' : ''}`;
}

function cookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim().split(/=(.*)/s).slice(0, 2)).filter(([name, value]) => name && value !== undefined));
}

function login(config) {
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callback,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account'
  });
  return {
    location: `https://accounts.google.com/o/oauth2/v2/auth?${query}`,
    cookie: cookie(STATE_COOKIE, seal({ state, verifier }, config, 'oauth', STATE_SECONDS), config, STATE_SECONDS)
  };
}

function profile(value) {
  if (!value || typeof value.sub !== 'string' || !value.sub || value.sub.length > 255 || typeof value.email !== 'string' || value.email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(value.email) || value.email_verified !== true) return null;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 128) : value.email;
  return { sub: value.sub, email: value.email, name };
}

function authorizedSession(header, config, now = Date.now()) {
  if (!config) return null;
  const session = open(cookies(header)[SESSION_COOKIE], config, 'session', now);
  const user = profile(session?.user);
  return user && allows(config, user.email) ? user : null;
}

function allows(config, email) {
  return !config.allowedEmails || config.allowedEmails.includes(email.toLowerCase());
}

function allowsOrigin(config, origin) {
  return config.origins.includes(origin);
}

async function googleProfile(code, verifier, config, redirectUri = config.callback) {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, ...(verifier ? { code_verifier: verifier } : {}), client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    redirect: 'error',
    signal: AbortSignal.timeout(10000)
  });
  if (!tokenResponse.ok) throw new Error('google_unavailable');
  const token = await tokenResponse.json();
  if (typeof token.access_token !== 'string' || !token.access_token || token.token_type?.toLowerCase() !== 'bearer') throw new Error('google_unavailable');
  const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
    redirect: 'error',
    signal: AbortSignal.timeout(10000)
  });
  if (!userResponse.ok) throw new Error('google_unavailable');
  const user = profile(await userResponse.json());
  if (!user) throw new Error('google_unavailable');
  return user;
}

module.exports = { configuration, seal, open, cookie, cookies, login, profile, authorizedSession, allows, allowsOrigin, googleProfile, SESSION_COOKIE, STATE_COOKIE, SESSION_SECONDS, STATE_SECONDS };
