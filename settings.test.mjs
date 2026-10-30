import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_KEY, DEFAULT_ORBS, DEFAULT_POINTS, getSettings, setSettings, saveProfile, deleteProfile, setActive, setPartner, onProfilesChange, readProfiles, activeProfile, connectProfiles } from './profiles.js';

const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const person = { name: 'Pessoa teste', birthDate: '2000-01-01', birthTime: null, timeUnknown: true, place: 'Lisboa' };
const full = { cabalaLanguage: 'pt', houseSystem: 'equal', zodiac: 'sidereal', orbMode: 'manual', orbs: { conjunction: 0, opposition: 15, trine: 6, square: 5, sextile: 4 }, points: { node: false, lilith: false, chiron: false, ceres: true, pallas: true, juno: true, vesta: true } };

test('preferências: roundtrip completo e patches parciais preservam os outros valores', () => {
  const db = storage();
  setSettings(full, db);
  assert.deepEqual(getSettings(db), full);
  setSettings({ points: { node: true }, orbs: { opposition: 9 } }, db);
  assert.deepEqual(getSettings(db), { ...full, points: { ...full.points, node: true }, orbs: { ...full.orbs, opposition: 9 } });
  const copy = getSettings(db);
  copy.points.ceres = false; copy.orbs.conjunction = 12;
  assert.equal(getSettings(db).points.ceres, true);
  assert.equal(getSettings(db).orbs.conjunction, 0);
});

test('preferências: dados antigos e campos inválidos usam defaults por campo', () => {
  const db = storage();
  db.setItem(PROFILE_KEY, JSON.stringify({ version: 1, profiles: [], settings: { houseSystem: 'whole' } }));
  assert.deepEqual(getSettings(db), { houseSystem: 'whole', zodiac: 'tropical', orbMode: 'auto', cabalaLanguage: 'pt', orbs: { ...DEFAULT_ORBS }, points: { ...DEFAULT_POINTS } });
  db.setItem(PROFILE_KEY, JSON.stringify({ version: 1, profiles: [], settings: { houseSystem: 'koch', zodiac: 'other', orbMode: false, orbs: { conjunction: -1, opposition: '8', trine: 4, square: 16 }, points: { node: 'false', chiron: false } } }));
  assert.deepEqual(getSettings(db), { houseSystem: 'placidus', zodiac: 'tropical', orbMode: 'auto', cabalaLanguage: 'pt', orbs: { ...DEFAULT_ORBS, trine: 4 }, points: { ...DEFAULT_POINTS, chiron: false } });
});

test('preferências: rejeita patches malformados sem alterar o blob', () => {
  const db = storage(); setSettings(full, db);
  const before = db.getItem(PROFILE_KEY);
  for (const patch of [null, [], 2, 'whole', { unknown: true }, { cabalaLanguage: 'es' }, { cabalaLanguage: undefined }, { houseSystem: undefined }, { houseSystem: 'koch' }, { zodiac: 'vedic' }, { orbMode: 'automatic' }, { orbs: null }, { orbs: [] }, { orbs: { conjunction: -1 } }, { orbs: { conjunction: 16 } }, { orbs: { conjunction: 1.5 } }, { orbs: { conjunction: '8' } }, { orbs: { conjunction: NaN } }, { orbs: { extra: 4 } }, { points: null }, { points: [] }, { points: { chiron: 1 } }, { points: { extra: false } }, JSON.parse('{"__proto__":{"polluted":true}}')]) {
    assert.throws(() => setSettings(patch, db), undefined, JSON.stringify(patch));
    assert.equal(db.getItem(PROFILE_KEY), before);
  }
  assert.equal({}.polluted, undefined);
});

test('preferências: criar/editar/selecionar/excluir perfil preserva todos os ajustes', () => {
  const db = storage();
  setSettings(full, db);
  const a = saveProfile(db, person), b = saveProfile(db, { ...person, name: 'Segunda pessoa' });
  saveProfile(db, { ...person, name: 'Nome alterado' }, a.id);
  setActive(a.id, db); setPartner(b.id, db);
  deleteProfile(db, b.id);
  assert.deepEqual(getSettings(db), full);
});

