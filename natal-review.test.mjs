import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildMapState, findBody, PLANETS, balanceSummary } from './map-data.js';
import { computeAspects } from './astro-engine.js';
import { renderMapReading, selectableBodies } from './map-explorer.js';
import { natalAspectReading, natalSynthesis, natalDistribution } from './natal-readings.js';
import { escapeHTML, renderPanelBody } from './map-readings.js';
import { natalAngleTexts } from './natal-angle-texts.js';

// Perfis inventados para confrontar seleção com o resultado do motor; nenhum fixture pessoal.
const profiles = [
  ['1993-08-26', '06:19', -15.8, -47.9, 'America/Sao_Paulo'],
  ['1977-01-09', '22:31', 48.9, 2.3, 'Europe/Paris'],
  ['2012-11-18', '15:47', 70.1, 20.2, 'Europe/Oslo'],
  ['2001-04-14', '01:08', -33.9, 151.2, 'Australia/Sydney']
].map(([birthDate, birthTime, lat, lon, timezone], index) => ({
  name: `Revisão sintética ${index}`, birthDate, birthTime, lat, lon, timezone, timeUnknown: false
}));
const stateOf = (profile, houseSystem = 'placidus', mode = 'natal') => buildMapState({ profile, houseSystem, mode, date: new Date('2026-10-20T12:00:00Z') });
const signature = aspect => `${[aspect.from, aspect.to].sort().join('-')}:${aspect.kind}`;
const normalized = angle => ((angle % 360) + 360) % 360;

test('todos aspectos calculáveis dos12 corpos disponíveis chegam à seleção natal', () => {
  const omitted = [];
  for (const [index, profile] of profiles.entries()) {
    const state = stateOf(profile);
    const selected = new Set(state.aspects.map(signature));
    // Quíron e asteroides só aparecem nas posições; os 12 corpos com leitura entram nos aspectos.
    const read = state.natal.bodies.filter(body => body.id !== 'chiron');
    for (const aspect of computeAspects(read, read)) {
      if (!selected.has(signature(aspect))) omitted.push(`${index}:${signature(aspect)}`);
    }
  }
  assert.deepEqual(omitted, [], 'não excluir conexões de pontos disponíveis silenciosamente');
});

test('cada aspecto presente recebe prosa autoral específica, sem fallback genérico', () => {
  const missing = [];
  for (const [index, profile] of profiles.entries()) {
    const state = stateOf(profile);
    for (const aspect of state.aspects) {
      const authored = natalAspectReading(aspect);
      if (!authored) missing.push(`${index}:${signature(aspect)}`);
      else assert.ok(renderMapReading({ kind: 'aspect', id: aspect.id }, state).includes(escapeHTML(authored)));
    }
  }
  assert.deepEqual(missing, []);
});

test('eixos conservam polaridade factual inclusive em casasinteiras e latitude polar', () => {
  let cases = 0;
  for (const profile of profiles) for (const system of ['placidus', 'equal', 'whole']) {
    const state = stateOf(profile, system);
    assert.equal(state.status, 'ok');
    for (const [first, opposite] of [['asc', 'dsc'], ['mc', 'ic']]) {
      const a = findBody(state, first);
      const b = findBody(state, opposite);
      assert.ok(Math.abs(normalized(b.longitude - a.longitude) - 180) < 1e-8);
      assert.equal(b.sign, (a.sign + 6) % 12);
      assert.equal(a.house, undefined);
      assert.equal(b.house, undefined);
      const expected = natalAngleTexts[first][a.sign][0];
      for (const body of [a, b]) {
        assert.ok(renderMapReading({ kind: 'body', id: body.id }, state).includes(escapeHTML(expected)));
        assert.equal(body.retrograde, undefined);
      }
      cases++;
    }
  }
  assert.equal(cases, 24);
});

test('cadastros semhora não ganham nenhum corpo,ângulo ou síntese inventados', () => {
  for (const profile of profiles) for (const time of [{ timeUnknown: true }, { birthTime: '' }]) {
    const state = stateOf({ ...profile, ...time });
    assert.equal(state.status, 'empty');
    assert.equal(state.reason, 'no-time');
    assert.deepEqual(selectableBodies(state), []);
    assert.deepEqual(natalSynthesis(state), []);
    for (const id of ['sun', 'moon', 'node', 'lilith', 'asc', 'mc', 'dsc', 'ic']) assert.equal(renderMapReading({ kind: 'body', id }, state), '');
  }
});

