import { readProfiles, saveProfile, deleteProfile, validateProfile, onProfilesChange, activeProfile, setActive, partnerProfile, setPartner, connectProfiles, getSettings } from './profiles.js';
import { searchPlaces, localToUtcDetailed } from './geocode.js';
import { readSession, isLocalPreview } from './login.js?v=20261019-caminhos';
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

export async function initProfilePage({ root = document, storage = localStorage, pageURL = location.href, navigate = url => location.assign(url), request = fetch, confirmRemove = message => globalThis.confirm(message), confirmDiscard = message => globalThis.confirm(message), draftStorage = globalThis.sessionStorage, lookupPlaces = searchPlaces } = {}) {
  const node = id => root.querySelector(`#${id}`);
  const form = node('birth-form'), status = node('profile-status'), list = node('profile-list');
  const cancel = node('cancel-edit'), unknown = node('time-unknown');
  const name = node('birth-name'), date = node('birth-date'), time = node('birth-time');
  const place = node('birth-place'), placeList = node('place-list'), placeState = node('place-state');
  const hubStatus = node('profile-hub-status');
  const cabalaFields = { paternalSurname: node('cabala-paternal'), maternalSurname: node('cabala-maternal') };
  let cabalaOrder = 'paternal-first', cabalaLanguage = 'pt';
  const cabalaValues = () => ({ firstNames: name.value, ...Object.fromEntries(Object.entries(cabalaFields).map(([key, field]) => [key, field.value])), language: cabalaLanguage, order: cabalaOrder });
  const hasCabala = () => ['paternalSurname', 'maternalSurname'].some(key => cabalaFields[key].value.trim());
  const setCabala = value => {
    // Novos cadastros seguem os campos; preservar a convenção de perfis e rascunhos anteriores.
    cabalaOrder = value?.order || 'paternal-first';
    cabalaLanguage = value?.language || getSettings(storage).cabalaLanguage;
    for (const [key, field] of Object.entries(cabalaFields)) field.value = value?.[key] || '';
    syncCabala();
  };
  const url = new URL(pageURL);
  const requiresCabala = url.searchParams.get('cabala') === '1';
  const comparing = url.searchParams.get('compare') === '1';
  const allowedModes = ['natal', 'transits', 'synastry', 'synastry-transits'];
  const requestedMode = url.searchParams.get('mode');
  const returnMode = comparing ? ['synastry', 'synastry-transits'].includes(requestedMode) ? requestedMode : 'synastry'
    : allowedModes.includes(requestedMode) ? requestedMode : null;
  const returnQuery = new URLSearchParams();
  if (returnMode) returnQuery.set('mode', returnMode);
  if (requiresCabala) returnQuery.set('tree', 'personal');
  const returnToApp = `./universo.html${returnQuery.size ? `?${returnQuery}` : ''}`;
  const route = url.searchParams.get('view');
  let editingId, chosen = null, options = [], active = -1, debounce, sequence = 0, busy = false, busyFocus, owner = 'local', baseline = '';
  let originalProfile, preservedDraftName, initialName = '', nameConfirmed = false, inactiveCabalaDraft = false;
  const draftKey = () => `know-thyself.profile-draft.v1.${owner}`;
  const retry = node('profile-retry'), relogin = node('profile-relogin');
  const values = () => ({ name: name.value, date: date.value, time: time.value, unknown: unknown.checked, place: place.value, chosen, nameConfirmed, preservedDraftName, cabala: { enabled: !inactiveCabalaDraft && hasCabala(), ...cabalaValues() } });
  const dirty = () => !node('profile-form-view').hidden && JSON.stringify(values()) !== baseline;
  const clearDraft = () => { try { draftStorage?.removeItem(draftKey()); } catch { /* sair sem armazenamento continua protegido pela confirmação */ } };
  const stashDraft = () => {
    if (!dirty()) return;
    try { draftStorage?.setItem(draftKey(), JSON.stringify({ owner, editingId, values: values() })); } catch { /* confirmação continua disponível sem espaço */ }
  };
  const discard = () => {
    if (dirty() && !confirmDiscard(t('Descartar as alterações não salvas?'))) return false;
    clearDraft(); return true;
  };
  relogin.href = `./?return=profile${returnMode ? `&mode=${returnMode}` : ''}${comparing ? '&compare=1' : ''}`;
  retry.addEventListener('click', () => navigate(pageURL));
  relogin.addEventListener('click', () => { stashDraft(); baseline = JSON.stringify(values()); });
  const back = node('profile-back');
  back.href = returnToApp;
  const setBusy = value => {
    if (value && !busy) busyFocus = root.activeElement;
    busy = value;
    root.querySelectorAll('#profile-list button, #profile-form-view button, #birth-form input, #birth-form select, #new-profile, #profile-partner').forEach(control => { control.disabled = value; });
    if (!value) {
      syncTime(); syncCabala();
      if (busyFocus?.isConnected) busyFocus.focus();
      busyFocus = null;
    }
    form.setAttribute('aria-busy', String(value));
  };
  const fail = message => {
    node('profile-form-view').hidden = true;
    node('saved-profiles').hidden = true;
    node('new-profile').hidden = true;
    node('profile-comparison').hidden = true;
    hubStatus.textContent = message;
  };

  try {
    const session = isLocalPreview(pageURL) ? null : await readSession(request);
    if (!isLocalPreview(pageURL) && !session?.vercel && (!session?.configured || !session.user)) {
      navigate(new URL('./', pageURL).pathname);
      return;
    }
    if (session?.user) {
      owner = session.user.accountId || session.user.email.toLowerCase();
      await connectProfiles({ storage, request });
    }
  } catch (error) {
    fail(error.code === 'session_expired' ? error.message : t('Não foi possível abrir seus perfis. Confira a conexão e tente novamente.'));
    retry.hidden = error.code === 'session_expired';
    relogin.hidden = error.code !== 'session_expired';
    return;
  }
  root.addEventListener('click', event => {
    const target = event.target.closest?.('a, [data-auth-logout]');
    if (!target || target === relogin) return;
    if (busy || !discard()) { event.preventDefault(); event.stopImmediatePropagation(); }
    else baseline = JSON.stringify(values());
  }, true);
  root.defaultView?.addEventListener('beforeunload', event => {
    if (!dirty()) return;
    stashDraft(); event.preventDefault(); event.returnValue = '';
  });
  form.addEventListener('input', stashDraft);
  form.addEventListener('change', stashDraft);

  function remoteFailure(error, message, target = hubStatus) {
    target.textContent = error?.code === 'session_expired' ? error.message : message;
    relogin.hidden = error?.code !== 'session_expired';
    if (error?.code === 'session_expired') stashDraft();
  }
  function syncCabala() {
    for (const field of Object.values(cabalaFields)) {
      field.disabled = busy;
      field.required = requiresCabala || Boolean(originalProfile?.cabala) || hasCabala();
    }
  }
  name.addEventListener('input', () => { nameConfirmed = true; inactiveCabalaDraft = false; });
  for (const field of Object.values(cabalaFields)) {
    field.addEventListener('input', () => { inactiveCabalaDraft = false; syncCabala(); });
    field.addEventListener('change', () => { inactiveCabalaDraft = false; syncCabala(); });
  }
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
    closeList(); stashDraft();
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
        if (busy || profile.id === current?.id) return;
        const fail = error => { setBusy(false); remoteFailure(error, t('Não foi possível selecionar o perfil. Tente novamente.')); };
        setBusy(true); hubStatus.textContent = '';
        try { afterSave(setActive(profile.id, storage), () => { setBusy(false); render(); list.querySelector?.('[aria-current="true"]')?.focus(); }, fail); } catch (error) { fail(error); }
      });
      const entry = root.createElement('div');
      entry.className = 'profile-card';
      entry.setAttribute('data-active', String(profile.id === current?.id));
      const editButton = root.createElement('button');
      editButton.type = 'button';
      editButton.className = 'profile-icon profile-edit';
      editButton.setAttribute('aria-label', t('Editar perfil de {name}', { name: profile.name }));
      editButton.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>';
      editButton.addEventListener('click', () => { if (!busy) edit(profile); });
      const trash = root.createElement('button');
      trash.type = 'button';
      trash.className = 'profile-icon profile-trash';
      trash.setAttribute('aria-label', t('Excluir perfil de {name}', { name: profile.name }));
      trash.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></svg>';
      trash.addEventListener('click', () => removePerson(profile));
      entry.append(row, editButton, trash);
      list.append(entry);
    }
    const comparison = node('profile-comparison');
    comparison.hidden = !comparing || people.length < 3;
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
  function openForm() {
    clearTimeout(debounce); sequence++; closeList();
    status.textContent = ''; placeState.textContent = ''; hubStatus.textContent = '';
    node('profile-form-view').hidden = false;
    node('new-profile').hidden = true;
    baseline = JSON.stringify(values());
    node('form-title').focus();
    node('profile-form-view').scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }
  function closeForm() {
    clearTimeout(debounce); sequence++; closeList();
    node('profile-form-view').hidden = true;
    node('new-profile').hidden = false;
    clearDraft(); baseline = ''; relogin.hidden = true;
    editingId = undefined; chosen = null; status.textContent = ''; placeState.textContent = '';
    node('new-profile').focus();
  }
  function edit(profile) {
    if (!discard()) return;
    editingId = profile.id;
    originalProfile = profile; preservedDraftName = undefined; nameConfirmed = false; inactiveCabalaDraft = false;
    name.value = initialName = profile.cabala?.firstNames || profile.name;
    date.value = toBr(profile.birthDate);
    time.value = profile.birthTime || '';
    unknown.checked = profile.timeUnknown;
    place.value = profile.place;
    chosen = profile.lat === null ? null : { lat: profile.lat, lon: profile.lon, timezone: profile.timezone };
    setCabala(profile.cabala);
    node('form-title').textContent = t('Editar perfil');
    syncTime();
    openForm();
  }
  function createProfile() {
    if (busy || !discard()) return;
    editingId = undefined; chosen = null;
    originalProfile = undefined; preservedDraftName = undefined; initialName = ''; nameConfirmed = false; inactiveCabalaDraft = false;
    name.value = ''; date.value = ''; time.value = ''; place.value = ''; unknown.checked = false;
    setCabala();
    node('form-title').textContent = t('Novo perfil');
    syncTime(); openForm();
  }
  node('new-profile').addEventListener('click', createProfile);
  cancel.addEventListener('click', () => { if (!busy && discard()) closeForm(); });
  node('profile-partner').addEventListener('change', () => {
    if (busy) return;
    const fail = error => { setBusy(false); render(); remoteFailure(error, t('Não foi possível selecionar a pessoa. Tente novamente.')); };
    setBusy(true); hubStatus.textContent = '';
    try { afterSave(setPartner(node('profile-partner').value || null, storage), () => { setBusy(false); render(); }, fail); } catch (error) { fail(error); }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    status.textContent = '';
    const useCabala = requiresCabala || Boolean(originalProfile?.cabala) || hasCabala();
    if (useCabala && (inactiveCabalaDraft || (originalProfile && !originalProfile.cabala && !nameConfirmed && name.value === initialName))) {
      status.textContent = t('Confira o campo Nome: deixe apenas os nomes de nascimento, sem os sobrenomes.'); name.focus(); return;
    }
    const displayName = preservedDraftName && name.value === preservedDraftName.firstNames ? preservedDraftName.name : originalProfile?.cabala && name.value === initialName ? originalProfile.name : name.value;
    const input = { name: displayName, birthDate: toIso(date.value), birthTime: normalizeBirthTime(time.value), timeUnknown: unknown.checked, place: place.value, ...chosen, cabala: useCabala ? cabalaValues() : undefined };
    let warning = '';
    try {
      validateProfile(input);
      if (!chosen) { status.textContent = t('Selecione a cidade na lista de sugestões.'); place.focus(); return; }
      if (!input.timeUnknown) warning = localToUtcDetailed({ date: input.birthDate, time: input.birthTime, timezone: chosen.timezone }).warning || '';
    } catch (error) { status.textContent = error.message; return; }
    // Salvar já ativa o perfil, na mesma gravação.
    const done = () => {
      setBusy(false); render(); closeForm();
      if (warning) hubStatus.textContent = t('Dados salvos. {warning}', { warning });
    };
    const fail = error => {
      setBusy(false); stashDraft();
      status.textContent = /\s/.test(error?.message || '') ? error.message : t('Não foi possível salvar. Verifique o armazenamento do navegador; os dados anteriores foram preservados.');
      relogin.hidden = error?.code !== 'session_expired';
    };
    setBusy(true);
    try { afterSave(saveProfile(storage, input, editingId), done, fail); } catch (error) { fail(error); }
  });
  function removePerson(profile) {
    if (busy || !profile || !confirmRemove(t('Excluir perfil de {name}?', { name: profile.name }))) return;
    setBusy(true); hubStatus.textContent = '';
    const fail = error => { setBusy(false); remoteFailure(error, t('Não foi possível excluir. Tente novamente.')); };
    try { afterSave(deleteProfile(storage, profile.id), () => {
      setBusy(false); render();
      if (editingId === profile.id) closeForm();
      (list.querySelector?.('[aria-current="true"]') || node('new-profile')).focus();
    }, fail); } catch (error) { fail(error); }
  }
  try {
    render();
    let draft;
    try { draft = JSON.parse(draftStorage?.getItem(draftKey()) || 'null'); } catch { clearDraft(); }
    if (url.searchParams.get('cabala') === '1' && activeProfile(storage)) edit(activeProfile(storage));
    else if (route === 'edit' && activeProfile(storage)) edit(activeProfile(storage));
    else if (route === 'new' || route === 'edit' || url.searchParams.get('cabala') === '1') createProfile();
    else syncTime();
    try {
      const saved = draft?.values;
      if (draft?.owner === owner && saved && ['name', 'date', 'time', 'place'].every(key => typeof saved[key] === 'string' && saved[key].length <= 240) && typeof saved.unknown === 'boolean' && (!draft.editingId || readProfiles(storage).some(profile => profile.id === draft.editingId))) {
        if (saved.preservedDraftName !== undefined && (!saved.preservedDraftName || !['name', 'firstNames'].every(key => typeof saved.preservedDraftName[key] === 'string' && saved.preservedDraftName[key].length <= 120))) throw new Error('invalid_draft');
        if (saved.nameConfirmed !== undefined && typeof saved.nameConfirmed !== 'boolean') throw new Error('invalid_draft');
        if (saved.cabala && (typeof saved.cabala.enabled !== 'boolean' || !['firstNames', ...Object.keys(cabalaFields)].every(key => typeof saved.cabala[key] === 'string' && saved.cabala[key].length <= 120) || !['', 'pt', 'en'].includes(saved.cabala.language) || !['', 'paternal-first', 'maternal-first'].includes(saved.cabala.order))) throw new Error('invalid_draft');
        // Só a conta verificada pode recuperar seu rascunho; ele continua sem salvar.
        if (draft.editingId) edit(readProfiles(storage).find(profile => profile.id === draft.editingId));
        else createProfile();
        name.value = saved.name; date.value = saved.date; time.value = saved.time;
        unknown.checked = saved.unknown; place.value = saved.place; chosen = saved.chosen;
        if (saved.cabala) {
          setCabala(saved.cabala);
          if (saved.cabala.enabled || hasCabala() || saved.cabala.firstNames) name.value = saved.cabala.firstNames;
          inactiveCabalaDraft = !saved.cabala.enabled && hasCabala();
        }
        // O rascunho antigo pode conter um nome de exibição ainda não salvo e diferente dos nomes da Cabala.
        preservedDraftName = saved.preservedDraftName || (!Object.hasOwn(saved, 'nameConfirmed') && saved.cabala && name.value !== saved.name ? { name: saved.name, firstNames: saved.cabala.firstNames } : undefined);
        nameConfirmed = Object.hasOwn(saved, 'nameConfirmed') ? saved.nameConfirmed === true : Boolean(saved.cabala?.enabled && saved.cabala.firstNames);
        syncTime(); stashDraft(); status.textContent = t('Recuperamos seu preenchimento. Confira e salve os dados.');
      } else if (draft) clearDraft();
    } catch { clearDraft(); }
    if (root.title !== undefined) root.title = `${t('Perfil')} — Know Thyself`;
  } catch {
    fail(t('Não foi possível ler os perfis. Os dados não foram sobrescritos. Verifique o armazenamento do navegador.'));
    return;
  }
  onProfilesChange(() => {
    try { render(); if (busy) setBusy(true); }
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
