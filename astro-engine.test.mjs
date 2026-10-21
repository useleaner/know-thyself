import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeChart, computeAspects, balanceCounts, DEFAULT_ORBS } from './astro-engine.js';
import { localToUtc } from './geocode.js';

// Quatro perfis fictícios conferidos no Astro-Seek (Placidus, Nó e Lilith médios), com as coordenadas que ele exibe.
const { cases } = JSON.parse(readFileSync(new URL('./fixtures/astro-seek-cases.json', import.meta.url)));
const dms = text => text.split(':').map(Number).reduce((sum, part, i) => sum + part / 60 ** i, 0);
const sep = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const input = c => ({ utc: new Date(c.utc), lat: c.lat, lon: c.lon });
const ARCSEC = 1 / 3600;

test('Astro-Seek: posições, casas, retrogradação, ângulos e cúspides dos quatro perfis', () => {
  for (const c of cases) {
    assert.equal(localToUtc({ date: c.birthDate, time: c.birthTime, timezone: c.timezone }).toISOString(), c.utc, `${c.name} UTC`);
    const chart = computeChart(input(c));
    for (const ref of c.bodies) {
      const body = chart.bodies.find(b => b.id === ref.id);
      // Referência com segundos: o Swiss Ephemeris do app fica a poucos segundos de arco (Moshier × arquivos JPL).
      assert.ok(sep(body.longitude, dms(ref.longitude)) < 3 * ARCSEC, `${c.name} ${ref.id}: ${body.longitude} vs ${ref.longitude}`);
      assert.equal(body.house, ref.house, `${c.name} ${ref.id} casa`);
      assert.equal(body.retrograde, ref.retrograde, `${c.name} ${ref.id} retrógrado`);
    }
    // Ângulos dependem das coordenadas, que o Astro-Seek só exibe ao minuto: até 5″.
    assert.ok(sep(chart.asc, dms(c.angles.asc)) < 5 * ARCSEC, `${c.name} ASC`);
    assert.ok(sep(chart.mc, dms(c.angles.mc)) < 5 * ARCSEC, `${c.name} MC`);
    // Cúspides exportadas só com minutos (truncados): o valor verdadeiro fica em [ref, ref + 1′).
    c.cusps.forEach((ref, i) => assert.ok(sep(chart.cusps[i], dms(ref) + 1 / 120) <= 1 / 120 + ARCSEC, `${c.name} cúspide ${i + 1}`));
  }
});

test('Quíron e asteroides calculados; fora de 1800–2400 ficam em unsupported', () => {
  const chart = computeChart(input(cases[0]));
  assert.deepEqual(chart.bodies.map(b => b.id).slice(10), ['node', 'lilith', 'chiron', 'ceres', 'pallas', 'juno', 'vesta']);
  assert.deepEqual(chart.unsupported, []);
  const old = computeChart({ utc: new Date(Date.UTC(1700, 0, 1)), lat: 0, lon: 0 });
  assert.deepEqual(old.unsupported, ['chiron', 'ceres', 'pallas', 'juno', 'vesta']);
  assert.equal(old.bodies.length, 12);
});

test('casas iguais, inteiras, queda polar avisada, zodíaco sideral e entrada inválida', () => {
  const base = input(cases[0]);
  const equal = computeChart({ ...base, houseSystem: 'equal' });
  assert.ok(sep(equal.cusps[1], equal.asc + 30) < 1e-9);
  const whole = computeChart({ ...base, houseSystem: 'whole' });
  assert.deepEqual(whole.cusps.slice(0, 2), [30, 60]);
  const polar = computeChart({ ...base, lat: 70 });
  assert.equal(polar.houseSystem, 'equal');
  assert.match(polar.warning, /Placidus/);
  const tropical = computeChart(base), sidereal = computeChart({ ...base, zodiac: 'sidereal' });
  const ayanamsa = sep(tropical.bodies[0].longitude, sidereal.bodies[0].longitude);
  assert.ok(ayanamsa > 23.7 && ayanamsa < 23.8, `Lahiri 1991 ≈ 23,7°: ${ayanamsa}`);
  assert.ok(Math.abs(sep(tropical.asc, sidereal.asc) - ayanamsa) < 1e-6);
  assert.throws(() => computeChart({ ...base, utc: new Date(NaN) }), RangeError);
});

test('aspectos: orbes padrão e sinastria simétrica', () => {
  assert.deepEqual(DEFAULT_ORBS, { conjunction: 8, opposition: 8, trine: 7, square: 7, sextile: 5 });
  const a = computeChart(input(cases[0])).bodies;
  const natal = computeAspects(a);
  assert.ok(natal.find(x => [x.from, x.to].sort().join() === 'jupiter,mars').kind === 'conjunction');
  assert.ok(natal.every(x => x.from !== x.to && x.orb <= DEFAULT_ORBS[x.kind]));
  const b = computeChart(input(cases[1])).bodies;
  const ab = computeAspects(a, b).map(x => `${x.from}>${x.to}:${x.kind}:${x.orb.toFixed(6)}`).sort();
  const ba = computeAspects(b, a).map(x => `${x.to}>${x.from}:${x.kind}:${x.orb.toFixed(6)}`).sort();
  assert.ok(ab.length > 0);
  assert.deepEqual(ab, ba);
});

test('balanço soma 15 pontos, como o Astro-Seek', () => {
  const seek = balanceCounts(computeChart(input(cases[0])));
  assert.equal(Object.values(seek.element).reduce((s, n) => s + n, 0), 15);
  assert.deepEqual(seek.missing, []);
});
