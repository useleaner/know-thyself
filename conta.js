import { t } from './i18n.js';
import { initLogout } from './login.js?v=20261019-caminhos';

export function clearAccountCopies(accountId, storage, drafts) {
  const key = 'know-thyself.birth-profiles.v1';
  try {
    if (storage?.getItem(`${key}.imported`) === accountId) {
      storage.removeItem(key);
      storage.removeItem(`${key}.imported`);
    }
    storage?.removeItem(`${key}.import-declined.${accountId}`);
  } catch { /* a conta já foi excluída; armazenamento bloqueado não desfaz a exclusão */ }
  try {
    const key = 'know-thyself.profile-draft.v1';
    for (const item of [`${key}.${accountId}`, key]) {
      if (JSON.parse(drafts?.getItem(item) || 'null')?.owner === accountId) drafts.removeItem(item);
    }
  } catch { /* não remover rascunho sem dono confirmado */ }
}

export async function initAccountPage({ root = document, request = fetch, navigate = url => location.assign(url), storage = globalThis.localStorage, drafts = globalThis.sessionStorage } = {}) {
  const $ = id => root.querySelector(`#${id}`);
  const form = $('account-delete-form'), input = $('account-confirmation'), confirm = $('account-confirm'), submit = $('account-delete');
  const status = $('account-status'), retry = $('account-retry'), signin = $('account-signin');
  let account, busy = false;
  const setBusy = value => {
    busy = value;
    for (const control of [input, confirm, submit, retry]) control.disabled = value;
    form.setAttribute('aria-busy', String(value));
  };
  async function api(method, body) {
    const response = await request('/api/account', { method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
      ...(body && { headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XmlHttpRequest' }, body: JSON.stringify(body) }) });
    if (!response.ok) throw new Error(response.status === 401 ? 'login' : response.status === 400 ? 'confirmation' : 'unavailable');
    return response.json();
  }
  function fail(error) {
    signin.hidden = error.message !== 'login';
    retry.hidden = Boolean(account) || error.message === 'login';
    status.textContent = t(error.message === 'login' ? 'Sua sessão terminou. Entre novamente para acessar sua conta.' : error.message === 'confirmation' ? 'Digite o mesmo e-mail da sua conta para confirmar.' : 'Não foi possível acessar sua conta. Confira a conexão e tente novamente.');
  }
  async function load() {
    if (busy) return;
    setBusy(true); retry.hidden = true; signin.hidden = true;
    status.textContent = t('Carregando sua conta…');
    try {
      const result = await api('GET');
      if (typeof result.email !== 'string' || typeof result.accountId !== 'string') throw new Error('unavailable');
      account = result;
      $('account-email').textContent = account.email;
      form.hidden = false;
      status.textContent = '';
    } catch (error) { fail(error); }
    finally { setBusy(false); }
  }
  retry.addEventListener('click', load);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !account || !confirm.checked || (form.reportValidity && !form.reportValidity())) return;
    if (input.value.trim().toLowerCase() !== account.email.toLowerCase()) { fail(new Error('confirmation')); input.focus(); return; }
    setBusy(true); status.textContent = t('Excluindo sua conta…'); signin.hidden = true;
    try {
      const result = await api('DELETE', { confirmation: input.value });
      if (result.ok !== true || result.accountId !== account.accountId) throw new Error('unavailable');
      clearAccountCopies(account.accountId, storage, drafts);
      // As inscrições já foram excluídas no servidor; consultar PushManager pode bloquear a saída no WebKit.
      navigate('./');
    } catch (error) { fail(error); setBusy(false); }
  });
  await load();
}

if (typeof document !== 'undefined' && document.querySelector('#account-page')) { initLogout(); initAccountPage(); }
