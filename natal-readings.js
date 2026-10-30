import { t, locale, lang } from './i18n.js';
import { PLANETS, BODY_NAMES, SIGN_NAMES, ASPECT_INFO, findBody, findAspect } from './map-data.js';
import { bodyMeanings, pairedTexts, explicitExamples } from './aspect-context-texts.js';
import { natalLearningTexts, natalSignTexts, natalHouseTexts, natalAspectTexts, natalAngleTexts, natalRetrogradeTexts, natalDignityTexts, natalSynthesisTexts, natalSynthesisContext, natalNarrativeTexts, natalDistributionTexts } from './natal-catalog.js';
import { dignities } from './interpretations.js';
import { DEFAULT_ORBS } from './astro-engine.js';

export const natalSignReading = (id, sign) => natalSignTexts[id]?.[sign] ? t(natalSignTexts[id][sign][0]) : '';
export const natalHouseReading = (id, house) => natalHouseTexts[id]?.[house] ? t(natalHouseTexts[id][house][0]) : '';
export const natalRetrogradeReading = body => body.retrograde && natalRetrogradeTexts[body.base || body.id] ? t(natalRetrogradeTexts[body.base || body.id][0]) : '';
export function natalAspectReading(aspect) {
  const entry = natalAspectTexts[[aspect.from, aspect.to].sort().join('-')];
  return entry?.core && entry[aspect.kind] ? `${t(entry.core[0])} ${t(entry[aspect.kind][0])}` : '';
}
const learningText = (key, vars) => t(natalLearningTexts[key][0], vars);

export function contextAspectReading(aspect, state, language = lang) {
  if (state?.status !== 'ok' || !aspect || findAspect(state, aspect.id) !== aspect) return null;
  const from = findBody(state, aspect.from), to = findBody(state, aspect.to);
  const context = from?.set === 'transit' ? 'transit' : from?.set === 'partner' ? 'synastry' : null;
  const pair = pairedTexts[[from?.base, to?.base].sort().join('-')];
  const mechanism = natalLearningTexts.contextMechanisms[aspect.kind];
  if (!context || to?.set !== 'natal' || !pair || !mechanism || !bodyMeanings[from.base] || !bodyMeanings[to.base]) return null;
  const say = (text, vars) => t(text[0], vars, language);
  const vars = { fromOwner: state.partner?.name ?? '', toOwner: state.profile?.name ?? '',
    fromFunction: say(natalSynthesisContext.functions[from.base]), toFunction: say(natalSynthesisContext.functions[to.base]) };
  const fromName = t(BODY_NAMES[from.base], undefined, language), toName = t(BODY_NAMES[to.base], undefined, language);
  const fromRole = context === 'transit' ? t('{body} em trânsito', { body: fromName }, language)
    : t('{body} de {name}', { body: fromName, name: vars.fromOwner }, language);
  const toRole = context === 'transit' ? t('{body} natal', { body: toName }, language)
    : t('{body} de {name}', { body: toName, name: vars.toOwner }, language);
  const combination = context === 'transit' && from.base === to.base
    ? say(natalLearningTexts.sameBodyTransit, { body: fromName, function: vars.fromFunction }) : say(pair);
  const example = explicitExamples[`${context}:${from.base}>${to.base}:${aspect.kind}`];
  const paragraphs = example ? example.paragraphs.map(text => say(text, vars)) : [
    say(natalLearningTexts.contextRole, { role: fromRole, meaning: say(bodyMeanings[from.base]) }),
    say(natalLearningTexts.contextRole, { role: toRole, meaning: say(bodyMeanings[to.base]) }),
    combination, `${say(mechanism, vars)} ${say(context === 'transit' ? natalLearningTexts.contextTiming : natalLearningTexts.contextOwners)}`
  ];
  return { title: say(context === 'transit' ? natalLearningTexts.transitTitle : natalLearningTexts.comparisonTitle),
    detailTitle: say(natalLearningTexts.geometryTitle), paragraphs, summary: combination };
}

