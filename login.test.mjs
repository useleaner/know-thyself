import test from 'node:test';
import assert from 'node:assert/strict';
import { initLogin, initApp, initLogout } from './login.js';

function fixture({ session = { configured: false, user: null }, responseOK = true, failRequest = false, failLoad = false, authError = '', privatePage = false, consent = true } = {}) {
  const nodes = Object.fromEntries(['login-consent', 'login-gate', 'login-screen', 'app-content', 'google-login', 'google-login-label', 'login-message', 'profile-button', 'account-status', 'auth-status', 'email-divider', 'email-login', 'code-login', 'login-email', 'login-code', 'code-resend', 'code-change', 'code-email', 'email-send', 'code-submit'].map(id => [id, {
    checked: consent, value: '', checkValidity() { return this.value.includes('@'); },
    hidden: ['app-content', 'email-divider', 'email-login', 'code-login'].includes(id), inert: id === 'app-content', disabled: id === 'google-login', textContent: '', listeners: {},
    addEventListener(type, handler) { this.listeners[type] = handler; },
    focus(options) { this.focused = options; this.focusedWhileDisabled = nodes['login-gate'].disabled; }, select() {}
  }]));
  const requests = [], navigations = [], histories = [];
  const root = { listeners: {}, querySelector: selector => nodes[selector.slice(1)], addEventListener(type, fn) { this.listeners[type] = fn; } };
  let loaded = 0, googleOptions, popupRequests = 0;
  const options = {
    root, pageURL: `https://know.example/previews/antes/${privatePage ? 'universo.html' : ''}${authError ? `?auth_error=${authError}` : ''}`,
    request: async (url, opts) => { requests.push([url, opts]); if (failRequest) throw Error('network'); return { ok: responseOK, json: async () => session?.configured ? { clientId: '123-test.apps.googleusercontent.com', ...session } : session }; },
    loadGoogle: async () => ({ initCodeClient(options) { googleOptions = options; return { requestCode() { popupRequests++; } }; } }),
    navigate: url => navigations.push(url), history: { replaceState: (...args) => histories.push(args) },
    loadApp: async () => { loaded++; if (failLoad) throw Error('module'); return {}; }
  };
  return { options, root, nodes, requests, navigations, histories, setSession(value) { session = value; }, get googleOptions() { return googleOptions; }, get popupRequests() { return popupRequests; }, get loaded() { return loaded; },
    click() { nodes['google-login'].listeners.click(); },
    logout() { const button = { closest: () => button }; return { button, done: root.listeners.click({ target: button }) }; }
  };
}

test('sem configuração, mantém o app oculto e permite tentar novamente', async () => {
  const f = fixture();
  await initLogin(f.options);
  assert.equal(f.loaded, 0);
  assert.equal(f.nodes['app-content'].hidden, true);
  assert.equal(f.nodes['app-content'].inert, true);
  assert.equal(f.nodes['google-login'].disabled, false);
  f.click();
  assert.match(f.nodes['login-message'].textContent, /Tente novamente/);
  assert.deepEqual(f.navigations, []);
});

test('entrada Google abre a janela sem navegar o app e bloqueia clique repetido', async () => {
  const f = fixture({ session: { configured: true, user: null } });
  await initLogin(f.options);
  f.click();
  assert.equal(f.nodes['google-login'].disabled, true);
  assert.deepEqual(f.navigations, []);
  f.click();
  assert.equal(f.popupRequests, 1);
  assert.equal(f.nodes['login-consent'].disabled, true);
  assert.equal(f.nodes['login-gate'].disabled, true);
  assert.equal(f.googleOptions.ux_mode, 'popup');
  assert.equal(f.googleOptions.scope, 'openid email profile');
  assert.equal(f.requests[0][1].credentials, 'same-origin');
  assert.equal(f.requests[0][1].cache, 'no-store');
});

