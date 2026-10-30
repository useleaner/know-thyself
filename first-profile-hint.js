import { t } from './i18n.js';

const KEY = 'know-thyself.hint.first-profile';
let armed = false;

// Dica única para a conta sem ninguém cadastrado: aponta o nome no topo, que leva ao Perfil.
// Só aparece depois que o splash sai, senão o tempo dela correria atrás dele.
export function showFirstProfileHint(header, { storage = globalThis.localStorage, ms = 9000 } = {}) {
  const host = header?.parentElement;
  if (!host || armed) return;
  try { if (storage?.getItem(KEY)) return; } catch { return; }
  armed = true;
  const wait = setInterval(() => {
    if (document.getElementById('splash')) return;
    clearInterval(wait);
    const hint = document.createElement('p');
    hint.className = 'profile-hint';
    hint.setAttribute('role', 'status');
    hint.textContent = t('Toque aqui para criar seu perfil e ver seu mapa.');
    host.append(hint);
    header.classList.add('is-hinted');
    const done = () => {
      clearTimeout(timer);
      hint.remove();
      header.classList.remove('is-hinted');
      try { storage?.setItem(KEY, '1'); } catch { /* sem armazenamento a dica volta na próxima visita */ }
    };
    const timer = setTimeout(done, ms);
    header.addEventListener('click', done, { once: true });
    hint.addEventListener('click', () => { done(); location.assign(header.href); }, { once: true });
  }, 200);
}