export function natalPositionLearning(body) {
  const id = body?.base || body?.id;
  if (body?.set !== 'natal' || !natalSynthesisContext.functions[id] ||
      !Number.isInteger(body.sign) || body.sign < 0 || body.sign > 11 ||
      !Number.isInteger(body.house) || body.house < 1 || body.house > 12) return null;
  const vars = { body: BODY_NAMES[id], function: t(natalSynthesisContext.functions[id][0]),
    sign: SIGN_NAMES[body.sign], style: t(natalSynthesisContext.signs[body.sign][0]),
    house: body.house, domain: t(natalSynthesisContext.houses[body.house][0]) };
  return { title: learningText('positionTitle'), detailTitle: learningText('detailTitle'), paragraphs: [learningText('position', vars), learningText('positionQuestion', vars)] };
}

export function natalAspectLearning(aspect, state) {
  if (state?.status !== 'ok' || state.mode?.id !== 'natal' || !aspect || aspect.from === aspect.to ||
      !state.aspects?.includes(aspect) || !natalLearningTexts.mechanisms[aspect.kind] ||
      !Number.isFinite(aspect.orb) || aspect.orb < 0 || !Number.isFinite(aspect.angle) || aspect.angle < 0 || aspect.angle > 180) return null;
  const from = findBody(state, aspect.from), to = findBody(state, aspect.to);
  if (!from || !to || from.set !== 'natal' || to.set !== 'natal' ||
      !natalSynthesisContext.functions[from.base] || !natalSynthesisContext.functions[to.base]) return null;
  const vars = { from: from.name, to: to.name, fromFunction: t(natalSynthesisContext.functions[from.base][0]),
    toFunction: t(natalSynthesisContext.functions[to.base][0]), aspect: ASPECT_INFO[aspect.kind].name,
    angle: aspect.angle, orb: aspect.orb.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
  return { title: learningText('aspectTitle'), detailTitle: learningText('detailTitle'), paragraphs: [learningText('functions', vars),
    `${learningText('geometry', vars)} ${t(natalLearningTexts.mechanisms[aspect.kind][0])}`, learningText('aspectQuestion', vars)] };
}

export function transitAspectLearning(aspect, state) {
  if (state?.status !== 'ok' || !state.mode?.transits || !aspect || typeof aspect.from !== 'string' || typeof aspect.to !== 'string' ||
      !(state.aspects?.includes(aspect) || state.dayAspect === aspect) ||
      !natalLearningTexts.mechanisms[aspect.kind] || !Number.isFinite(aspect.orb) || aspect.orb < 0 ||
      !Number.isFinite(aspect.angle) || aspect.angle < 0 || aspect.angle > 180) return null;
  const from = findBody(state, aspect.from), to = findBody(state, aspect.to);
  if (from?.set !== 'transit' || to?.set !== 'natal' ||
      ![from, to].every(body => natalSynthesisContext.functions[body.base] && natalSynthesisContext.signs[body.sign] && natalSynthesisContext.houses[body.house])) return null;
  const vars = { aspect: ASPECT_INFO[aspect.kind].name, angle: aspect.angle,
    orb: aspect.orb.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
  for (const [key, body] of [['from', from], ['to', to]]) Object.assign(vars, {
    [key]: body.name, [`${key}Function`]: t(natalSynthesisContext.functions[body.base][0]),
    [`${key}Sign`]: SIGN_NAMES[body.sign], [`${key}House`]: body.house,
    [`${key}Domain`]: t(natalSynthesisContext.houses[body.house][0])
  });
  const direction = aspect.orb === 0 ? 'exact' : aspect.applying ? 'applying' : 'separating';
  return { title: learningText('transitTitle'), detailTitle: learningText('detailTitle'), paragraphs: [learningText('transitRoles', vars),
    `${learningText('geometry', vars)} ${learningText(direction)} ${t(natalLearningTexts.mechanisms[aspect.kind][0])}`] };
}

export function natalAngleReading(body) {
  const pair = natalAngleTexts[body.axis]?.[body.axisSign];
  return pair ? t(pair[0]) : '';
}

export function natalDignityReading(body) {
  const id = body.base || body.id;
  const labels = { dom: t('Domicílio'), exa: t('Exaltação'), det: t('Exílio'), fall: t('Queda') };
  return dignities(id, body.sign).map(kind => ({ kind, label: labels[kind],
    text: t(natalDignityTexts[kind][0], { function: t(natalSynthesisContext.functions[id][0]), style: t(natalSynthesisContext.signs[body.sign][0]) }) }));
}

// Distribuição conta somente os planetas disponíveis, uma vez por corpo.
export function natalDistribution(chart) {
  const bodies = chart.bodies.filter(body => PLANETS.includes(body.id));
  const signs = Array.from({ length: 12 }, (_, sign) => bodies.filter(body => body.sign === sign));
  const houses = Array.from({ length: 12 }, (_, index) => bodies.filter(body => body.house === index + 1));
  const count = predicate => bodies.filter(predicate).length;
  const arc = (longitude, start) => ((longitude - start) % 360 + 360) % 360;
  const below = body => arc(body.longitude, chart.asc) < 180;
  const east = body => arc(body.longitude, chart.mc) < 180;
  return {
    total: bodies.length, signs, houses,
    below: count(below), above: count(body => !below(body)),
    east: count(east), west: count(body => !east(body)),
    quadrants: [count(body => below(body) && east(body)), count(body => below(body) && !east(body)),
      count(body => !below(body) && !east(body)), count(body => !below(body) && east(body))],
    angular: count(body => [1, 4, 7, 10].includes(body.house)),
    succedent: count(body => [2, 5, 8, 11].includes(body.house)),
    cadent: count(body => [3, 6, 9, 12].includes(body.house))
  };
}
const position = body => t('{body} em {sign}, Casa {house}', { body: BODY_NAMES[body.id], sign: SIGN_NAMES[body.sign], house: body.house });
const relation = aspect => `${BODY_NAMES[aspect.from]} ${ASPECT_INFO[aspect.kind].verb} ${BODY_NAMES[aspect.to]}`;

const say = (key, vars) => t(natalNarrativeTexts[key][0], vars);
const content = (table, key) => t(table[key][0]);
const domain = house => content(natalSynthesisContext.houses, house);
const functions = bodies => bodies.map(body => content(natalSynthesisContext.functions, body.id)).join('; ');
const positions = bodies => bodies.map(position).join('; ');
const domains = bodies => [...new Set(bodies.map(body => body.house))].map(domain).join('; ');
const aspectPart = aspect => t(natalAspectTexts[[aspect.from, aspect.to].sort().join('-')][aspect.kind][0]);

const priorityDifference = (a, b) => b.angular - a.angular || b.activity - a.activity || b.ruler - a.ruler;
const noPriority = { angular: 0, activity: 0, ruler: 0 };
function aspectExactness(aspect, orbs) {
  const limit = orbs[aspect.kind];
  if (!Number.isFinite(limit) || limit < 0 || !Number.isFinite(aspect.orb) || aspect.orb < 0 || aspect.orb > limit) return null;
  return limit === 0 ? 1 : 1 - aspect.orb / limit;
}

// Prioridade editorial própria: angularidade (15°), atividade e regências; critérios Astrotheme/Astrolog, sem replicar seus pesos.
export function natalReadingPriority(state) {
  const chart = state?.natal;
  if (state?.status !== 'ok' || state.mode?.id !== 'natal' || state.profile?.timeUnknown ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(state.profile?.birthTime || '') || !Array.isArray(chart?.bodies) ||
      ![chart.asc, chart.mc].every(angle => Number.isFinite(angle) && angle >= 0 && angle < 360)) return [];
  const bodies = chart.bodies.filter((body, index, all) => PLANETS.includes(body?.id) && all.findIndex(item => item?.id === body.id) === index &&
    Number.isFinite(body.longitude) && body.longitude >= 0 && body.longitude < 360 &&
    Number.isInteger(body.sign) && body.sign >= 0 && body.sign < 12 && Number.isInteger(body.house) && body.house >= 1 && body.house <= 12);
  const ids = new Set(bodies.map(body => body.id));
  const links = new Map(bodies.map(body => [body.id, new Map()]));
  for (const aspect of Array.isArray(state.aspects) ? state.aspects : []) {
    if (!aspect || aspect.from === aspect.to || !ids.has(aspect.from) || !ids.has(aspect.to)) continue;
    const exactness = aspectExactness(aspect, state.orbs || DEFAULT_ORBS);
    if (exactness === null) continue;
    for (const [from, to] of [[aspect.from, aspect.to], [aspect.to, aspect.from]]) {
      links.get(from).set(to, Math.max(links.get(from).get(to) || 0, exactness));
    }
  }
  const angles = [chart.asc, chart.mc, (chart.asc + 180) % 360, (chart.mc + 180) % 360];
  return bodies.map(body => {
    const distance = Math.min(...angles.map(angle => Math.abs(((body.longitude - angle + 540) % 360) - 180)));
    return { body, angular: Math.max(0, 1 - distance / 15),
      activity: [...links.get(body.id).values()].sort((a, b) => a - b).reduce((sum, value) => sum + value, 0),
      ruler: [chart.asc, chart.mc].filter(angle => dignities(body.id, Math.floor(angle / 30)).includes('dom')).length };
  }).sort(priorityDifference);
}

export function natalSynthesis(state) {
  if (state?.status !== 'ok' || state.mode.id !== 'natal') return [];
  const chart = state.natal;
  const sun = chart.bodies.find(body => body.id === 'sun');
  const moon = chart.bodies.find(body => body.id === 'moon');
  if (!sun || !moon) return [];
  const byId = Object.fromEntries(chart.bodies.map(body => [body.id, body]));
  const priority = natalReadingPriority(state);
  const priorities = new Map(priority.map(item => [item.body.id, item]));
  const sections = [];
  // Um líder sem a combinação hard+soft também precisa aparecer; empate geral conserva a abertura anterior.
  if (priority.some(item => priorityDifference(item, priority[0]) !== 0)) {
    for (const item of priority.filter(item => priorityDifference(item, priority[0]) === 0)) {
      const body = item.body;
      const paragraphs = [natalSignReading(body.id, body.sign), natalHouseReading(body.id, body.house)].filter(Boolean);
      if (paragraphs.length) sections.push({ key: `priority-${body.id}`, title: position(body), text: paragraphs.join(' '), paragraphs, bodies: [body.id] });
    }
  }
  const ascSign = Math.floor(chart.asc / 30);
  const opening = say('opening', { sun: position(sun), moon: position(moon), asc: SIGN_NAMES[ascSign] });
  const meeting = content(natalSynthesisTexts.elements, `${sun.sign % 4}-${moon.sign % 4}`);
  const styles = sun.sign === moon.sign
    ? say('sameSignStyles', { style: content(natalSynthesisContext.signs, sun.sign) })
    : say('styles', { solarStyle: content(natalSynthesisContext.signs, sun.sign), lunarStyle: content(natalSynthesisContext.signs, moon.sign) });
  const houseLink = sun.house === moon.house
    ? say('sameHouse', { house: sun.house, domain: domain(sun.house) })
    : say('distinctHouses', { sunDomain: domain(sun.house), moonDomain: domain(moon.house) });
  const luminariesParagraphs = [`${opening} ${styles}`, meeting, `${houseLink} ${learningText('synthesisBridge')}`];
  sections.push({ key: 'luminaries', title: say('identity'), text: luminariesParagraphs.join(' '), paragraphs: luminariesParagraphs, bodies: ['sun', 'moon'] });
  const arrival = sun.sign === ascSign ? say('sameAsc', { sign: SIGN_NAMES[ascSign] })
    : say('differentAsc', { sign: SIGN_NAMES[ascSign], style: content(natalSynthesisContext.signs, ascSign) });
  sections.push({ key: 'arrival', title: say('arrival'), text: arrival, angles: ['asc'] });

  const elementWheel = state.balance.wheels.find(wheel => wheel.key === 'element');
  const qualityWheel = state.balance.wheels.find(wheel => wheel.key === 'quality');
  // Só destaca máximo único acima do mesmo limiar das rodas; empates não ganham um vencedor fictício.
  const emphasis = wheel => {
    const max = Math.max(...wheel.categories.map(category => category.count));
    const best = wheel.categories.filter(category => category.count === max);
    return best.length === 1 && max >= wheel.total / wheel.categories.length * 1.5 ? best[0] : null;
  };
  const element = emphasis(elementWheel), quality = emphasis(qualityWheel);
  const elementKeys = ['fogo', 'terra', 'ar', 'agua'], qualityKeys = ['cardinal', 'fixa', 'mutavel'];
  const counts = wheel => wheel.categories.map(category => `${category.name} ${category.count}`).join(', ');
  let rhythm = element && quality ? content(natalSynthesisContext.rhythms, `${elementKeys.indexOf(element.key)}-${qualityKeys.indexOf(quality.key)}`) : say('wheelEven');
  if (element) {
    const repeating = [sun, moon].filter(body => body.sign % 4 === elementKeys.indexOf(element.key));
    rhythm += ` ${repeating.length ? say('repeats', { element: element.name, names: repeating.map(body => BODY_NAMES[body.id]).join(', ') }) : say('contrasts', { element: element.name })}`;
  }
  const rhythmParagraphs = [say('wheelFacts', { elements: counts(elementWheel), qualities: counts(qualityWheel) }), rhythm];
  sections.push({ key: 'rhythm', title: say('rhythm'), text: rhythmParagraphs.join(' '), paragraphs: rhythmParagraphs,
    counts: { element: elementWheel.categories.map(category => category.count), quality: qualityWheel.categories.map(category => category.count) } });

  const aspects = state.aspects.filter(item => byId[item.from] && byId[item.to] && natalAspectReading(item));
  const byOrb = [...aspects];
  const closeness = item => {
    const exactness = aspectExactness(item, state.orbs || DEFAULT_ORBS);
    return exactness === null ? Infinity : 1 - exactness;
  };
  const aspectPriority = item => {
    const a = priorities.get(item.from) || noPriority, b = priorities.get(item.to) || noPriority;
    return priorityDifference(a, b) <= 0 ? a : b;
  };
  byOrb.sort((a, b) => priorityDifference(aspectPriority(a), aspectPriority(b)) || closeness(a) - closeness(b));
  const candidates = chart.bodies.flatMap(body => {
    const links = byOrb.filter(item => [item.from, item.to].includes(body.id));
    const hard = links.find(item => ['square', 'opposition'].includes(item.kind));
    const soft = links.find(item => ['trine', 'sextile'].includes(item.kind));
    if (!hard || !soft) return [];
    const priority = priorities.get(body.id) || noPriority;
    return [{ body, hard, soft, priority, distance: closeness(hard) + closeness(soft) }];
  }).sort((a, b) => priorityDifference(a.priority, b.priority) || a.distance - b.distance);
  const bridge = candidates[0];
  if (bridge) {
    const { body, hard, soft } = bridge;
    const relatedIds = [...new Set([hard.from, hard.to, soft.from, soft.to])];
    const relatedBodies = relatedIds.map(id => byId[id]);
    const paragraphs = [`${learningText('connectionBridge', { body: BODY_NAMES[body.id], function: content(natalSynthesisContext.functions, body.id) })} ${say('bridgePositions', { positions: positions(relatedBodies), body: BODY_NAMES[body.id], function: content(natalSynthesisContext.functions, body.id), style: content(natalSynthesisContext.signs, body.sign), domain: domain(body.house) })}`,
      content(natalSynthesisContext.bridges, body.id), say('aspectLead', { relation: relation(hard), text: aspectPart(hard) }), say('aspectLead', { relation: relation(soft), text: aspectPart(soft) })];
    sections.push({ key: 'connections', title: say('bridge', { body: BODY_NAMES[body.id] }), text: paragraphs.join(' '), paragraphs, bodies: relatedIds, aspectIds: [hard.id, soft.id] });
  } else {
    for (const aspect of byOrb.slice(0, 2)) {
      const bodies = [byId[aspect.from], byId[aspect.to]];
      const paragraphs = [`${learningText('pairBridge', { from: BODY_NAMES[aspect.from], to: BODY_NAMES[aspect.to] })} ${say('aspectPositions', { positions: positions(bodies), domains: domains(bodies) })}`, natalAspectReading(aspect)];
      sections.push({ key: aspect.id, title: relation(aspect), text: paragraphs.join(' '), paragraphs, bodies: bodies.map(body => body.id), aspectIds: [aspect.id] });
    }
  }

  const distribution = natalDistribution(chart);
  const presentedAspects = new Set(sections.flatMap(section => section.aspectIds || []));
  const highestHouse = Math.max(...distribution.houses.map(group => group.length));
  distribution.houses.forEach((group, index) => {
    if (group.length < 3 || group.length !== highestHouse) return;
    const house = index + 1;
    const members = group.map(body => body.id);
    const internal = byOrb.find(item => !presentedAspects.has(item.id) && members.includes(item.from) && members.includes(item.to));
    const paragraphs = [say('cluster', { names: group.map(body => BODY_NAMES[body.id]).join(', '), house, count: group.length, total: distribution.total, domain: domain(house), functions: functions(group) })];
    if (internal) {
      paragraphs.push(say('clusterAspect', { relation: relation(internal), text: aspectPart(internal) }));
      presentedAspects.add(internal.id);
    }
    sections.push({ key: `house-${house}`, title: say('concentration', { house }), text: paragraphs.join(' '), paragraphs, bodies: members, aspectIds: internal ? [internal.id] : [] });
  });
  const highestSign = Math.max(...distribution.signs.map(group => group.length));
  distribution.signs.forEach((group, sign) => {
    if (group.length < 3 || group.length !== highestSign) return;
    sections.push({ key: `sign-${sign}`, title: say('sign', { sign: SIGN_NAMES[sign] }), text: say('signCluster', { names: group.map(body => BODY_NAMES[body.id]).join(', '), sign: SIGN_NAMES[sign], count: group.length, total: distribution.total, style: content(natalSynthesisContext.signs, sign), functions: functions(group), domains: domains(group) }), bodies: group.map(body => body.id) });
  });

  const planetBodies = chart.bodies.filter(body => PLANETS.includes(body.id));
  const arc = (value, start) => ((value - start) % 360 + 360) % 360;
  const membership = {
    below: body => arc(body.longitude, chart.asc) < 180, above: body => arc(body.longitude, chart.asc) >= 180,
    east: body => arc(body.longitude, chart.mc) < 180, west: body => arc(body.longitude, chart.mc) >= 180,
    angular: body => [1, 4, 7, 10].includes(body.house), succedent: body => [2, 5, 8, 11].includes(body.house), cadent: body => [3, 6, 9, 12].includes(body.house)
  };
  const emphases = Object.keys(membership).filter(key => distribution[key] >= distribution.total * (['angular', 'succedent', 'cadent'].includes(key) ? .5 : .7));
  const paragraphs = emphases.map(key => {
    const bodies = planetBodies.filter(membership[key]);
    return `${say('distribution', { count: bodies.length, total: distribution.total, area: say(key), names: bodies.map(body => BODY_NAMES[body.id]).join(', ') })} ${content(natalDistributionTexts, key)}`;
  });
  if (!paragraphs.length) paragraphs.push(say('distributionEven'));
  sections.push({ key: 'distribution', title: say('fields'), text: paragraphs.join(' '), paragraphs, counts: distribution });
  return sections;
}
