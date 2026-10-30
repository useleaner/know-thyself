import { t } from './i18n.js';
import { normalizeCabala } from './cabala-input.js';
export const PROFILE_KEY = 'know-thyself.birth-profiles.v1';
export const HOUSE_SYSTEMS = ['placidus', 'equal', 'whole'];
export const DEFAULT_ORBS = Object.freeze({ conjunction: 8, opposition: 8, trine: 7, square: 7, sextile: 5 });
export const DEFAULT_POINTS = Object.freeze({ node: true, lilith: true, chiron: true, ceres: false, pallas: false, juno: false, vesta: false });
const SETTING_CHOICES = { houseSystem: HOUSE_SYSTEMS, zodiac: ['tropical', 'sidereal'], orbMode: ['auto', 'manual'], cabalaLanguage: ['pt', 'en'] };
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validOrb = value => Number.isInteger(value) && value >= 0 && value <= 15;
function normalizeSettings(settings) {
  return {
    ...Object.fromEntries(Object.entries(SETTING_CHOICES).map(([key, choices]) => [key, choices.includes(settings?.[key]) ? settings[key] : choices[0]])),
    orbs: Object.fromEntries(Object.entries(DEFAULT_ORBS).map(([key, value]) => [key, validOrb(settings?.orbs?.[key]) ? settings.orbs[key] : value])),
    points: Object.fromEntries(Object.entries(DEFAULT_POINTS).map(([key, value]) => [key, typeof settings?.points?.[key] === 'boolean' ? settings.points[key] : value]))
  };
}
const defaultStorage = () => globalThis.localStorage;
const accounts = new WeakMap();

function validTimezone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

export function validateProfile(input, today = new Date()) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const place = typeof input?.place === 'string' ? input.place.trim() : '';
  if (!name || name.length > 120) throw new Error(t('Informe o nome, com até 120 caracteres.'));
  if (!place || place.length > 240) throw new Error(t('Informe cidade, estado e país, com até 240 caracteres.'));
  const date = input.birthDate;
  const parsed = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null;
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < '1900-01-01' || date > localToday) throw new Error(t('Informe uma data de nascimento válida, entre 1900 e hoje.'));
  if (typeof input.timeUnknown !== 'boolean') throw new Error(t('Confirme se conhece o horário de nascimento.'));
  if (!input.timeUnknown && (typeof input.birthTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.birthTime))) throw new Error(t('Informe a hora de nascimento ou marque que não sabe.'));
  // Local do nascimento: os três campos juntos, ou nenhum (perfis antigos, sem mapa calculável).
  const { lat, lon, timezone } = input;
  const none = [lat, lon, timezone].every(v => v === undefined || v === null);
  if (!none && !(Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180 && validTimezone(timezone))) throw new Error(t('Coordenadas ou fuso horário inválidos. Escolha a cidade na lista de sugestões.'));
  const cabala = normalizeCabala(input.cabala);
  return { name, birthDate: date, birthTime: input.timeUnknown ? null : input.birthTime, timeUnknown: input.timeUnknown, place, lat: none ? null : lat, lon: none ? null : lon, timezone: none ? null : timezone, ...(cabala ? { cabala } : {}) };
}

// Estado completo no mesmo blob v1; leitores antigos ignoram os campos extras.
function readState(storage) {
  const account = accounts.get(storage);
  if (account) {
    if (!account.state) throw account.error || new Error(t('Não foi possível acessar seus perfis na conta. Tente novamente.'));
    return structuredClone(account.state);
  }
  const raw = storage.getItem(PROFILE_KEY);
  return normalizeProfileState(raw === null ? { version: 1, profiles: [] } : JSON.parse(raw));
}

export function normalizeProfileState(data) {
  if (data?.version !== 1 || !Array.isArray(data.profiles)) throw new Error('invalid_profiles');
  if (data.profiles.length > 100) throw new Error('too_many_profiles');
  const ids = new Set();
  const profiles = data.profiles.map(profile => {
    if (typeof profile?.id !== 'string' || !profile.id || profile.id.length > 128 || ids.has(profile.id)) throw new Error('invalid_profile_id');
    ids.add(profile.id);
    return { id: profile.id, ...validateProfile(profile) };
  });
  return { profiles, seeded: data.seeded === true, activeId: ids.has(data.activeId) ? data.activeId : null, partnerId: ids.has(data.partnerId) ? data.partnerId : null, settings: normalizeSettings(data.settings) };
}

