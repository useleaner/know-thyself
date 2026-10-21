import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from './profiles.js';
const { PROFILE_KEY, validateProfile, readProfiles, saveProfile, deleteProfile } = P;

const input = { name: ' Pessoa de teste ', birthDate: '2000-02-29', birthTime: '09:30', timeUnknown: false, place: ' Curitiba, Paraná, Brasil ', lat: -25.42778, lon: -49.27306, timezone: 'America/Sao_Paulo' };
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
test('valida data real e horário local sem converter para UTC', () => {
  assert.equal(validateProfile(input).birthTime, '09:30');
  assert.equal(validateProfile(input).name, 'Pessoa de teste');
  for (const birthDate of ['2001-02-29', '2000-04-31', '0000-01-01', '3000-01-01', '2020-1-01', null]) {
    assert.throws(() => validateProfile({ ...input, birthDate }));
  }
  for (const birthTime of ['', '24:00', '10:60', null]) assert.throws(() => validateProfile({ ...input, birthTime }));
});
test('horário desconhecido fica nulo e não inventa meio-dia', () => {
  assert.equal(validateProfile({ ...input, timeUnknown: true, birthTime: '09:30' }).birthTime, null);
  assert.throws(() => validateProfile({ ...input, timeUnknown: 'true' }));
  assert.throws(() => validateProfile({ ...input, name: ' ' }));
  assert.throws(() => validateProfile({ ...input, place: ' ' }));
});
test('coordenadas e fuso: válidos, todos ausentes (legado) ou erro', () => {
  const p = validateProfile(input);
  assert.deepEqual([p.lat, p.lon, p.timezone], [-25.42778, -49.27306, 'America/Sao_Paulo']);
  const legacy = validateProfile({ ...input, lat: undefined, lon: undefined, timezone: undefined });
  assert.deepEqual([legacy.lat, legacy.lon, legacy.timezone], [null, null, null]);
  for (const bad of [{ lat: 91 }, { lon: -181 }, { lat: '1' }, { timezone: 'Nao/Existe' }, { timezone: null }]) assert.throws(() => validateProfile({ ...input, ...bad }));
});
test('salva dois perfis, restaura, edita e exclui sem perder o outro', () => {
  const db = storage();
  assert.deepEqual(readProfiles(db), []);
  const first = saveProfile(db, input);
  const second = saveProfile(db, { ...input, name: 'Outro perfil', timeUnknown: true });
  assert.notEqual(first.id, second.id);
  assert.equal(readProfiles(db).length, 2);
  saveProfile(db, { ...input, name: 'Nome corrigido' }, first.id);
  assert.equal(readProfiles(db)[0].name, 'Nome corrigido');
  deleteProfile(db, first.id);
  assert.deepEqual(readProfiles(db), [second]);
});
test('dados inválidos, corrompidos e versões futuras não são sobrescritos', () => {
  const db = storage();
  for (const raw of ['{broken', '{"version":2,"profiles":[]}', '{"version":1,"profiles":[null]}']) {
    db.setItem(PROFILE_KEY, raw);
    assert.throws(() => saveProfile(db, input));
    assert.equal(db.getItem(PROFILE_KEY), raw);
    assert.throws(() => deleteProfile(db, 'missing'));
  }
  const duplicate = { id: 'same', ...validateProfile(input) };
  db.setItem(PROFILE_KEY, JSON.stringify({ version: 1, profiles: [duplicate, duplicate] }));
  assert.throws(() => readProfiles(db));
});
test('falha de armazenamento é comunicada sem descartar perfil existente', () => {
  const db = storage();
  saveProfile(db, input);
  const before = db.getItem(PROFILE_KEY);
  db.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => saveProfile(db, input));
  assert.equal(db.getItem(PROFILE_KEY), before);
});
test('migração: dados v1 antigos (sem coordenadas) continuam legíveis e não são semeados', () => {
  const db = storage();
  db.setItem(PROFILE_KEY, JSON.stringify({ version: 1, profiles: [{ id: 'old', name: 'Antigo', birthDate: '1990-05-05', birthTime: null, timeUnknown: true, place: 'Lisboa' }] }));
  assert.equal(P.activeProfile(db).id, 'old');
  assert.equal(P.activeProfile(db).lat, null);
  assert.equal(readProfiles(db).length, 1);
});
test('primeiro acesso: sem perfil semeado', () => {
  const db = storage();
  assert.equal(P.activeProfile(db), null);
  assert.equal(readProfiles(db).length, 0);
});
test('ativo, parceiro, exclusões e eventos', () => {
  const db = storage();
  const seen = [];
  const off = P.onProfilesChange(() => seen.push(1));
  const a = saveProfile(db, { ...input, name: 'A' });
  const b = saveProfile(db, { ...input, name: 'B' });
  assert.equal(P.activeProfile(db).id, b.id, 'saving activates the saved profile');
  P.setActive(a.id, db);
  assert.equal(P.partnerProfile(db), null);
  P.setPartner(b.id, db);
  assert.equal(P.partnerProfile(db).id, b.id);
  assert.throws(() => P.setPartner(a.id, db), /ativo/);
  assert.throws(() => P.setActive('nope', db));
  P.setActive(b.id, db);
  assert.equal(P.activeProfile(db).id, b.id);
  assert.equal(P.partnerProfile(db), null);
  P.setPartner(a.id, db);
  P.setPartner(null, db);
  assert.equal(P.partnerProfile(db), null);
  assert.ok(seen.length >= 4);
  off();
  const n = seen.length;
  P.setActive(a.id, db);
  assert.equal(seen.length, n);
  deleteProfile(db, a.id);
  assert.equal(P.activeProfile(db).id, b.id);
});
test('ajustes: padrão placidus, valida sistema de casas e preserva perfis', () => {
  const db = storage();
  assert.deepEqual(P.getSettings(db), { houseSystem: 'placidus', zodiac: 'tropical', orbMode: 'auto', orbs: { ...P.DEFAULT_ORBS }, points: { ...P.DEFAULT_POINTS } });
  P.setSettings({ houseSystem: 'whole' }, db);
  assert.equal(P.getSettings(db).houseSystem, 'whole');
  assert.throws(() => P.setSettings({ houseSystem: 'koch' }, db));
  saveProfile(db, input);
  assert.equal(P.getSettings(db).houseSystem, 'whole');
});
