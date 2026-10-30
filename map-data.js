import { natalPlacements, ascendant } from './sample-chart.js';
import { computeChart, computeAspects, balanceCounts, DEFAULT_ORBS } from './astro-engine.js';
import { DEFAULT_POINTS } from './profiles.js';
import { localToUtcDetailed } from './geocode.js';
import { t } from './i18n.js';

export const SIGN_NAMES = [t('Áries'), t('Touro'), t('Gêmeos'), t('Câncer'), t('Leão'), t('Virgem'), t('Libra'), t('Escorpião'), t('Sagitário'), t('Capricórnio'), t('Aquário'), t('Peixes')];
export const SIGN_GLYPHS = SIGN_NAMES.map((_, index) => String.fromCodePoint(0x2648 + index, 0xFE0E));
export const BODY_NAMES = { sun: t('Sol'), moon: t('Lua'), mercury: t('Mercúrio'), venus: t('Vênus'), earth: t('Terra'), mars: t('Marte'), jupiter: t('Júpiter'),
  saturn: t('Saturno'), uranus: t('Urano'), neptune: t('Netuno'), pluto: t('Plutão'), node: t('Nó Norte'), lilith: t('Lilith'), chiron: t('Quíron'),
  ceres: t('Ceres'), pallas: t('Palas Atena'), juno: t('Juno'), vesta: t('Vesta') };
export const BODY_GLYPHS = { sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂', jupiter: '♃', saturn: '♄', uranus: '♅',
  neptune: '♆', pluto: '♇', node: '☊', lilith: '⚸', chiron: '⚷',
  ceres: '⚳', pallas: '⚴', juno: '⚵', vesta: '⚶' };
Object.assign(BODY_NAMES, { node: t('Nó Norte médio'), lilith: t('Lilith média'), asc: t('Ascendente'), dsc: t('Descendente'), mc: t('Meio do Céu'), ic: t('Fundo do Céu') });
Object.assign(BODY_GLYPHS, { asc: 'ASC', dsc: 'DSC', mc: 'MC', ic: 'IC' });
export const MINOR_BODIES = ['chiron', 'ceres', 'pallas', 'juno', 'vesta'];
export const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
export const ASPECT_INFO = {
  conjunction: { name: t('Conjunção'), verb: t('em conjunção com'), color: '#ddc69e' },
  opposition: { name: t('Oposição'), verb: t('em oposição a'), color: '#f27d96' },
  square: { name: t('Quadratura'), verb: t('em quadratura com'), color: '#f27d96' },
  trine: { name: t('Trígono'), verb: t('em trígono com'), color: '#74a6ff' },
  sextile: { name: t('Sextil'), verb: t('em sextil com'), color: '#74a6ff' }
};

// Os quatro botões do seletor. O segundo conjunto fica fora do aro dos signos (ver solar-study).
export const MODES = [
  { id: 'natal', title: t('Mapa Astral'), label: t('Mapa natal'), transits: false, synastry: false },
  { id: 'transits', title: t('Mapa Astral com Trânsitos'), label: t('Natal com trânsitos'), transits: true, synastry: false },
  { id: 'synastry', title: t('Sinastria'), label: t('Sinastria'), transits: false, synastry: true },
  { id: 'synastry-transits', title: t('Sinastria com Trânsitos'), label: t('Sinastria com trânsitos'), transits: true, synastry: true }
];
export const modeInfo = id => MODES.find(mode => mode.id === id) || MODES[1];

const norm = value => ((value % 360) + 360) % 360;
export const formatDegree = body => `${body.degree}°${String(body.minute).padStart(2, '0')}′`;
const DAY = 864e5;
export const addDays = (date, days) => new Date(date.getTime() + days * DAY);

// Giro em arco: 1 dia a cada 15° (horário avança, anti-horário volta). Parte inteira, em direção a zero.
export const DEGREES_PER_DAY = 15;
export function rotationDays(totalDegrees, perDay = DEGREES_PER_DAY) {
  return Number.isFinite(totalDegrees) ? Math.trunc(totalDegrees / perDay) + 0 : 0;
}
export const angleDelta = (from, to) => ((to - from + 540) % 360) - 180;

export function houseOf(longitude, cusps) {
  for (let index = 0; index < 12; index++) {
    if (norm(longitude - cusps[index]) < norm(cusps[(index + 1) % 12] - cusps[index])) return index + 1;
  }
  return 12;
}