const listeners = new Set();
function notifyProfiles() {
  for (const cb of [...listeners]) try { cb(); } catch { /* ouvinte não derruba a escrita */ }
}
function writeState(storage, state) {
  const account = accounts.get(storage);
  if (account) {
    if (!account.state) throw account.error || new Error(t('Não foi possível acessar seus perfis na conta. Tente novamente.'));
    return persistAccount(account, state);
  }
  storage.setItem(PROFILE_KEY, JSON.stringify({ version: 1, ...state }));
  notifyProfiles();
}

async function persistAccount(account, state) {
  if (account.busy) throw new Error(t('Aguarde o salvamento terminar e tente novamente.'));
  account.busy = true;
  try {
    const { request } = account; // destacado: fetch chamado como método de objeto dá "Illegal invocation"
    const unavailable = () => new Error(t('Não foi possível salvar na sua conta. Confira a conexão e tente novamente.'));
    const response = await request('/api/profiles', {
      method: 'PUT', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XmlHttpRequest' },
      body: JSON.stringify({ accountId: account.id, revision: account.revision, state: { version: 1, ...state } }),
      signal: AbortSignal.timeout(20000)
    }).catch(() => { throw unavailable(); }); // erro técnico do navegador nunca chega à tela
    if (response.status === 401) throw Object.assign(new Error(t('Sua sessão terminou. Entre novamente para salvar seus dados.')), { code: 'session_expired' });
    if (response.status === 409) throw new Error(t('Seus dados mudaram em outra aba ou aparelho. Recarregue a página antes de salvar.'));
    if (!response.ok) throw unavailable();
    const result = await response.json().catch(() => { throw unavailable(); });
    if (result.accountId !== account.id || result.revision !== account.revision + 1) throw new Error('invalid_profiles_response');
    account.state = normalizeProfileState(result.state);
    account.revision = result.revision;
    notifyProfiles();
  } finally { account.busy = false; }
}

