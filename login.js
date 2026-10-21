import { t, lang } from './i18n.js';
const messages = {
  not_configured: t('Não foi possível entrar com o Google agora. Tente novamente em instantes.'),
  access_denied: t('A entrada foi cancelada ou esta conta não tem acesso. Tente novamente.'),
  invalid_state: t('O tempo para entrar terminou. Tente novamente.'),
  invalid_response: t('O Google não confirmou sua conta. Tente entrar novamente.'),
  google_unavailable: t('Não foi possível conectar ao Google. Tente novamente em instantes.')
};
const emailMessages = {
  invalid_email: t('Confira o e-mail digitado.'),
  access_denied: t('Este e-mail não tem acesso.'),
  email_unavailable: t('Não foi possível enviar o código agora. Tente novamente em instantes.'),
  invalid_code: t('Código incorreto. Confira o e-mail e digite os 8 números.'),
  expired: t('O código expirou. Peça um novo.')
};
const RESEND_WAIT = 30;

async function post(request, action, body) {
  const response = await request(`/api/auth?action=${action}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XmlHttpRequest' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'email_unavailable');
  return data;
}

export async function readSession(request = fetch) {
  const response = await request('/api/auth?action=session', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) });
  return response.ok ? response.json() : null;
}

export const isLocalPreview = pageURL => ['http://127.0.0.1:4173', 'http://localhost:4173', 'http://[::1]:4173'].includes(new URL(pageURL).origin);

function loadGoogleIdentity() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve(globalThis.google.accounts.oauth2);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => { script.remove(); reject(new Error('google_unavailable')); }, 10000);
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => { clearTimeout(timer); globalThis.google?.accounts?.oauth2 ? resolve(globalThis.google.accounts.oauth2) : reject(new Error('google_unavailable')); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('google_unavailable')); };
    document.head.append(script);
  });
}

// Tempo da abertura do splash; a saída espera ela terminar (contada desde a primeira página da sessão).
const SPLASH_INTRO = 1900;
const reducedMotion = root => root.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
export function splashIntroLeft(root = document) {
  const splash = root.querySelector('#splash');
  return !splash || reducedMotion(root) ? 0 : Math.max(0, Number(splash.dataset.start || 0) + SPLASH_INTRO - Date.now());
}
export function leaveSplash(root = document, exit = 'reveal') {
  const splash = root.querySelector('#splash');
  if (!splash || splash.dataset.leaving) return;
  splash.dataset.leaving = '1';
  const still = reducedMotion(root);
  const wait = splashIntroLeft(root);
  setTimeout(() => {
    const mark = exit === 'morph' && root.querySelector('.login-mark');
    if (mark && !still) {
      // O símbolo do login usa o mesmo viewBox 80×140; o voo leva o centro e a escala de um ao outro.
      const from = splash.querySelector('.splash-mark').getBoundingClientRect(), to = mark.getBoundingClientRect();
      const fit = box => Math.min(box.width / 80, box.height / 140);
      const stage = splash.querySelector('.splash-stage').style;
      stage.setProperty('--fx', `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
      stage.setProperty('--fy', `${to.top + to.height / 2 - (from.top + from.height / 2)}px`);
      stage.setProperty('--fs', fit(to) / fit(from));
    }
    splash.dataset.exit = mark ? 'morph' : 'reveal';
    setTimeout(() => splash.remove(), still ? 0 : 1300);
  }, wait);
}