test('cargaEN real alcança todos oscorpos, quatroângulos e condições retrógradas', () => {
  const code = `globalThis.localStorage={getItem:()=> 'en'};
    const assert=(await import('node:assert/strict')).default;
    const {buildMapState,findBody}=await import('./map-data.js');
    const {renderMapReading}=await import('./map-explorer.js');
    const {escapeHTML}=await import('./map-readings.js');
    const {natalDignityReading}=await import('./natal-readings.js');
    const dignityLabels={dom:'Domicile',exa:'Exaltation',det:'Detriment',fall:'Fall'};
    for(const body of [{id:'mercury',sign:5},{id:'mercury',sign:8},{id:'sun',sign:6}])for(const item of natalDignityReading(body))assert.equal(item.label,dignityLabels[item.kind]);
    const {natalSignTexts,natalHouseTexts,natalAngleTexts,natalRetrogradeTexts}=await import('./natal-catalog.js');
    let count=0;
    for(const profile of ${JSON.stringify(profiles)}){
      const state=buildMapState({profile,mode:'natal'});
      for(const body of state.natal.bodies.filter(body=>body.id!=='chiron')){
        const html=renderMapReading({kind:'body',id:body.id},state);
        for(const pair of [natalSignTexts[body.id][body.sign],natalHouseTexts[body.id][body.house]])assert.ok(html.includes(escapeHTML(pair[1])),body.id);
        if(body.retrograde&&natalRetrogradeTexts[body.id])assert.ok(html.includes(escapeHTML(natalRetrogradeTexts[body.id][1])),'retro '+body.id);
        for(const item of natalDignityReading(body))assert.equal(item.label,dignityLabels[item.kind],'dignity label '+body.id);
        assert.doesNotMatch(html,/>undefined<|>NaN<|\\{\\w+\\}/);count++;
      }
      for(const id of ['asc','dsc','mc','ic']){const body=findBody(state,id);assert.ok(renderMapReading({kind:'body',id},state).includes(escapeHTML(natalAngleTexts[body.axis][body.axisSign][1])));count++;}
    }console.log(count);`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: new URL('.', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '64');
});

// Horizonte e meridiano reais não coincidem com os limites de casas em todos os sistemas.
test('hemisférios seguem ASC e MC reais, sem presumir cúspides de casasinteiras/iguais', () => {
  for (const profile of profiles) for (const system of ['placidus', 'equal', 'whole']) {
    const state = stateOf(profile, system);
    const bodies = state.natal.bodies.filter(body => PLANETS.includes(body.id));
    const distribution = natalDistribution(state.natal);
    const below = bodies.filter(body => normalized(body.longitude - state.natal.asc) < 180).length;
    const east = bodies.filter(body => normalized(body.longitude - state.natal.mc) < 180).length;
    assert.equal(distribution.below, below, `${profile.name}:${system}:horizonte`);
    assert.equal(distribution.east, east, `${profile.name}:${system}:meridiano`);
  }
});

test('fallbackpolar de casas aparece na leitura, em vez de mudar osfatos silenciosamente', () => {
  const state = stateOf(profiles[2], 'placidus');
  assert.equal(state.houseSystem, 'equal');
  assert.ok(state.warning);
  const html = renderPanelBody(state);
  assert.match(html, /role="status"/);
  assert.match(html, /casas iguais/i);
});

test('distribuição dentrodoslimiares não recebe rótulo muito forte ou muito fraco', () => {
  const balance = balanceSummary({
    element: { Fogo: 4, Terra: 4, Ar: 3, 'Água': 3 },
    quality: { Cardinal: 5, Fixa: 5, 'Mutável': 4 },
    duality: { Feminina: 7, Masculina: 7 }, missing: []
  });
  assert.deepEqual(balance.notes, []);
  assert.doesNotMatch(balance.predominance, /muito (?:forte|frac[oa])/);
});
