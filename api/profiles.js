const { logFailure } = require('../lib/operational-log.cjs');
const auth = require('../lib/google-auth.cjs');
const store = require('../lib/profile-store.cjs');
const MAX_BODY = 128 * 1024;

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
    if (!['GET', 'PUT'].includes(req.method)) { res.setHeader('Allow', 'GET, PUT'); return json(405, { error: 'method_not_allowed' }); }
    const config = auth.configuration();
    const user = auth.authorizedSession(req.headers.cookie, config);
    if (!user) return json(401, { error: 'unauthorized' });
    if (req.method === 'PUT' && (!auth.allowsOrigin(config, req.headers.origin) || req.headers['x-requested-with'] !== 'XmlHttpRequest' || !req.headers['content-type']?.startsWith('application/json'))) return json(403, { error: 'invalid_origin' });
    let body, state;
    if (req.method === 'PUT') {
      try {
        body = await readBody(req);
        if (!Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision >= 2147483647 || typeof body.accountId !== 'string') throw new Error('invalid_request');
        const { normalizeProfileState } = await import('../profiles.js');
        state = { version: 1, ...normalizeProfileState(body.state) };
      } catch { return json(400, { error: 'invalid_request' }); }
    }
    try {
      const accountId = await repository.accountFor(user);
      if (req.method === 'GET') return json(200, await repository.read(accountId));
      // O cliente não escolhe o dono. O id apenas detecta troca de conta em outra aba.
      if (body.accountId !== accountId) return json(409, { error: 'account_changed' });
      const result = await repository.write(accountId, state, body.revision);
      return result ? json(200, result) : json(409, { error: 'revision_conflict' });
    } catch (error) {
      if (error.message === 'account_inactive') return json(401, { error: 'unauthorized' });
      logFailure('profiles_unavailable');
      return json(503, { error: 'profiles_unavailable' });
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