export async function initLogin({ root = document, request = fetch, navigate = url => location.assign(url), pageURL = location.href, history = globalThis.history, loadGoogle = loadGoogleIdentity, viewport = globalThis.visualViewport } = {}) {
  if (viewport) {
    const device = root.querySelector('#login-screen').parentElement;
    const fitViewport = () => device.style.setProperty('--login-height', `${Math.round(viewport.height)}px`);
    viewport.addEventListener('resize', fitViewport);
    fitViewport();
  }
  const consent = root.querySelector('#login-consent');
  const gate = root.querySelector('#login-gate');
  const syncConsent = () => { gate.disabled = !consent.checked || consent.disabled; };
  consent.addEventListener('change', syncConsent);
  syncConsent();
  const button = root.querySelector('#google-login');
  const label = root.querySelector('#google-login-label');
  const status = root.querySelector('#login-message');
  const url = new URL(pageURL);
  const error = url.searchParams.get('auth_error');
  if (error) {
    url.searchParams.delete('auth_error');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  let configured = false;
  let googleClient;
  function googleFailure(message = messages.google_unavailable) {
    consent.disabled = false;
    syncConsent();
    button.disabled = false;
    label.textContent = t('Continuar com o Google');
    status.textContent = message;
  }
  const emailForm = root.querySelector('#email-login');
  const codeForm = root.querySelector('#code-login');
  const emailInput = root.querySelector('#login-email');
  const codeInput = root.querySelector('#login-code');
  const resend = root.querySelector('#code-resend');
  let email = '';
  let timer;
  function waitToResend() {
    let left = RESEND_WAIT;
    resend.disabled = true;
    clearInterval(timer);
    const tick = () => {
      resend.textContent = left > 0 ? t('Reenviar em {n}s', { n: left }) : t('Reenviar código');
      if (left-- <= 0) { clearInterval(timer); resend.disabled = false; }
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  async function sendCode(submit) {
    if (!consent.checked || submit.disabled) return;
    submit.disabled = true;
    status.textContent = t('Enviando o código…');
    try {
      await post(request, 'email-start', { email, lang });
      root.querySelector('#code-email').textContent = email;
      emailForm.hidden = true;
      codeForm.hidden = false;
      codeInput.value = '';
      codeInput.focus();
      status.textContent = t('Enviamos um código de 8 números. Confira também o spam.');
      root.querySelector('#email-send').disabled = false;
      waitToResend();
    } catch (failure) {
      status.textContent = emailMessages[failure.message] || emailMessages.email_unavailable;
      submit.disabled = false;
    }
  }
  emailForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!consent.checked) return;
    email = emailInput.value.trim();
    if (!emailInput.checkValidity() || !email) { status.textContent = emailMessages.invalid_email; emailInput.focus(); return; }
    sendCode(root.querySelector('#email-send'));
  });
  codeInput.addEventListener('input', () => {
    const digits = codeInput.value.replace(/\D/g, '').slice(0, 8);
    codeInput.value = digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
    if (digits.length === 8) codeForm.requestSubmit();
  });
  codeForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = root.querySelector('#code-submit');
    if (!consent.checked || submit.disabled) return;
    submit.disabled = true;
    consent.disabled = true;
    syncConsent();
    status.textContent = t('Conferindo…');
    try {
      await post(request, 'email-verify', { code: codeInput.value });
      status.textContent = t('Entrando…');
      navigate(new URL('./universo.html', pageURL).pathname);
      return;
    } catch (failure) {
      status.textContent = emailMessages[failure.message] || emailMessages.email_unavailable;
      consent.disabled = false;
      syncConsent();
      codeInput.focus();
      codeInput.select();
    }
    submit.disabled = false;
  });
  resend.addEventListener('click', () => sendCode(resend));
  root.querySelector('#code-change').addEventListener('click', () => {
    clearInterval(timer);
    codeForm.hidden = true;
    emailForm.hidden = false;
    status.textContent = '';
    emailInput.focus();
  });
  button.addEventListener('click', () => {
    if (!consent.checked) return;
    if (!configured) {
      status.textContent = messages.not_configured;
      return;
    }
    if (button.disabled) return;
    if (!googleClient) { googleFailure(); return; }
    button.disabled = true;
    consent.disabled = true;
    syncConsent();
    label.textContent = t('Abrindo o Google…');
    status.textContent = t('Escolha sua conta para continuar.');
    try { googleClient.requestCode(); } catch { googleFailure(); }
  });
  try {
    const session = isLocalPreview(pageURL) ? null : await readSession(request);
    configured = session?.configured === true;
    if (session?.vercel || (configured && session.user)) {
      navigate(new URL('./universo.html', pageURL).pathname);
      return;
    }
    leaveSplash(root, 'morph');
    if (configured && session.clientId) {
      try {
        const google = await loadGoogle();
        googleClient = google.initCodeClient({
          client_id: session.clientId, scope: 'openid email profile', ux_mode: 'popup', select_account: true,
          callback: async result => {
            if (!consent.checked) { googleFailure(t('Aceite os Termos e a Política de Privacidade para continuar.')); return; }
            if (result.error || !result.code) { googleFailure(messages.access_denied); return; }
            status.textContent = t('Entrando…');
            try {
              await post(request, 'google-exchange', { code: result.code });
              const confirmed = await readSession(request);
              if (!confirmed?.user) throw new Error('google_unavailable');
              navigate(new URL('./universo.html', pageURL).pathname);
            } catch (failure) {
              googleFailure(messages[failure.message] || messages.google_unavailable);
            }
          },
          error_callback: failure => googleFailure(failure.type === 'popup_closed' ? t('Entrada cancelada. Tente novamente quando quiser.') : t('Não foi possível abrir o Google. Permita a abertura da janela e tente novamente.'))
        });
      } catch { googleFailure(); }
    }
    if (error) status.textContent = Object.hasOwn(messages, error) ? messages[error] : messages.google_unavailable;
    else if (googleClient || !configured) status.textContent = '';
  } catch {
    leaveSplash(root, 'morph');
    status.textContent = t('Não foi possível verificar seu acesso. Confira a conexão e recarregue a página.');
  }
  button.disabled = false;
}

