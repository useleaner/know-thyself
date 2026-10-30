import { SIGN_NAMES, SIGN_GLYPHS, BODY_NAMES, BODY_GLYPHS, ASPECT_INFO, formatDegree, findBody, PLANETS } from './map-data.js';
import { aspectText, balance as balanceTexts } from './interpretations.js';
import { t, lang } from './i18n.js';
import { natalSynthesis, natalDistribution, transitAspectLearning, contextAspectReading } from './natal-readings.js';
import { natalBalanceTexts, natalBalanceEvenTexts, natalLearningTexts } from './natal-catalog.js';

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const en = lang === 'en';
const MONTHS = en ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  : ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEKDAYS = en ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const pad = value => String(value).padStart(2, '0');
export const isoDay = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const isoTime = date => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const longDate = date => en ? `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}` : `${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;

export function birthLine(profile) {
  const [year, month, day] = profile.birthDate.split('-').map(Number);
  return `${en ? `${MONTHS[month - 1]} ${day}, ${year}` : `${day} ${MONTHS[month - 1]} ${year}`}${profile.birthTime ? ` · ${profile.birthTime}` : ''}`;
}

// Cabeçalho do perfil: nome, data·hora, cidade e glifos Sol/Asc calculados.
export function renderProfileHeader(state) {
  const profile = state.profile;
  if (!profile) return { label: t('Cadastrar perfil'), html: `<span class="profile-name">${t('Cadastre uma pessoa')}</span>` };
  const sun = state.natal?.bodies.find(body => body.id === 'sun');
  const asc = state.natal ? Math.floor(state.natal.asc / 30) : null;
  const signs = sun ? `<span class="profile-signs" aria-hidden="true"><span class="profile-glyph">${SIGN_GLYPHS[sun.sign]}</span><span>Asc</span><span class="profile-glyph">${SIGN_GLYPHS[asc]}</span></span>` : '';
  const label = sun ? t('Ver perfil de {name}, Sol em {sun} e ascendente em {asc}', { name: profile.name, sun: SIGN_NAMES[sun.sign], asc: SIGN_NAMES[asc] }) : t('Ver perfil de {name}', { name: profile.name });
  const city = String(profile.place).split(',')[0].trim();
  return { label, html: `<span class="profile-name">${escapeHTML(profile.name)}</span>${signs}<span class="profile-birth" title="${escapeHTML(profile.place)}">${escapeHTML(birthLine(profile))} · ${escapeHTML(city)}</span>` };
}

// Faixa de dias centrada na data escolhida; o dia de hoje recebe "Hoje".
export function calendarDays(selected, today = new Date(), span = 15) {
  return Array.from({ length: span * 2 + 1 }, (_, index) => {
    const day = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + index - span);
    return { iso: isoDay(day), day: day.getDate(), weekday: WEEKDAYS[day.getDay()], today: isoDay(day) === isoDay(today), selected: index === span,
      label: `${WEEKDAYS[day.getDay()]}, ${longDate(day)}${isoDay(day) === isoDay(today) ? t(', hoje') : ''}` };
  });
}
export function renderCalendarDays(selected, today = new Date(), span = 15) {
  return calendarDays(selected, today, span).map(day => `<button type="button" class="calendar-day" data-day="${day.iso}" aria-label="${day.label}" tabindex="${day.selected ? 0 : -1}"${day.selected ? ' aria-current="date"' : ''}${day.today ? ' data-today="true"' : ''}><span class="calendar-weekday" aria-hidden="true">${day.weekday}</span><span class="calendar-number" aria-hidden="true">${day.day}</span>${day.today ? `<span class="calendar-today" aria-hidden="true">${t('Hoje')}</span>` : ''}</button>`).join('');
}

// Glifos etéreos: triângulos alquímicos e sinais ocultistas em traço fino, com estrelas nos vértices como constelações.
const WHEEL_SYMBOLS = {
  fire: '<circle class="halo" r="9"/><path d="M0-6.4 5.5 3.2H-5.5Z"/><circle class="dot" cx="0" cy="-6.4" r=".95"/><circle class="dot" cx="5.5" cy="3.2" r=".95"/><circle class="dot" cx="-5.5" cy="3.2" r=".95"/>',
  earth: '<circle class="halo" r="9"/><path d="M0 6.4 5.5-3.2H-5.5ZM-3.6 0H3.6"/><circle class="dot" cx="0" cy="6.4" r=".95"/><circle class="dot" cx="5.5" cy="-3.2" r=".95"/><circle class="dot" cx="-5.5" cy="-3.2" r=".95"/>',
  air: '<circle class="halo" r="9"/><path d="M0-6.4 5.5 3.2H-5.5ZM-3.6 0H3.6"/><circle class="dot" cx="0" cy="-6.4" r=".95"/><circle class="dot" cx="5.5" cy="3.2" r=".95"/><circle class="dot" cx="-5.5" cy="3.2" r=".95"/>',
  water: '<circle class="halo" r="9"/><path d="M0 6.4 5.5-3.2H-5.5Z"/><circle class="dot" cx="0" cy="6.4" r=".95"/><circle class="dot" cx="5.5" cy="-3.2" r=".95"/><circle class="dot" cx="-5.5" cy="-3.2" r=".95"/>',
  cardinal: '<circle class="halo" r="9"/><path d="M0-7 1.2-1.2 7 0 1.2 1.2 0 7-1.2 1.2-7 0-1.2-1.2Z"/><circle class="dot" cx="0" cy="0" r=".95"/>',
  fixed: '<circle class="halo" r="9"/><circle r="5.8"/><path d="M-4.1-4.1H4.1V4.1H-4.1Z"/><circle class="dot" cx="0" cy="0" r=".95"/>',
  mutable: '<circle class="halo" r="9"/><path d="M-1.4-6A6.4 6.4 0 0 0-1.4 6M1.4-6A6.4 6.4 0 0 1 1.4 6"/><circle class="dot" cx="0" cy="-2.6" r=".95"/><circle class="dot" cx="0" cy="2.6" r=".95"/>',
  feminine: '<circle class="halo" r="9"/><path d="M2.2-6A6.2 6.2 0 1 0 2.2 6 4.9 4.9 0 1 1 2.2-6Z"/><circle class="dot" cx="5.2" cy="-4.2" r=".95"/>',
  masculine: '<circle class="halo" r="9"/><circle r="4.4"/><path d="M0-7.4V-6.2M0 6.2V7.4M-7.4 0H-6.2M6.2 0H7.4"/><circle class="dot" cx="0" cy="0" r=".95"/>'
};
// Indexado pela chave interna da categoria (o nome exibido muda com o idioma).
const WHEEL_GRADIENTS = { fogo: 'fire', terra: 'earth', ar: 'air', agua: 'water', cardinal: 'cardinal', fixa: 'fixed', mutavel: 'mutable', feminina: 'feminine', masculina: 'masculine' };
// Anéis internos são desenhados menores (balance-wheels.css); a escala devolve aos glifos o mesmo tamanho na tela.
const GLYPH_SCALE = { element: .8, quality: 1.08, duality: 1.67 };
// Pontas do pentagrama (graus, horário a partir do topo; o topo é do Espírito).
const PENTAGRAM = { agua: 72, fogo: 144, terra: 216, ar: 288 };
// Gira o anel para que o meio de cada arco fique o mais perto possível da sua ponta (média circular ponderada).
export function pentagramRotation(categories, total) {
  let offset = 0, x = 0, y = 0;
  for (const category of categories) {
    const middle = (offset + category.count / 2) / total * 360;
    const error = (PENTAGRAM[category.key] - middle) * Math.PI / 180;
    x += category.count * Math.cos(error); y += category.count * Math.sin(error);
    offset += category.count;
  }
  return x || y ? Math.atan2(y, x) * 180 / Math.PI : 0;
}

export function renderWheel(wheel) {
  let offset = 0;
  const total = wheel.total || 1;
  const segments = [];
  const splits = [];
  const glyphs = [];
  const pentagram = wheel.key === 'element';
  const drawn = pentagram ? Object.keys(PENTAGRAM).map(key => wheel.categories.find(category => category.key === key)).filter(Boolean) : wheel.categories;
  const rotation = pentagram && wheel.total ? pentagramRotation(drawn, total) : 0;
  for (const category of drawn) {
    if (category.count) {
      const id = WHEEL_GRADIENTS[category.key];
      const angle = ((offset + category.count / 2) / total * 360 + rotation - 90) * Math.PI / 180;
      glyphs.push(`<g class="cat-${id}" transform="translate(${(60 + 46 * Math.cos(angle)).toFixed(1)} ${(60 + 46 * Math.sin(angle)).toFixed(1)}) scale(${GLYPH_SCALE[wheel.key] || 1})"><circle class="glyph-plate" r="8"/>${WHEEL_SYMBOLS[id]}</g>`);
      segments.push(`<circle data-balance="${wheel.key}" data-category="${WHEEL_GRADIENTS[category.key]}" data-count="${category.count}" cx="60" cy="60" r="46" pathLength="${total}" stroke="url(#balance-${WHEEL_GRADIENTS[category.key]})" stroke-dasharray="${category.count} ${total - category.count}" stroke-dashoffset="${-offset}"/>`);
      splits.push(`.06 ${category.count - .06}`);
    }
    offset += category.count;
  }
  const top = wheel.total ? Math.max(...wheel.categories.map(category => category.count)) : 0;
  const leaders = wheel.categories.filter(category => top && category.count === top);
  const summary = wheel.total ? wheel.categories.map(category => `${category.name} ${category.count}`).join(', ') : t('ainda não calculado');
  return `<div class="balance-wheel balance-${wheel.key}" role="group" aria-label="${wheel.title}: ${summary}">
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="wheel-depth" cx="60" cy="60" r="46"/>
      <g class="wheel-segments" transform="rotate(${(rotation - 90).toFixed(2)} 60 60)">${segments.join('')}</g>
      <circle class="wheel-splits" cx="60" cy="60" r="46" pathLength="${total}" stroke-dasharray="${splits.join(' ')}" transform="rotate(${(rotation - 90).toFixed(2)} 60 60)"/>
      <circle class="wheel-rim" stroke="url(#balance-rim)" cx="60" cy="60" r="55.5"/>
      <g class="wheel-glyphs">${glyphs.join('')}</g></svg>
    ${top ? `<p class="balance-core" aria-hidden="true"><b>${top}</b><span>${leaders.map(category => escapeHTML(category.name)).join(' · ')}</span></p>` : ''}
    <div class="balance-choice"><h3>${wheel.title}</h3>
    <p class="balance-counts">${wheel.total ? wheel.categories.map(category => `<span><i class="cat-${WHEEL_GRADIENTS[category.key]}"></i>${escapeHTML(category.name)} <b>${category.count}</b></span>`).join('') : t('ainda não calculado')}</p>
    ${wheel.total ? `<button type="button" class="balance-trigger" data-balance="${wheel.key}" aria-label="${t('Ler sobre {title}: {summary}', { title: wheel.title, summary })}" aria-expanded="false" aria-controls="balance-reading"></button>` : ''}</div>
  </div>`;
}


function balanceReadings(state) {
  return { captured: false, notes: state.balance.notes.map(note => ({ ...note, text: state.mode.id === 'natal' ? t(natalBalanceTexts[note.key][note.kind][0]) : balanceTexts[note.key][note.kind] })) };
}

export function balanceScopeText(state) {
  if (!state?.balance?.wheels?.length) return '';
  // As rodas usam o conjunto completo, inclusive pontos ocultos no desenho.
  const ids = [...PLANETS, 'asc', 'mc', 'node', 'lilith', 'chiron'].filter(id => !state.balance.missing?.includes(id));
  const source = state.sky ? 'skySource' : 'natalSource';
  return t(natalLearningTexts.balanceScope[0], { total: state.balance.wheels[0].total,
    source: t(natalLearningTexts[source][0]), names: ids.map(id => BODY_NAMES[id]).join(', ') });
}

export function renderBalanceReading(state, key) {
  const wheel = state.balance.wheels.find(item => item.key === key);
  if (!wheel) return '';
  const readings = balanceReadings(state);
  const notes = readings.notes.filter(note => wheel.categories.some(category => category.key === note.key));
  return `<h3>${wheel.title}</h3><p class="balance-scope">${escapeHTML(balanceScopeText(state))}</p><div class="balance-legend">${wheel.categories.map(category => `<div class="cat-${WHEEL_GRADIENTS[category.key]}" style="--share:${Math.round(category.count / (wheel.total || 1) * 100)}%"><svg viewBox="-10 -10 20 20" aria-hidden="true">${WHEEL_SYMBOLS[WHEEL_GRADIENTS[category.key]]}</svg><span>${escapeHTML(category.name)}</span><b>${category.count}</b></div>`).join('')}</div>
    ${notes.length ? notes.map(note => `<p>${escapeHTML(note.text)}</p>`).join('') : `<p>${state.mode.id === 'natal' ? escapeHTML(t(natalBalanceEvenTexts[key][0])) : t('Distribuição equilibrada: nenhuma categoria se afasta muito da média.')}</p>`}`;
}

const bodyName = (state, id) => {
  const body = findBody(state, id);
  if (!body) return '';
  return body.set === 'transit' ? t('{body} em trânsito', { body: body.name }) : body.set === 'partner' ? t('{body} de {name}', { body: body.name, name: escapeHTML(state.partner?.name) }) : t('{body} natal', { body: body.name });
};
export const aspectTitle = (state, aspect) => `${bodyName(state, aspect.from)} ${ASPECT_INFO[aspect.kind].verb} ${bodyName(state, aspect.to)}`;
export const orbText = aspect => `${en ? aspect.orb.toFixed(2) : aspect.orb.toFixed(2).replace('.', ',')}° ${aspect.orb === 0 ? t('exato') : aspect.applying ? t('aproximando') : t('afastando')}`;

export function renderDayAspect(state) {
  const aspect = state.dayAspect;
  if (!aspect) return state.mode.transits ? `<section class="panel-section"><h3>${t('Aspecto do dia')}</h3><p>${t('Nenhum aspecto entre trânsitos e mapa natal dentro dos orbes neste instante.')}</p></section>` : '';
  const from = findBody(state, aspect.from);
  const to = findBody(state, aspect.to);
  if (!from || !to) return '';
  const learning = transitAspectLearning(aspect, state);
  const contextual = contextAspectReading(aspect, state);
  return `<section class="panel-section" aria-labelledby="day-aspect-title"><h3 id="day-aspect-title">${t('Aspecto do dia')}</h3>
    <p class="panel-strong"><button type="button" class="panel-link" data-map-aspect="${aspect.id}">${t('{aspect}: {natal} natal com {transit} em trânsito', { aspect: ASPECT_INFO[aspect.kind].name, natal: to.name, transit: from.name })}</button></p>
    ${contextual ? `<div class="transit-learning">${contextual.paragraphs.map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join('')}</div><details><summary>${escapeHTML(contextual.detailTitle)}</summary>${learning ? learning.paragraphs.map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join('') : ''}</details>` : learning ? `<div class="transit-learning">${learning.paragraphs.map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join('')}</div>` : `<p>${aspectText(aspect.kind, from.name, to.name, 'transit')}</p>`}<p class="panel-muted">${t('Orbe: {orb}', { orb: orbText(aspect) })}</p></section>`;
}

export function renderPositions(state) {
  const chart = state.positionsChart;
  const title = state.sky ? t('Posição dos planetas em trânsito · {date}', { date: longDate(state.date) }) : t('Posição dos planetas no mapa natal');
  const rows = chart.bodies.map(body => {
    const content = `<span class="position-glyph" aria-hidden="true">${BODY_GLYPHS[body.id]}&#xFE0E;</span><span class="position-name">${BODY_NAMES[body.id]}</span><span class="position-sign"><span aria-hidden="true">${SIGN_GLYPHS[body.sign]}</span> ${SIGN_NAMES[body.sign]}, ${formatDegree(body)}${body.retrograde ? ` <abbr title="${t('Retrógrado')}">R</abbr>` : ''}</span>`;
    return `<li>${state.mode.id === 'natal' ? `<button type="button" class="position-link" data-map-body="${body.id}" aria-label="${t('Ler {body} em {sign}, {degree}', { body: BODY_NAMES[body.id], sign: SIGN_NAMES[body.sign], degree: formatDegree(body) })}${body.retrograde ? `, ${t('Retrógrado')}` : ''}">${content}</button>` : content}</li>`;
  }).join('');
  return `<section class="panel-section" aria-labelledby="positions-title"><h3 id="positions-title">${title}</h3><ul class="position-list">${rows}</ul></section>`;
}

