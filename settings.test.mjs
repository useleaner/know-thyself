import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_KEY, DEFAULT_ORBS, DEFAULT_POINTS, getSettings, setSettings, saveProfile, deleteProfile, setActive, setPartner, onProfilesChange } from './profiles.js';

const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const person = { name: 'Pessoa teste', birthDate: '2000-01-01', birthTime: null, timeUnknown: true, place: 'Lisboa' };
const full = { houseSystem: 'equal', zodiac: 'sidereal', orbMode: 'manual', orbs: { conjunction: 0, opposition: 15, trine: 6, square: 5, sextile: 4 }, points: { node: false, lilith: false, chiron: false, ceres: true, pallas: true, juno: true, vesta: true } };

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
  assert.deepEqual(getSettings(db), { houseSystem: 'whole', zodiac: 'tropical', orbMode: 'auto', orbs: { ...DEFAULT_ORBS }, points: { ...DEFAULT_POINTS } });
  db.setItem(PROFILE_KEY, JSON.stringify({ version: 1, profiles: [], settings: { houseSystem: 'koch', zodiac: 'other', orbMode: false, orbs: { conjunction: -1, opposition: '8', trine: 4, square: 16 }, points: { node: 'false', chiron: false } } }));
  assert.deepEqual(getSettings(db), { houseSystem: 'placidus', zodiac: 'tropical', orbMode: 'auto', orbs: { ...DEFAULT_ORBS, trine: 4 }, points: { ...DEFAULT_POINTS, chiron: false } });
});

test('preferências: rejeita patches malformados sem alterar o blob', () => {
  const db = storage(); setSettings(full, db);
  const before = db.getItem(PROFILE_KEY);
  for (const patch of [null, [], 2, 'whole', { unknown: true }, { houseSystem: undefined }, { houseSystem: 'koch' }, { zodiac: 'vedic' }, { orbMode: 'automatic' }, { orbs: null }, { orbs: [] }, { orbs: { conjunction: -1 } }, { orbs: { conjunction: 16 } }, { orbs: { conjunction: 1.5 } }, { orbs: { conjunction: '8' } }, { orbs: { conjunction: NaN } }, { orbs: { extra: 4 } }, { points: null }, { points: [] }, { points: { chiron: 1 } }, { points: { extra: false } }, JSON.parse('{"__proto__":{"polluted":true}}')]) {
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
