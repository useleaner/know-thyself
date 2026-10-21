import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initProfilePage, normalizeBirthTime } from './profile-form.js';
import { activeProfile, readProfiles, saveProfile, setActive, setPartner, partnerProfile, PROFILE_KEY } from './profiles.js';

const html = await readFile(new URL('./perfil.html', import.meta.url), 'utf8');
const person = { name: 'Pessoa Teste', birthDate: '1991-06-17', birthTime: '04:23', timeUnknown: false, place: 'Passo Fundo, Rio Grande do Sul, Brasil', lat: -28.26278, lon: -52.40667, timezone: 'America/Sao_Paulo' };
const city = { label: person.place, lat: person.lat, lon: person.lon, timezone: person.timezone };
function fixture({ view = '', people = [person], session = null, production = false, lookupPlaces = async () => [city], raw } = {}) {
  const values = new Map();
  let failWrites = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem(key, value) { if (failWrites) throw Error('quota'); values.set(key, value); } };
  people.forEach((profile, index) => saveProfile(storage, profile, `p${index}`));
  // Salvar ativa o perfil salvo; o cenário começa com a primeira pessoa em uso.
  if (people.length) setActive('p0', storage);
  if (raw !== undefined) values.set(PROFILE_KEY, raw);
  const makeNode = tag => ({ tag, attrs: {}, children: [], listeners: {}, value: '', checked: false, hidden: false, textContent: '', innerHTML: '', disabled: false, classList: { add() {} },
    setAttribute(key, value) { this.attrs[key] = value; }, removeAttribute(key) { delete this.attrs[key]; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; },
    querySelectorAll(selector) { return selector === 'li' ? this.children.filter(child => child.tag === 'li') : Object.values(nodes).filter(node => ['input', 'button'].includes(node.tag)); },
    focus() { this.focused = true; }
  });
  const nodes = Object.fromEntries([...html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)].map(([markup, tag, id]) => [id, { ...makeNode(tag), hidden: /\shidden/.test(markup) }]));
  const root = { title: '', listeners: {}, createElement: makeNode, querySelector: selector => nodes[selector.slice(1)], addEventListener(type, fn) { this.listeners[type] = fn; } };
  const navigations = [], requests = [];
  const options = { root, storage, pageURL: `${production ? 'https://know.example' : 'http://127.0.0.1:4173'}/perfil.html${view ? `?${view}` : ''}`,
    navigate: url => navigations.push(url), lookupPlaces, confirmRemove: () => true,
    request: async (...args) => { requests.push(args); return { ok: true, json: async () => session }; },
  };
  return { options, nodes, storage, navigations, requests, failWrites: () => { failWrites = true; }, event(id, type, extra = {}) { return nodes[id].listeners[type]({ preventDefault() {}, ...extra }); } };
}

const waitForLookup = () => new Promise(resolve => setTimeout(resolve, 370));

test('hub usa perfil real e comparação só aparece no contexto de sinastria', async () => {
  const f = fixture({ people: [person, { ...person, name: '<Outra pessoa>' }] });
  await initProfilePage(f.options);
  assert.equal(f.nodes['profile-hub'].hidden, false);
  assert.equal(f.nodes['profiles-view'].hidden, true);
  assert.match(f.nodes['active-profile'].innerHTML, /Pessoa Teste/);
  assert.match(f.nodes['active-profile'].innerHTML, /profile-signs/);
  assert.equal(f.nodes['profile-comparison'].hidden, true);
  assert.equal(f.nodes['profile-partner'].children.length, 2);
  assert.equal(f.nodes['profile-partner'].children[1].textContent, '<Outra pessoa>');
  assert.equal(f.requests.length, 0);

  const comparison = fixture({ view: 'compare=1', people: [person, { ...person, name: 'Parceira' }] });
  await initProfilePage(comparison.options);
  assert.equal(comparison.nodes['profile-comparison'].hidden, false);
  comparison.nodes['profile-partner'].value = 'p1';
  comparison.event('profile-partner', 'change');
  assert.equal(partnerProfile(comparison.storage).id, 'p1');
  assert.deepEqual(comparison.navigations, ['./universo.html?mode=synastry']);
  assert.equal(comparison.nodes['switch-profile'].href, './perfil.html?view=profiles&compare=1&mode=synastry');
  assert.equal(comparison.nodes['profile-back'].href, './universo.html?mode=synastry');
});

