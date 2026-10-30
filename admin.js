import { t, locale } from './i18n.js';

const rows = document.querySelector('#users-rows');
const region = document.querySelector('#users-table-region');
const status = document.querySelector('#users-status');
const empty = document.querySelector('#users-empty');
const error = document.querySelector('#users-error');
const errorMessage = document.querySelector('#users-error-message');
const login = document.querySelector('#users-login');
const retry = document.querySelector('#retry-users');
const refresh = document.querySelector('#refresh-users');
const more = document.querySelector('#load-more-users');
const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' });
let nextCursor = null;
let busy = false;
let retryAppend = false;

function displayDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? dateFormat.format(date) : t('Não informado');
}

function appendUsers(users) {
  const fragment = document.createDocumentFragment();
  for (const user of users) {
    const row = document.createElement('tr');
    for (const value of [user.name || t('Não informado'), user.email || t('Não informado'), displayDate(user.created_at), displayDate(user.last_login_at), user.id]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    fragment.append(row);
  }
  rows.append(fragment);
}

async function loadUsers(append = false) {
  if (busy) return;
  busy = true;
  retryAppend = append;
  refresh.disabled = more.disabled = retry.disabled = true;
  region.setAttribute('aria-busy', 'true');
  error.hidden = true;
  status.textContent = t('Carregando usuários…');
  try {
    const query = append && nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : '';
    const response = await fetch(`/api/admin-users${query}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Object.assign(new Error('Request failed'), { status: response.status });
    const data = await response.json();
    if (!Array.isArray(data.users) || !data.users.every(user => user && typeof user.id === 'string' && ['name', 'email', 'created_at', 'last_login_at'].every(key => user[key] === null || typeof user[key] === 'string')) || !(data.nextCursor === null || typeof data.nextCursor === 'string')) throw new Error('Invalid response');
    if (!append) rows.replaceChildren();
    appendUsers(data.users);
    nextCursor = data.nextCursor;
    region.hidden = !rows.children.length;
    empty.hidden = !!rows.children.length;
    more.hidden = !nextCursor;
    status.textContent = rows.children.length ? t('Registros carregados: {count}', { count: rows.children.length }) : t('Nenhum usuário cadastrado.');
  } catch (failure) {
    const denied = failure.status === 401 || failure.status === 403;
    if (denied) {
      rows.replaceChildren();
      region.hidden = empty.hidden = more.hidden = true;
      nextCursor = null;
    }
    status.textContent = '';
    error.hidden = false;
    login.hidden = failure.status !== 401;
    retry.hidden = denied;
    errorMessage.textContent = failure.status === 401 ? t('Sua sessão expirou. Entre novamente.')
      : failure.status === 403 ? t('Acesso restrito.') : t('Não foi possível carregar os usuários. Tente novamente.');
  } finally {
    busy = false;
    refresh.disabled = more.disabled = retry.disabled = false;
    region.setAttribute('aria-busy', 'false');
  }
}

refresh.addEventListener('click', () => loadUsers());
more.addEventListener('click', () => loadUsers(true));
retry.addEventListener('click', () => loadUsers(retryAppend));
loadUsers();
