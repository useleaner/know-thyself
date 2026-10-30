import { notificationLink } from './notification-link.js';

const OFFLINE_CACHE = 'know-thyself-offline-v1';
const OFFLINE_URL = new URL('./offline.html', self.location.href).href;

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(OFFLINE_CACHE);
  await cache.add(new Request(OFFLINE_URL, { cache: 'reload', credentials: 'omit' }));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('know-thyself-offline-') && key !== OFFLINE_CACHE) await caches.delete(key);
  await self.clients.claim();
})()));

// Só a tela pública de desconexão fica em cache; páginas privadas e APIs sempre usam a rede.
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(async () => (await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE })) || Response.error()));
});

self.addEventListener('push', event => {
  let payload;
  try { payload = event.data?.json(); } catch { /* todo push precisa mostrar uma notificação */ }
  const link = notificationLink(payload?.url, self.location.href);
  event.waitUntil(self.registration.showNotification(
    typeof payload?.title === 'string' ? payload.title.slice(0, 180) : 'Know Thyself', {
      body: typeof payload?.body === 'string' ? payload.body.slice(0, 300) : '',
      icon: './assets/icons/icon-192.png',
      tag: typeof payload?.tag === 'string' ? payload.tag.slice(0, 180) : 'know-thyself-daily',
      data: { url: link?.url || '/' }
    }
  ));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const link = notificationLink(event.notification.data?.url, self.location.href);
    // A entrada pública preserva o destino mesmo quando a sessão expirou.
    const url = new URL(link ? `./?notification=${encodeURIComponent(link.url)}` : './', self.location.href).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try { await client.navigate(url); return await client.focus(); } catch { /* tentar outra janela */ }
    }
    return self.clients.openWindow(url);
  })());
});
