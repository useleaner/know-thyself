import { computeTree } from './cabala-engine.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from './profiles.js';
import { buildMapState } from './map-data.js';
const { PROFILE_KEY, validateProfile, readProfiles, saveProfile, deleteProfile } = P;

const input = { name: ' Pessoa de teste ', birthDate: '2000-02-29', birthTime: '09:30', timeUnknown: false, place: ' Curitiba, Paraná, Brasil ', lat: -25.42778, lon: -49.27306, timezone: 'America/Sao_Paulo' };
const cabala = { firstNames: 'Alba Maria', paternalSurname: 'Costa', maternalSurname: 'Silva', language: 'pt', order: 'maternal-first' };
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
test('dados explícitos da Cabala persistem no mesmo perfil e não afetam perfis antigos', () => {
  const db = storage();
  const saved = saveProfile(db, { ...input, cabala });
  assert.deepEqual(readProfiles(db)[0].cabala, cabala);
  saveProfile(db, { ...readProfiles(db)[0], name: 'Nome de exibição' }, saved.id);
  assert.deepEqual(readProfiles(db)[0].cabala, cabala);
  const before = db.getItem(PROFILE_KEY);
  assert.throws(() => saveProfile(db, { ...input, cabala: { ...cabala, firstNames: '李' } }, saved.id));
  assert.equal(db.getItem(PROFILE_KEY), before);
  saveProfile(db, { ...input, cabala: undefined }, saved.id);
  assert.equal(Object.hasOwn(readProfiles(db)[0], 'cabala'), false);
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
  assert.equal(P.partnerProfile(db).id, b.id);
  P.setPartner(b.id, db);
  assert.equal(P.partnerProfile(db).id, b.id);
  assert.throws(() => P.setPartner(a.id, db), /ativo/);
  assert.throws(() => P.setActive('nope', db));
  P.setActive(b.id, db);
  assert.equal(P.activeProfile(db).id, b.id);
  assert.equal(P.partnerProfile(db).id, a.id);
  P.setPartner(a.id, db);
  P.setPartner(null, db);
  assert.equal(P.partnerProfile(db).id, a.id);
  assert.ok(seen.length >= 4);
  off();
  const n = seen.length;
  P.setActive(a.id, db);
  assert.equal(seen.length, n);
  deleteProfile(db, a.id);
  assert.equal(P.activeProfile(db).id, b.id);
});
test('dois perfis legados comparam automaticamente sem gravar, inclusive na sinastria direta', () => {
  const db = storage();
  const a = { id: 'a', ...validateProfile(input) };
  const b = { ...a, id: 'b', name: 'Pessoa fictícia B', birthDate: '1995-08-12' };
  const raw = JSON.stringify({ version: 1, profiles: [a, b] });
  db.setItem(PROFILE_KEY, raw);
  db.setItem = () => { throw Error('leitura não deve gravar'); };
  for (const mode of ['synastry', 'synastry-transits']) {
    const state = buildMapState({ profile: P.activeProfile(db), partner: P.partnerProfile(db), mode, date: new Date('2026-10-21T12:00:00Z') });
    assert.equal(state.status, 'ok');
    assert.equal(state.partner.id, 'b');
    assert.ok(state.partnerChart);
    assert.ok(state.scene.outer.some(set => set.key === 'partner'));
  }
  assert.equal(db.getItem(PROFILE_KEY), raw);
  const reopened = { getItem: key => db.getItem(key) };
  assert.equal(P.partnerProfile(reopened).id, 'b');
});

test('comparação automática acompanha cadastro, troca e exclusão; três perfis mantêm escolha explícita', () => {
  const db = storage();
  assert.equal(P.partnerProfile(db), null);
  const a = saveProfile(db, { ...input, name: 'Pessoa fictícia A' });
  assert.equal(P.partnerProfile(db), null);
  const b = saveProfile(db, { ...input, name: 'Pessoa fictícia B' });
  assert.equal(P.partnerProfile(db).id, a.id);
  P.setActive(a.id, db);
  assert.equal(P.partnerProfile(db).id, b.id);
  const c = saveProfile(db, { ...input, name: 'Pessoa fictícia C' });
  assert.equal(P.partnerProfile(db), null);
  P.setPartner(b.id, db);
  assert.equal(P.partnerProfile(db).id, b.id);
  P.setActive(a.id, db);
  assert.equal(P.partnerProfile(db).id, b.id);
  P.setPartner(null, db);
  assert.equal(P.partnerProfile(db), null);
  P.setPartner(c.id, db);
  deleteProfile(db, c.id);
  assert.equal(P.partnerProfile(db).id, b.id);
  deleteProfile(db, a.id);
  assert.equal(P.activeProfile(db).id, b.id);
  assert.equal(P.partnerProfile(db), null);
});