test('entrada autenticada navega ao documento privado sem carregar o app no login público', async () => {
  const f = fixture({ session: { configured: true, user: { name: 'Maria', email: 'maria@example.com' } } });
  await initLogin(f.options);
  assert.equal(f.loaded, 0);
  assert.deepEqual(f.navigations, ['/previews/antes/universo.html']);
});

test('modo só-Vercel: entrada redireciona e o documento privado abre sem conta Google', async () => {
  const session = { configured: true, vercel: true, user: null };
  const login = fixture({ session });
  await initLogin(login.options);
  assert.deepEqual(login.navigations, ['/previews/antes/universo.html']);
  const app = fixture({ session, privatePage: true });
  await initApp(app.options);
  assert.equal(app.loaded, 1);
});

test('documento privado só abre app com sessão confirmada, foca perfil', async () => {
  const user = { name: 'Maria', email: 'maria@example.com' };
  const f = fixture({ session: { configured: true, user }, privatePage: true });
  await initApp(f.options);
  assert.equal(f.loaded, 1);
  assert.equal(f.nodes['app-content'].hidden, false);
  assert.equal(f.nodes['app-content'].inert, false);
  assert.equal(f.nodes['auth-status'].hidden, true);
  assert.deepEqual(f.nodes['profile-button'].focused, { preventScroll: true, focusVisible: false });
});

test('erro de callback tem texto local e some da URL sem injetar conteúdo', async () => {
  const f = fixture({ authError: 'access_denied' });
  await initLogin(f.options);
  assert.match(f.nodes['login-message'].textContent, /entrada foi cancelada/);
  assert.equal(f.histories[0][2], '/previews/antes/');
  const unknown = fixture({ authError: '%3Cscript%3E' });
  await initLogin(unknown.options);
  assert.match(unknown.nodes['login-message'].textContent, /Não foi possível conectar/);
});

test('falhas de rede ou endpoint estático nunca liberam o app', async () => {
  for (const options of [{ failRequest: true }, { responseOK: false }]) {
    const f = fixture(options);
    await initLogin(f.options);
    assert.equal(f.loaded, 0);
    assert.equal(f.nodes['app-content'].hidden, true);
    assert.equal(f.nodes['google-login'].disabled, false);
  }
});

test('documento privado sem sessão retorna à entrada e nunca inicia o app', async () => {
  const f = fixture({ privatePage: true });
  await initApp(f.options);
  assert.equal(f.loaded, 0);
  assert.equal(f.nodes['app-content'].hidden, true);
  assert.deepEqual(f.navigations, ['/previews/antes/']);
});

test('falha ao carregar o app mantém conteúdo privado oculto e orienta recarregar', async () => {
  const f = fixture({ session: { configured: true, user: { name: 'Ana', email: 'ana@example.com' } }, privatePage: true, failLoad: true });
  await initApp(f.options);
  assert.equal(f.nodes['app-content'].hidden, true);
  assert.equal(f.nodes['app-content'].inert, true);
  assert.match(f.nodes['auth-status'].textContent, /recarregue/);
});

test('sair exige POST e recarrega a rota somente após o servidor confirmar', async () => {
  const f = fixture({ session: { configured: true, user: { name: 'Ana', email: 'ana@example.com' } }, privatePage: true });
  await initApp(f.options);
  const { button, done } = f.logout();
  assert.equal(button.disabled, true);
  await done;
  assert.equal(f.requests.at(-1)[0], '/api/auth?action=logout');
  assert.equal(f.requests.at(-1)[1].method, 'POST');
  assert.deepEqual(f.navigations, ['/previews/antes/']);
});

test('erro ao sair permite repetir e mantém a mensagem junto do controle', async () => {
  const f = fixture({ failRequest: true, privatePage: true });
  await initApp(f.options);
  const { button, done } = f.logout();
  await done;
  assert.equal(button.disabled, false);
  assert.deepEqual(f.navigations, []);
  assert.match(f.nodes['account-status'].textContent, /Não foi possível sair/);
});

