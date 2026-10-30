import { readProfiles, activeProfile, onProfilesChange } from './profiles.js';
import { t, lang } from './i18n.js';

export async function initNotifications({ root = document, session, accountReady, request = fetch } = {}) {
  const $ = selector => root.querySelector(selector);
  const form = $('#notification-form'), enabled = $('#notification-enabled'), person = $('#notification-profile');
  const time = $('#notification-time'), save = $('#notification-save'), status = $('#notification-status'), value = $('#notification-value');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let registration, subscription, publicKey, preference = null, busy = false;
  const message = text => { status.textContent = text; };
  function render() {
    enabled.checked = Boolean(preference);
    enabled.disabled = busy || !registration || (!publicKey && !preference);
    save.hidden = !preference || !publicKey;
    save.disabled = busy;
    person.disabled = time.disabled = busy || !registration || !publicKey;
    form.setAttribute('aria-busy', String(busy));
    value.textContent = preference ? preference.time : t('Desativada');
  }
  function unavailable(text) {
    form.hidden = true;
    value.textContent = t('Indisponível');
    message(text);
  }
  async function api(method, body) {
    const response = await request('/api/notifications', {
      method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: body ? { 'Content-Type': 'application/json', 'X-Requested-With': 'XmlHttpRequest' } : {},
      ...(body && { body: JSON.stringify(body) })
    });
    if (!response.ok) throw new Error(response.status === 401 ? 'login' : 'unavailable');
    return response.json();
  }
  function people() {
    const selected = person.value || activeProfile()?.id;
    person.replaceChildren(...readProfiles(globalThis.localStorage).map(profile => {
      const option = document.createElement('option');
      option.value = profile.id; option.textContent = profile.name;
      return option;
    }));
    if ([...person.options].some(option => option.value === selected)) person.value = selected;
  }
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches) return unavailable(t('No iPhone, adicione o app à Tela de Início e abra por lá para receber notificações.'));
  if (!('serviceWorker' in navigator) || !('PushManager' in globalThis) || !('Notification' in globalThis)) return unavailable(t('Este navegador não recebe notificações. Abra o app em um navegador compatível.'));
  if (!session?.user) return unavailable(t('Entre na sua conta para receber a leitura diária.'));
  if (!accountReady) return unavailable(t('Não foi possível acessar seus perfis na conta. Recarregue a página para tentar novamente.'));
  try {
    people();
    if (!person.options.length) return unavailable(t('Cadastre uma pessoa para receber a leitura diária.'));
    const config = await api('GET');
    if (config.configured && config.publicKey) publicKey = Uint8Array.from(atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    await navigator.serviceWorker.register('./sw.js', { type: 'module' });
    registration = await navigator.serviceWorker.ready;
    subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const result = await api('POST', { endpoint: subscription.endpoint });
      preference = result.preference;
    }
    if (!publicKey && !preference) return unavailable(t('As notificações estão indisponíveis. Tente novamente mais tarde.'));
    if (!publicKey) message(t('As notificações estão indisponíveis. Tente novamente mais tarde.'));
    if (preference) { person.value = preference.profileId; time.value = preference.time; }
    const zone = preference?.timeZone || timezone;
    const zoneName = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'pt-BR', { timeZone: zone, timeZoneName: 'long' }).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value || zone;
    $('#notification-zone').textContent = t('Horário: {zone}', { zone: zoneName });
    if (Notification.permission === 'denied') message(t('As notificações estão bloqueadas. Permita-as nos ajustes do aparelho e reabra o app.'));
    render();
    onProfilesChange(people);
  } catch { return unavailable(t('Não foi possível carregar as notificações. Confira a conexão e recarregue a página.')); }

  async function persist() {
    const result = await api('PUT', { subscription: subscription.toJSON(), profileId: person.value, time: time.value, timeZone: preference?.timeZone || timezone, language: lang });
    preference = result.preference;
  }
  function failure(error) {
    message(t(error.message === 'login' ? 'Sua sessão terminou. Entre novamente para ajustar as notificações.' : 'Não foi possível salvar as notificações. Confira a conexão e tente novamente.'));
  }
  enabled.addEventListener('change', async () => {
    if (busy) return;
    const turnOn = enabled.checked;
    if (turnOn && !form.reportValidity()) { render(); return; }
    busy = true;
    render();
    message('');
    try {
      if (turnOn) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { message(t('As notificações não foram permitidas. Você pode ativá-las nos ajustes do aparelho.')); return; }
        if (subscription && !preference) await subscription.unsubscribe();
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
        await persist();
        message(t('Leitura diária ativada.'));
      } else {
        await api('DELETE', { endpoint: subscription.endpoint });
        preference = null;
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
        message(t('Leitura diária desativada.'));
      }
    } catch (error) { failure(error); }
    finally { busy = false; render(); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !preference || !form.reportValidity()) return;
    busy = true; render(); message(t('Salvando…'));
    try { await persist(); message(t('Horário da leitura atualizado.')); }
    catch (error) { failure(error); }
    finally { busy = false; render(); }
  });
}