export function initLogout({ root = document, request = fetch, navigate = url => location.assign(url), pageURL = location.href } = {}) {
  const loginPath = new URL('./', pageURL).pathname;
  root.addEventListener('click', async event => {
    const logout = event.target.closest('[data-auth-logout]');
    if (!logout || logout.disabled) return;
    const accountStatus = root.querySelector('#account-status');
    logout.disabled = true;
    if (accountStatus) accountStatus.textContent = t('Saindo da conta…');
    try {
      const response = await request('/api/auth?action=logout', { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('logout');
      navigate(loginPath);
    } catch {
      logout.disabled = false;
      if (accountStatus) accountStatus.textContent = t('Não foi possível sair. Confira a conexão e tente novamente.');
    }
  });
}

export async function initApp({ root = document, request = fetch, navigate = url => location.assign(url), loadApp = () => import('./app.js?v=20261020-ciclos'), pageURL = location.href } = {}) {
  const content = root.querySelector('#app-content');
  const status = root.querySelector('#auth-status');
  const loginPath = new URL('./', pageURL).pathname;
  const localPreview = isLocalPreview(pageURL);
  initLogout({ root, request, navigate, pageURL });
  try {
    const session = localPreview ? null : await readSession(request);
    if (!localPreview && !session?.vercel && (!session?.configured || !session.user)) {
      navigate(loginPath);
      return;
    }
    if (session?.user) await import('./profiles.js').then(profiles => profiles.connectProfiles({ request })).catch(() => {});
    content.hidden = false;
    content.inert = false;
    // O app 3D ocupa a thread principal ao montar; esperar a abertura evita travar o desenho do splash.
    const introLeft = splashIntroLeft(root);
    if (introLeft) await new Promise(resolve => setTimeout(resolve, introLeft));
    await loadApp();
    status.hidden = true;
    // O primeiro quadro 3D compila shaders; a revelação só começa depois dele para não engasgar.
    const frame = root.defaultView?.requestAnimationFrame;
    if (frame) for (let i = 0; i < 3; i++) await new Promise(resolve => frame(resolve));
    leaveSplash(root);
    root.querySelector('#profile-button').focus({ preventScroll: true, focusVisible: false });
  } catch {
    content.hidden = true;
    content.inert = true;
    status.textContent = t('Não foi possível abrir o app. Confira a conexão e recarregue a página.');
    leaveSplash(root);
  }
}

if (typeof document !== 'undefined') {
  if (document.querySelector('#login-screen')) initLogin();
  else if (document.querySelector('#app-content')) initApp();
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
}
