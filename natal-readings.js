import { t } from './i18n.js';
import { PLANETS, BODY_NAMES, SIGN_NAMES, ASPECT_INFO } from './map-data.js';
import { natalSignTexts, natalHouseTexts, natalAspectTexts, natalAngleTexts, natalRetrogradeTexts, natalDignityTexts, natalSynthesisTexts, natalSynthesisContext, natalNarrativeTexts, natalDistributionTexts } from './natal-catalog.js';
import { dignities } from './interpretations.js';
import { DEFAULT_ORBS } from './astro-engine.js';

export const natalSignReading = (id, sign) => natalSignTexts[id]?.[sign] ? t(natalSignTexts[id][sign][0]) : '';
export const natalHouseReading = (id, house) => natalHouseTexts[id]?.[house] ? t(natalHouseTexts[id][house][0]) : '';
export const natalRetrogradeReading = body => body.retrograde && natalRetrogradeTexts[body.base || body.id] ? t(natalRetrogradeTexts[body.base || body.id][0]) : '';
export function natalAspectReading(aspect) {
  const entry = natalAspectTexts[[aspect.from, aspect.to].sort().join('-')];
  return entry?.core && entry[aspect.kind] ? `${t(entry.core[0])} ${t(entry[aspect.kind][0])}` : '';
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

// Contagens planetárias usam dez corpos uma vez; não misturam os14 pontos das rodas.
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

export function natalSynthesis(state) {
  if (state?.status !== 'ok' || state.mode.id !== 'natal') return [];
  const chart = state.natal;
  const sun = chart.bodies.find(body => body.id === 'sun');
  const moon = chart.bodies.find(body => body.id === 'moon');
  if (!sun || !moon) return [];
  const byId = Object.fromEntries(chart.bodies.map(body => [body.id, body]));
  const sections = [];
  const ascSign = Math.floor(chart.asc / 30);
  const opening = say('opening', { sun: position(sun), moon: position(moon), asc: SIGN_NAMES[ascSign] });
  const meeting = content(natalSynthesisTexts.elements, `${sun.sign % 4}-${moon.sign % 4}`);
  const styles = sun.sign === moon.sign
    ? say('sameSignStyles', { style: content(natalSynthesisContext.signs, sun.sign) })
    : say('styles', { solarStyle: content(natalSynthesisContext.signs, sun.sign), lunarStyle: content(natalSynthesisContext.signs, moon.sign) });
  const houseLink = sun.house === moon.house
    ? say('sameHouse', { house: sun.house, domain: domain(sun.house) })
    : say('distinctHouses', { sunDomain: domain(sun.house), moonDomain: domain(moon.house) });
  const luminariesParagraphs = [`${opening} ${styles}`, meeting, houseLink];
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
  // Ordenação de exposição editorial, sem atribuir força pessoal ao número de conexões.
  const closeness = item => item.orb / DEFAULT_ORBS[item.kind];
  byOrb.sort((a, b) => closeness(a) - closeness(b) || a.id.localeCompare(b.id));
  const candidates = chart.bodies.flatMap(body => {
    const links = byOrb.filter(item => [item.from, item.to].includes(body.id));
    const hard = links.find(item => ['square', 'opposition'].includes(item.kind));
    const soft = links.find(item => ['trine', 'sextile'].includes(item.kind));
    if (!hard || !soft) return [];
    const priority = ['sun', 'moon'].includes(body.id) ? 0 : ['mercury', 'venus', 'mars'].includes(body.id) ? 1 : ['jupiter', 'saturn'].includes(body.id) ? 2 : 3;
    return [{ body, hard, soft, priority, distance: closeness(hard) + closeness(soft) }];
  }).sort((a, b) => a.priority - b.priority || a.distance - b.distance || a.body.id.localeCompare(b.body.id));
  const bridge = candidates[0];
  if (bridge) {
    const { body, hard, soft } = bridge;
    const relatedIds = [...new Set([hard.from, hard.to, soft.from, soft.to])];
    const relatedBodies = relatedIds.map(id => byId[id]);
    const paragraphs = [say('bridgePositions', { positions: positions(relatedBodies), body: BODY_NAMES[body.id], function: content(natalSynthesisContext.functions, body.id), style: content(natalSynthesisContext.signs, body.sign), domain: domain(body.house) }),
      content(natalSynthesisContext.bridges, body.id), say('aspectLead', { relation: relation(hard), text: aspectPart(hard) }), say('aspectLead', { relation: relation(soft), text: aspectPart(soft) })];
    sections.push({ key: 'connections', title: say('bridge', { body: BODY_NAMES[body.id] }), text: paragraphs.join(' '), paragraphs, bodies: relatedIds, aspectIds: [hard.id, soft.id] });
  } else {
    for (const aspect of byOrb.slice(0, 2)) {
      const bodies = [byId[aspect.from], byId[aspect.to]];
      const paragraphs = [say('aspectPositions', { positions: positions(bodies), domains: domains(bodies) }), natalAspectReading(aspect)];
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
