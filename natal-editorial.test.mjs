import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildMapState, findBody, PLANETS } from './map-data.js';
import { renderMapReading, selectableBodies } from './map-explorer.js';
import { renderPanelBody, renderProfileHeader, escapeHTML } from './map-readings.js';
import { natalDistribution, natalSynthesis, natalSignReading, natalHouseReading, natalAspectReading } from './natal-readings.js';
import { natalSignTexts, natalHouseTexts, natalAspectTexts, natalAngleTexts, natalTranslations, translationPairs, natalNarrativeTexts } from './natal-catalog.js';
import EN from './i18n-en.js';

const ids = [...PLANETS, 'node', 'lilith'];
const fixtures = [
  ['1991-06-17', '04:23', -22.9, -43.2, 'America/Sao_Paulo'],
  ['1984-12-05', '19:41', 51.5, -.12, 'Europe/London'],
  ['2007-09-29', '12:37', 70, 18.9, 'Europe/Oslo'],
  ['2020-02-11', '23:13', 35.7, 139.7, 'Asia/Tokyo']
].map(([birthDate, birthTime, lat, lon, timezone], index) => ({ name: `Perfil sintético ${index}`, birthDate, birthTime, lat, lon, timezone, place: 'Local de teste', timeUnknown: false }));
const stateOf = (profile, houseSystem = 'placidus', mode = 'natal') => buildMapState({ profile, houseSystem, mode, date: new Date('2026-10-20T12:00:00Z') });

// Este gate continua vermelho enquanto houver catálogo faltante; não confundir integração parcial com aceite.
test('cobertura editorial exigida: 288 posições, 24 eixos e 66 pares com cinco aspectos', () => {
  const missing = [];
  for (const id of ids) {
    for (let sign = 0; sign < 12; sign++) if (!natalSignTexts[id]?.[sign]) missing.push(`${id}:sign:${sign}`);
    for (let house = 1; house <= 12; house++) if (!natalHouseTexts[id]?.[house]) missing.push(`${id}:house:${house}`);
  }
  for (const axis of ['asc', 'mc']) for (let sign = 0; sign < 12; sign++) if (!natalAngleTexts[axis]?.[sign]) missing.push(`${axis}:${sign}`);
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const pair = [ids[a], ids[b]].sort().join('-');
    for (const kind of ['core', 'conjunction', 'opposition', 'trine', 'square', 'sextile']) if (!natalAspectTexts[pair]?.[kind]) missing.push(`${pair}:${kind}`);
  }
  assert.deepEqual(missing, []);
});

test('cada par redigido tem fonte e EN coerentes, sem chaves conflitantes', () => {
  const pairs = translationPairs({ natalSignTexts, natalHouseTexts, natalAspectTexts, natalAngleTexts });
  const seen = new Map();
  for (const [pt, en] of pairs) {
    assert.ok(pt.length > 80 && en.length > 80);
    assert.doesNotMatch(`${pt} ${en}`, /\bTODO\b|\bNaN\b/);
    if (seen.has(pt)) assert.equal(en, seen.get(pt), 'mesma fonte com traduções distintas');
    seen.set(pt, en);
    assert.equal(EN[pt], en);
  }
  assert.ok(Object.keys(natalTranslations).length >= seen.size);
});