test('prévia local mostra Entrar; documento privado mantém bypass sem inventar conta', async () => {
  for (const origin of ['http://127.0.0.1:4173', 'http://localhost:4173', 'http://[::1]:4173']) {
    const entry = fixture({ failRequest: true });
    entry.options.pageURL = `${origin}/previews/antes/`;
    await initLogin(entry.options);
    assert.deepEqual(entry.navigations, []);
    assert.equal(entry.nodes['login-gate'].disabled, false);
    assert.deepEqual(entry.requests, []);
    const app = fixture({ failRequest: true, privatePage: true });
    app.options.pageURL = `${origin}/universo.html`;
    await initApp(app.options);
    assert.equal(app.loaded, 1);
      assert.equal(app.nodes['app-content'].hidden, false);
    assert.equal(app.nodes['app-content'].inert, false);
    assert.deepEqual(app.requests, []);
    assert.deepEqual(app.navigations, []);
  }
});

test('outros endereços e portas continuam exigindo sessão', async () => {
  for (const origin of ['https://know-thyself-useleaner.vercel.app', 'http://localhost:3000', 'http://127.0.0.1:4174', 'http://localhost.example:4173', 'http://192.168.1.2:4173']) {
    const f = fixture({ privatePage: true });
    f.options.pageURL = `${origin}/universo.html`;
    await initApp(f.options);
    assert.equal(f.loaded, 0);
    assert.equal(f.requests.length, 1);
    assert.deepEqual(f.navigations, ['/']);
  }
});

test('Google popup exchanges code and confirms the cookie in the PWA before opening the app', async () => {
  const f = fixture({ session: { configured: true, user: null } });
  await initLogin(f.options);
  f.click();
  assert.deepEqual(f.navigations, []);
  f.setSession({ configured: true, user: { name: 'Maria', email: 'maria@example.com' } });
  await f.googleOptions.callback({ code: 'google-code' });
  assert.equal(f.requests[1][0], '/api/auth?action=google-exchange');
  assert.equal(f.requests[1][1].method, 'POST');
  assert.equal(f.requests[1][1].credentials, 'same-origin');
  assert.equal(f.requests[1][1].headers['X-Requested-With'], 'XmlHttpRequest');
  assert.deepEqual(JSON.parse(f.requests[1][1].body), { code: 'google-code' });
  assert.equal(f.requests[2][0], '/api/auth?action=session');
  assert.deepEqual(f.navigations, ['/previews/antes/universo.html']);
});

test('closing or blocking the Google popup permits retry without leaving or reopening it automatically', async () => {
  const f = fixture({ session: { configured: true, user: null } });
  await initLogin(f.options);
  for (const type of ['popup_closed', 'popup_failed_to_open']) {
    f.click();
    f.googleOptions.error_callback({ type });
    assert.equal(f.nodes['google-login'].disabled, false);
    assert.equal(f.nodes['google-login-label'].textContent, 'Continuar com o Google');
    assert.deepEqual(f.navigations, []);
  }
  assert.equal(f.popupRequests, 2);
});

test('no cookie confirmation, rejected consent, or failed Google SDK never returns to the login loop', async () => {
  const f = fixture({ session: { configured: true, user: null } });
  await initLogin(f.options);
  f.click();
  await f.googleOptions.callback({ code: 'google-code' });
  assert.deepEqual(f.navigations, []);
  assert.equal(f.nodes['google-login'].disabled, false);
  await f.googleOptions.callback({ error: 'access_denied' });
  assert.match(f.nodes['login-message'].textContent, /cancelada/);
  const offline = fixture({ session: { configured: true, user: null } });
  await initLogin({ ...offline.options, loadGoogle: async () => { throw Error('offline'); } });
  offline.click();
  assert.deepEqual(offline.navigations, []);
  assert.equal(offline.popupRequests, 0);
  assert.match(offline.nodes['login-message'].textContent, /Não foi possível conectar/);
});


