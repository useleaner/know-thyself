const { timingSafeEqual } = require('node:crypto');
const webPush = require('web-push');
const store = require('../lib/notification-store.cjs');
const { localDay, nextDue, endOfDay } = require('../lib/notification-schedule.cjs');
const { decrypt } = require('../lib/crypto.cjs');

function createHandler(repository = store, send = webPush.sendNotification.bind(webPush), now = () => new Date(), payload = (...args) => import('../daily-transit.js').then(module => module.dailyTransit(...args))) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const json = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(405, { error: 'method_not_allowed' }); }
    const secret = process.env.CRON_SECRET, header = req.headers.authorization;
    const expected = Buffer.from(`Bearer ${secret || ''}`), received = Buffer.from(typeof header === 'string' ? header : '');
    if (typeof secret !== 'string' || secret.length < 32 || received.length !== expected.length || !timingSafeEqual(received, expected)) return json(401, { error: 'unauthorized' });
    const config = store.configuration();
    if (!config) return json(503, { error: 'notifications_unavailable' });
    const date = now();
    let rows;
    try { rows = await repository.claim(date); }
    catch { return json(503, { error: 'notifications_unavailable' }); }
    const results = await Promise.all(rows.map(async row => {
      try {
        const preference = store.validatePreference(JSON.parse(decrypt(row.data)));
        const scheduled = new Date(row.next_due_at), day = localDay(date, preference.timeZone);
        const lastDay = row.last_day instanceof Date ? row.last_day.toISOString().slice(0, 10) : row.last_day;
        const stale = localDay(scheduled, preference.timeZone) !== day;
        const next = await nextDue(preference, date, stale ? lastDay : day);
        const { state } = await repository.profileState(row.account_id);
        const profile = state?.profiles?.find(item => item.id === preference.profileId);
        if (!profile) { await repository.removeClaim(row); return 'removed'; }
        if (stale || lastDay === day) {
          await repository.reserve(row, stale ? lastDay : day, next);
          return 'skipped';
        }
        const message = await payload(profile, state.settings, scheduled, preference.language);
        // No máximo uma tentativa/dia; crash após reservar pode perder o envio, rever com idempotência do provedor.
        if (!await repository.reserve(row, day, next)) return 'skipped';
        if (!message) return 'skipped';
        const ttl = Math.max(0, Math.min(86400, Math.floor(((await endOfDay(date, preference.timeZone)) - date) / 1000)));
        if (!ttl) return 'skipped';
        try {
          await send(preference.subscription, JSON.stringify(message), { TTL: ttl, timeout: 10000, urgency: 'normal', vapidDetails: config });
          return 'sent';
        } catch (error) {
          if ([404, 410].includes(error.statusCode)) { await repository.removeExpired(row); return 'removed'; }
          return 'failed';
        }
      } catch { return 'failed'; }
    }));
    return json(200, Object.fromEntries(['sent', 'skipped', 'removed', 'failed'].map(status => [status, results.filter(value => value === status).length])));
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