test('lista marca Em uso, seleciona perfil e remove autocomparação sem editar dados', async () => {
  const f = fixture({ view: 'view=profiles', people: [person, { ...person, name: 'Segunda pessoa' }] });
  setPartner('p1', f.storage);
  await initProfilePage(f.options);
  assert.equal(f.nodes['profiles-view'].hidden, false);
  assert.equal(f.nodes['profile-form-view'].hidden, true);
  const rows = f.nodes['profile-list'].children;
  assert.equal(rows[0].attrs['aria-current'], 'true');
  assert.equal(rows[0].children[0].children[1].textContent, 'Em uso');
  rows[1].listeners.click();
  assert.equal(activeProfile(f.storage).id, 'p1');
  assert.equal(partnerProfile(f.storage), null);
  assert.equal(readProfiles(f.storage).length, 2);
  assert.deepEqual(f.navigations, ['./universo.html']);
});

test('horário desconhecido apaga a hora, desabilita e não a restaura ao desmarcar', async () => {
  const f = fixture({ view: 'view=edit' });
  await initProfilePage(f.options);
  assert.equal(f.nodes['form-title'].textContent, 'Editar perfil');
  assert.equal(f.nodes['birth-time'].value, '04:23');
  f.nodes['time-unknown'].checked = true;
  f.event('time-unknown', 'change');
  assert.equal(f.nodes['birth-time'].value, '');
  assert.equal(f.nodes['birth-time'].disabled, true);
  assert.equal(f.nodes['birth-time'].required, false);
  f.nodes['time-unknown'].checked = false;
  f.event('time-unknown', 'change');
  assert.equal(f.nodes['birth-time'].value, '');
  assert.equal(f.nodes['birth-time'].required, true);
  assert.equal(activeProfile(f.storage).birthTime, '04:23');
});

test('máscaras e correção de hora preservam validação de datas e horários', async () => {
  const f = fixture({ view: 'view=new' });
  await initProfilePage(f.options);
  f.nodes['birth-date'].value = '17061991'; f.event('birth-date', 'input');
  f.nodes['birth-time'].value = '0423'; f.event('birth-time', 'input');
  assert.equal(f.nodes['birth-date'].value, '17/06/1991');
  assert.equal(f.nodes['birth-time'].value, '04:23');
  assert.equal(normalizeBirthTime('952'), '09:52');
  assert.equal(normalizeBirthTime('9'), '09:00');
  assert.equal(normalizeBirthTime('24:99'), '24:99');
  const before = f.storage.getItem(PROFILE_KEY);
  f.nodes['birth-name'].value = 'Nova'; f.nodes['birth-place'].value = 'Cidade';
  f.nodes['birth-date'].value = '31/02/2000'; f.event('birth-form', 'submit');
  assert.match(f.nodes['profile-status'].textContent, /data.*válida/);
  assert.equal(f.storage.getItem(PROFILE_KEY), before);
});

test('editar preserva id e coordenadas, salva e retorna ao app; falha não perde valores', async () => {
  const f = fixture({ view: 'view=edit' });
  await initProfilePage(f.options);
  f.nodes['birth-name'].value = 'Atualizada';
  f.event('birth-form', 'submit');
  assert.equal(readProfiles(f.storage).length, 1);
  assert.equal(activeProfile(f.storage).id, 'p0');
  assert.equal(activeProfile(f.storage).name, 'Atualizada');
  assert.equal(activeProfile(f.storage).timezone, person.timezone);
  assert.deepEqual(f.navigations, ['./universo.html']);

  const failed = fixture({ view: 'view=edit' });
  await initProfilePage(failed.options);
  const before = failed.storage.getItem(PROFILE_KEY);
  failed.nodes['birth-name'].value = 'Não salva';
  failed.failWrites(); failed.event('birth-form', 'submit');
  assert.match(failed.nodes['profile-status'].textContent, /Não foi possível salvar/);
  assert.equal(failed.nodes['birth-name'].value, 'Não salva');
  assert.equal(failed.storage.getItem(PROFILE_KEY), before);
  assert.deepEqual(failed.navigations, []);
});