// Aspectos do mapa de exemplo (sample-chart.js), calculados pelo motor com os orbes padrão.
export const mapAspects = computeAspects(PLANETS.map(id => ({ id, longitude: natalPlacements[id].longitude })))
  .map(({ from, to, kind }) => ({ id: `${from}-${to}`, from, to, kind, color: ASPECT_INFO[kind].color }));

export function fixtureSceneData() {
  const natal = Object.fromEntries(PLANETS.map(id => [id, { longitude: natalPlacements[id].longitude, degree: natalPlacements[id].degree }]));
  return { asc: ascendant, cusps: null, natal, aspects: mapAspects, outer: [] };
}

export const emptySceneData = () => ({ asc: 0, cusps: null, natal: {}, aspects: [], outer: [] });

// Hora local de nascimento → instante UTC. Horário ambíguo usa a primeira ocorrência; inexistente avança o salto.
export function birthInstant(profile) {
  const result = localToUtcDetailed({ date: profile.birthDate, time: profile.birthTime, timezone: profile.timezone }, { resolve: 'earlier' });
  return { date: result.date || result.candidates[0], warning: result.warning };
}

export function natalChart(profile, houseSystem = 'placidus', zodiac = 'tropical') {
  if (!profile) return { error: 'no-profile', message: t('Cadastre uma pessoa para calcular o mapa.') };
  if (!Number.isFinite(profile.lat) || !Number.isFinite(profile.lon) || !profile.timezone) {
    return { error: 'no-place', message: t('Escolha a cidade de nascimento de {name} na lista de sugestões para calcular o mapa.', { name: profile.name }) };
  }
  if (profile.timeUnknown || !profile.birthTime) {
    return { error: 'no-time', message: t('Informe a hora de nascimento de {name} para calcular ascendente e casas.', { name: profile.name }) };
  }
  try {
    const { date, warning } = birthInstant(profile);
    const chart = computeChart({ utc: date, lat: profile.lat, lon: profile.lon, houseSystem, zodiac });
    return { chart, utc: date, warning: [warning, chart.warning].filter(Boolean).join(' ') || undefined };
  } catch {
    return { error: 'invalid', message: t('Não foi possível calcular o mapa de {name}. Confira data, hora e cidade.', { name: profile.name }) };
  }
}

const planetsOf = chart => chart.bodies.filter(body => PLANETS.includes(body.id));
const prefixed = (prefix, bodies) => bodies.map(body => ({ ...body, id: `${prefix}-${body.id}`, base: body.id }));

// Desvio relativo à média da roda; a categoria mais distante dá a frase de predominância.
const WHEELS = [
  ['element', t('Elemento'), { Fogo: 'fogo', Terra: 'terra', Ar: 'ar', 'Água': 'agua' }],
  ['quality', t('Qualidade'), { Cardinal: 'cardinal', Fixa: 'fixa', 'Mutável': 'mutavel' }],
  ['duality', t('Dualidade'), { Feminina: 'feminina', Masculina: 'masculina' }]
];
// Nomes das categorias são chaves da contagem do motor; só o rótulo exibido é traduzido.
const CATEGORY_LABELS = { Fogo: t('Fogo'), Terra: t('Terra'), Ar: t('Ar'), 'Água': t('Água'), Cardinal: t('Cardinal'), Fixa: t('Fixa'), 'Mutável': t('Mutável'), Feminina: t('Feminina'), Masculina: t('Masculina') };
// Frases completas por roda × (próprio, outro) × (forte, fraco): o gênero muda em português.
const PREDOMINANCE = {
  element: [[t('Seu elemento {name} é muito forte'), t('Seu elemento {name} é muito fraco')], [t('O elemento {name} é muito forte'), t('O elemento {name} é muito fraco')]],
  quality: [[t('Sua qualidade {name} é muito forte'), t('Sua qualidade {name} é muito fraca')], [t('A qualidade {name} é muito forte'), t('A qualidade {name} é muito fraca')]],
  duality: [[t('Sua polaridade {name} é muito forte'), t('Sua polaridade {name} é muito fraca')], [t('A polaridade {name} é muito forte'), t('A polaridade {name} é muito fraca')]]
};
export function balanceSummary(counts, own = true) {
  const wheels = WHEELS.map(([key, title, keys]) => {
    const categories = Object.keys(keys).map(name => ({ name: CATEGORY_LABELS[name], key: keys[name], count: counts[key][name] }));
    const total = categories.reduce((sum, item) => sum + item.count, 0);
    return { key, title, total, categories };
  });
  let strongest = null;
  wheels.forEach((wheel, index) => wheel.categories.forEach(category => {
    const expected = wheel.total / wheel.categories.length;
    const deviation = expected ? category.count / expected - 1 : 0;
    if (!strongest || Math.abs(deviation) > Math.abs(strongest.deviation)) strongest = { wheel: index, category, deviation };
  }));
  // Excesso: ≥ 1,5× a média; falta: ≤ 0,5× a média.
  const notes = wheels.flatMap(wheel => wheel.categories.flatMap(category => {
    if (!wheel.total) return [];
    const expected = wheel.total / wheel.categories.length;
    if (category.count >= expected * 1.5) return [{ key: category.key, kind: 'excess', name: category.name }];
    if (category.count <= expected * .5) return [{ key: category.key, kind: 'lack', name: category.name }];
    return [];
  }));
  const predominance = !wheels.some(wheel => wheel.total) ? t('ainda não calculado') : notes.length
    ? t(PREDOMINANCE[WHEELS[strongest.wheel][0]][own ? 0 : 1][strongest.deviation > 0 ? 0 : 1], { name: strongest.category.name })
    : t('Distribuição sem predominância acentuada');
  return { wheels, predominance, influence: influenceSentence(wheels) || predominance, notes, missing: counts.missing };
}

