const { logFailure } = require('../lib/operational-log.cjs');
const auth = require('../lib/google-auth.cjs');
const store = require('../lib/notification-store.cjs');
const MAX_BODY = 12 * 1024;

async function readBody(req) {
  let value = req.body;
  if (value === undefined) {
    value = '';
    for await (const chunk of req) {
      value += chunk;
      if (Buffer.byteLength(value) > MAX_BODY) throw new Error('too_large');
    }
  }
  if (Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value)) > MAX_BODY) throw new Error('too_large');
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function createHandler(repository = store) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const json = (status, value) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    };
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PUT, DELETE');
      return json(405, { error: 'method_not_allowed' });
    }
    const config = auth.configuration();
    const user = auth.authorizedSession(req.headers.cookie, config);
    if (!user) return json(401, { error: 'unauthorized' });
    if (req.method !== 'GET' && (!auth.allowsOrigin(config, req.headers.origin) || req.headers['x-requested-with'] !== 'XmlHttpRequest' || !req.headers['content-type']?.startsWith('application/json'))) return json(403, { error: 'invalid_origin' });
    const push = store.configuration();
    if (req.method === 'GET') return json(200, { configured: Boolean(push), publicKey: push?.publicKey ?? null });
    let body, preference, endpoint;
    try {
      body = await readBody(req);
      if (req.method === 'PUT') preference = store.validatePreference(body);
      else endpoint = store.validateEndpoint(body.endpoint);
    } catch { return json(400, { error: 'invalid_request' }); }
    if (req.method === 'PUT' && !push) return json(503, { error: 'notifications_unavailable' });
    try {
      const accountId = await repository.accountFor(user);
      if (req.method === 'POST') return json(200, { preference: await repository.read(accountId, endpoint) });
      if (req.method === 'DELETE') { await repository.remove(accountId, endpoint); return json(200, { disabled: true }); }
      const { state } = await repository.profileState(accountId);
      const profile = state?.profiles?.find(item => item.id === preference.profileId);
      if (!profile || !Number.isFinite(profile.lat) || !Number.isFinite(profile.lon) || !profile.timezone) return json(400, { error: 'invalid_profile' });
      const saved = await repository.write(accountId, preference);
      return saved ? json(200, { preference: saved }) : json(409, { error: 'subscription_conflict' });
    } catch (error) {
      if (error.message === 'account_inactive') return json(401, { error: 'unauthorized' });
      logFailure('notifications_unavailable');
      return json(503, { error: 'notifications_unavailable' });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