test('aceite inicia bloqueado, libera e volta a bloquear todos os controles', async () => {
  const f = fixture({ consent: false, session: { configured: true, user: null } });
  await initLogin(f.options);
  assert.equal(f.nodes['login-gate'].disabled, true);
  f.click();
  assert.equal(f.popupRequests, 0);
  f.nodes['login-email'].value = 'teste@example.com';
  f.nodes['email-login'].listeners.submit({ preventDefault() {} });
  await f.nodes['code-login'].listeners.submit({ preventDefault() {} });
  f.nodes['code-resend'].listeners.click();
  assert.equal(f.requests.length, 1);
  f.nodes['login-consent'].checked = true;
  f.nodes['login-consent'].listeners.change();
  assert.equal(f.nodes['login-gate'].disabled, false);
  f.click();
  assert.equal(f.popupRequests, 1);
  assert.equal(f.nodes['login-consent'].disabled, true);
  assert.equal(f.nodes['login-gate'].disabled, true);
  f.nodes['login-consent'].checked = false;
  f.nodes['login-consent'].listeners.change();
  f.googleOptions.error_callback({ type: 'popup_closed' });
  assert.equal(f.nodes['login-gate'].disabled, true);
  f.click();
  assert.equal(f.popupRequests, 1);
});

test('aceite não substitui validação do e-mail e impede envio duplicado', async () => {
  const f = fixture({ responseOK: false });
  await initLogin(f.options);
  f.nodes['email-login'].listeners.submit({ preventDefault() {} });
  assert.match(f.nodes['login-message'].textContent, /Confira o e-mail/);
  assert.equal(f.requests.length, 1);
  f.nodes['login-email'].value = 'teste@example.com';
  f.nodes['email-login'].listeners.submit({ preventDefault() {} });
  f.nodes['email-login'].listeners.submit({ preventDefault() {} });
  assert.equal(f.requests.filter(([url]) => url.endsWith('email-start')).length, 1);

});


test('callback Google sem aceite não troca o código nem cria sessão', async () => {
  const f = fixture({ session: { configured: true, user: null } });
  await initLogin(f.options);
  f.nodes['login-consent'].checked = false;
  await f.googleOptions.callback({ code: 'google-code' });
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.navigations, []);
  assert.equal(f.nodes['login-gate'].disabled, true);
});

test('verificação bloqueia o aceite em andamento e restaura após erro', async () => {
  const f = fixture({ responseOK: false });
  await initLogin(f.options);
  const done = f.nodes['code-login'].listeners.submit({ preventDefault() {} });
  assert.equal(f.nodes['login-consent'].disabled, true);
  assert.equal(f.nodes['login-gate'].disabled, true);
  await done;
  assert.equal(f.nodes['login-consent'].disabled, false);
  assert.equal(f.nodes['login-gate'].disabled, false);
  assert.equal(f.nodes['login-code'].focusedWhileDisabled, false);
  assert.deepEqual(f.navigations, []);
});


test('entrada acompanha a altura visível sem mudar layout ao trocar foco', async () => {
  const f = fixture();
  const values = {};
  f.nodes['login-screen'].parentElement = { style: { setProperty(name, value) { values[name] = value; } } };
  let resize;
  const viewport = { height: 812, addEventListener(type, handler) { assert.equal(type, 'resize'); resize = handler; } };
  await initLogin({ ...f.options, viewport });
  assert.equal(values['--login-height'], '812px');
  viewport.height = 374.4;
  resize();
  assert.equal(values['--login-height'], '374px');
});


test('logout compartilhado bloqueia clique repetido e tolera ausência da mensagem', async () => {
  const f = fixture();
  delete f.nodes['account-status'];
  initLogout(f.options);
  const button = { disabled: false, closest() { return this; } };
  const first = f.root.listeners.click({ target: button });
  await f.root.listeners.click({ target: button });
  await first;
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0][1].method, 'POST');
  assert.deepEqual(f.navigations, ['/previews/antes/']);
});