// Peso das influências: a categoria mais acima da média da sua roda e a mais abaixo, numa frase só.
function influenceSentence(wheels) {
  const ranked = wheels.filter(wheel => wheel.total).flatMap(wheel => wheel.categories.map(category => ({ wheel: wheel.key, name: category.name, deviation: category.count / (wheel.total / wheel.categories.length) - 1 })));
  if (!ranked.length) return '';
  ranked.sort((a, b) => b.deviation - a.deviation);
  const strong = ranked[0], weak = ranked[ranked.length - 1];
  if (strong.deviation < .5 && weak.deviation > -.5) return '';
  // Nomes não se repetem entre anéis; a frase curta cabe na faixa da gaveta fechada.
  return t('{strong} pesa mais; {weak} quase não influencia.', { strong: strong.name, weak: weak.name });
}

export function crossAspects(fromBodies, toBodies, orbs = DEFAULT_ORBS) {
  return computeAspects(fromBodies, toBodies, orbs).map(aspect => ({ ...aspect, id: `${aspect.from}~${aspect.kind}~${aspect.to}`, color: ASPECT_INFO[aspect.kind].color }));
}

// Ajustes (profiles.getSettings): casas, zodíaco, orbes automáticos/manuais e pontos/asteroides visíveis.
export function buildMapState({ profile, partner = null, mode = 'transits', date = new Date(), houseSystem = 'placidus', zodiac = 'tropical', orbMode = 'auto', orbs: manualOrbs, points = DEFAULT_POINTS }) {
  const info = modeInfo(mode);
  const orbs = orbMode === 'manual' && manualOrbs ? manualOrbs : DEFAULT_ORBS;
  const visible = body => PLANETS.includes(body.id) || Boolean({ ...DEFAULT_POINTS, ...points }[body.id]);
  // O balanço usa o mapa inteiro; o resto só vê os pontos ligados.
  const shown = chart => ({ ...chart, bodies: chart.bodies.filter(visible) });
  const natalResult = natalChart(profile, houseSystem, zodiac);
  if (natalResult.error) return { status: 'empty', mode: info, profile, reason: natalResult.error, message: natalResult.message };
  const fullNatal = natalResult.chart, natal = shown(fullNatal);
  const natalPlanets = planetsOf(natal);
  const state = { status: 'ok', mode: info, profile, partner: null, date, natal, natalUtc: natalResult.utc, warning: natalResult.warning,
    houseSystem: natal.houseSystem, zodiac, orbs, sky: null, partnerChart: null, notice: null, dayAspect: null };
  const outer = [];
  let fullSky = null;
  // Quíron e asteroides aparecem nas posições; aspectos só entre corpos com leitura (planetas, Nó, Lilith).
  const natalAspectBodies = info.id === 'natal' ? natal.bodies.filter(body => PLANETS.includes(body.id) || ['node', 'lilith'].includes(body.id)) : natalPlanets;
  let aspects = crossAspects(natalAspectBodies, natalAspectBodies, orbs);
  if (info.synastry) {
    const partnerResult = partner ? natalChart(partner, houseSystem, zodiac) : { error: 'no-partner' };
    if (partnerResult.error) {
      state.notice = partner ? partnerResult.message : t('Escolha a pessoa para comparar no perfil do topo.');
    } else {
      state.partner = partner;
      state.partnerChart = shown(partnerResult.chart);
      state.partnerWarning = partnerResult.warning;
      const bodies = prefixed('partner', planetsOf(partnerResult.chart));
      outer.push({ key: 'partner', label: partner.name, bodies });
      aspects = crossAspects(bodies, natalPlanets, orbs);
    }
  }
  if (info.transits) {
    fullSky = computeChart({ utc: date, lat: profile.lat, lon: profile.lon, houseSystem, zodiac });
    state.sky = shown(fullSky);
    const bodies = prefixed('transit', planetsOf(state.sky));
    outer.push({ key: 'transit', label: t('Trânsitos'), bodies });
    // O alvo natal fica fixo enquanto só o céu avança com a data do trânsito.
    const transitAspects = crossAspects(bodies, natalPlanets.map(body => ({ ...body, speed: 0 })), orbs);
    if (!state.partnerChart) aspects = transitAspects;
    state.dayAspect = transitAspects.reduce((best, aspect) => !best || aspect.orb < best.orb ? aspect : best, null);
  }
  state.aspects = aspects;
  state.outer = outer;
  // Rodas do céu do dia nos modos com trânsitos; do mapa natal nos outros.
  state.balance = balanceSummary(balanceCounts(fullSky || fullNatal), !state.sky);
  state.positionsChart = state.sky || natal;
  state.scene = {
    asc: natal.asc, mc: natal.mc, cusps: natal.cusps,
    natal: Object.fromEntries(natal.bodies.filter(body => PLANETS.includes(body.id) || MINOR_BODIES.includes(body.id)).map(body => [body.id, { longitude: body.longitude, degree: formatDegree(body) }])),
    aspects: info.id === 'natal' ? aspects.filter(item => PLANETS.includes(item.from) && PLANETS.includes(item.to)) : aspects,
    outer: outer.map(set => ({ key: set.key, bodies: set.bodies.map(body => ({ id: body.id, base: body.base, longitude: body.longitude, degree: formatDegree(body) })) }))
  };
  return state;
}