test('ajustes: padrão placidus, valida sistema de casas e preserva perfis', () => {
  const db = storage();
  assert.deepEqual(P.getSettings(db), { houseSystem: 'placidus', zodiac: 'tropical', orbMode: 'auto', cabalaLanguage: 'pt', orbs: { ...P.DEFAULT_ORBS }, points: { ...P.DEFAULT_POINTS } });
  P.setSettings({ houseSystem: 'whole' }, db);
  assert.equal(P.getSettings(db).houseSystem, 'whole');
  assert.throws(() => P.setSettings({ houseSystem: 'koch' }, db));
  saveProfile(db, input);
  assert.equal(P.getSettings(db).houseSystem, 'whole');
});

test('salvar na conta chama o fetch solto e mostra só mensagem amigável quando ele falha', async () => {
  const s = storage();
  let calls = 0;
  const request = async function (url, options) {
    assert.equal(this, undefined); // fetch exige this da window; método de objeto dá "Illegal invocation"
    calls++;
    if (calls === 1) return { ok: true, json: async () => ({ accountId: 'a1', revision: 0, state: null }) };
    throw new TypeError('Can only call Window.fetch on instances of Window');
  };
  await P.connectProfiles({ storage: s, request });
  await assert.rejects(() => saveProfile(s, input), error => !/Window\.fetch/.test(error.message) && /Não foi possível salvar/.test(error.message));
});

test('importação que falha bloqueia a conta e preserva o legado para retentar', async () => {
  const s = storage();
  saveProfile(s, input);
  const before = s.getItem(PROFILE_KEY);
  const request = async (url, options) => options?.method === 'PUT' ? { ok: false, status: 503 } : { ok: true, json: async () => ({ accountId: 'a1', revision: 0, state: null }) };
  await assert.rejects(() => P.connectProfiles({ storage: s, request, confirmImport: () => true }));
  assert.throws(() => readProfiles(s));
  assert.equal(s.getItem(PROFILE_KEY), before);
});

test('cancelar importação é lembrado por conta e não apaga perfis locais', async () => {
  const s = storage();
  saveProfile(s, { ...input, name: 'Alba fictícia', birthDate: '1991-06-17', cabala });
  const legacy = s.getItem(PROFILE_KEY);
  let accountId = 'account-a', prompts = 0;
  const request = async () => ({ ok: true, json: async () => ({ accountId, revision: 0, state: null }) });
  const confirmImport = () => { prompts++; return false; };
  await P.connectProfiles({ storage: s, request, confirmImport });
  await P.connectProfiles({ storage: s, request, confirmImport });
  assert.equal(prompts, 1);
  assert.equal(s.getItem(PROFILE_KEY), legacy);
  accountId = 'account-b';
  await P.connectProfiles({ storage: s, request, confirmImport });
  await P.connectProfiles({ storage: s, request, confirmImport });
  assert.equal(prompts, 2, 'a decisão de A não decide por B');
  accountId = 'account-a';
  await P.connectProfiles({ storage: s, request, confirmImport });
  assert.equal(prompts, 2);
  assert.equal(s.getItem(PROFILE_KEY), legacy);
});