test('seleção usa fatos atuais em quatro perfis sintéticos e três sistemas de casas', () => {
  const signatures = new Set();
  for (const profile of fixtures) for (const houseSystem of ['placidus', 'equal', 'whole']) {
    const state = stateOf(profile, houseSystem);
    assert.equal(state.status, 'ok');
    assert.equal(selectableBodies(state).length, 18);
    const html = renderPanelBody(state);
    assert.match(html, /Seu mapa em conjunto/);
    assert.doesNotMatch(html, /<p>undefined<\/p>|>NaN<|\{\w+\}/);
    // Quíron calculado também seleciona sua leitura de signo/casa.
    for (const body of state.natal.bodies) {
      const found = findBody(state, body.id);
      assert.equal(found.sign, body.sign);
      assert.equal(found.house, body.house);
      const reading = renderMapReading({ kind: 'body', id: body.id }, state);
      assert.ok(reading.includes(natalSignReading(body.id, body.sign)));
      assert.ok(reading.includes(natalHouseReading(body.id, body.house)));
      assert.doesNotMatch(reading, /<p>undefined<\/p>|>NaN<|<p><\/p>/);
    }
    for (const id of ['asc', 'dsc', 'mc', 'ic']) {
      const angle = findBody(state, id);
      assert.equal(angle.house, undefined);
      assert.equal(angle.retrograde, undefined);
      assert.ok(renderMapReading({ kind: 'body', id }, state).includes(natalAngleTexts[angle.axis][angle.axisSign][0]));
    }
    assert.ok(Math.abs(((findBody(state, 'dsc').longitude - state.natal.asc + 360) % 360) - 180) < 1e-9);
    assert.equal(findBody(state, 'chiron').base, 'chiron');
    const d = natalDistribution(state.natal);
    assert.equal(d.total, 10);
    for (const total of [d.above + d.below, d.east + d.west, d.angular + d.succedent + d.cadent, d.quadrants.reduce((a, b) => a + b, 0)]) assert.equal(total, 10);
    for (const section of natalSynthesis(state)) {
      for (const id of section.bodies || []) assert.ok(state.natal.bodies.some(body => body.id === id));
      for (const id of section.aspectIds || []) assert.ok(state.aspects.some(item => item.id === id));
    }
    signatures.add(natalSynthesis(state)[0].text);
  }
  assert.ok(signatures.size >= 4, 'não reutilizar síntese do perfil anterior');
});

test('limites: hora desconhecida, nomes hostis, contexto externo e par natal simétrico', () => {
  const missing = stateOf({ ...fixtures[0], timeUnknown: true, birthTime: '' });
  assert.equal(missing.status, 'empty');
  assert.equal(missing.reason, 'no-time');
  assert.deepEqual(natalSynthesis(missing), []);
  assert.equal(renderMapReading({ kind: 'body', id: 'sun' }, missing), '');
  const hostile = stateOf({ ...fixtures[0], name: '<img src=x onerror=1>' });
  assert.doesNotMatch(renderProfileHeader(hostile).html, /<img/);
  const transit = stateOf(fixtures[0], 'placidus', 'transits');
  assert.deepEqual(natalSynthesis(transit), []);
  assert.doesNotMatch(renderPanelBody(transit), /Seu mapa em conjunto/);
  assert.equal(natalAspectReading({ from: 'sun', to: 'moon', kind: 'square' }), natalAspectReading({ from: 'moon', to: 'sun', kind: 'square' }));
  assert.equal(natalAspectReading({ from: 'sun', to: 'chiron', kind: 'square' }), '');
});

test('síntese separa movimentos editoriais sem cortar texto, reordenar fatos ou interpretar pontuação', () => {
  for (const profile of fixtures) {
    const state = stateOf(profile);
    const sections = natalSynthesis(state);
    const html = renderPanelBody(state);
    assert.match(html, /class="panel-section natal-synthesis"/);
    assert.equal((html.match(/class="natal-synthesis-group"/g) || []).length, sections.length);
    assert.match(html, /class="natal-synthesis-group natal-synthesis-facts"/);
    assert.equal(sections.find(section => section.key === 'luminaries').paragraphs.length, 3);
    assert.equal(sections.find(section => section.key === 'rhythm').paragraphs.length, 2);
    const connections = sections.find(section => section.key === 'connections');
    if (connections) assert.equal(connections.paragraphs.length, 4);
    for (const section of sections) {
      const paragraphs = section.paragraphs || [section.text];
      assert.equal(paragraphs.join(' '), section.text);
      assert.ok(html.includes(`<h4>${escapeHTML(section.title)}</h4>${paragraphs.map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join('')}`));
    }
  }
  const hostile = stateOf(fixtures[0]);
  hostile.balance.wheels[0].categories[0].name = '<img src=x onerror=1>';
  const html = renderPanelBody(hostile);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=1&gt;/);
});

