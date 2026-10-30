import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initProfilePage, normalizeBirthTime } from './profile-form.js';
import { computeTree } from './cabala-engine.js';
import { activeProfile, readProfiles, saveProfile, setActive, setPartner, partnerProfile, PROFILE_KEY } from './profiles.js';

const html = await readFile(new URL('./perfil.html', import.meta.url), 'utf8');
const person = { name: 'Pessoa Teste', birthDate: '1991-06-17', birthTime: '04:23', timeUnknown: false, place: 'Passo Fundo, Rio Grande do Sul, Brasil', lat: -28.26278, lon: -52.40667, timezone: 'America/Sao_Paulo' };
const city = { label: person.place, lat: person.lat, lon: person.lon, timezone: person.timezone };
function fixture({ view = '', people = [person], session = null, production = false, settings, lookupPlaces = async () => [city], raw } = {}) {
  const values = new Map();
  let failWrites = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem(key, value) { if (failWrites) throw Error('quota'); values.set(key, value); } };
  people.forEach((profile, index) => saveProfile(storage, profile, `p${index}`));
  // Salvar ativa o perfil salvo; o cenário começa com a primeira pessoa em uso.
  if (people.length) setActive('p0', storage);
  if (settings) values.set(PROFILE_KEY, JSON.stringify({ ...JSON.parse(values.get(PROFILE_KEY) || '{"version":1,"profiles":[]}'), settings }));
  if (raw !== undefined) values.set(PROFILE_KEY, raw);
  const makeNode = tag => ({ tag, isConnected: true, attrs: {}, children: [], listeners: {}, value: '', checked: false, hidden: false, textContent: '', innerHTML: '', _disabled: false, get disabled() { return this._disabled; }, set disabled(value) { this._disabled = value; if (value && root.activeElement === this) root.activeElement = root.body; }, classList: { add() {} },
    setAttribute(key, value) { this.attrs[key] = value; }, removeAttribute(key) { delete this.attrs[key]; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; },
    querySelectorAll(selector) { return selector === 'li' ? this.children.filter(child => child.tag === 'li') : Object.values(nodes).filter(node => ['input', 'button'].includes(node.tag)); },
    focus() { this.focused = true; root.activeElement = this; }
  });
  const nodes = Object.fromEntries([...html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)].map(([markup, tag, id]) => [id, Object.assign(makeNode(tag), { hidden: /\shidden/.test(markup) })]));
  const root = { title: '', body: { tag: 'body' }, activeElement: null, listeners: {}, createElement: makeNode, querySelector: selector => nodes[selector.slice(1)], addEventListener(type, fn) { this.listeners[type] = fn; } };
  root.querySelectorAll = selector => {
    const descendants = node => [node, ...node.children.flatMap(descendants)];
    const all = [...new Set(Object.values(nodes).flatMap(descendants))];
    if (selector.startsWith('#profile-list')) return all.filter(node => ['button', 'input', 'select'].includes(node.tag));
    return [];

  };
  const navigations = [], requests = [];
  const options = { root, storage, pageURL: `${production ? 'https://know.example' : 'http://127.0.0.1:4173'}/perfil.html${view ? `?${view}` : ''}`,
    navigate: url => navigations.push(url), lookupPlaces, confirmRemove: () => true, confirmDiscard: () => true,
    request: async (...args) => { requests.push(args); return { ok: true, json: async () => session }; },
  };
  return { options, nodes, storage, navigations, requests, failWrites: () => { failWrites = true; }, event(id, type, extra = {}) { return nodes[id].listeners[type]({ preventDefault() {}, ...extra }); } };
}

const waitForLookup = () => new Promise(resolve => setTimeout(resolve, 370));

test('hub usa perfil real e comparação só aparece no contexto de sinastria', async () => {
  const f = fixture({ people: [person, { ...person, name: '<Outra pessoa>' }] });
  await initProfilePage(f.options);
  assert.equal(f.nodes['profile-hub'].hidden, false);
  assert.equal(f.nodes['profiles-view'], undefined);
  assert.equal(f.nodes['profile-list'].children.length, 2);
  assert.equal(f.nodes['profile-list'].children[0].children[0].children[0].children[0].textContent, person.name);
  assert.equal(f.nodes['profile-comparison'].hidden, true);
  assert.equal(f.nodes['profile-partner'].children.length, 2);
  assert.equal(f.nodes['profile-partner'].children[1].textContent, '<Outra pessoa>');
  assert.equal(f.requests.length, 0);

  const automatic = fixture({ view: 'compare=1', people: [person, { ...person, name: 'Parceira' }] });
  await initProfilePage(automatic.options);
  assert.equal(automatic.nodes['profile-comparison'].hidden, true);
  assert.equal(partnerProfile(automatic.storage).id, 'p1');

  const comparison = fixture({ view: 'compare=1', people: [person, { ...person, name: 'Parceira' }, { ...person, name: 'Terceira pessoa' }] });
  await initProfilePage(comparison.options);
  assert.equal(comparison.nodes['profile-comparison'].hidden, false);
  assert.equal(comparison.nodes['profile-partner'].children.length, 3);
  assert.equal(partnerProfile(comparison.storage), null);
  comparison.nodes['profile-partner'].value = 'p1';
  comparison.event('profile-partner', 'change');
  assert.equal(partnerProfile(comparison.storage).id, 'p1');
  assert.deepEqual(comparison.navigations, []);
  assert.equal(comparison.nodes['switch-profile'], undefined);
  assert.equal(comparison.nodes['profile-back'].href, './universo.html?mode=synastry');
});