test('preferências: falha na escrita mantém estado e não notifica sucesso', () => {
  const db = storage(); setSettings(full, db);
  const before = db.getItem(PROFILE_KEY);
  let calls = 0;
  const off = onProfilesChange(() => { calls++; });
  db.setItem = () => { throw new Error('QuotaExceededError'); };
  try { assert.throws(() => setSettings({ zodiac: 'tropical', points: { node: true } }, db), /Quota/); }
  finally { off(); }
  assert.equal(db.getItem(PROFILE_KEY), before);
  assert.deepEqual(getSettings(db), full);
  assert.equal(calls, 0);
});

test('preferências: estado corrompido não é sobrescrito', () => {
  const db = storage();
  for (const raw of ['{broken', '{"version":2,"profiles":[]}', '{"version":1,"profiles":[null]}']) {
    db.setItem(PROFILE_KEY, raw);
    assert.throws(() => setSettings({ zodiac: 'sidereal' }, db));
    assert.equal(db.getItem(PROFILE_KEY), raw);
  }
});

const cabala = { firstNames: 'Alba Maria', paternalSurname: 'Costa', maternalSurname: 'Silva', language: 'pt', order: 'maternal-first' };

test('idioma do nome: atualiza preferência e só a Cabala ativa em uma escrita', () => {
  const db = storage();
  const other = saveProfile(db, { ...person, cabala });
  const active = saveProfile(db, { ...person, name: 'Outra pessoa fictícia', cabala });
  const before = readProfiles(db);
  let writes = 0;
  const write = db.setItem;
  db.setItem = (...args) => { writes++; return write(...args); };
  setSettings({ cabalaLanguage: 'en', zodiac: 'sidereal' }, db);
  assert.equal(writes, 1);
  assert.equal(getSettings(db).cabalaLanguage, 'en');
  assert.equal(getSettings(db).zodiac, 'sidereal');
  assert.deepEqual(readProfiles(db).find(profile => profile.id === other.id), before[0]);
  assert.deepEqual(activeProfile(db), { ...before[1], cabala: { ...cabala, language: 'en' } });
  assert.equal(activeProfile(db).id, active.id);
  setSettings({ houseSystem: 'whole' }, db);
  assert.equal(activeProfile(db).cabala.language, 'en', 'outros ajustes não mudam o idioma');
});

test('idioma do nome: sem Cabala salva só a preferência, sem inventar dados', () => {
  const db = storage();
  setSettings({ cabalaLanguage: 'en' }, db);
  assert.equal(getSettings(db).cabalaLanguage, 'en');
  assert.equal(activeProfile(db), null);
  saveProfile(db, person);
  setSettings({ cabalaLanguage: 'pt' }, db);
  assert.equal(getSettings(db).cabalaLanguage, 'pt');
  assert.equal(activeProfile(db).cabala, undefined);
});

test('idioma do nome: alfabeto incompatível ou falha local preserva perfil e preferência', () => {
  const db = storage();
  saveProfile(db, { ...person, cabala: { ...cabala, firstNames: 'Wanda', language: 'en' } });
  setSettings({ cabalaLanguage: 'en' }, db);
  const before = db.getItem(PROFILE_KEY);
  assert.throws(() => setSettings({ cabalaLanguage: 'pt', zodiac: 'sidereal' }, db), /alfabeto/);
  assert.equal(db.getItem(PROFILE_KEY), before);
  db.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => setSettings({ cabalaLanguage: 'en', zodiac: 'sidereal' }, db), /Quota/);
  assert.equal(db.getItem(PROFILE_KEY), before);
});

test('idioma do nome: falha remota não altera preferência nem Cabala em memória', async () => {
  const db = storage();
  const state = { version: 1, profiles: [{ id: 'fictional', ...person, cabala }], activeId: 'fictional' };
  let writes = 0;
  await connectProfiles({ storage: db, request: async (url, options) => {
    if (options?.method === 'PUT') { writes++; return { ok: false, status: 503 }; }
    return { ok: true, json: async () => ({ accountId: 'synthetic', revision: 0, state }) };
  } });
  const before = activeProfile(db);
  await assert.rejects(setSettings({ cabalaLanguage: 'en' }, db));
  assert.equal(writes, 1);
  assert.deepEqual(activeProfile(db), before);
  assert.equal(getSettings(db).cabalaLanguage, 'pt');
  assert.equal(db.getItem(PROFILE_KEY), null);
});
