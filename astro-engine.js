// Swiss Ephemeris 2.10 em WebAssembly (AGPL): Moshier para planetas, Nó e Lilith; seas_18.se1 para Quíron e asteroides.
import { t } from './i18n.js';
import { DEFAULT_ORBS } from './profiles.js';
import SwissEph from './vendor/swisseph/swisseph.js';

const norm = x => ((x % 360) + 360) % 360;
const delta = (a, b) => ((b - a + 540) % 360) - 180; // b − a em (−180, 180]
const asset = name => new URL(`./vendor/swisseph/${name}`, import.meta.url);
const bytes = async url => url.protocol === 'file:'
  ? (await import('node:fs/promises')).readFile(url)
  : new Uint8Array(await (await fetch(url)).arrayBuffer());

const [wasm, asteroids] = await Promise.all([bytes(asset('swisseph.wasm')), bytes(asset('seas_18.se1'))]);
const swe = await SwissEph({ print() {}, printErr() {}, instantiateWasm(imports, done) { WebAssembly.instantiate(wasm, imports).then(r => done(r.instance)); return {}; } });
swe.FS.mkdir('/ephe');
swe.FS.writeFile('/ephe/seas_18.se1', asteroids);
{ const path = swe.allocateUTF8('/ephe'); swe.ccall('swe_set_ephe_path_wrap', null, ['number'], [path]); swe._free(path); }

const MOSHIER = 4, SWIEPH = 2, SPEED = 256;
const LAHIRI = 1; // zodíaco sideral: ayanamsa Lahiri, a da astrologia védica
swe.ccall('swe_set_sid_mode_wrap', null, ['number', 'number', 'number'], [LAHIRI, 0, 0]);
const buf = swe._malloc(23 * 8), err = swe._malloc(256);
const read = n => Array.from({ length: n }, (_, i) => swe.getValue(buf + i * 8, 'double'));
const julianDay = utc => utc.getTime() / 864e5 + 2440587.5;

function calc(jd, body, flags) {
  if (swe.ccall('swe_calc_ut_wrap', 'number', ['number', 'number', 'number', 'number', 'number'], [jd, body, flags, buf, err]) < 0) throw new Error(swe.UTF8ToString(err));
  return read(4);
}
function ayanamsa(jd) { // inclui nutação, como as longitudes aparentes
  swe.ccall('swe_get_ayanamsa_ex_ut_wrap', 'number', ['number', 'number', 'number', 'number'], [jd, MOSHIER, buf, err]);
  return read(1)[0];
}

// [id, nome, número Swiss Ephemeris, arquivo de asteroides?]
export const BODIES = [
  ['sun', t('Sol'), 0], ['moon', t('Lua'), 1], ['mercury', t('Mercúrio'), 2], ['venus', t('Vênus'), 3], ['mars', t('Marte'), 4],
  ['jupiter', t('Júpiter'), 5], ['saturn', t('Saturno'), 6], ['uranus', t('Urano'), 7], ['neptune', t('Netuno'), 8], ['pluto', t('Plutão'), 9],
  ['node', t('Nó Norte médio'), 10], ['lilith', t('Lilith média'), 12],
  ['chiron', t('Quíron'), 15, true], ['ceres', t('Ceres'), 17, true], ['pallas', t('Palas Atena'), 18, true], ['juno', t('Juno'), 19, true], ['vesta', t('Vesta'), 20, true]
];
const HOUSE_CODES = { placidus: 'P', equal: 'A', whole: 'W' };

function houseOf(lon, cusps) {
  for (let i = 0; i < 12; i++) {
    const span = norm(cusps[(i + 1) % 12] - cusps[i]);
    if (norm(lon - cusps[i]) < span) return i + 1;
  }
  return 12;
}

