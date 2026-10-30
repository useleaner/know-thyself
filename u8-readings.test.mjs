import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildMapState, findBody, SIGN_NAMES } from './map-data.js';
import * as readings from './natal-readings.js';
import * as panel from './map-readings.js';
import { renderMapReading } from './map-explorer.js';
import { natalSynthesisContext } from './natal-catalog.js';
const profiles = [
  { name: 'Alba fictícia', birthDate: '1991-06-17', birthTime: '04:23', lat: -22.9, lon: -43.2, timezone: 'America/Sao_Paulo' },
  { name: 'Bento fictício', birthDate: '1984-12-05', birthTime: '19:41', lat: 51.5, lon: -.12, timezone: 'Europe/London' }
].map(profile => ({ ...profile, place: 'Local sintético', timeUnknown: false }));
const stateOf = (profile = profiles[0], mode = 'transits', date = new Date('2026-10-23T18:00:00Z'), extra = {}) => buildMapState({ profile, partner: profiles[1], mode, date, ...extra });

test('trânsito ensina funções, signos e casas dos dois astros no resumo e na ficha', () => {
  for (const profile of profiles) for (const mode of ['transits', 'synastry-transits']) {
    const state = stateOf(profile, mode), original = JSON.stringify(state);
    const aspect = state.dayAspect, learning = readings.transitAspectLearning(aspect, state);
    assert.ok(learning);
    const text = learning.paragraphs.join(' '), html = panel.renderDayAspect(state);
    for (const id of [aspect.from, aspect.to]) {
      const body = findBody(state, id);
      for (const fact of [body.name, SIGN_NAMES[body.sign], `Casa ${body.house}`, natalSynthesisContext.functions[body.base][0], natalSynthesisContext.houses[body.house][0]]) assert.ok(text.includes(fact), fact);
    }
    for (const paragraph of learning.paragraphs) assert.ok(html.includes(panel.escapeHTML(paragraph)));
    assert.match(renderMapReading({ kind: 'body', id: 'moon' }, state), /natal-learning/);
    if (mode === 'transits') assert.match(renderMapReading({ kind: 'aspect', id: aspect.id }, state), /natal-learning/);
    assert.equal(JSON.stringify(state), original);
  }
  for (const mode of ['natal', 'synastry']) {
    const state = stateOf(profiles[0], mode);
    assert.equal(readings.transitAspectLearning(state.aspects[0], state), null);
  }
  assert.equal(readings.transitAspectLearning(null, null), null);
});

test('orbe exato não é chamado afastamento e explicação acompanha direção sem criar prazo', () => {
  const state = stateOf(), source = state.dayAspect;
  for (const [orb, applying, word] of [[0, false, 'exato'], [.5, true, 'diminuindo'], [.5, false, 'aumentando']]) {
    const aspect = { ...source, orb, applying }, current = { ...state, dayAspect: aspect, aspects: [aspect] };
    assert.ok(readings.transitAspectLearning(aspect, current).paragraphs.join(' ').includes(word));
    if (orb === 0) assert.equal(panel.orbText(aspect), '0,00° exato');
  }
  const none = stateOf(profiles[0], 'transits', undefined, { orbMode: 'manual', orbs: { conjunction: 0, opposition: 0, trine: 0, square: 0, sextile: 0 } });
  assert.equal(none.dayAspect, null);
  assert.doesNotMatch(panel.renderDayAspect(none), /NaN|undefined/);
});

test('rodas explicam conjunto real mesmo oculto; ausência real retira Quíron sem alterar total', () => {
  const regular = stateOf(), hidden = stateOf(profiles[0], 'transits', undefined, { points: { node: false, lilith: false, chiron: false } });
  assert.equal(panel.balanceScopeText(regular), panel.balanceScopeText(hidden));
  const old = stateOf(profiles[0], 'transits', new Date('1700-06-17T12:00:00Z'));
  assert.ok(old.balance.missing.includes('chiron'));
  for (const state of [regular, old]) {
    const text = panel.balanceScopeText(state);
    assert.ok(text.includes(String(state.balance.wheels[0].total)));
    assert.ok(text.includes('Ascendente'));
    assert.ok(text.includes('Meio do Céu'));
    assert.equal(text.includes('Quíron'), !state.balance.missing.includes('chiron'));
    assert.ok(panel.renderBalanceReading(state, 'element').includes(panel.escapeHTML(text)));
  }
  assert.match(panel.renderNatalSynthesis(stateOf(profiles[0], 'natal')), /distribution-scope/);
});

test('EN real traduz papéis, direção e conjunto sem placeholders pendentes', () => {
  const code = `globalThis.localStorage={getItem:()=> 'en'};const {buildMapState}=await import('./map-data.js');const {renderDayAspect,balanceScopeText,orbText}=await import('./map-readings.js');const state=buildMapState({profile:${JSON.stringify(profiles[1])},mode:'transits',date:new Date('2026-10-23T18:00Z')});const assert=(await import('node:assert/strict')).default;const html=renderDayAspect(state);assert.match(html,/fixed natal reference/);assert.match(html,/House/);assert.match(balanceScopeText(state),/Ascendant/);assert.equal(orbText({orb:0,applying:false}),'0.00° exact');assert.doesNotMatch(html,/\\{\\w+\\}|>undefined<|NaN|Casa |referência natal fixa/);`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: new URL('.', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
