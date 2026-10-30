const { logFailure } = require('../lib/operational-log.cjs');
const auth = require('../lib/google-auth.cjs');
const users = require('../lib/user-store.cjs');
const mail = require('../lib/email-login.cjs');

async function readBody(req) {
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 1024) throw new Error('too_large');
    return JSON.parse(raw);
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 1024) throw new Error('too_large');
  }
  return JSON.parse(raw);
}

function createHandler(repository = users) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const json = (status, value) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    };
    if (!['GET', 'DELETE'].includes(req.method)) { res.setHeader('Allow', 'GET, DELETE'); return json(405, { error: 'method_not_allowed' }); }
    const config = auth.configuration();
    const user = auth.authorizedSession(req.headers.cookie, config);
    if (!user) return json(401, { error: 'unauthorized' });
    if (req.method === 'DELETE') {
      if (!auth.allowsOrigin(config, req.headers.origin) || req.headers['x-requested-with'] !== 'XmlHttpRequest' || !req.headers['content-type']?.startsWith('application/json')) return json(403, { error: 'invalid_origin' });
      try {
        const body = await readBody(req);
        if (Object.keys(body).length !== 1 || typeof body.confirmation !== 'string' || body.confirmation.trim().toLowerCase() !== user.email.toLowerCase()) throw new Error('confirmation');
      } catch { return json(400, { error: 'invalid_confirmation' }); }
    }
    try {
      if (req.method === 'GET') {
        await repository.accountFor(user);
        return json(200, { email: user.email, accountId: user.accountId });
      }
      const accountId = await repository.remove(user);
      res.setHeader('Set-Cookie', [auth.SESSION_COOKIE, auth.STATE_COOKIE, mail.CODE_COOKIE].map(name => auth.cookie(name, '', config, 0)));
      return json(200, { ok: true, accountId });
    } catch (error) { if (error.message !== 'account_inactive') logFailure(req.method === 'DELETE' ? 'account_delete_unavailable' : 'accounts_unavailable'); return json(error.message === 'account_inactive' ? 401 : 503, { error: error.message === 'account_inactive' ? 'unauthorized' : 'account_unavailable' }); }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