test('seletor some ao passar de três para dois perfis e não aparece com um ou nenhum', async () => {
  const f = fixture({ view: 'compare=1', people: [person, { ...person, name: 'Segunda' }, { ...person, name: 'Terceira' }] });
  await initProfilePage(f.options);
  assert.equal(f.nodes['profile-comparison'].hidden, false);
  f.nodes['profile-list'].children[2].children[2].listeners.click();
  assert.equal(f.nodes['profile-comparison'].hidden, true);
  assert.equal(partnerProfile(f.storage).id, 'p1');
  f.nodes['profile-list'].children[1].children[2].listeners.click();
  assert.equal(f.nodes['profile-comparison'].hidden, true);
  assert.equal(partnerProfile(f.storage), null);
  f.nodes['profile-list'].children[0].children[2].listeners.click();
  assert.equal(f.nodes['profile-comparison'].hidden, true);
  assert.equal(partnerProfile(f.storage), null);
});

test('lista marca Em uso, seleciona perfil e remove autocomparação sem editar dados', async () => {
  const f = fixture({ view: 'view=profiles', people: [person, { ...person, name: 'Segunda pessoa' }] });
  setPartner('p1', f.storage);
  await initProfilePage(f.options);
  assert.equal(f.nodes['profile-hub'].hidden, false);
  assert.equal(f.nodes['profile-form-view'].hidden, true);
  const rows = f.nodes['profile-list'].children.map(entry => entry.children[0]);
  assert.equal(rows[0].attrs['aria-current'], 'true');
  assert.equal(rows[0].children[0].children[1].textContent, 'Em uso');
  rows[1].listeners.click();
  assert.equal(activeProfile(f.storage).id, 'p1');
  assert.equal(partnerProfile(f.storage).id, 'p0');
  assert.equal(readProfiles(f.storage).length, 2);
  assert.deepEqual(f.navigations, []);
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

test('editar preserva id e coordenadas, salva e fecha o formulário inline; falha não perde valores', async () => {
  const f = fixture({ view: 'view=edit' });
  await initProfilePage(f.options);
  f.nodes['birth-name'].value = 'Atualizada';
  f.event('birth-form', 'submit');
  assert.equal(readProfiles(f.storage).length, 1);
  assert.equal(activeProfile(f.storage).id, 'p0');
  assert.equal(activeProfile(f.storage).name, 'Atualizada');
  assert.equal(activeProfile(f.storage).timezone, person.timezone);
  assert.equal(f.nodes['profile-form-view'].hidden, true);
  assert.deepEqual(f.navigations, []);

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
  assert.deepEqual(f.navigations, []);
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

test('lixeira do card confirma, remove somente a pessoa ativa e mantém a lista', async () => {
  const f = fixture({ people: [person, { ...person, name: 'Segunda' }] });
  await initProfilePage(f.options);
  f.nodes['profile-list'].children[0].children[2].listeners.click();
  assert.deepEqual(readProfiles(f.storage).map(profile => profile.name), ['Segunda']);
  assert.deepEqual(f.navigations, []);
  assert.equal(f.nodes['profile-hub'].hidden, false);
});

test('lixeira na lista exclui só a pessoa indicada; cancelar preserva todos os dados', async () => {
  const f = fixture({ view: 'view=profiles', people: [person, { ...person, name: 'Segunda' }] });
  let confirmed = false, question;
  f.options.confirmRemove = message => { question = message; return confirmed; };
  await initProfilePage(f.options);
  const trash = f.nodes['profile-list'].children[1].children[2];
  assert.equal(trash.attrs['aria-label'], 'Excluir perfil de Segunda');
  trash.listeners.click();
  assert.equal(question, 'Excluir perfil de Segunda?');
  assert.equal(readProfiles(f.storage).length, 2);
  assert.deepEqual(f.navigations, []);
  confirmed = true;
  trash.listeners.click();
  assert.deepEqual(readProfiles(f.storage).map(profile => profile.id), ['p0']);
  assert.equal(activeProfile(f.storage).id, 'p0');
});

test('falha de exclusão mostra erro junto do nome e preserva o cadastro', async () => {
  const f = fixture();
  await initProfilePage(f.options);
  const before = f.storage.getItem(PROFILE_KEY);
  f.failWrites(); f.nodes['profile-list'].children[0].children[2].listeners.click();
  assert.equal(f.storage.getItem(PROFILE_KEY), before);
  assert.deepEqual(f.navigations, []);
  assert.match(f.nodes['profile-hub-status'].textContent, /Não foi possível excluir/);
});

test('primeiro acesso e sessão inválida não expõem dados de exemplo', async () => {
  const empty = fixture({ people: [] });
  await initProfilePage(empty.options);
  assert.equal(empty.nodes['profile-list'].children[0].textContent, 'Você ainda não cadastrou ninguém.');
  assert.equal(empty.nodes['new-profile'].hidden, false);
  assert.equal(empty.nodes['create-first-profile'], undefined);
  assert.equal(empty.nodes['share-profile'], undefined);
  assert.equal(empty.nodes['profile-actions'], undefined);
  const blocked = fixture({ production: true });
  await initProfilePage(blocked.options);
  assert.deepEqual(blocked.navigations, ['/']);
  assert.equal(blocked.nodes['profile-list'].children.length, 0);
  const logged = fixture({ production: true, session: { configured: true, user: { email: 'pessoa@example.com' } } });
  await initProfilePage(logged.options);
  assert.equal(logged.nodes['profile-email'], undefined);
  assert.equal(logged.nodes['account-status'], undefined);
  assert.doesNotMatch(html, /profile-account|data-auth-logout|Código-fonte/);
});

test('armazenamento inválido mantém os dados originais e informa recuperação', async () => {
  // Em qualquer visão a falha aparece no hub (o status do formulário ficaria oculto).
  const f = fixture({ raw: '{broken', view: 'view=new' });
  await initProfilePage(f.options);
  assert.match(f.nodes['profile-hub-status'].textContent, /não foram sobrescritos/);
  assert.equal(f.nodes['profile-hub'].hidden, false);
  assert.equal(f.nodes['profile-form-view'].hidden, true);
  assert.equal(f.nodes['saved-profiles'].hidden, true);
  assert.equal(f.storage.getItem(PROFILE_KEY), '{broken');
});

test('trocar perfil e voltar preservam sinastria com trânsitos; modo inesperado não vira URL', async () => {
  const f = fixture({ view: 'view=profiles&compare=1&mode=synastry-transits', people: [person, { ...person, name: 'Segunda' }] });
  await initProfilePage(f.options);
  f.nodes['profile-list'].children[1].children[0].listeners.click();
  assert.deepEqual(f.navigations, []);
  assert.equal(f.nodes['profile-back'].href, './universo.html?mode=synastry-transits');
  f.event('new-profile', 'click');
  assert.equal(f.nodes['profile-form-view'].hidden, false);
  f.event('cancel-edit', 'click');
  assert.equal(f.nodes['profile-form-view'].hidden, true);
  const invalid = fixture({ view: 'compare=1&mode=https://invalid.example' });
  await initProfilePage(invalid.options);
  assert.equal(invalid.nodes['profile-back'].href, './universo.html?mode=synastry');
});


test('editar o card inativo usa a pessoa indicada; cancelar preserva seleção e dados, salvar atualiza só ela', async () => {
  const f = fixture({ people: [person, { ...person, name: 'Segunda pessoa', birthTime: '09:52' }] });
  await initProfilePage(f.options);
  const original = f.storage.getItem(PROFILE_KEY);
  f.nodes['profile-list'].children[1].children[1].listeners.click();
  assert.equal(f.nodes['profile-form-view'].hidden, false);
  assert.equal(f.nodes['birth-name'].value, 'Segunda pessoa');
  assert.equal(f.nodes['birth-time'].value, '09:52');
  assert.equal(activeProfile(f.storage).id, 'p0');
  f.nodes['birth-name'].value = 'Rascunho'; f.event('cancel-edit', 'click');
  assert.equal(f.nodes['profile-form-view'].hidden, true);
  assert.equal(f.storage.getItem(PROFILE_KEY), original);
  f.nodes['profile-list'].children[1].children[1].listeners.click();
  assert.equal(f.nodes['birth-name'].value, 'Segunda pessoa');
  f.nodes['birth-name'].value = 'Segunda atualizada'; f.event('birth-form', 'submit');
  assert.equal(readProfiles(f.storage)[0].name, person.name);
  assert.equal(readProfiles(f.storage)[1].name, 'Segunda atualizada');
  assert.equal(activeProfile(f.storage).id, 'p1');
  assert.equal(f.nodes['profile-form-view'].hidden, true);
  assert.deepEqual(f.navigations, []);
});

function remoteFixture({ threePeople = false } = {}) {
  const f = fixture({ people: [], production: true });
  let revision = 0, pending;
  let state = { version: 1, profiles: [{ ...person, id: 'a' }, { ...person, name: 'Remota segunda', id: 'b' }, ...(threePeople ? [{ ...person, name: 'Remota terceira', id: 'c' }] : [])], activeId: 'a', partnerId: 'b' };
  let writes = 0;
  f.options.request = async (url, options = {}) => {
    if (url !== '/api/profiles') return { ok: true, json: async () => ({ configured: true, user: { email: 'qa@example.test' } }) };
    if (options.method !== 'PUT') return { ok: true, json: async () => ({ accountId: 'synthetic-account', revision, state }) };
    writes++;
    const incoming = JSON.parse(options.body);
    return new Promise(resolve => { pending = success => {
      if (!success) return resolve({ ok: false, status: 503 });
      state = incoming.state; revision++;
      resolve({ ok: true, json: async () => ({ accountId: 'synthetic-account', revision, state }) });
    }; });
  };
  return Object.assign(f, { get writes() { return writes; }, finish(success = true) { pending(success); }, writeCount: () => writes });
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('seleção remota só destaca o novo perfil após confirmar gravação e impede reentrada', async () => {
  const f = remoteFixture(); await initProfilePage(f.options);
  const select = f.nodes['profile-list'].children[1].children[0];
  select.listeners.click(); select.listeners.click();
  assert.equal(f.writeCount(), 1); assert.equal(select.disabled, true);
  assert.equal(activeProfile(f.storage).id, 'a');
  assert.equal(f.nodes['profile-list'].children[0].attrs['data-active'], 'true');
  f.finish(); await settle();
  assert.equal(activeProfile(f.storage).id, 'b');
  assert.equal(partnerProfile(f.storage).id, 'a');
  assert.equal(f.nodes['profile-list'].children[1].attrs['data-active'], 'true');
  assert.equal(f.nodes['profile-list'].children[1].children[0].disabled, false);
  assert.deepEqual(f.navigations, []);
});

test('falha de seleção remota mantém o perfil anterior e permite nova tentativa', async () => {
  const f = remoteFixture(); await initProfilePage(f.options);
  f.nodes['profile-list'].children[1].children[0].listeners.click(); f.finish(false); await settle();
  assert.equal(activeProfile(f.storage).id, 'a');
  assert.match(f.nodes['profile-hub-status'].textContent, /Não foi possível selecionar/);
  assert.equal(f.nodes['profile-list'].children[1].children[0].disabled, false);
  f.nodes['profile-list'].children[1].children[0].listeners.click(); assert.equal(f.writeCount(), 2);
  f.finish(); await settle(); assert.equal(activeProfile(f.storage).id, 'b');
});

test('edição remota aguarda salvar para fechar e ativar; falha preserva campos e não duplica gravação', async () => {
  const f = remoteFixture(); await initProfilePage(f.options);
  f.nodes['profile-list'].children[1].children[1].listeners.click();
  f.nodes['birth-name'].value = 'Segunda salva';
  f.event('birth-form', 'submit'); f.event('birth-form', 'submit'); f.event('cancel-edit', 'click');
  assert.equal(f.writeCount(), 1);
  assert.equal(f.nodes['profile-form-view'].hidden, false); assert.equal(activeProfile(f.storage).id, 'a');
  f.finish(false); await settle();
  assert.equal(f.nodes['birth-name'].value, 'Segunda salva');
  assert.equal(f.nodes['profile-form-view'].hidden, false);
  assert.match(f.nodes['profile-status'].textContent, /Não foi possível salvar/);
  f.event('birth-form', 'submit'); assert.equal(f.writeCount(), 2); f.finish(); await settle();
  assert.equal(activeProfile(f.storage).id, 'b'); assert.equal(activeProfile(f.storage).name, 'Segunda salva');
  assert.equal(readProfiles(f.storage)[0].name, person.name); assert.equal(f.nodes['profile-form-view'].hidden, true);
  assert.deepEqual(f.navigations, []);
});

test('exclusão remota falha sem remover pessoa, bloqueia reentrada e só atualiza após confirmação', async () => {
  const f = remoteFixture(); let questions = 0; f.options.confirmRemove = () => { questions++; return true; };
  await initProfilePage(f.options);
  const trash = f.nodes['profile-list'].children[1].children[2];
  trash.listeners.click(); trash.listeners.click();
  assert.equal(questions, 1); assert.equal(f.writeCount(), 1); assert.equal(readProfiles(f.storage).length, 2);
  f.finish(false); await settle();
  assert.equal(readProfiles(f.storage).length, 2); assert.match(f.nodes['profile-hub-status'].textContent, /Não foi possível excluir/);
  f.nodes['profile-list'].children[1].children[2].listeners.click(); f.finish(); await settle();
  assert.deepEqual(readProfiles(f.storage).map(profile => profile.id), ['a']);
  assert.equal(partnerProfile(f.storage), null); assert.deepEqual(f.navigations, []);
});

test('parceiro remoto aguarda confirmação e preserva modo no retorno sem navegar sozinho', async () => {
  const f = remoteFixture({ threePeople: true }); f.options.pageURL += '?compare=1&mode=synastry-transits';
  await initProfilePage(f.options);
  f.nodes['profile-partner'].value = ''; f.event('profile-partner', 'change');
  assert.equal(partnerProfile(f.storage).id, 'b');
  f.finish(false); await settle();
  assert.equal(f.nodes['profile-partner'].value, 'b'); assert.equal(partnerProfile(f.storage).id, 'b');
  f.nodes['profile-partner'].value = ''; f.event('profile-partner', 'change'); f.finish(); await settle();
  assert.equal(partnerProfile(f.storage), null);
  assert.equal(f.nodes['profile-back'].href, './universo.html?mode=synastry-transits'); assert.deepEqual(f.navigations, []);
});

test('voltar preserva modo natal/trânsitos permitido e formulário novo cancela na mesma área', async () => {
  const f = fixture({ view: 'view=new&mode=transits', people: [] }); await initProfilePage(f.options);
  assert.equal(f.nodes['profile-back'].href, './universo.html?mode=transits');
  assert.equal(f.nodes['profile-form-view'].hidden, false); f.event('cancel-edit', 'click');
  assert.equal(f.nodes['profile-form-view'].hidden, true); assert.equal(f.nodes['new-profile'].hidden, false);
  assert.deepEqual(f.navigations, []);
});


test('excluir o último perfil mantém um próximo alvo de foco no cadastro', async () => {
  const f = fixture(); await initProfilePage(f.options);
  f.nodes['profile-list'].children[0].children[2].listeners.click();
  assert.equal(readProfiles(f.storage).length, 0);
  assert.equal(f.nodes['new-profile'].focused, true);
});


test('falhas remotas devolvem foco ao controle acionador após a transição ocupada', async () => {
  for (const action of ['select', 'save', 'delete', 'partner']) {
    const f = remoteFixture({ threePeople: action === 'partner' });
    if (action === 'partner') f.options.pageURL += '?compare=1';
    await initProfilePage(f.options);
    const root = f.options.root;
    let trigger;
    if (action === 'select') {
      trigger = f.nodes['profile-list'].children[1].children[0]; trigger.focus(); trigger.listeners.click();
    } else if (action === 'save') {
      f.nodes['profile-list'].children[1].children[1].listeners.click();
      trigger = f.nodes['birth-name']; trigger.focus(); f.event('birth-form', 'submit');
    } else if (action === 'delete') {
      trigger = f.nodes['profile-list'].children[1].children[2]; trigger.focus(); trigger.listeners.click();
    } else {
      trigger = f.nodes['profile-partner']; trigger.focus(); trigger.value = ''; f.event('profile-partner', 'change');
    }
    assert.equal(root.activeElement, root.body, `${action}: o DOM perde foco ao desabilitar`);
    f.finish(false); await settle();
    assert.equal(root.activeElement, trigger, `${action}: falha recupera o controle`);
    assert.equal(trigger.disabled, false);
  }
});

const draftStore = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('cancelar ou sair exige confirmar descarte, sem perder edição quando recusado', async () => {
  const f = fixture({ view: 'view=edit' }); let confirm = false, questions = 0;
  f.options.confirmDiscard = () => { questions++; return confirm; };
  await initProfilePage(f.options);
  f.nodes['birth-name'].value = 'Rascunho';
  f.event('cancel-edit', 'click');
  assert.equal(questions, 1); assert.equal(f.nodes['profile-form-view'].hidden, false);
  let prevented = false;
  f.options.root.listeners.click({ target: { closest: () => f.nodes['profile-back'] }, preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
  assert.equal(prevented, true); assert.equal(f.nodes['birth-name'].value, 'Rascunho');
  confirm = true; f.event('cancel-edit', 'click');
  assert.equal(f.nodes['profile-form-view'].hidden, true);
  assert.equal(activeProfile(f.storage).name, person.name);
});

test('rascunho de sessão sobrevive à recarga e é apagado depois de salvar', async () => {
  const draftStorage = draftStore();
  const first = fixture({ view: 'view=edit' }); first.options.draftStorage = draftStorage;
  await initProfilePage(first.options);
  first.nodes['birth-name'].value = 'Continuar depois'; first.event('birth-form', 'input');
  assert.ok(draftStorage.getItem('know-thyself.profile-draft.v1.local'));
  const next = fixture({ view: 'view=edit' }); next.options.draftStorage = draftStorage;
  await initProfilePage(next.options);
  assert.equal(next.nodes['birth-name'].value, 'Continuar depois');
  assert.match(next.nodes['profile-status'].textContent, /Recuperamos/);
  next.event('birth-form', 'submit');
  assert.equal(activeProfile(next.storage).name, 'Continuar depois');
  assert.equal(draftStorage.getItem('know-thyself.profile-draft.v1.local'), null);
});

test('rascunho pertence à conta confirmada e outra conta não o lê nem apaga', async () => {
  const drafts = draftStore();
  drafts.setItem('know-thyself.profile-draft.v1.account-a', JSON.stringify({ owner: 'account-a', values: { name: 'Privado A', date: '17/06/1991', time: '04:23', unknown: false, place: person.place, chosen: city } }));
  const f = remoteFixture(); const request = f.options.request;
  f.options.draftStorage = drafts;
  f.options.request = async (url, options) => url === '/api/profiles' ? request(url, options) : { ok: true, json: async () => ({ configured: true, user: { email: 'b@example.test', accountId: 'account-b' } }) };
  await initProfilePage(f.options);
  assert.equal(f.nodes['profile-form-view'].hidden, true);
  assert.notEqual(f.nodes['birth-name'].value, 'Privado A');
  assert.ok(drafts.getItem('know-thyself.profile-draft.v1.account-a'));
});

test('401 ao salvar mantém os campos e prepara reentrada com rascunho da conta', async () => {
  const f = remoteFixture(); const request = f.options.request;
  const drafts = draftStore(); f.options.draftStorage = drafts;
  f.options.request = async (url, options) => options?.method === 'PUT' ? { ok: false, status: 401 } : request(url, options);
  await initProfilePage(f.options);
  f.nodes['profile-list'].children[0].children[1].listeners.click();
  f.nodes['birth-name'].value = 'Não perder'; f.event('birth-form', 'submit'); await settle();
  assert.equal(f.nodes['birth-name'].value, 'Não perder');
  assert.match(f.nodes['profile-status'].textContent, /sessão terminou/);
  assert.equal(f.nodes['profile-relogin'].hidden, false);
  assert.equal(f.storage.getItem(PROFILE_KEY), null);
  assert.equal(JSON.parse(drafts.getItem('know-thyself.profile-draft.v1.qa@example.test')).values.name, 'Não perder');
});


const cabalaDetails = { firstNames: 'Ana Clara', paternalSurname: 'Silva', maternalSurname: 'Lima', language: 'pt', order: 'maternal-first' };
const fillCabala = (f, value = cabalaDetails) => {
  for (const [id, key] of [['birth-name', 'firstNames'], ['cabala-paternal', 'paternalSurname'], ['cabala-maternal', 'maternalSurname']]) {
    f.nodes[id].value = value[key]; f.event(id, id === 'birth-name' ? 'input' : 'change');
  }
};

test('um formulário sem opção de preparação permite cadastro astral sem inferir Cabala', async () => {
  assert.doesNotMatch(html, /cabala-enabled|cabala-first-names|cabala-order|cabala-language|Para sua Cabala|Qual vem antes|Preparar árvore pessoal|prenome/i);
  for (const view of ['view=edit', 'cabala=1']) {
    const f = fixture({ view }); await initProfilePage(f.options);
    assert.equal(f.nodes['birth-name'].value, person.name);
    for (const id of ['cabala-paternal', 'cabala-maternal']) {
      assert.equal(f.nodes[id].value, ''); assert.equal(f.nodes[id].disabled, false); assert.equal(f.nodes[id].required, view === 'cabala=1');
    }
    f.event('birth-form', 'submit');
    assert.equal(activeProfile(f.storage).cabala, undefined);
    assert.equal(activeProfile(f.storage).name, person.name);
  }
});

test('criar e editar usam Nome uma vez; ambas ordens e nomes salvos ficam intactos', async () => {
  for (const order of ['paternal-first', 'maternal-first']) {
    const expected = { ...cabalaDetails, order };
    const f = fixture({ view: 'view=edit', people: [{ ...person, cabala: expected }] }); await initProfilePage(f.options);
    assert.equal(f.nodes['birth-name'].value, expected.firstNames);
    const treeBefore = computeTree(activeProfile(f.storage));
    f.event('birth-form', 'submit');
    assert.deepEqual(activeProfile(f.storage).cabala, expected);
    assert.deepEqual(computeTree(activeProfile(f.storage)), treeBefore);
    assert.equal(activeProfile(f.storage).name, person.name);
    f.nodes['profile-list'].children[0].children[1].listeners.click();
    f.nodes['birth-name'].value = 'Ana Maria'; f.event('birth-form', 'submit');
    assert.equal(activeProfile(f.storage).name, 'Ana Maria');
    assert.deepEqual(activeProfile(f.storage).cabala, { ...expected, firstNames: 'Ana Maria' });
  }
  const f = fixture({ view: 'view=new', people: [] }); await initProfilePage(f.options);
  fillCabala(f); f.nodes['birth-date'].value = '17/06/1991'; f.nodes['birth-time'].value = '04:23';
  f.nodes['birth-place'].value = person.place; f.event('birth-place', 'input'); await waitForLookup();
  f.nodes['place-list'].children[0].listeners.click(); f.event('birth-form', 'submit');
  assert.deepEqual(activeProfile(f.storage).cabala, { ...cabalaDetails, order: 'paternal-first' });
  assert.equal(activeProfile(f.storage).name, cabalaDetails.firstNames);
  assert.equal(readProfiles(f.storage).length, 1);
});

test('perfil legado não vira Cabala pelo nome completo sem conferência explícita, mesmo após recarga', async () => {
  const drafts = draftStore();
  const fresh = fixture({ view: 'view=edit' }); fresh.options.draftStorage = drafts;
  drafts.setItem('know-thyself.profile-draft.v1.local', JSON.stringify({ owner: 'local', editingId: 'p0', values: { name: person.name, date: '17/06/1991', time: '04:23', unknown: false, place: person.place, chosen: city, nameConfirmed: false, cabala: { ...cabalaDetails, firstNames: person.name, enabled: true } } }));
  await initProfilePage(fresh.options); fresh.event('birth-form', 'submit');
  assert.equal(activeProfile(fresh.storage).cabala, undefined);
  assert.match(fresh.nodes['profile-status'].textContent, /Confira o campo Nome/);
  fresh.nodes['birth-name'].value = 'Pessoa'; fresh.event('birth-name', 'input'); fresh.event('birth-form', 'submit');
  assert.deepEqual(activeProfile(fresh.storage).cabala, { ...cabalaDetails, firstNames: 'Pessoa' });
});

test('Cabala incompleta não sobrescreve perfil; rascunho recupera campos e salva uma vez', async () => {
  const drafts = draftStore(); const f = fixture({ view: 'cabala=1' }); f.options.draftStorage = drafts;
  await initProfilePage(f.options); fillCabala(f);
  f.nodes['cabala-maternal'].value = ''; f.event('birth-form', 'submit');
  assert.equal(activeProfile(f.storage).cabala, undefined);
  assert.equal(f.nodes['profile-form-view'].hidden, false);
  f.nodes['cabala-maternal'].value = 'Lima'; f.event('birth-form', 'input');
  const next = fixture(); next.options.draftStorage = drafts; await initProfilePage(next.options);
  assert.equal(next.nodes['birth-name'].value, 'Ana Clara');
  assert.equal(next.nodes['cabala-language'], undefined);
  assert.equal(next.nodes['cabala-order'], undefined);
  assert.equal(JSON.parse(drafts.getItem('know-thyself.profile-draft.v1.local')).values.cabala.order, 'paternal-first');
  next.event('birth-form', 'submit');
  assert.deepEqual(activeProfile(next.storage).cabala, { ...cabalaDetails, order: 'paternal-first' });
  assert.equal(drafts.getItem('know-thyself.profile-draft.v1.local'), null);
});

test('rascunhos antigos desativados preservam valores sem ativar Cabala silenciosamente', async () => {
  const drafts = draftStore();
  drafts.setItem('know-thyself.profile-draft.v1.local', JSON.stringify({ owner: 'local', editingId: 'p0', values: { name: person.name, date: '17/06/1991', time: '04:23', unknown: false, place: person.place, chosen: city, cabala: { ...cabalaDetails, enabled: false } } }));
  const f = fixture(); f.options.draftStorage = drafts; await initProfilePage(f.options);
  assert.equal(f.nodes['birth-name'].value, cabalaDetails.firstNames);
  assert.equal(f.nodes['cabala-paternal'].value, cabalaDetails.paternalSurname);
  f.event('birth-form', 'submit'); assert.equal(activeProfile(f.storage).cabala, undefined);
  assert.match(f.nodes['profile-status'].textContent, /Confira o campo Nome/);
  f.event('birth-name', 'input'); f.event('birth-form', 'submit');
  assert.deepEqual(activeProfile(f.storage).cabala, cabalaDetails);
});

test('apagar campos não remove Cabala existente acidentalmente; falha de gravação preserva todos', async () => {
  const f = fixture({ view: 'view=edit', people: [{ ...person, cabala: cabalaDetails }] });
  const drafts = draftStore(); f.options.draftStorage = drafts; await initProfilePage(f.options);
  const before = f.storage.getItem(PROFILE_KEY);
  for (const id of ['cabala-paternal', 'cabala-maternal']) f.nodes[id].value = '';
  f.event('birth-form', 'submit'); assert.equal(f.storage.getItem(PROFILE_KEY), before);
  fillCabala(f); f.failWrites(); f.event('birth-form', 'submit');
  assert.equal(f.storage.getItem(PROFILE_KEY), before);
  assert.equal(f.nodes['cabala-language'], undefined); assert.equal(f.nodes['cabala-order'], undefined);
  assert.equal(f.nodes['birth-name'].value, 'Ana Clara');
  assert.equal(JSON.parse(drafts.getItem('know-thyself.profile-draft.v1.local')).values.cabala.order, 'maternal-first');
});


test('rascunho histórico mantém nome de exibição pendente divergente através de duas recargas', async () => {
  for (const rename of [false, true]) {
    const drafts = draftStore();
    const displayName = 'Nome de exibição pendente';
    drafts.setItem('know-thyself.profile-draft.v1.local', JSON.stringify({ owner: 'local', editingId: 'p0', values: { name: displayName, date: '17/06/1991', time: '04:23', unknown: false, place: person.place, chosen: city, cabala: { ...cabalaDetails, enabled: true } } }));
    const first = fixture(); first.options.draftStorage = drafts; await initProfilePage(first.options);
    assert.equal(first.nodes['birth-name'].value, cabalaDetails.firstNames);
    const recovered = JSON.parse(drafts.getItem('know-thyself.profile-draft.v1.local'));
    assert.deepEqual(recovered.values.preservedDraftName, { name: displayName, firstNames: cabalaDetails.firstNames });
    const second = fixture(); second.options.draftStorage = drafts; await initProfilePage(second.options);
    assert.equal(second.nodes['birth-name'].value, cabalaDetails.firstNames);
    if (rename) { second.nodes['birth-name'].value = 'Ana Maria'; second.event('birth-name', 'input'); }
    second.event('birth-form', 'submit');
    assert.equal(activeProfile(second.storage).name, rename ? 'Ana Maria' : displayName);
    assert.deepEqual(activeProfile(second.storage).cabala, { ...cabalaDetails, firstNames: rename ? 'Ana Maria' : cabalaDetails.firstNames });
    assert.equal(drafts.getItem('know-thyself.profile-draft.v1.local'), null);
  }
});


test('rascunho histórico novo com Nome da Cabala vazio não infere a partir do nome de exibição', async () => {
  const drafts = draftStore();
  drafts.setItem('know-thyself.profile-draft.v1.local', JSON.stringify({ owner: 'local', values: { name: 'Ana Lima', date: '17/06/1991', time: '04:23', unknown: false, place: person.place, chosen: city, cabala: { ...cabalaDetails, firstNames: '', enabled: true } } }));
  const f = fixture({ people: [] }); f.options.draftStorage = drafts; await initProfilePage(f.options);
  assert.equal(f.nodes['birth-name'].value, '');
  f.event('birth-form', 'submit'); assert.equal(readProfiles(f.storage).length, 0);
  assert.deepEqual(JSON.parse(drafts.getItem('know-thyself.profile-draft.v1.local')).values.preservedDraftName, { name: 'Ana Lima', firstNames: '' });
});


test('idioma não aparece no editor; português padrão não ativa Cabala e perfil inglês mantém seu cálculo', async () => {
  const drafts = draftStore();
  const f = fixture({ people: [], view: 'view=new' }); f.options.draftStorage = drafts;
  await initProfilePage(f.options);
  assert.equal(f.nodes['cabala-language'], undefined);
  assert.equal(f.nodes['cabala-language-details'], undefined);
  assert.equal(f.nodes['cabala-language-summary'], undefined);
  assert.equal(f.nodes['cabala-paternal'].required, false);
  f.nodes['birth-name'].value = 'Ana'; f.event('birth-name', 'input'); f.event('birth-form', 'input');
  assert.equal(JSON.parse(drafts.getItem('know-thyself.profile-draft.v1.local')).values.cabala.language, 'pt');
  f.nodes['birth-date'].value = '17/06/1991'; f.nodes['birth-time'].value = '04:23';
  f.nodes['birth-place'].value = person.place; f.event('birth-place', 'input'); await waitForLookup();
  f.nodes['place-list'].children[0].listeners.click(); f.event('birth-form', 'submit');
  assert.equal(activeProfile(f.storage).cabala, undefined);
  const expected = { ...cabalaDetails, language: 'en' };
  const en = fixture({ view: 'view=edit', people: [{ ...person, cabala: expected }] }); await initProfilePage(en.options);
  en.event('birth-form', 'submit');
  assert.deepEqual(activeProfile(en.storage).cabala, expected);
});

test('novo bloco usa preferência de Ajustes e não a aplica sobre idioma já salvo', async () => {
  const f = fixture({ view: 'view=edit', settings: { cabalaLanguage: 'en' } }); await initProfilePage(f.options);
  fillCabala(f); f.event('birth-form', 'submit');
  assert.deepEqual(activeProfile(f.storage).cabala, { ...cabalaDetails, language: 'en', order: 'paternal-first' });
  const pt = fixture({ view: 'view=edit', settings: { cabalaLanguage: 'en' }, people: [{ ...person, cabala: cabalaDetails }] });
  await initProfilePage(pt.options); pt.nodes['cabala-paternal'].value = 'Souza'; pt.event('birth-form', 'submit');
  assert.deepEqual(activeProfile(pt.storage).cabala, { ...cabalaDetails, paternalSurname: 'Souza' });
});

test('rascunho com idioma vazio recebe preferência sem ativar Cabala inativa; idioma explícito é preservado', async () => {
  for (const language of ['', 'pt']) {
    const drafts = draftStore();
    drafts.setItem('know-thyself.profile-draft.v1.local', JSON.stringify({ owner: 'local', editingId: 'p0', values: { name: 'Ana', date: '17/06/1991', time: '04:23', unknown: false, place: person.place, chosen: city, cabala: { ...cabalaDetails, language, enabled: false } } }));
    const f = fixture({ settings: { cabalaLanguage: 'en' } }); f.options.draftStorage = drafts; await initProfilePage(f.options);
    assert.equal(JSON.parse(drafts.getItem('know-thyself.profile-draft.v1.local')).values.cabala.language, language || 'en');
    f.event('birth-form', 'submit'); assert.equal(activeProfile(f.storage).cabala, undefined);
  }
});


test('entrada pela Cabala exige seus campos mesmo vazios e não salva cadastro apenas natal', async () => {
  const f = fixture({ people: [], view: 'cabala=1' });
  await initProfilePage(f.options);
  for (const id of ['cabala-paternal', 'cabala-maternal']) assert.equal(f.nodes[id].required, true, id);
  f.nodes['birth-name'].value = 'Alba Maria'; f.nodes['birth-date'].value = '17/06/1991'; f.nodes['birth-time'].value = '04:23';
  f.nodes['birth-place'].value = person.place; f.event('birth-place', 'input'); await waitForLookup();
  f.nodes['place-list'].children[0].listeners.click();
  f.event('birth-form', 'submit');
  assert.equal(readProfiles(f.storage).length, 0);
  assert.equal(f.nodes['profile-form-view'].hidden, false);
  fillCabala(f); f.event('birth-form', 'submit');
  assert.deepEqual(activeProfile(f.storage).cabala, { ...cabalaDetails, order: 'paternal-first' });
  const legacy = fixture({ view: 'cabala=1' }); await initProfilePage(legacy.options);
  const before = legacy.storage.getItem(PROFILE_KEY);
  legacy.event('birth-form', 'submit');
  assert.equal(legacy.storage.getItem(PROFILE_KEY), before);
  assert.equal(legacy.nodes['birth-name'].value, person.name);
});
