const auth = require('../lib/google-auth.cjs');
const mail = require('../lib/email-login.cjs');

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2048) throw new Error('too_large');
  }
  return raw ? JSON.parse(raw) : {};
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const json = (status, value) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(value));
  };
  const redirect = location => {
    res.statusCode = 303;
    res.setHeader('Location', location);
    res.end();
  };
  const query = new URL(req.url, 'https://local.invalid').searchParams;
  const action = query.get('action');
  if (!['session', 'login', 'callback', 'google-exchange', 'logout', 'email-start', 'email-verify'].includes(action)) return json(404, { error: 'not_found' });
  const method = ['google-exchange', 'logout', 'email-start', 'email-verify'].includes(action) ? 'POST' : 'GET';
  if (req.method !== method) {
    res.setHeader('Allow', method);
    return json(405, { error: 'method_not_allowed' });
  }
  if (process.env.KT_ACCESS === 'vercel') {
    if (action === 'session') return json(200, { configured: true, vercel: true, user: null });
    return redirect('/universo.html');
  }
  const config = auth.configuration();
  if (!config) {
    if (action === 'session') return json(200, { configured: false, user: null });
    if (action === 'google-exchange') return json(503, { error: 'not_configured' });
    if (action === 'logout') return json(503, { error: 'not_configured' });
    return redirect('/?auth_error=not_configured');
  }
  const jar = auth.cookies(req.headers.cookie);
  if (action === 'session') {
    const user = auth.authorizedSession(req.headers.cookie, config);
    return json(200, { configured: true, clientId: config.clientId, email: Boolean(mail.emailConfiguration()), user: user ? { name: user.name, email: user.email } : null });
  }
  if (action === 'google-exchange') {
    if (!auth.allowsOrigin(config, req.headers.origin) || req.headers['x-requested-with'] !== 'XmlHttpRequest') return json(403, { error: 'invalid_origin' });
    let body;
    try { body = await readJson(req); } catch { return json(400, { error: 'invalid_request' }); }
    if (typeof body?.code !== 'string' || !body.code.trim() || body.code.length > 2048) return json(400, { error: 'invalid_response' });
    try {
      const user = await auth.googleProfile(body.code, null, config, req.headers.origin);
      if (!auth.allows(config, user.email)) return json(403, { error: 'access_denied' });
      const session = auth.seal({ user: { ...user, email_verified: true } }, config, 'session', auth.SESSION_SECONDS);
      res.setHeader('Set-Cookie', auth.cookie(auth.SESSION_COOKIE, session, config, auth.SESSION_SECONDS));
      return json(200, { ok: true });
    } catch {
      return json(502, { error: 'google_unavailable' });
    }
  }
  if (action === 'email-start' || action === 'email-verify') {
    if (!auth.allowsOrigin(config, req.headers.origin)) return json(403, { error: 'invalid_origin' });
    const emailConfig = mail.emailConfiguration();
    if (!emailConfig) return json(503, { error: 'not_configured' });
    let body;
    try { body = await readJson(req); } catch { return json(400, { error: 'invalid_request' }); }
    if (action === 'email-start') {
      const email = mail.normalEmail(body?.email);
      if (!email) return json(400, { error: 'invalid_email' });
      if (!auth.allows(config, email)) return json(403, { error: 'access_denied' });
      const code = mail.newCode();
      try { await mail.sendCode(email, code, emailConfig, body?.lang); } catch { return json(502, { error: 'email_unavailable' }); }
      res.setHeader('Set-Cookie', mail.startCookie(email, code, config));
      return json(200, { ok: true });
    }
    const result = mail.verify(req.headers.cookie, body?.code, config);
    if (result.error) return json(400, { error: result.error });
    const session = auth.seal({ user: { sub: `email:${result.email}`, email: result.email, name: result.email, email_verified: true } }, config, 'session', auth.SESSION_SECONDS);
    res.setHeader('Set-Cookie', [auth.cookie(mail.CODE_COOKIE, '', config, 0), auth.cookie(auth.SESSION_COOKIE, session, config, auth.SESSION_SECONDS)]);
    return json(200, { ok: true });
  }
  if (action === 'logout') {
    if (!auth.allowsOrigin(config, req.headers.origin)) return json(403, { error: 'invalid_origin' });
    res.setHeader('Set-Cookie', [auth.cookie(auth.SESSION_COOKIE, '', config, 0), auth.cookie(auth.STATE_COOKIE, '', config, 0)]);
    return json(200, { ok: true });
  }
  if (action === 'login') {
    const start = auth.login(config);
    res.setHeader('Set-Cookie', start.cookie);
    return redirect(start.location);
  }
  res.setHeader('Set-Cookie', auth.cookie(auth.STATE_COOKIE, '', config, 0));
  const pending = auth.open(jar[auth.STATE_COOKIE], config, 'oauth');
  if (!pending || typeof pending.state !== 'string' || !pending.state || query.get('state') !== pending.state || typeof pending.verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(pending.verifier)) return redirect('/?auth_error=invalid_state');
  if (query.has('error')) return redirect(`/?auth_error=${query.get('error') === 'access_denied' ? 'access_denied' : 'google_unavailable'}`);
  const code = query.get('code');
  if (!code || code.length > 4096) return redirect('/?auth_error=invalid_response');
  try {
    const user = await auth.googleProfile(code, pending.verifier, config);
    if (!auth.allows(config, user.email)) {
      res.setHeader('Set-Cookie', [auth.cookie(auth.STATE_COOKIE, '', config, 0), auth.cookie(auth.SESSION_COOKIE, '', config, 0)]);
      return redirect('/?auth_error=access_denied');
    }
    // shortcut: sessão sem banco expira em 8 horas; revogação individual exige armazenamento no servidor.
    const session = auth.seal({ user: { ...user, email_verified: true } }, config, 'session', auth.SESSION_SECONDS);
    res.setHeader('Set-Cookie', [auth.cookie(auth.STATE_COOKIE, '', config, 0), auth.cookie(auth.SESSION_COOKIE, session, config, auth.SESSION_SECONDS)]);
    return redirect('/universo.html');
  } catch {
    return redirect('/?auth_error=google_unavailable');
  }
};
