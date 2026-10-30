const { logFailure } = require('../lib/operational-log.cjs');
const auth = require('../lib/google-auth.cjs');
const { isAdmin } = require('../lib/admin-auth.cjs');
const store = require('../lib/user-store.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createHandler(repository = store) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const json = (status, value) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    };
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return json(405, { error: 'method_not_allowed' });
    }
    const user = auth.authorizedSession(req.headers.cookie, auth.configuration());
    if (!user) return json(401, { error: 'unauthorized' });
    if (!isAdmin(user)) return json(403, { error: 'forbidden' });
    const params = new URL(req.url, 'https://local.invalid').searchParams;
    const cursor = params.get('cursor');
    if (params.getAll('cursor').length > 1 || (cursor !== null && !UUID.test(cursor))) return json(400, { error: 'invalid_cursor' });
    try {
      await repository.accountFor(user);
      return json(200, await repository.list(cursor));
    } catch (error) { if (error.message !== 'account_inactive') logFailure('users_unavailable'); return json(error.message === 'account_inactive' ? 401 : 503, { error: error.message === 'account_inactive' ? 'unauthorized' : 'users_unavailable' }); }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
