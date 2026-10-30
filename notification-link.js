const PLANET = '(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto)';
const ASPECT = new RegExp(`^transit-${PLANET}~(?:conjunction|opposition|trine|square|sextile)~${PLANET}$`);
const PENDING_KEY = 'know-thyself.notification-target';

export function notificationLink(value, base) {
  try {
    const url = new URL(value, base), origin = new URL(base).origin;
    const profile = url.searchParams.get('profile'), at = url.searchParams.get('at'), aspect = url.searchParams.get('aspect');
    if (url.origin !== origin || url.pathname !== '/universo.html' || url.searchParams.get('mode') !== 'transits' || !profile || profile.length > 128 || /[\u0000-\u001f]/.test(profile) || !ASPECT.test(aspect)) return null;
    const date = new Date(at);
    if (!at || !Number.isFinite(date.getTime()) || date.toISOString() !== at) return null;
    const params = new URLSearchParams({ mode: 'transits', profile, at, aspect });
    return { profile, date, aspect, url: `/universo.html?${params}` };
  } catch { return null; }
}

export function pendingNotification(pageURL, storage = globalThis.sessionStorage) {
  try {
    const requested = notificationLink(new URL(pageURL).searchParams.get('notification'), pageURL);
    if (requested) storage?.setItem(PENDING_KEY, requested.url);
    return requested || notificationLink(storage?.getItem(PENDING_KEY), pageURL);
  } catch { return null; }
}

export function clearPendingNotification(storage = globalThis.sessionStorage) {
  try { storage?.removeItem(PENDING_KEY); } catch { /* a URL direta continua suficiente */ }
}