test('carga EN real seleciona tradução dos catálogos e mantém os fatos', () => {
  const script = `globalThis.localStorage={getItem:()=> 'en'};const {buildMapState}=await import('./map-data.js');const {renderMapReading}=await import('./map-explorer.js');const {natalSignTexts}=await import('./natal-catalog.js');const {renderPanelBody}=await import('./map-readings.js');const assert=(await import('node:assert/strict')).default;const state=buildMapState({profile:${JSON.stringify(fixtures[1])},mode:'natal'});const html=renderMapReading({kind:'body',id:'sun'},state);const sign=state.natal.bodies.find(b=>b.id==='sun').sign;assert.ok(html.includes(natalSignTexts.sun[sign][1]));assert.match(renderPanelBody(state),/Your chart as a whole/);assert.doesNotMatch(renderPanelBody(state),/<p>undefined<\\/p>|>NaN<|\\{\\w+\\}/);console.log('EN ok');`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: new URL('.', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /EN ok/);
});

test('síntese preserva empates, ausência de extremos e separação entre casas e signos', () => {
  const state = stateOf(fixtures[0]);
  state.natal = { ...state.natal, bodies: PLANETS.map((id, index) => ({ id, sign: index, house: index + 1, longitude: index * 30 + 15 })), asc: 0, mc: 270 };
  state.aspects = [];
  state.balance = balanceForSynthesis();
  const sections = natalSynthesis(state);
  assert.equal(sections.find(section => section.key === 'rhythm').text.endsWith(natalNarrativeTexts.wheelEven[0]), true);
  assert.equal(sections.find(section => section.key === 'distribution').text, natalNarrativeTexts.distributionEven[0]);
  assert.equal(sections.filter(section => /^(house|sign)-/.test(section.key)).length, 0);
  assert.equal(sections.filter(section => section.aspectIds?.length).length, 0);

  for (const [index, body] of state.natal.bodies.entries()) {
    body.sign = index < 3 ? 0 : index < 6 ? 1 : index;
    body.house = index < 3 ? 4 : index < 6 ? 9 : [1, 2, 3, 5][index - 6];
  }
  const clustered = natalSynthesis(state);
  assert.deepEqual(clustered.filter(section => section.key.startsWith('house-')).map(section => section.key), ['house-4', 'house-9']);
  assert.deepEqual(clustered.filter(section => section.key.startsWith('sign-')).map(section => section.key), ['sign-0', 'sign-1']);
  assert.match(clustered.find(section => section.key === 'house-4').text, /Sol, Lua, Mercúrio.*3 dos 10/);
  const luminaries = clustered.find(section => section.key === 'luminaries').text;
  assert.match(luminaries, /Com Sol e Lua no mesmo signo/);
  assert.equal(luminaries.split('responder começando e descobrindo no próprio movimento').length - 1, 1);
});

function balanceForSynthesis() {
  return { wheels: [
    { key: 'element', total: 14, categories: ['fogo', 'terra', 'ar', 'agua'].map((key, index) => ({ key, name: key, count: [4, 4, 3, 3][index] })) },
    { key: 'quality', total: 14, categories: ['cardinal', 'fixa', 'mutavel'].map((key, index) => ({ key, name: key, count: [5, 5, 4][index] })) }
  ] };
}

test('síntese não repete o mesmo aspecto entre ponte e concentração', () => {
  const state = stateOf(fixtures[0]);
  state.natal = { ...state.natal, bodies: PLANETS.map((id, index) => ({ id, sign: index, house: index < 3 ? 4 : index + 1, longitude: index * 30 + 15 })) };
  state.aspects = [
    { id: 'sun~square~moon', from: 'sun', to: 'moon', kind: 'square', orb: 1 },
    { id: 'sun~trine~mercury', from: 'sun', to: 'mercury', kind: 'trine', orb: 2 }
  ];
  const sections = natalSynthesis(state);
  const aspectIds = sections.flatMap(section => section.aspectIds || []);
  assert.equal(new Set(aspectIds).size, aspectIds.length);
  assert.deepEqual(new Set(aspectIds), new Set(state.aspects.map(aspect => aspect.id)));
  assert.ok(sections.some(section => section.key === 'house-4'));
});
