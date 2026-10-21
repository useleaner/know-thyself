import test from 'node:test';
import assert from 'node:assert/strict';
import { MODES, modeInfo, buildMapState, rotationDays, addDays, angleDelta, balanceSummary, findBody, findAspect, houseOf, natalChart, mapAspects, fixtureSceneData } from './map-data.js';
import { readFileSync } from 'node:fs';
const [albaReference] = JSON.parse(readFileSync(new URL('./fixtures/astro-seek-cases.json', import.meta.url))).cases;
const dms = text => text.split(':').map(Number).reduce((sum, part, i) => sum + part / 60 ** i, 0);

// Pessoa fictícia conferida no Astro-Seek (fixtures/astro-seek-cases.json).
const alba = { name: 'Alba', birthDate: '1991-06-17', birthTime: '04:23', timeUnknown: false, place: 'São Paulo, Brasil', lat: -23.55, lon: -46.63333333333333, timezone: 'America/Sao_Paulo' };
const partner = { name: 'Ana <b>', birthDate: '1995-07-10', birthTime: '08:15', timeUnknown: false, place: 'Porto Alegre', lat: -30.03, lon: -51.23, timezone: 'America/Sao_Paulo' };
const day = new Date('2026-10-18T20:19:00Z');

test('four modes keep the reference titles and fall back to natal with transits', () => {
  assert.deepEqual(MODES.map(mode => mode.title), ['Mapa Astral', 'Mapa Astral com Trânsitos', 'Sinastria', 'Sinastria com Trânsitos']);
  assert.deepEqual(MODES.map(mode => [mode.transits, mode.synastry]), [[false, false], [true, false], [false, true], [true, true]]);
  assert.equal(modeInfo('invented').id, 'transits');
});

test('arc rotation maps 15 degrees to one day in both directions, truncating toward zero', () => {
  assert.equal(rotationDays(0), 0);
  assert.equal(rotationDays(14.9), 0);
  assert.equal(rotationDays(15), 1);
  assert.equal(rotationDays(91), 6);
  assert.equal(rotationDays(-14), 0);
  assert.ok(Object.is(rotationDays(-14), 0), 'no negative zero day');
  assert.equal(rotationDays(-31), -2);
  assert.equal(rotationDays(720), 48, 'several turns accumulate');
  assert.equal(rotationDays(NaN), 0);
  assert.equal(angleDelta(170, -170), 20, 'crossing ±180 stays continuous');
  assert.equal(angleDelta(-170, 170), -20);
  assert.equal(addDays(day, -2).getTime(), day.getTime() - 2 * 864e5);
});

test('natal mode matches the transcribed chart: positions, houses, aspects and counts', () => {
  const state = buildMapState({ profile: alba, mode: 'natal', date: day });
  assert.equal(state.status, 'ok');
  assert.equal(state.mode.title, 'Mapa Astral');
  assert.equal(state.sky, null);
  assert.equal(state.outer.length, 0);
  for (const id of ['sun', 'moon', 'mercury', 'pluto']) {
    const body = findBody(state, id);
    const reference = albaReference.bodies.find(item => item.id === id);
    assert.equal(body.house, reference.house, id);
    assert.ok(Math.abs(body.longitude - dms(reference.longitude)) < 3 / 3600, id);
  }
  const pair = aspect => [aspect.from, aspect.to].sort().join(':') + aspect.kind;
  const calculated = new Set(state.aspects.map(pair));
  assert.equal(state.aspects.filter(aspect => !['node', 'lilith'].some(id => [aspect.from, aspect.to].includes(id))).length, 11);
  assert.ok(calculated.has('jupiter:marsconjunction'));
  assert.equal(state.scene.natal.sun.degree, '25°37′');
  assert.equal(state.scene.cusps.length, 12);
  assert.equal(state.balance.predominance, 'Seu elemento Terra é muito forte');
  assert.deepEqual(state.balance.missing, []);
  assert.deepEqual(state.balance.wheels.map(wheel => wheel.total), [15, 15, 15], 'Astro-Seek set: 10 planets, ASC, MC, Node, Lilith and Chiron');
  assert.deepEqual(state.natal.bodies.map(body => body.id).slice(10), ['node', 'lilith', 'chiron'], 'default points; asteroids off');
  assert.equal(state.dayAspect, null);
  assert.equal(state.positionsChart, state.natal);
});

test('transit mode adds the day ring, cross aspects, the tightest day aspect and sky wheels', () => {
  const state = buildMapState({ profile: alba, mode: 'transits', date: day });
  assert.equal(state.mode.title, 'Mapa Astral com Trânsitos');
  assert.equal(state.outer.length, 1);
  assert.equal(state.outer[0].key, 'transit');
  assert.equal(state.outer[0].bodies.length, 10);
  assert.ok(state.aspects.length > 0);
  assert.ok(state.aspects.every(aspect => aspect.from.startsWith('transit-') && !aspect.to.includes('-')));
  assert.equal(state.dayAspect.orb, Math.min(...state.aspects.map(aspect => aspect.orb)));
  assert.equal(state.positionsChart, state.sky);
  assert.equal(state.balance.predominance, 'A qualidade Mutável é muito fraca', 'matches capture 02 for 18/10/2026');
  const transitSun = findBody(state, 'transit-sun');
  assert.equal(transitSun.set, 'transit');
  assert.equal(transitSun.house, houseOf(transitSun.longitude, state.natal.cusps));
  assert.ok(findAspect(state, state.dayAspect.id));
  const later = buildMapState({ profile: alba, mode: 'transits', date: addDays(day, 1) });
  assert.notEqual(later.scene.outer[0].bodies[1].longitude, state.scene.outer[0].bodies[1].longitude, 'the Moon moves with the chosen day');
});