// Qualquer corpo do estado, natal ('sun'), trânsito ('transit-sun') ou parceiro ('partner-sun').
export function findBody(state, id) {
  if (id === 'earth') return { id: 'earth', base: 'earth', set: 'earth', name: t('Terra') };
  if (state.mode.id === 'natal' && ['asc', 'dsc', 'mc', 'ic'].includes(id)) {
    const axis = ['asc', 'dsc'].includes(id) ? 'asc' : 'mc';
    const longitude = norm(state.natal[axis] + (['dsc', 'ic'].includes(id) ? 180 : 0));
    const inSign = longitude % 30;
    return { id, base: id, set: 'natal', kind: 'angle', axis, axisSign: Math.floor(state.natal[axis] / 30), name: BODY_NAMES[id],
      longitude, sign: Math.floor(longitude / 30), degree: Math.floor(inSign), minute: Math.floor(inSign % 1 * 60) };
  }
  const [prefix, base] = id.includes('-') ? id.split('-') : ['natal', id];
  const chart = prefix === 'natal' ? state.natal : prefix === 'transit' ? state.sky : prefix === 'partner' ? state.partnerChart : null;
  const body = chart?.bodies.find(item => item.id === base);
  if (!body || !(PLANETS.includes(base) || state.mode.id === 'natal' && Object.hasOwn(DEFAULT_POINTS, base) || prefix === 'natal' && MINOR_BODIES.includes(base))) return null;
  const house = prefix === 'partner' ? body.house : houseOf(body.longitude, state.natal.cusps);
  return { ...body, id, base, set: prefix, name: BODY_NAMES[base], house };
}

export function findAspect(state, id) {
  return state.aspects?.find(aspect => aspect.id === id) || (state.dayAspect && state.dayAspect.id === id ? state.dayAspect : null);
}