test('geocodificação é obrigatória ao mudar a cidade; novo perfil é ativado ao salvar', async () => {
  const f = fixture({ view: 'view=new' });
  await initProfilePage(f.options);
  f.nodes['birth-name'].value = 'Nova pessoa';
  f.nodes['birth-date'].value = '17/06/1991';
  f.nodes['birth-time'].value = '04:23';
  f.nodes['birth-place'].value = 'Passo Fundo';
  f.event('birth-form', 'submit');
  assert.match(f.nodes['profile-status'].textContent, /Selecione a cidade/);
  f.event('birth-place', 'input');
  await waitForLookup();
  assert.equal(f.nodes['place-list'].hidden, false);
  const suggestion = f.nodes['place-list'].children[0];
  assert.equal(suggestion.listeners.pointerdown, undefined);
  suggestion.listeners.mousedown({ preventDefault() {} });
  assert.equal(f.nodes['birth-place'].value, 'Passo Fundo');
  suggestion.listeners.click();
  assert.equal(f.nodes['birth-place'].value, city.label);
  assert.equal(f.nodes['place-list'].hidden, true);
  f.event('birth-form', 'submit');
  assert.equal(readProfiles(f.storage).length, 2);
  assert.equal(activeProfile(f.storage).name, 'Nova pessoa');
  assert.equal(activeProfile(f.storage).lat, city.lat);
  assert.deepEqual(f.navigations, ['./universo.html']);
});

test('resultado atrasado não reabre sugestões depois de sair do campo', async () => {
  let resolve;
  const f = fixture({ view: 'view=new', lookupPlaces: () => new Promise(done => { resolve = done; }) });
  await initProfilePage(f.options);
  f.nodes['birth-place'].value = 'Passo Fundo';
  f.event('birth-place', 'input');
  await waitForLookup();
  f.event('birth-place', 'blur');
  resolve([city]);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.nodes['place-list'].hidden, true);
  assert.equal(f.nodes['place-state'].textContent, '');
});

test('exclusão confirma, remove somente o perfil editado e volta à lista', async () => {
  const f = fixture({ view: 'view=edit', people: [person, { ...person, name: 'Segunda' }] });
  await initProfilePage(f.options);
  f.event('delete-profile', 'click');
  assert.deepEqual(readProfiles(f.storage).map(profile => profile.name), ['Segunda']);
  assert.deepEqual(f.navigations, ['./perfil.html?view=profiles']);
});

test('primeiro acesso e sessão inválida não expõem dados de exemplo', async () => {
  const empty = fixture({ people: [] });
  await initProfilePage(empty.options);
  assert.equal(empty.nodes['active-profile'].attrs.href, './perfil.html?view=new');
  assert.equal(empty.nodes['create-first-profile'], undefined);
  assert.equal(empty.nodes['share-profile'], undefined);
  assert.equal(empty.nodes['profile-actions'].hidden, true);
  const blocked = fixture({ production: true });
  await initProfilePage(blocked.options);
  assert.deepEqual(blocked.navigations, ['/']);
  assert.equal(blocked.nodes['active-profile'].innerHTML, '');
  const logged = fixture({ production: true, session: { configured: true, user: { email: 'pessoa@example.com' } } });
  await initProfilePage(logged.options);
  assert.equal(logged.nodes['profile-email'].textContent, 'pessoa@example.com');
  assert.equal(logged.nodes['profile-email'].hidden, false);
});

test('armazenamento inválido mantém os dados originais e informa recuperação', async () => {
  // Em qualquer visão a falha aparece no hub (o status do formulário ficaria oculto).
  const f = fixture({ raw: '{broken', view: 'view=new' });
  await initProfilePage(f.options);
  assert.match(f.nodes['profile-hub-status'].textContent, /não foram sobrescritos/);
  assert.equal(f.nodes['profile-hub'].hidden, false);
  assert.equal(f.nodes['profile-form-view'].hidden, true);
  assert.equal(f.nodes['profile-summary'].hidden, true);
  assert.equal(f.storage.getItem(PROFILE_KEY), '{broken');
});

test('trocar perfil e voltar preservam sinastria com trânsitos; modo inesperado não vira URL', async () => {
  const f = fixture({ view: 'view=profiles&compare=1&mode=synastry-transits', people: [person, { ...person, name: 'Segunda' }] });
  await initProfilePage(f.options);
  f.nodes['profile-list'].children[1].listeners.click();
  assert.deepEqual(f.navigations, ['./universo.html?mode=synastry-transits']);
  assert.equal(f.nodes['profile-back'].href, './perfil.html?compare=1&mode=synastry-transits');
  assert.equal(f.nodes['new-profile'].href, './perfil.html?view=new&compare=1&mode=synastry-transits');
  const invalid = fixture({ view: 'compare=1&mode=https://invalid.example' });
  await initProfilePage(invalid.options);
  assert.equal(invalid.nodes['profile-back'].href, './universo.html?mode=synastry');
});