test('synastry uses the partner ring or explains the missing partner without inventing one', () => {
  const alone = buildMapState({ profile: alba, mode: 'synastry', date: day });
  assert.equal(alone.status, 'ok');
  assert.match(alone.notice, /pessoa para comparar/);
  assert.equal(alone.outer.length, 0);
  const pair = buildMapState({ profile: alba, partner, mode: 'synastry', date: day });
  assert.equal(pair.notice, null);
  assert.deepEqual(pair.outer.map(set => set.key), ['partner']);
  assert.ok(pair.aspects.every(aspect => aspect.from.startsWith('partner-')));
  assert.equal(findBody(pair, 'partner-sun').set, 'partner');
  const both = buildMapState({ profile: alba, partner, mode: 'synastry-transits', date: day });
  assert.equal(both.mode.title, 'Sinastria com Trânsitos');
  assert.deepEqual(both.outer.map(set => set.key), ['partner', 'transit']);
  assert.ok(both.aspects.every(aspect => aspect.from.startsWith('partner-')), 'lines stay synastry; the day aspect is transit × natal');
  assert.ok(both.dayAspect.from.startsWith('transit-'));
});

test('profiles without coordinates or birth time give a clear empty state', () => {
  assert.equal(buildMapState({ profile: null }).reason, 'no-profile');
  const noPlace = buildMapState({ profile: { ...alba, lat: null, lon: null, timezone: null } });
  assert.equal(noPlace.status, 'empty');
  assert.match(noPlace.message, /cidade de nascimento/);
  const noTime = buildMapState({ profile: { ...alba, timeUnknown: true, birthTime: null } });
  assert.equal(noTime.reason, 'no-time');
  assert.equal(noTime.scene, undefined, 'no invented chart');
  assert.match(natalChart({ ...alba, birthDate: 'x' }).message, /Não foi possível/);
});

test('house system choice reaches the chart and balance summary flags excess and lack', () => {
  const equal = buildMapState({ profile: alba, mode: 'natal', houseSystem: 'equal' });
  assert.equal(equal.houseSystem, 'equal');
  assert.ok(Math.abs(((equal.scene.cusps[1] - equal.scene.cusps[0]) + 360) % 360 - 30) < 1e-9);
  const summary = balanceSummary({ element: { Fogo: 5, Terra: 0, Ar: 4, 'Água': 3 }, quality: { Cardinal: 4, Fixa: 4, 'Mutável': 4 }, duality: { Masculina: 9, Feminina: 3 }, missing: [] }, false);
  assert.equal(summary.predominance, 'O elemento Terra é muito fraco');
  assert.deepEqual(summary.notes.map(note => `${note.key}:${note.kind}`), ['fogo:excess', 'terra:lack', 'feminina:lack', 'masculina:excess']);
});

test('the fixture scene keeps the transcribed default used without a profile', () => {
  const data = fixtureSceneData();
  assert.equal(data.cusps, null);
  assert.equal(data.aspects.length, 6);
  assert.equal(data.natal.neptune.degree, '0°04′');
});

test('settings: visible points, sidereal zodiac and manual orbs reach the state', () => {
  const shown = buildMapState({ profile: alba, mode: 'natal', points: { node: false, ceres: true } });
  assert.deepEqual(shown.natal.bodies.map(body => body.id).slice(10), ['lilith', 'chiron', 'ceres']);
  assert.ok(!shown.aspects.some(aspect => [aspect.from, aspect.to].includes('node')));
  assert.ok(!shown.aspects.some(aspect => [aspect.from, aspect.to].some(id => ['chiron', 'ceres'].includes(id))), 'no aspects without readings');
  assert.deepEqual(shown.balance.wheels.map(wheel => wheel.total), [15, 15, 15], 'hidden points still count like Astro-Seek');
  const sidereal = buildMapState({ profile: alba, mode: 'natal', zodiac: 'sidereal' });
  assert.equal(sidereal.zodiac, 'sidereal');
  assert.equal(findBody(sidereal, 'sun').degree, 1, 'Sun at Gemini 1° in the Lahiri zodiac (25°37′ tropical)');
  const tight = buildMapState({ profile: alba, mode: 'natal', orbMode: 'manual', orbs: { conjunction: 1, opposition: 1, trine: 1, square: 1, sextile: 1 } });
  assert.ok(tight.aspects.length < shown.aspects.length && tight.aspects.every(aspect => aspect.orb <= 1));
  const auto = buildMapState({ profile: alba, mode: 'natal', orbMode: 'auto', orbs: { conjunction: 1, opposition: 1, trine: 1, square: 1, sextile: 1 } });
  assert.equal(auto.aspects.length, buildMapState({ profile: alba, mode: 'natal' }).aspects.length);
});

test('frase de peso: categoria mais acima e mais abaixo da média', async () => {
  const { balanceSummary } = await import('./map-data.js');
  const counts = { element: { Fogo: 5, Terra: 1, Ar: 6, 'Água': 2 }, quality: { Cardinal: 5, Fixa: 7, 'Mutável': 2 }, duality: { Feminina: 3, Masculina: 11 }, missing: [] };
  assert.equal(balanceSummary(counts).influence, 'Ar pesa mais; Terra quase não influencia.');
  const even = { element: { Fogo: 3, Terra: 3, Ar: 3, 'Água': 3 }, quality: { Cardinal: 4, Fixa: 4, 'Mutável': 4 }, duality: { Feminina: 6, Masculina: 6 }, missing: [] };
  assert.equal(balanceSummary(even).influence, balanceSummary(even).predominance);
});
