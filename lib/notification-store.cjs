const { createECDH, ECDH, randomUUID } = require('node:crypto');
const profiles = require('./profile-store.cjs');
const { encrypt, decrypt, fingerprint } = require('./crypto.cjs');
const { nextDue } = require('./notification-schedule.cjs');

function keyBytes(value, size) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) throw new Error('invalid_key');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length !== size) throw new Error('invalid_key');
  return bytes;
}

function configuration(env = process.env) {
  try {
    const publicKey = keyBytes(env.VAPID_PUBLIC_KEY, 65), privateKey = keyBytes(env.VAPID_PRIVATE_KEY, 32);
    const ec = createECDH('prime256v1');
    ec.setPrivateKey(privateKey);
    if (!ec.getPublicKey().equals(publicKey)) return null;
    const subject = new URL(env.VAPID_SUBJECT);
    if (!['mailto:', 'https:'].includes(subject.protocol) || subject.username || subject.password || !subject.pathname || (subject.protocol === 'https:' && !subject.hostname) || (subject.protocol === 'mailto:' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject.pathname))) return null;
    return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT };
  } catch { return null; }
}

function validateEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 4096) throw new Error('invalid_endpoint');
  const url = new URL(endpoint);
  const hosts = ['fcm.googleapis.com', 'push.apple.com', 'push.services.mozilla.com', 'notify.windows.com'];
  const allowed = hosts.some(host => url.hostname === host || host !== 'fcm.googleapis.com' && url.hostname.endsWith(`.${host}`));
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || !allowed) throw new Error('invalid_endpoint');
  return url.href;
}

function validatePreference(value) {
  const endpoint = validateEndpoint(value?.subscription?.endpoint);
  const p256dh = keyBytes(value.subscription.keys?.p256dh, 65);
  if (p256dh[0] !== 4) throw new Error('invalid_key');
  ECDH.convertKey(p256dh, 'prime256v1');
  keyBytes(value.subscription.keys?.auth, 16);
  if (typeof value.profileId !== 'string' || !value.profileId || value.profileId.length > 128 ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) || typeof value.timeZone !== 'string' || value.timeZone.length > 64 ||
      !['pt-BR', 'en'].includes(value.language)) throw new Error('invalid_preference');
  new Intl.DateTimeFormat('en-US', { timeZone: value.timeZone });
  return {
    subscription: { endpoint, keys: { p256dh: value.subscription.keys.p256dh, auth: value.subscription.keys.auth } },
    profileId: value.profileId, time: value.time, timeZone: value.timeZone, language: value.language
  };
}

const idFor = endpoint => fingerprint(`push:${validateEndpoint(endpoint)}`);
const publicPreference = value => value ? { profileId: value.profileId, time: value.time, timeZone: value.timeZone, language: value.language } : null;

async function read(accountId, endpoint, sql = profiles.database()) {
  const [row] = await sql`SELECT data FROM kt_push_subscriptions WHERE endpoint_hash = ${idFor(endpoint)} AND account_id = ${accountId}`;
  return row ? publicPreference(JSON.parse(decrypt(row.data))) : null;
}

async function write(accountId, preference, now = new Date(), sql = profiles.database()) {
  const id = idFor(preference.subscription.endpoint);
  const data = encrypt(JSON.stringify(preference));
  const due = await nextDue(preference, now);
  // Uma inscrição pertence a uma conta. Trocar de conta exige desativar a inscrição antiga.
  const [row] = await sql`INSERT INTO kt_push_subscriptions (endpoint_hash, account_id, data, next_due_at)
    VALUES (${id}, ${accountId}, ${data}, ${due.toISOString()})
    ON CONFLICT (endpoint_hash) DO UPDATE SET data = EXCLUDED.data,
      next_due_at = EXCLUDED.next_due_at, lease_id = NULL, lease_until = NULL, updated_at = now()
    WHERE kt_push_subscriptions.account_id = EXCLUDED.account_id
    RETURNING endpoint_hash`;
  return row ? publicPreference(preference) : null;
}

async function remove(accountId, endpoint, sql = profiles.database()) {
  await sql`DELETE FROM kt_push_subscriptions WHERE endpoint_hash = ${idFor(endpoint)} AND account_id = ${accountId}`;
}

async function claim(now, sql = profiles.database()) {
  const lease = randomUUID();
  return sql`WITH due AS (
    SELECT endpoint_hash FROM kt_push_subscriptions
    WHERE next_due_at <= ${now.toISOString()} AND (lease_until IS NULL OR lease_until < ${now.toISOString()})
    ORDER BY next_due_at LIMIT 20 FOR UPDATE SKIP LOCKED
  ) UPDATE kt_push_subscriptions AS s SET lease_id = ${lease}, lease_until = ${new Date(now.getTime() + 600000).toISOString()}
    FROM due WHERE s.endpoint_hash = due.endpoint_hash
    RETURNING s.endpoint_hash, s.account_id, s.data, s.next_due_at, s.last_day, s.lease_id`;
}

// Reserva o dia antes do envio: um cron repetido nunca dispara a mesma inscrição duas vezes.
async function reserve(row, day, due, sql = profiles.database()) {
  const [saved] = await sql`UPDATE kt_push_subscriptions SET last_day = ${day}, next_due_at = ${due.toISOString()},
    lease_id = NULL, lease_until = NULL WHERE endpoint_hash = ${row.endpoint_hash} AND lease_id = ${row.lease_id}
    RETURNING endpoint_hash`;
  return Boolean(saved);
}

async function removeClaim(row, sql = profiles.database()) {
  await sql`DELETE FROM kt_push_subscriptions WHERE endpoint_hash = ${row.endpoint_hash} AND lease_id = ${row.lease_id}`;
}

async function removeExpired(row, sql = profiles.database()) {
  // Não apaga uma inscrição renovada enquanto o Push estava em andamento.
  await sql`DELETE FROM kt_push_subscriptions WHERE endpoint_hash = ${row.endpoint_hash} AND account_id = ${row.account_id} AND data = ${row.data}`;
}

module.exports = { configuration, validateEndpoint, validatePreference, publicPreference, read, write, remove, claim, reserve, removeClaim, removeExpired, accountFor: profiles.accountFor, profileState: profiles.read };