test('OK importa uma vez, reabre pela conta e não oferece o mesmo legado a outra conta', async () => {
  const s = storage();
  saveProfile(s, { ...input, name: 'Alba fictícia', birthDate: '1991-06-17', cabala });
  const localProfiles = readProfiles(s), legacy = s.getItem(PROFILE_KEY);
  let state = null, revision = 0, puts = 0, prompts = 0, accountId = 'account-a';
  const request = async (url, options) => {
    if (options?.method === 'PUT') {
      const body = JSON.parse(options.body);
      assert.equal(body.accountId, accountId);
      assert.equal(body.revision, revision);
      state = body.state; revision++; puts++;
    }
    return { ok: true, json: async () => ({ accountId, revision, state }) };
  };
  const confirmImport = () => { prompts++; return true; };
  await P.connectProfiles({ storage: s, request, confirmImport });
  assert.deepEqual(readProfiles(s), localProfiles);
  await P.connectProfiles({ storage: s, request, confirmImport });
  assert.deepEqual(readProfiles(s), localProfiles);
  assert.equal(prompts, 1); assert.equal(puts, 1);
  assert.equal(s.getItem(PROFILE_KEY), legacy);
  assert.equal(s.getItem(`${PROFILE_KEY}.imported`), 'account-a');
  accountId = 'account-b'; state = null; revision = 0;
  await P.connectProfiles({ storage: s, request, confirmImport });
  assert.equal(prompts, 1); assert.equal(puts, 1);
  assert.deepEqual(readProfiles(s), [], 'legado já reivindicado não passa para outra conta');
});

for (const status of [503, 409]) test(`importação falha ${status} preserva dados e permite tentar novamente sem duplicar`, async () => {
  const s = storage();
  saveProfile(s, { ...input, name: 'Alba fictícia', birthDate: '1991-06-17', cabala });
  const localProfiles = readProfiles(s), legacy = s.getItem(PROFILE_KEY);
  let fail = true, state = null, revision = 0, puts = 0, prompts = 0;
  const request = async (url, options) => {
    if (options?.method === 'PUT') {
      puts++;
      if (fail) return { ok: false, status };
      state = JSON.parse(options.body).state; revision++;
    }
    return { ok: true, json: async () => ({ accountId: 'account-a', revision, state }) };
  };
  const confirmImport = () => { prompts++; return true; };
  await assert.rejects(() => P.connectProfiles({ storage: s, request, confirmImport }));
  assert.throws(() => readProfiles(s));
  assert.equal(s.getItem(PROFILE_KEY), legacy);
  assert.equal(s.getItem(`${PROFILE_KEY}.imported`), null);
  assert.equal(s.getItem(`${PROFILE_KEY}.import-declined.account-a`), null);
  fail = false;
  await P.connectProfiles({ storage: s, request, confirmImport });
  await P.connectProfiles({ storage: s, request, confirmImport });
  assert.equal(prompts, 2); assert.equal(puts, 2);
  assert.deepEqual(readProfiles(s), localProfiles);
});

test('falha de conta bloqueia leitura e escrita locais sem tocar o legado, e permite retentar', async () => {
  const s = storage(); saveProfile(s, input);
  const legacy = s.getItem(PROFILE_KEY);
  await assert.rejects(P.connectProfiles({ storage: s, request: async () => ({ ok: false, status: 503 }) }));
  assert.throws(() => readProfiles(s));
  assert.throws(() => saveProfile(s, { ...input, name: 'Não pode salvar no aparelho' }));
  assert.equal(s.getItem(PROFILE_KEY), legacy);
  await P.connectProfiles({ storage: s, confirmImport: () => false, request: async () => ({ ok: true, json: async () => ({ accountId: 'recovered', revision: 0, state: null }) }) });
  assert.deepEqual(readProfiles(s), []);
  assert.equal(s.getItem(PROFILE_KEY), legacy);
});

test('401 ao salvar pede reentrada e não transforma a gravação remota em local', async () => {
  const s = storage();
  let reads = 0;
  const request = async () => ++reads === 1 ? { ok: true, json: async () => ({ accountId: 'expired', revision: 0, state: null }) } : { ok: false, status: 401 };
  await P.connectProfiles({ storage: s, request });
  await assert.rejects(() => saveProfile(s, input), error => error.code === 'session_expired' && /sessão terminou/.test(error.message));
  assert.equal(s.getItem(PROFILE_KEY), null);
  assert.deepEqual(readProfiles(s), []);
});

test('troca da tabela mantém nomes K/W/Y legíveis sem fallback no cálculo', () => {
  const db = storage();
  for (const firstNames of ['Kaya', 'Wanda', 'Yara']) {
    const saved = saveProfile(db, { ...input, birthDate: '1991-06-17', cabala: { ...cabala, firstNames, language: 'pt' } });
    const restored = readProfiles(db).find(profile => profile.id === saved.id);
    assert.equal(restored.cabala.firstNames, firstNames);
    assert.equal(computeTree(restored), null);
  }
  assert.equal(readProfiles(db).length, 3);
});
