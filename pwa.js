import { t } from './i18n.js';

export async function registerPWA(worker = globalThis.navigator?.serviceWorker) {
  if (!worker) return false;
  try {
    await worker.register('./sw.js', { type: 'module' });
    return true;
  } catch { return false; }
}

export function initInstallOnboarding({ root = document, storage, navigator = globalThis.navigator, matchMedia = globalThis.matchMedia?.bind(globalThis) } = {}) {
  const surface = root.querySelector('#login-screen') ? 'login' : root.querySelector('#app-content') ? 'app' : null;
  if (!surface || root.querySelector('#install-onboarding') || navigator?.standalone || matchMedia?.('(display-mode: standalone)')?.matches) return null;
  const key = 'know-thyself.install-onboarding.v1';
  try { storage ??= globalThis.localStorage; if (storage?.getItem(key) === 'dismissed') return null; } catch { /* a orientação continua disponível sem armazenamento */ }
  const ios = /iPhone|iPad|iPod/.test(navigator?.userAgent || '') || (navigator?.platform === 'MacIntel' && navigator?.maxTouchPoints > 1);
  const android = /Android/.test(navigator?.userAgent || '');
  const panel = root.createElement('aside');
  panel.id = 'install-onboarding'; panel.className = 'pwa-onboarding'; panel.dataset.surface = surface;
  panel.setAttribute('aria-labelledby', 'install-onboarding-title');
  const title = root.createElement('h2'); title.id = 'install-onboarding-title'; title.textContent = t('Instalar no celular');
  const instructions = [];
  if (ios || !android) instructions.push('No iPhone ou iPad, abra no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início. Depois, toque em Adicionar.');
  if (android || !ios) instructions.push('No Android, abra no Chrome, toque no menu e escolha Instalar app ou Adicionar à tela inicial.');
  panel.append(title);
  for (const instruction of instructions) {
    const paragraph = root.createElement('p'); paragraph.textContent = t(instruction); panel.append(paragraph);
  }
  const actions = root.createElement('div'); actions.className = 'pwa-onboarding-actions';
  const help = root.createElement('a'); help.href = './ajuda.html#install-help'; help.textContent = t('Ajuda e instalação');
  const dismiss = root.createElement('button'); dismiss.type = 'button'; dismiss.textContent = t('Agora não');
  dismiss.addEventListener('click', () => {
    try { storage?.setItem(key, 'dismissed'); } catch { /* fechar funciona mesmo sem armazenamento */ }
    panel.remove();
  });
  actions.append(help, dismiss); panel.append(actions);
  if (!root.querySelector('#pwa-onboarding-style')) {
    const stylesheet = root.createElement('link'); stylesheet.id = 'pwa-onboarding-style'; stylesheet.rel = 'stylesheet'; stylesheet.href = './onboarding.css'; root.head.append(stylesheet);
  }
  if (surface === 'login') root.querySelector('#login-screen').prepend(panel);
  else root.body.append(panel);
  return panel;
}

if (typeof document !== 'undefined') { void registerPWA(); initInstallOnboarding(); }
