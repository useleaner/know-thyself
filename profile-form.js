import { readProfiles, saveProfile, deleteProfile, validateProfile, onProfilesChange, activeProfile, setActive, partnerProfile, setPartner, getSettings, connectProfiles } from './profiles.js';
import { searchPlaces, localToUtcDetailed } from './geocode.js';
import { buildMapState } from './map-data.js';
import { renderProfileHeader } from './map-readings.js';
import { readSession, isLocalPreview, initLogout } from './login.js?v=20261019-caminhos';
import { t, lang } from './i18n.js';

// Na conta a gravação vai ao servidor (promessa); no aparelho é imediata. Só segue depois de gravar.
const afterSave = (result, next, fail) => result?.then ? result.then(next, fail) : next(result);

export const normalizeBirthTime = value => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 3 ? `0${digits[0]}:${digits.slice(1)}` : digits.length <= 2 && digits ? `${digits.padStart(2, '0')}:00` : value;
};
// Ordem da data segue o idioma: dd/mm/aaaa em português, mm/dd/yyyy em inglês (como o usuário digita).
const monthFirst = lang === 'en';
const toIso = value => value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, monthFirst ? '$3-$1-$2' : '$3-$2-$1');
const toBr = value => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, monthFirst ? '$2/$3/$1' : '$3/$2/$1');

