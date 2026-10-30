const auth = require('./lib/google-auth.cjs');
const { administrator } = require('./lib/admin-auth.cjs');

const publicPaths = new Set([
  '/', '/index.html', '/login.css', '/login.js', '/i18n.js', '/i18n-en.js', '/style.css', '/cosmos.css',
  '/natal-catalog.js', '/natal-sign-texts.js', '/natal-house-texts.js', '/natal-aspect-texts.js',
  '/natal-minor-sign-texts.js', '/natal-minor-house-texts.js',
  '/natal-angle-texts.js', '/natal-condition-texts.js', '/natal-synthesis-texts.js', '/natal-balance-texts.js',
  '/cabala-catalog.js', '/cabala-sphere-texts.js', '/cabala-path-texts.js', '/cabala-learning-texts.js', '/natal-learning-texts.js', '/aspect-context-texts.js',
  '/ajuda.html', '/ajuda.css', '/onboarding.css', '/pwa.js', '/offline.html', '/manifest.webmanifest', '/sw.js', '/notification-link.js', '/api/auth', '/api/cron-notifications', '/termos.html', '/privacidade.html',
  '/assets/nebula.webp', '/assets/nebula-near.webp',
  '/assets/space-regular.ttf', '/assets/space-medium.ttf', '/assets/bricolage-semibold.ttf',
  '/assets/google-g.png',
  '/assets/icons/icon-192.png', '/assets/icons/icon-512.png', '/assets/icons/apple-touch-icon.png', '/assets/icons/icon.svg', '/assets/og-image.jpg'
]);

module.exports = function proxy(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (path.includes('%') || /(?:^|\/)(?:\.env[^/]*|\.git|lib|tests?|__tests__)(?:\/|$)/.test(path) || /\.(?:test\.[^/]+|cjs|mjs)$/.test(path) || /^\/api\/.*\.[^/]+$/.test(path) || ['/proxy.js', '/vercel.json'].includes(path)) {
    return new Response('Not found', { status: 404, headers });
  }
  if (path === '/admin' || /^\/admin(?:\.html|\.js|\.css)$/.test(path) || path === '/api/admin-users') {
    if (administrator(request.headers.get('cookie') || '')) return;
    return new Response('Restricted access', { status: 403, headers });
  }
  if (publicPaths.has(path)) return;
  // Modo explícito por deploy (vercel deploy -e KT_ACCESS=vercel): a Vercel Authentication do projeto é a única porta.
  if (process.env.KT_ACCESS === 'vercel') return;
  const config = auth.configuration();
  if (auth.authorizedSession(request.headers.get('cookie') || '', config)) return;
  if (path.endsWith('.html') || request.headers.get('sec-fetch-dest') === 'document' || request.headers.get('accept')?.includes('text/html')) {
    return new Response(null, { status: 303, headers: { ...headers, Location: '/' } });
  }
  return new Response('Unauthorized', { status: 401, headers });
};
