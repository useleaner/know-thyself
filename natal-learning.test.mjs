import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildMapState, findBody, BODY_NAMES, SIGN_NAMES } from './map-data.js';
import { natalPositionLearning, natalAspectLearning } from './natal-readings.js';
import { natalLearningTexts, natalSynthesisContext, translationPairs } from './natal-catalog.js';
import { renderMapReading } from './map-explorer.js';
import EN from './i18n-en.js';

const profile = { id: 'natal-learning-synthetic', name: 'Pessoa fictícia', birthDate: '1991-06-17', birthTime: '04:23', timeUnknown: false, place: 'Local sintético', lat: -22.9, lon: -43.2, timezone: 'America/Sao_Paulo' };
const stateOf = (mode = 'natal') => buildMapState({ profile, partner: { ...profile, id: 'other', birthDate: '1984-12-05' }, mode, date: new Date('2026-10-20T12:00:00Z') });

test('posição ensina função, estilo e campo específicos sem reutilizar o perfil anterior', () => {
  const state = stateOf();
  const originals = JSON.stringify(state);
  for (const id of ['sun', 'moon', 'mercury', 'mars', 'node', 'lilith']) {
    const body = findBody(state, id);
    const learning = natalPositionLearning(body);
    const text = learning.paragraphs.join(' ');
    assert.ok(text.includes(BODY_NAMES[id]));
    assert.ok(text.includes(SIGN_NAMES[body.sign]));
    assert.ok(text.includes(natalSynthesisContext.functions[id][0]));
    assert.ok(text.includes(natalSynthesisContext.signs[body.sign][0]));
    assert.ok(text.includes(natalSynthesisContext.houses[body.house][0]));
    const other = natalPositionLearning({ ...body, sign: (body.sign + 1) % 12, house: body.house % 12 + 1 });
    assert.notDeepEqual(other.paragraphs, learning.paragraphs);
    const html = renderMapReading({ kind: 'body', id }, state);
    assert.match(html, /class="natal-learning"/);
    assert.match(html, /<details class="natal-interpretation"><summary>/);
    assert.doesNotMatch(html, /<details[^>]* open/);
    assert.ok(html.indexOf('natal-learning') < html.indexOf('natal-interpretation'));
  }
  assert.equal(JSON.stringify(state), originals, 'ensinar não altera fatos, prioridade ou cálculos');
});

test('posição sem campo válido ou função catalogada não recebe uma explicação inventada', () => {
  const body = findBody(stateOf(), 'sun');
  for (const patch of [{ house: undefined }, { house: 0 }, { house: 13 }, { sign: -1 }, { sign: 12 }, { sign: NaN }, { set: 'partner' }, { base: 'chiron' }, { base: 'ceres' }]) {
    assert.equal(natalPositionLearning({ ...body, ...patch }), null);
  }
  assert.equal(natalPositionLearning(null), null);
  for (const id of ['earth', 'asc', 'mc', 'chiron']) assert.doesNotMatch(renderMapReading({ kind: 'body', id }, stateOf()), /natal-learning/);
});

test('aspecto ensina duas funções, tipo concreto e orbe atual inclusive zero e inversão do par', () => {
  const state = stateOf();
  for (const aspect of state.aspects) {
    const learning = natalAspectLearning(aspect, state);
    const text = learning.paragraphs.join(' ');
    for (const id of [aspect.from, aspect.to]) assert.ok(text.includes(natalSynthesisContext.functions[id][0]));
    assert.ok(text.includes(`${aspect.angle}°`));
    assert.ok(text.includes(`${aspect.orb.toFixed(2).replace('.', ',')}°`));
    assert.ok(text.includes(natalLearningTexts.mechanisms[aspect.kind][0]));
    const inverse = { ...aspect, from: aspect.to, to: aspect.from, orb: 0 };
    const inverseLearning = natalAspectLearning(inverse, { ...state, aspects: [inverse] });
    assert.ok(inverseLearning.paragraphs.join(' ').includes('0,00°'));
    for (const id of [aspect.from, aspect.to]) assert.ok(inverseLearning.paragraphs[0].includes(natalSynthesisContext.functions[id][0]));
    assert.match(renderMapReading({ kind: 'aspect', id: aspect.id }, state), /natal-interpretation/);
  }
});

test('didática de posição segue o corpo natal; aspectos respeitam seu contexto e geometria', () => {
  const natal = stateOf();
  const aspect = natal.aspects[0];
  assert.equal(natalAspectLearning({ ...aspect }, natal), null, 'só a conexão presente pode ser explicada');
  for (const patch of [{ orb: NaN }, { orb: -1 }, { angle: undefined }, { angle: 181 }, { kind: 'invented' }, { to: aspect.from }, { to: 'missing' }]) {
    const invalid = { ...aspect, ...patch };
    assert.equal(natalAspectLearning(invalid, { ...natal, aspects: [invalid] }), null);
  }
  for (const mode of ['transits', 'synastry', 'synastry-transits']) {
    const state = stateOf(mode);
    assert.equal(natalAspectLearning(aspect, state), null);
    assert.match(renderMapReading({ kind: 'body', id: 'sun' }, state), /natal-learning/);
    for (const id of ['transit-sun', 'partner-sun']) assert.doesNotMatch(renderMapReading({ kind: 'body', id }, state), /natal-learning|natal-interpretation/);
    for (const actual of state.aspects) {
      const html = renderMapReading({ kind: 'aspect', id: actual.id }, state);
      if (actual.from.startsWith('transit-')) assert.match(html, /natal-learning/);
      else assert.match(html, /Como ler esta comparação/);
    }
  }
});

test('novos pares PT/EN estão no catálogo, preservam variáveis e selecionam idioma real', () => {
  for (const [pt, en] of translationPairs(natalLearningTexts)) {
    assert.equal(EN[pt], en);
    assert.deepEqual([...pt.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort(), [...en.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort());
  }
  const script = `globalThis.localStorage={getItem:()=> 'en'};const {buildMapState,findBody}=await import('./map-data.js');const {natalPositionLearning,natalAspectLearning}=await import('./natal-readings.js');const assert=(await import('node:assert/strict')).default;const state=buildMapState({profile:${JSON.stringify(profile)},mode:'natal'});const body=natalPositionLearning(findBody(state,'sun'));const aspect=natalAspectLearning(state.aspects[0],state);assert.equal(body.title,'How to read this placement');assert.equal(aspect.title,'How to read this connection');assert.match(body.paragraphs.join(' '),/symbolic function/);assert.match(aspect.paragraphs.join(' '),/reference angle/);assert.doesNotMatch([...body.paragraphs,...aspect.paragraphs].join(' '),/\\{\\w+\\}|NaN|undefined|Na leitura/);console.log('EN learning ok');`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: new URL('.', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /EN learning ok/);
});
