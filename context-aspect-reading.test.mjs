import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMapState, findBody } from './map-data.js';
import { contextAspectReading } from './natal-readings.js';
import { bodyMeanings, pairedTexts } from './aspect-context-texts.js';
import { renderMapReading } from './map-explorer.js';

const profile = { name: 'Alba fictícia', birthDate: '1991-06-17', birthTime: '04:23', timeUnknown: false, place: 'Local sintético', lat: -23.55, lon: -46.63, timezone: 'America/Sao_Paulo' };
const partner = { ...profile, name: 'Bento fictício', birthDate: '1984-11-23', birthTime: '14:10', lat: 38.72, lon: -9.14, timezone: 'Europe/Lisbon' };
const stateOf = mode => buildMapState({ profile, partner, mode, date: new Date('2026-10-24T12:00Z') });

test('cada aspecto calculado não natal seleciona funções e combinação dos próprios corpos em PT/EN', () => {
  for (const mode of ['transits', 'synastry', 'synastry-transits']) {
    const state = stateOf(mode), before = JSON.stringify(state);
    for (const aspect of [...state.aspects, state.dayAspect].filter(Boolean)) {
      const from = findBody(state, aspect.from), to = findBody(state, aspect.to);
      for (const [index, language] of ['pt-BR', 'en'].entries()) {
        const reading = contextAspectReading(aspect, state, language);
        assert.ok(reading, `${mode}:${aspect.id}`);
        const text = reading.paragraphs.join(' ');
        if (from.set === 'transit' && from.base === to.base) {
          assert.match(reading.summary, index ? /two roles/ : /dois papéis/);
          assert.doesNotMatch(reading.summary, /apoio mútuo|mutual support|shared project/);
        } else assert.equal(reading.summary, pairedTexts[[from.base, to.base].sort().join('-')][index]);
        if (reading.paragraphs.length === 4) {
          assert.ok(text.includes(bodyMeanings[from.base][index]));
          assert.ok(text.includes(bodyMeanings[to.base][index]));
        }
        assert.doesNotMatch(text, /\{\w+\}|today’s sky|: undefined|\bNaN\b/);
      }
    }
    assert.equal(JSON.stringify(state), before);
  }
  const natal = stateOf('natal');
  assert.equal(contextAspectReading(natal.aspects[0], natal), null);
  assert.equal(contextAspectReading(null, null), null);
});

test('exemplos editoriais mantêm donos e direção; inversão usa outra combinação', () => {
  // Conexões controladas para testar seleção editorial; não são benchmarks de posições.
  for (const [mode, from, to] of [['transits', 'transit-saturn', 'moon'], ['synastry', 'partner-mercury', 'mars']]) {
    const state = stateOf(mode), aspect = { id: 'editorial', from, to, kind: 'square', angle: 90, orb: .5, applying: true };
    state.aspects = [aspect]; state.dayAspect = mode === 'transits' ? aspect : null;
    const reading = contextAspectReading(aspect, state);
    assert.equal(reading.paragraphs.length, 2);
    const text = reading.paragraphs.join(' ');
    if (mode === 'synastry') {
      assert.match(text, /Mercúrio de Bento fictício/);
      assert.match(text, /Marte de Alba fictícia/);
      assert.doesNotMatch(text, /Mercúrio de Alba fictícia/);
    } else {
      assert.match(text, /Lua natal de Alba fictícia/);
      assert.match(text, /Saturno em trânsito/);
      assert.doesNotMatch(text, /sente falta/);
    }
    assert.equal(contextAspectReading({ ...aspect }, state), null, 'não reutiliza objeto de outro estado');
    const reversed = { ...aspect, from: `${mode === 'transits' ? 'transit' : 'partner'}-${to}`, to: from.split('-')[1] };
    state.aspects = [reversed]; state.dayAspect = mode === 'transits' ? reversed : null;
    assert.equal(contextAspectReading(reversed, state).paragraphs.length, 4);
  }
});

test('texto com nomes hostis é escapado na ficha e interpretação precede geometria', () => {
  const state = buildMapState({ profile, partner: { ...partner, name: '<img src=x onerror=1>' }, mode: 'synastry' });
  const html = renderMapReading({ kind: 'aspect', id: state.aspects[0].id }, state);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.ok(html.indexOf('natal-learning') < html.indexOf('Posições e geometria'));
  assert.ok(html.indexOf('Posições e geometria') < html.indexOf('map-position'));
});