export async function initProfilePage({ root = document, storage = localStorage, pageURL = location.href, navigate = url => location.assign(url), request = fetch, confirmRemove = message => globalThis.confirm(message), lookupPlaces = searchPlaces } = {}) {
  const node = id => root.querySelector(`#${id}`);
  const form = node('birth-form'), status = node('profile-status'), list = node('profile-list');
  const remove = node('delete-profile'), cancel = node('cancel-edit'), unknown = node('time-unknown');
  const name = node('birth-name'), date = node('birth-date'), time = node('birth-time');
  const place = node('birth-place'), placeList = node('place-list'), placeState = node('place-state');
  const hubStatus = node('profile-hub-status');
  const url = new URL(pageURL);
  const comparing = url.searchParams.get('compare') === '1';
  const comparisonMode = ['synastry', 'synastry-transits'].includes(url.searchParams.get('mode')) ? url.searchParams.get('mode') : 'synastry';
  const returnToApp = comparing ? `./universo.html?mode=${comparisonMode}` : './universo.html';
  const profileURL = nextView => {
    const params = new URLSearchParams();
    if (nextView) params.set('view', nextView);
    if (comparing) { params.set('compare', '1'); params.set('mode', comparisonMode); }
    return `./perfil.html${params.size ? `?${params}` : ''}`;
  };
  const route = url.searchParams.get('view');
  const view = ['profiles', 'new', 'edit'].includes(route) ? route : 'hub';
  let editingId, chosen = null, options = [], active = -1, debounce, sequence = 0;
  const back = node('profile-back');
  // Visão e voltar saem da URL antes de esperar a sessão: a página não pinta o hub e depois troca.
  const setView = (shown, newLike) => {
    node('profile-hub').hidden = shown !== 'hub';
    node('profiles-view').hidden = shown !== 'profiles';
    node('profile-form-view').hidden = shown !== 'new' && shown !== 'edit';
    back.setAttribute('aria-label', shown === 'hub' ? t('Voltar') : newLike ? t('Voltar aos perfis') : t('Voltar ao perfil'));
    back.href = shown === 'hub' ? returnToApp : profileURL(newLike ? 'profiles' : null);
  };
  // Falha de carga aparece no hub; o status do formulário fica oculto nas outras visões.
  const fail = message => {
    setView('hub');
    node('profile-summary').hidden = true;
    hubStatus.textContent = message;
  };
  setView(view, view === 'new');

  try {
    const session = isLocalPreview(pageURL) ? null : await readSession(request);
    if (!isLocalPreview(pageURL) && !session?.vercel && (!session?.configured || !session.user)) {
      navigate(new URL('./', pageURL).pathname);
      return;
    }
    if (session?.user?.email) {
      node('profile-email').textContent = session.user.email;
      node('profile-email').hidden = false;
    }
    if (session?.user) await connectProfiles({ storage, request }).catch(() => {});
  } catch {
    fail(t('Não foi possível abrir seus perfis. Confira a conexão e recarregue a página.'));
    return;
  }
  initLogout({ root, request, navigate, pageURL });

  function syncTime() {
    if (unknown.checked) time.value = '';
    time.disabled = unknown.checked;
    time.required = !unknown.checked;
  }
  function closeList() {
    placeList.hidden = true;
    place.setAttribute('aria-expanded', 'false');
    place.removeAttribute('aria-activedescendant');
    active = -1;
  }
  function highlight(index) {
    active = index;
    placeList.querySelectorAll('li').forEach((item, i) => item.setAttribute('aria-selected', String(i === index)));
    if (index >= 0) {
      place.setAttribute('aria-activedescendant', `place-opt-${index}`);
      placeList.children[index]?.scrollIntoView?.({ block: 'nearest' });
    } else place.removeAttribute('aria-activedescendant');
  }
  function pick(index) {
    const option = options[index];
    if (!option) return;
    clearTimeout(debounce);
    sequence++;
    place.value = option.label;
    chosen = { lat: option.lat, lon: option.lon, timezone: option.timezone };
    placeState.textContent = '';
    closeList();
  }
  function showOptions(found) {
    options = found;
    placeList.replaceChildren(...found.map((option, index) => {
      const item = root.createElement('li');
      item.id = `place-opt-${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      item.textContent = option.label;
      item.addEventListener('mousedown', event => event.preventDefault());
      item.addEventListener('click', () => pick(index));
      return item;
    }));
    placeList.hidden = !found.length;
    place.setAttribute('aria-expanded', String(found.length > 0));
    placeState.textContent = found.length ? '' : t('Nenhuma cidade encontrada. Tente outra grafia.');
    active = -1;
  }
  const mask = (field, groups) => field.addEventListener('input', () => {
    const digits = field.value.replace(/\D/g, '');
    field.value = groups.reduce((out, [from, to, separator]) => digits.length > from ? `${out}${out ? separator : ''}${digits.slice(from, to)}` : out, '');
  });
  mask(date, [[0, 2, ''], [2, 4, '/'], [4, 8, '/']]);
  mask(time, [[0, 2, ''], [2, 4, ':']]);
  time.addEventListener('blur', () => { time.value = normalizeBirthTime(time.value); });
  unknown.addEventListener('change', syncTime);
  place.addEventListener('input', () => {
    chosen = null;
    clearTimeout(debounce);
    sequence++;
    closeList();
    const query = place.value.trim();
    if (query.length < 2) { placeState.textContent = ''; return; }
    debounce = setTimeout(async () => {
      const mine = ++sequence;
      placeState.textContent = t('Buscando cidades…');
      try { const found = await lookupPlaces(query); if (mine === sequence) showOptions(found); }
      catch (error) { if (mine === sequence) { closeList(); placeState.textContent = error.message; } }
    }, 350);
  });
  place.addEventListener('keydown', event => {
    const count = options.length;
    if (placeList.hidden || !count) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); highlight((active + 1) % count); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); highlight((active - 1 + count) % count); }
    else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); pick(active); }
    else if (event.key === 'Escape') { event.preventDefault(); closeList(); }
  });
  place.addEventListener('blur', () => { clearTimeout(debounce); sequence++; closeList(); if (!chosen) placeState.textContent = ''; });

  function render() {
    const people = readProfiles(storage), current = activeProfile(storage);
    const mapState = buildMapState({ ...getSettings(storage), profile: current, mode: 'natal' });
    const header = renderProfileHeader(mapState);
    node('active-profile').innerHTML = header.html;
    // Só o estado vazio é link (para o cadastro); com perfil, o bloco é texto e dispensa rótulo.
    if (current) { node('active-profile').removeAttribute('href'); node('active-profile').removeAttribute('aria-label'); }
    else { node('active-profile').setAttribute('href', profileURL('new')); node('active-profile').setAttribute('aria-label', header.label); }
    node('profile-actions').hidden = !current;
    list.replaceChildren();
    if (!people.length) {
      const empty = root.createElement('p');
      empty.textContent = t('Você ainda não cadastrou ninguém.');
      list.append(empty);
    }
    for (const profile of people) {
      const row = root.createElement('button');
      row.type = 'button';
      row.className = 'profile-row';
      row.setAttribute('aria-current', String(profile.id === current?.id));
      const heading = root.createElement('span');
      heading.className = 'profile-row-heading';
      const profileName = root.createElement('span');
      profileName.textContent = profile.name;
      heading.append(profileName);
      if (profile.id === current?.id) {
        const badge = root.createElement('span');
        badge.className = 'profile-row-badge';
        badge.textContent = t('Em uso');
        heading.append(badge);
      }
      const details = root.createElement('span');
      details.className = 'profile-row-detail';
      details.textContent = `${toBr(profile.birthDate)} · ${profile.timeUnknown ? t('Horário desconhecido') : profile.birthTime} · ${profile.place}`;
      row.append(heading, details);
      row.addEventListener('click', () => {
        const fail = () => { node('profiles-status').textContent = t('Não foi possível selecionar o perfil. Tente novamente.'); };
        try { afterSave(setActive(profile.id, storage), () => navigate(returnToApp), fail); } catch { fail(); }
      });
      list.append(row);
    }
    const comparison = node('profile-comparison');
    comparison.hidden = !comparing || people.length < 2;
    const partner = node('profile-partner');
    partner.replaceChildren();
    for (const person of [{ id: '', name: t('Escolha uma pessoa') }, ...people.filter(profile => profile.id !== current?.id)]) {
      const option = root.createElement('option');
      option.value = person.id;
      option.textContent = person.name;
      partner.append(option);
    }
    partner.value = partnerProfile(storage)?.id || '';
  }
  function edit(profile) {
    editingId = profile.id;
    name.value = profile.name;
    date.value = toBr(profile.birthDate);
    time.value = profile.birthTime || '';
    unknown.checked = profile.timeUnknown;
    place.value = profile.place;
    chosen = profile.lat === null ? null : { lat: profile.lat, lon: profile.lon, timezone: profile.timezone };
    node('form-title').textContent = t('Editar perfil');
    remove.hidden = false;
    cancel.hidden = false;
    syncTime();
  }
  node('profile-partner').addEventListener('change', () => {
    const fail = () => { hubStatus.textContent = t('Não foi possível selecionar a pessoa. Tente novamente.'); };
    try { afterSave(setPartner(node('profile-partner').value || null, storage), () => navigate(returnToApp), fail); } catch { fail(); }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    status.textContent = '';
    const input = { name: name.value, birthDate: toIso(date.value), birthTime: normalizeBirthTime(time.value), timeUnknown: unknown.checked, place: place.value, ...chosen };
    let warning = '';
    try {
      validateProfile(input);
      if (!chosen) { status.textContent = t('Selecione a cidade na lista de sugestões.'); place.focus(); return; }
      if (!input.timeUnknown) warning = localToUtcDetailed({ date: input.birthDate, time: input.birthTime, timezone: chosen.timezone }).warning || '';
    } catch (error) { status.textContent = error.message; return; }
    // Salvar já ativa o perfil, na mesma gravação.
    const done = saved => {
      editingId = saved.id;
      if (warning) { status.textContent = t('Dados salvos. {warning}', { warning }); remove.hidden = false; cancel.hidden = false; }
      else navigate(returnToApp);
    };
    const fail = error => { status.textContent = /\s/.test(error?.message || '') ? error.message : t('Não foi possível salvar. Verifique o armazenamento do navegador; os dados anteriores foram preservados.'); };
    try { afterSave(saveProfile(storage, input, editingId), done, fail); } catch (error) { fail(error); }
  });
  remove.addEventListener('click', () => {
    if (!editingId || !confirmRemove(t('Excluir este perfil deste navegador?'))) return;
    const fail = () => { status.textContent = t('Não foi possível excluir. Tente novamente.'); };
    try { afterSave(deleteProfile(storage, editingId), () => navigate(profileURL('profiles')), fail); } catch { fail(); }
  });
  try {
    render();
    const isForm = view === 'new' || view === 'edit';
    const newLike = view === 'new' || (view === 'edit' && !activeProfile(storage));
    setView(view, newLike);
    if (view === 'edit' && activeProfile(storage)) edit(activeProfile(storage));
    else syncTime();
    node('edit-active-profile').href = profileURL('edit');
    node('switch-profile').href = profileURL('profiles');
    node('new-profile').href = profileURL('new');
    cancel.href = profileURL(null);
    if (root.title !== undefined) root.title = `${isForm ? node('form-title').textContent : view === 'profiles' ? t('Dados de nascimento') : t('Perfil')} — Know Thyself`;
  } catch {
    fail(t('Não foi possível ler os perfis. Os dados não foram sobrescritos. Verifique o armazenamento do navegador.'));
    return;
  }
  onProfilesChange(() => {
    try { render(); }
    catch { fail(t('Não foi possível atualizar os perfis. Recarregue a página para tentar novamente.')); }
  });
  const viewport = root.defaultView;
  if (viewport && !viewport.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const far = root.querySelector('.nebula-far'), near = root.querySelector('.nebula-near');
    viewport.addEventListener('scroll', () => {
      if (far) far.style.transform = `translateY(${-Math.min(32, viewport.scrollY * .028)}px)`;
      if (near) near.style.transform = `translateY(${-Math.min(64, viewport.scrollY * .065)}px)`;
    }, { passive: true });
  }
}

if (typeof document !== 'undefined' && document.querySelector('#profile-hub')) initProfilePage();