export function renderPanelBody(state) {
  const readings = balanceReadings(state);
  const notes = readings.notes.map(note => `<p>${escapeHTML(note.text)}</p>`).join('');
    return `${state.warning ? `<p class="panel-notice" role="status">${escapeHTML(state.warning)}</p>` : ''}${state.partnerWarning ? `<p class="panel-notice" role="status">${escapeHTML(t('Mapa de {name}: {warning}', { name: state.partner.name, warning: state.partnerWarning }))}</p>` : ''}${state.notice ? `<p class="panel-notice">${escapeHTML(state.notice)}</p>` : ''}
    ${renderDayAspect(state)}
    ${renderNatalSynthesis(state)}
    <section class="panel-section" aria-labelledby="balance-texts-title"><h3 id="balance-texts-title">${t('Elementos, qualidades e dualidades')}</h3>
      <p class="balance-scope">${escapeHTML(balanceScopeText(state))}</p>${notes || (readings.captured ? '' : `<p>${t('Nenhuma categoria aparece em excesso ou em falta neste mapa.')}</p>`)}</section>
    <section id="balance-reading" class="panel-section balance-reading" aria-live="polite" hidden></section>
    ${renderPositions(state)}`;
}

export function renderNatalSynthesis(state) {
  const sections = natalSynthesis(state);
  if (!sections.length) return '';
  const distribution = natalDistribution(state.natal);
  return `<section class="panel-section natal-synthesis" aria-labelledby="natal-synthesis-title"><h3 id="natal-synthesis-title">${t('Seu mapa em conjunto')}</h3>${sections.map(section => `<div class="natal-synthesis-group"><h4>${escapeHTML(section.title)}</h4>${(section.paragraphs || [section.text]).map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join('')}</div>`).join('')}
    <div class="natal-synthesis-group natal-synthesis-facts"><h4>${t('Distribuição dos planetas')}</h4><p class="distribution-scope">${escapeHTML(t(natalLearningTexts.distributionScope[0], { total: distribution.total, names: state.natal.bodies.filter(body => PLANETS.includes(body.id)).map(body => BODY_NAMES[body.id]).join(', ') }))}</p><p>${escapeHTML(t('Abaixo do horizonte: {below}; acima: {above}. Hemisfério oriental: {east}; ocidental: {west}.', distribution))}</p>
    <p>${escapeHTML(t('Quadrantes 1–4: {counts}. Casas angulares: {angular}; sucedentes: {succedent}; cadentes: {cadent}. Total: {total} planetas.', { ...distribution, counts: distribution.quadrants.join(' / ') }))}</p></div></section>`;
}

export function shareText(state) {
  const lines = [`${state.mode.title} — ${state.profile.name}`];
  if (state.sky) lines.push(longDate(state.date));
  if (state.dayAspect) lines.push(t('Aspecto do dia: {aspect} (orbe {orb})', { aspect: aspectTitle(state, state.dayAspect), orb: orbText(state.dayAspect) }));
  lines.push(state.balance.predominance);
  return lines.join('\n');
}
