import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyTransit } from './daily-transit.js';
import { buildMapState, BODY_NAMES, ASPECT_INFO } from './map-data.js';
import { aspectText } from './interpretations.js';
import { contextAspectReading } from './natal-readings.js';
import { t, lang } from './i18n.js';

const profile = { id: 'synthetic-profile', name: 'Pessoa fictícia', birthDate: '1991-06-17', birthTime: '04:23', timeUnknown: false, place: 'São Paulo', lat: -23.55, lon: -46.63333333333333, timezone: 'America/Sao_Paulo' };
const date = new Date('2026-10-21T11:00:00Z');

test('daily payload uses the existing smallest-orb transit and the same reading in PT/EN', () => {
  const state = buildMapState({ profile, date, mode: 'transits' });
  const aspect = state.dayAspect;
  assert.equal(aspect.orb, Math.min(...state.aspects.map(item => item.orb)));
  const fromSource = BODY_NAMES[aspect.from.replace(/^transit-/, '')], toSource = BODY_NAMES[aspect.to];
  for (const language of ['pt-BR', 'en', 'pt-BR']) {
    const actual = dailyTransit(profile, {}, date, language);
    const from = t(fromSource, undefined, language), to = t(toSource, undefined, language);
    const reading = contextAspectReading(aspect, state, language).summary;
    assert.equal(actual.title, t('{aspect}: {natal} natal com {transit} em trânsito', { aspect: t(ASPECT_INFO[aspect.kind].name, undefined, language), natal: to, transit: from }, language));
    assert.ok(reading.startsWith(actual.body.replace(/…$/, '')));
    assert.ok(actual.body.length <= 180);
    assert.doesNotMatch(actual.body, /today’s sky|\{\w+\}|undefined/);
    const url = new URL(actual.url, 'https://app.example/');
    assert.equal(url.pathname, '/universo.html');
    assert.deepEqual(Object.fromEntries(url.searchParams), { mode: 'transits', profile: profile.id, at: date.toISOString(), aspect: aspect.id });
    assert.ok(!actual.url.includes(profile.name));
    assert.ok(!actual.url.includes(profile.birthDate));
    assert.equal(lang, 'pt-BR');
  }
});

test('daily payload honors explicit chart settings and does not invent an absent aspect', () => {
  const settings = { zodiac: 'sidereal', houseSystem: 'whole', orbMode: 'manual', orbs: { conjunction: 0, sextile: 0, trine: 0, square: 0, opposition: 0 } };
  assert.equal(dailyTransit(profile, settings, date), null);
  assert.equal(dailyTransit({ ...profile, lat: null }, {}, date), null);
});

test('request-specific aspect translation cannot change later browser/server readings', async () => {
  const english = aspectText('trine', 'Mars', 'Pluto', 'transit', 'en');
  const portuguese = aspectText('trine', 'Marte', 'Plutão', 'transit', 'pt-BR');
  const values = await Promise.all(Array.from({ length: 12 }, (_, i) => Promise.resolve(aspectText('trine', i % 2 ? 'Mars' : 'Marte', i % 2 ? 'Pluto' : 'Plutão', 'transit', i % 2 ? 'en' : 'pt-BR'))));
  assert.deepEqual(values, Array.from({ length: 12 }, (_, i) => i % 2 ? english : portuguese));
  assert.equal(aspectText('trine', 'Marte', 'Plutão', 'transit'), portuguese);
});


test('daily link resolves the corrected transit day aspect in both map modes', () => {
  const at = new Date('2026-10-20T18:00:00Z');
  const payload = dailyTransit(profile, {}, at);
  const id = new URL(payload.url, 'https://app.example/').searchParams.get('aspect');
  for (const mode of ['transits', 'synastry-transits']) {
    const state = buildMapState({ profile, partner: { ...profile, id: 'synthetic-partner', birthDate: '1995-07-10' }, date: at, mode });
    assert.equal(state.dayAspect.id, id);
    assert.equal(state.dayAspect.id, 'transit-mars~conjunction~mars');
    assert.equal(state.dayAspect.applying, true, 'Mars approaches its fixed natal position');
  }
});
