import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMapState, findBody, SIGN_NAMES, SIGN_GLYPHS, BODY_NAMES, formatDegree } from './map-data.js';
import { renderMapReading, selectableBodies } from './map-explorer.js';
import { escapeHTML } from './map-readings.js';
import { natalSignTexts, natalHouseTexts, natalAspectTexts, natalAngleTexts, natalRetrogradeTexts } from './natal-catalog.js';
import { natalDignityReading } from './natal-readings.js';

// Cadastros inventados, sem associação a pessoas ou ao perfil da referência.
const profile = { name: 'Perfil sintético A', birthDate: '1991-06-17', birthTime: '04:23', timeUnknown: false, place: 'Local sintético A', lat: -22.9, lon: -43.2, timezone: 'America/Sao_Paulo' };
const partner = { name: 'Perfil sintético B', birthDate: '1984-12-05', birthTime: '19:41', timeUnknown: false, place: 'Local sintético B', lat: 51.5, lon: -.12, timezone: 'Europe/London' };
const day = new Date('2026-10-18T20:19:00Z');
const natal = buildMapState({ profile, mode: 'natal', date: day });

test('planet popup uses calculated sign, house, degree and authored readings with concrete dignities (L11)', () => {
  const sun = natal.natal.bodies.find(body => body.id === 'sun');
  const html = renderMapReading({ kind: 'body', id: 'sun' }, natal);
  assert.ok(html.includes(`Sol natal em ${SIGN_GLYPHS[sun.sign]} ${SIGN_NAMES[sun.sign]} e na ${sun.house}ª Casa`));
  assert.ok(html.includes(`<h3>Sol natal em ${SIGN_NAMES[sun.sign]}</h3><p>${escapeHTML(natalSignTexts.sun[sun.sign][0])}</p>`));
  assert.ok(html.includes(`<h3>Sol natal na ${sun.house}ª Casa</h3><p>${escapeHTML(natalHouseTexts.sun[sun.house][0])}</p>`));
  assert.ok(html.includes(`${SIGN_NAMES[sun.sign]} ${formatDegree(sun)}`));
  assert.match(html, /<h3 id="map-related-title">Conexões de Sol natal<\/h3>/);
  assert.match(html, /aria-expanded="true" aria-controls="map-reading-detail"/);
  assert.match(html, /data-map-action="toggle-reading"/, 'the whole header toggles (L14)');
  const saturn = natal.natal.bodies.find(body => body.id === 'saturn');
  assert.equal(saturn.retrograde, true);
  const retro = renderMapReading({ kind: 'body', id: saturn.id }, natal);
  assert.match(retro, /Retrógrado/);
  assert.ok(retro.includes(escapeHTML(natalRetrogradeTexts.saturn[0])));
  const mercury = findBody(natal, 'mercury');
  assert.equal(mercury.sign, 2, 'synthetic fixture places Mercury in Gemini');
  const dignities = natalDignityReading(mercury);
  assert.deepEqual(dignities.map(item => item.kind), ['dom']);
  const mercuryHTML = renderMapReading({ kind: 'body', id: 'mercury' }, natal);
  assert.match(mercuryHTML, /<h4>Domicílio<\/h4>/);
  assert.ok(mercuryHTML.includes(escapeHTML(dignities[0].text)));
  for (const id of ['sun', 'moon', 'node', 'lilith']) assert.doesNotMatch(renderMapReading({ kind: 'body', id }, natal), /Influência dessa posição: (forte|neutra|fraca)/);
  assert.doesNotMatch(html, /ilustrativ|sem cálculo|transcrit/);
});

test('all available natal positions and aspects select authored data', () => {
  for (const current of [profile, { ...profile, birthDate: '1991-06-18' }, partner]) {
    const state = buildMapState({ profile: current, mode: 'natal', date: day });
    // Quíron aparece nas posições, sem leitura própria; os 12 corpos com catálogo autoral recebem texto.
    assert.deepEqual(state.natal.bodies.map(body => body.id).slice(10), ['node', 'lilith', 'chiron']);
    for (const body of state.natal.bodies.filter(body => body.id !== 'chiron')) {
      const html = renderMapReading({ kind: 'body', id: body.id }, state);
      assert.ok(html.includes(escapeHTML(natalSignTexts[body.id][body.sign][0])), `${current.name}:${body.id}:sign`);
      assert.ok(html.includes(escapeHTML(natalHouseTexts[body.id][body.house][0])), `${current.name}:${body.id}:house`);
    }
    assert.ok(state.aspects.length > 0);
    for (const aspect of state.aspects) {
      const pair = natalAspectTexts[[aspect.from, aspect.to].sort().join('-')];
      const html = renderMapReading({ kind: 'aspect', id: aspect.id }, state);
      assert.ok(html.includes(escapeHTML(`${pair.core[0]} ${pair[aspect.kind][0]}`)));
      assert.ok(html.includes(`data-map-body="${aspect.from}"`));
      assert.ok(html.includes(`data-map-body="${aspect.to}"`));
    }
  }
});