export function computeChart({ utc, lat, lon, houseSystem = 'placidus', zodiac = 'tropical' }) {
  if (!(utc instanceof Date) || !Number.isFinite(utc.getTime()) || !Number.isFinite(lat) || !Number.isFinite(lon)) throw new RangeError(t('Data ou hora inválida.'));
  const jd = julianDay(utc);
  const eps = calc(jd, -1, MOSHIER)[0]; // obliquidade verdadeira
  let system = houseSystem in HOUSE_CODES ? houseSystem : 'placidus', warning;
  if (system === 'placidus' && Math.abs(lat) >= 90 - eps) {
    system = 'equal';
    warning = t('Placidus indefinido acima de {lat}° de latitude; casas iguais usadas.', { lat: (90 - eps).toFixed(2) });
  }
  const shift = zodiac === 'sidereal' ? ayanamsa(jd) : 0;
  swe.ccall('swe_houses_wrap', 'number', ['number', 'number', 'number', 'number', 'number', 'number'], [jd, lat, lon, HOUSE_CODES[system].charCodeAt(0), buf, buf + 13 * 8]);
  const raw = read(23);
  const asc = norm(raw[13] - shift), mc = norm(raw[14] - shift);
  // Signos inteiros partem do signo do ASC já no zodíaco escolhido.
  const cusps = system === 'whole' ? Array.from({ length: 12 }, (_, i) => norm(Math.floor(asc / 30) * 30 + 30 * i)) : raw.slice(1, 13).map(c => norm(c - shift));
  const unsupported = [];
  const bodies = BODIES.flatMap(([id, name, number, file]) => {
    let position;
    try { position = calc(jd, number, (file ? SWIEPH : MOSHIER) | SPEED); }
    catch { unsupported.push(id); return []; } // asteroides fora de 1800–2400
    const longitude = norm(position[0] - shift), speed = position[3], inSign = longitude % 30;
    return [{
      id, name, longitude, sign: Math.floor(longitude / 30), degree: Math.floor(inSign),
      minute: Math.floor((inSign % 1) * 60), speed, retrograde: speed < 0, house: houseOf(longitude, cusps)
    }];
  });
  return { bodies, asc, mc, cusps, houseSystem: system, zodiac, ...(warning && { warning }), unsupported };
}

export { DEFAULT_ORBS };
const ANGLES = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };

export function computeAspects(bodiesA, bodiesB = bodiesA, orbs = DEFAULT_ORBS) {
  const same = bodiesB === bodiesA, out = [];
  bodiesA.forEach((a, i) => bodiesB.forEach((b, j) => {
    if (same && j <= i) return;
    const d = delta(a.longitude, b.longitude), separation = Math.abs(d);
    for (const [kind, angle] of Object.entries(ANGLES)) {
      const orb = Math.abs(separation - angle);
      if (kind in orbs && orb <= orbs[kind]) {
        // Aplicativo quando a separação caminha para o ângulo exato (velocidades diárias; pontos sem velocidade = 0).
        const rate = Math.sign(d) * ((b.speed || 0) - (a.speed || 0));
        out.push({ from: a.id, to: b.id, kind, angle, orb, applying: Math.sign(separation - angle) * rate < 0 });
      }
    }
  }));
  return out;
}

// Balanço por signo, um voto por ponto, no mesmo conjunto do Astro-Seek (15 pontos).
const BALANCE_POINTS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'asc', 'mc', 'node', 'lilith', 'chiron'];

export function balanceCounts(chart, points = BALANCE_POINTS) {
  const element = { Fogo: 0, Terra: 0, Ar: 0, 'Água': 0 }, quality = { Cardinal: 0, Fixa: 0, 'Mutável': 0 };
  const duality = { Masculina: 0, Feminina: 0 }, missing = [];
  for (const id of points) {
    const lon = id === 'asc' ? chart.asc : id === 'mc' ? chart.mc : chart.bodies.find(b => b.id === id)?.longitude;
    if (lon === undefined) { missing.push(id); continue; }
    const sign = Math.floor(lon / 30);
    element[Object.keys(element)[sign % 4]]++;
    quality[Object.keys(quality)[sign % 3]]++;
    duality[sign % 2 === 0 ? 'Masculina' : 'Feminina']++;
  }
  return { element, quality, duality, missing };
}