// Dados da conta ficam em memória; o servidor é a fonte persistente, inclusive no PWA.
export async function connectProfiles({ storage = defaultStorage(), request = fetch, confirmImport = message => globalThis.confirm(message) } = {}) {
  accounts.set(storage, { state: null });
  let result;
  try {
    const response = await request('/api/profiles', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Object.assign(new Error(response.status === 401 ? t('Sua sessão terminou. Entre novamente para acessar seus perfis.') : t('Não foi possível acessar seus perfis na conta. Tente novamente.')), { code: response.status === 401 ? 'session_expired' : 'profiles_unavailable' });
    result = await response.json();
    if (typeof result.accountId !== 'string' || !Number.isSafeInteger(result.revision) || result.revision < 0) throw new Error('invalid_profiles_response');
  } catch (error) {
    // Falha da conta nunca libera o legado sem dono como se fosse dado desta conta.
    accounts.set(storage, { state: null, error });
    throw error;
  }
  const account = { id: result.accountId, revision: result.revision, request, state: normalizeProfileState(result.state ?? { version: 1, profiles: [] }) };
  accounts.set(storage, account);
  // O legado não tinha dono: só importar para uma conta vazia, mediante confirmação.
  const marker = `${PROFILE_KEY}.imported`;
  const declined = `${PROFILE_KEY}.import-declined.${account.id}`;
  let legacy;
  try { if (!result.state && !storage.getItem(marker) && !storage.getItem(declined)) legacy = storage.getItem(PROFILE_KEY); } catch { /* banco funciona sem armazenamento local */ }
  if (legacy) {
    let previous;
    try { previous = normalizeProfileState(JSON.parse(legacy)); } catch { /* preservar legado corrompido */ }
    if (previous?.profiles.length) {
      if (await confirmImport(t('Encontramos perfis salvos neste aparelho. Importar para esta conta?'))) {
        // O legado permanece intacto para retentar; a conta fica bloqueada até confirmar a importação.
        try { await persistAccount(account, previous); } catch (error) { accounts.set(storage, { state: null, error }); throw error; }
        try { storage.setItem(marker, account.id); } catch { /* legado original permanece como cópia */ }
      } else {
        try { storage.setItem(declined, '1'); } catch { /* sem armazenamento, não é possível lembrar a recusa */ }
      }
    }
  }
  notifyProfiles();
}

export const readProfiles = storage => readState(storage).profiles;

export function saveProfile(storage, input, id = crypto.randomUUID()) {
  const state = readState(storage);
  const profile = { id, ...validateProfile(input) };
  const index = state.profiles.findIndex(item => item.id === id);
  if (index < 0) state.profiles.push(profile);
  else state.profiles[index] = profile;
  // Criar/editar e ativar são uma única gravação: não deixar metade salva.
  state.activeId = id;
  if (state.partnerId === id) state.partnerId = null;
  const saved = writeState(storage, state);
  return saved ? saved.then(() => profile) : profile;
}

export function deleteProfile(storage, id) {
  const state = readState(storage);
  state.profiles = state.profiles.filter(profile => profile.id !== id);
  state.seeded = true; // apagar tudo não ressemeia
  if (state.activeId === id) state.activeId = state.profiles[0]?.id ?? null;
  if (state.partnerId === id || state.partnerId === state.activeId) state.partnerId = null;
  return writeState(storage, state);
}

export function activeProfile(storage = defaultStorage()) {
  const s = readState(storage);
  return s.profiles.find(p => p.id === s.activeId) ?? s.profiles[0] ?? null;
}
export function partnerProfile(storage = defaultStorage()) {
  const s = readState(storage);
  const active = s.profiles.find(p => p.id === s.activeId) ?? s.profiles[0];
  return s.profiles.find(p => p.id === s.partnerId && p !== active)
    ?? (s.profiles.length === 2 ? s.profiles.find(p => p !== active) : null);
}
export function setActive(id, storage = defaultStorage()) {
  const s = readState(storage);
  if (!s.profiles.some(p => p.id === id)) throw new Error(t('Perfil não encontrado.'));
  s.activeId = id;
  if (s.partnerId === id) s.partnerId = null;
  return writeState(storage, s);
}
export function setPartner(id, storage = defaultStorage()) {
  const s = readState(storage);
  if (id !== null) {
    if (!s.profiles.some(p => p.id === id)) throw new Error(t('Perfil não encontrado.'));
    if (id === (s.activeId ?? s.profiles[0]?.id)) throw new Error(t('A pessoa do mapa ativo não pode ser também a comparada.'));
  }
  s.partnerId = id;
  return writeState(storage, s);
}

export function onProfilesChange(cb) {
  listeners.add(cb);
  const onStorage = event => { if (event.key === PROFILE_KEY || event.key === null) cb(); };
  globalThis.addEventListener?.('storage', onStorage);
  return () => { listeners.delete(cb); globalThis.removeEventListener?.('storage', onStorage); };
}

export const getSettings = (storage = defaultStorage()) => ({ ...readState(storage).settings });
export function setSettings(patch, storage = defaultStorage()) {
  if (!isRecord(patch) || Object.keys(patch).some(key => !Object.hasOwn(SETTING_CHOICES, key) && key !== 'orbs' && key !== 'points')) throw new Error(t('Ajuste inválido.'));
  for (const [key, choices] of Object.entries(SETTING_CHOICES)) {
    if (Object.hasOwn(patch, key) && !choices.includes(patch[key])) throw new Error(key === 'houseSystem' ? t('Sistema de casas inválido.') : t('Ajuste inválido.'));
  }
  for (const [key, defaults, validate] of [['orbs', DEFAULT_ORBS, validOrb], ['points', DEFAULT_POINTS, value => typeof value === 'boolean']]) {
    if (Object.hasOwn(patch, key) && (!isRecord(patch[key]) || Object.entries(patch[key]).some(([name, value]) => !Object.hasOwn(defaults, name) || !validate(value)))) throw new Error(key === 'orbs' ? t('Informe orbes inteiros entre 0° e 15°.') : t('Ponto ou asteroide inválido.'));
  }
  const state = readState(storage);
  if (Object.hasOwn(patch, 'cabalaLanguage')) {
    const profile = state.profiles.find(item => item.id === state.activeId) ?? state.profiles[0];
    if (profile?.cabala) profile.cabala = normalizeCabala({ ...profile.cabala, language: patch.cabalaLanguage }, profile.birthDate);
  }
  state.settings = { ...state.settings, ...patch, orbs: { ...state.settings.orbs, ...patch.orbs }, points: { ...state.settings.points, ...patch.points } };
  return writeState(storage, state);
}