test('switching while collapsed renders the new body collapsed (L13); unknown ids render nothing', () => {
  const moon = renderMapReading({ kind: 'body', id: 'moon' }, natal, false);
  assert.match(moon, /aria-expanded="false"/);
  assert.match(moon, /id="map-reading-detail" class="map-reading-detail" hidden/);
  assert.equal(renderMapReading({ kind: 'body', id: '<script>' }, natal), '');
  assert.equal(renderMapReading({ kind: 'aspect', id: 'invented' }, natal), '');
  assert.equal(renderMapReading({ kind: 'body', id: 'chiron' }, natal), '', 'no absent body receives text');
  assert.equal(renderMapReading({ kind: 'body', id: 'transit-sun' }, natal), '', 'no transit body in natal mode');
  assert.equal(renderMapReading({ kind: 'body', id: 'sun' }, { status: 'empty' }), '');
  assert.match(renderMapReading({ kind: 'body', id: 'earth' }, natal), /referência geocêntrica/);
});

test('transit and synastry bodies and aspects carry their own context', () => {
  const transits = buildMapState({ profile, mode: 'transits', date: day });
  const sun = renderMapReading({ kind: 'body', id: 'transit-sun' }, transits);
  assert.match(sun, /Sol em trânsito em ♎︎ Libra, na \d+ª Casa natal/);
  assert.match(sun, /Influência dessa posição: (forte|neutra|fraca)/, 'external contexts keep their existing labels');
  const aspect = renderMapReading({ kind: 'aspect', id: transits.dayAspect.id }, transits);
  assert.match(aspect, /Neste trânsito/);
  assert.match(aspect, /Orbe<\/dt><dd>\d+,\d\d° (aproximando|afastando)/);
  assert.match(aspect, /data-map-body="transit-/);
  assert.match(aspect, /<h3 id="map-related-title">Astros desta conexão<\/h3>/);
  assert.match(aspect, />Ver .* em trânsito<\/button>/);
  const pair = buildMapState({ profile, partner, mode: 'synastry', date: day });
  const synastry = renderMapReading({ kind: 'aspect', id: pair.aspects[0].id }, pair);
  assert.match(synastry, /Na comparação entre dois mapas/);
  assert.match(renderMapReading({ kind: 'body', id: 'partner-moon' }, pair), /Lua de Perfil sintético B em/);
  const hostile = buildMapState({ profile, partner: { ...partner, name: '<img src=x onerror=1>' }, mode: 'synastry', date: day });
  const escaped = renderMapReading({ kind: 'body', id: 'partner-moon' }, hostile);
  assert.doesNotMatch(escaped, /<img/);
  assert.match(escaped, /&lt;img/);
});

test('the menu lists twelve natal bodies, four calculated angles and Earth; other modes preserve their second ring', () => {
  const bodies = selectableBodies(natal);
  assert.equal(bodies.length, 17);
  assert.deepEqual(new Set(bodies.map(body => body.id)), new Set([...natal.natal.bodies.map(body => body.id).filter(id => id !== 'chiron'), 'earth', 'asc', 'dsc', 'mc', 'ic']));
  for (const id of ['asc', 'dsc', 'mc', 'ic']) {
    const body = findBody(natal, id);
    const html = renderMapReading({ kind: 'body', id }, natal);
    assert.ok(html.includes(`${BODY_NAMES[id]} em ${SIGN_NAMES[body.sign]}`));
    assert.ok(html.includes(escapeHTML(natalAngleTexts[body.axis][body.axisSign][0])));
    assert.ok(html.includes(`${SIGN_NAMES[body.sign]} ${formatDegree(body)}`));
    assert.doesNotMatch(html, /ª Casa|Movimento retrógrado|Influência dessa posição/);
  }
  const transits = buildMapState({ profile, mode: 'transits', date: day });
  const outer = selectableBodies(transits);
  assert.equal(outer.length, 21);
  assert.equal(outer.filter(body => body.set === 'transit').length, 10);
  assert.deepEqual(selectableBodies({ status: 'empty' }), []);
});
