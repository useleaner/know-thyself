import { MINOR_BODIES, MODES, modeInfo, buildMapState, emptySceneData, findBody, findAspect, rotationDays, addDays, SIGN_NAMES, SIGN_GLYPHS, BODY_GLYPHS, ASPECT_INFO, formatDegree, PLANETS } from './map-data.js';
import { escapeHTML, renderProfileHeader, renderCalendarDays, renderWheel, renderPanelBody, renderBalanceReading, aspectTitle, orbText, isoDay, isoTime, longDate } from './map-readings.js';
import { planetInSign, planetInHouse, influence, aspectText } from './interpretations.js';
import * as profileStore from './profiles.js';
import { tick } from './haptics.js';
import { showFirstProfileHint } from './first-profile-hint.js';
import { t, lang } from './i18n.js';
import { natalPositionLearning, natalAspectLearning, transitAspectLearning, contextAspectReading, natalSignReading, natalHouseReading, natalRetrogradeReading, natalDignityReading, natalAspectReading, natalAngleReading } from './natal-readings.js';
import { notificationLink } from './notification-link.js';


const ordinal = house => lang === 'en' ? `${house}${[, 'st', 'nd', 'rd'][house % 100 > 10 && house % 100 < 14 ? 0 : house % 10] || 'th'} House` : `${house}ª Casa`;
const who = (state, body) => body.set === 'transit' ? t('{body} em trânsito', { body: body.name }) : body.set === 'partner' ? t('{body} de {name}', { body: body.name, name: escapeHTML(state.partner.name) }) : t('{body} natal', { body: body.name });
function bodyHeading(body, state) {
  if (body.set === 'earth') return t('Terra');
  const sign = `${SIGN_GLYPHS[body.sign]} ${SIGN_NAMES[body.sign]}`;
  if (body.set === 'transit') return t('{body} em trânsito em {sign}, na {house} natal', { body: body.name, sign, house: ordinal(body.house) });
  if (body.set === 'partner') return t('{body} de {name} em {sign} e na {house}', { body: body.name, name: escapeHTML(state.partner.name), sign, house: ordinal(body.house) });
  return t('{body} natal em {sign} e na {house}', { body: body.name, sign, house: ordinal(body.house) });
}
const readingHeader = (glyph, title, expanded = true) => `<header class="map-reading-header"><h2 class="map-reading-heading">
  <button type="button" class="map-reading-toggle" id="map-reading-toggle" data-map-action="toggle-reading" aria-expanded="${expanded}" aria-controls="map-reading-detail">
    <span class="map-reading-dots" aria-hidden="true">⋮</span><span class="map-reading-glyph" aria-hidden="true">${glyph}</span><span id="map-reading-title">${title}</span>
  </button></h2></header>`;

const learningSection = learning => learning ? `<section class="natal-learning"><h3>${escapeHTML(learning.title)}</h3>${learning.paragraphs.map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join('')}</section>` : '';

const interpretationStart = learning => learning ? `<details class="natal-interpretation"><summary><span>${escapeHTML(learning.detailTitle)}</span><svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>` : '';

export function renderMapReading(selection, state, expanded = true) {
  if (!selection || state?.status !== 'ok') return '';
  if (selection.kind === 'aspect') {
    const aspect = findAspect(state, selection.id);
    if (!aspect) return '';
    const from = findBody(state, aspect.from);
    const to = findBody(state, aspect.to);
    if (!from || !to) return '';
    const context = from.set === 'transit' ? 'transit' : from.set === 'partner' ? 'synastry' : 'natal';
    const authored = context === 'natal' ? natalAspectReading(aspect) : '';
    if (context === 'natal' && !authored) return '';
    const learning = context === 'transit' ? transitAspectLearning(aspect, state) : natalAspectLearning(aspect, state);
    const contextual = contextAspectReading(aspect, state);
    return `${readingHeader(`${BODY_GLYPHS[from.base]}&#xFE0E;`, aspectTitle(state, aspect), expanded)}<div id="map-reading-detail" class="map-reading-detail"${expanded ? '' : ' hidden'}>
      ${contextual ? `${learningSection(contextual)}${interpretationStart(contextual)}${learningSection(learning)}` : `${learningSection(learning)}${interpretationStart(learning)}<p>${escapeHTML(authored || aspectText(aspect.kind, from.name, to.name, context))}</p>${learning ? '</details>' : ''}`}
      <dl class="map-position"><div><dt>${t('Aspecto')}</dt><dd>${ASPECT_INFO[aspect.kind].name} · ${aspect.angle}°</dd></div><div><dt>${t('Orbe')}</dt><dd>${orbText(aspect)}</dd></div></dl>
      ${contextual ? '</details>' : ''}
      <section aria-labelledby="map-related-title"><h3 id="map-related-title">${t('Astros desta conexão')}</h3><div class="map-related"><button type="button" data-map-body="${from.id}">${t('Ver {body}', { body: who(state, from) })}</button><button type="button" data-map-body="${to.id}">${t('Ver {body}', { body: who(state, to) })}</button></div></section></div>`;
  }
  const body = findBody(state, selection.id);
  if (!body) return '';
  if (body.set === 'earth') {
    return `${readingHeader('⊕', t('Terra'), expanded)}<div id="map-reading-detail" class="map-reading-detail"${expanded ? '' : ' hidden'}>
      <p>${t('A Terra ocupa o centro como referência geocêntrica: as posições são vistas daqui. Ela não tem signo nem casa no mapa.')}</p></div>`;
  }
  const role = who(state, body);
  if (body.kind === 'angle') {
    return `${readingHeader(BODY_GLYPHS[body.base], t('{body} em {sign}', { body: body.name, sign: SIGN_NAMES[body.sign] }), expanded)}<div id="map-reading-detail" class="map-reading-detail"${expanded ? '' : ' hidden'}><p>${escapeHTML(natalAngleReading(body))}</p><dl class="map-position"><div><dt>${t('Posição')}</dt><dd>${SIGN_NAMES[body.sign]} ${formatDegree(body)}</dd></div></dl></div>`;
  }
  const related = state.aspects.filter(aspect => aspect.from === body.id || aspect.to === body.id);
  const signText = body.set === 'natal' ? natalSignReading(body.base, body.sign) : '';
  const houseText = body.set === 'natal' ? natalHouseReading(body.base, body.house) : '';
  const retroText = body.set === 'natal' ? natalRetrogradeReading(body) : '';
  const dignityTexts = body.set === 'natal' ? natalDignityReading(body) : [];
  if (body.set === 'natal' && (!signText || !houseText)) return '';
  const learning = natalPositionLearning(body);
  return `${readingHeader(`${BODY_GLYPHS[body.base]}&#xFE0E;`, bodyHeading(body, state), expanded)}<div id="map-reading-detail" class="map-reading-detail"${expanded ? '' : ' hidden'}>
    ${learningSection(learning)}${interpretationStart(learning)}<section><h3>${t('{body} em {sign}', { body: role, sign: SIGN_NAMES[body.sign] })}</h3><p>${escapeHTML(signText || planetInSign[body.base]?.[body.sign] || '')}</p>${body.set === 'natal' ? dignityTexts.map(item => `<h4>${item.label}${['uranus', 'neptune', 'pluto'].includes(body.base) ? ` · ${t('Regência moderna')}` : ''}</h4><p>${escapeHTML(item.text)}</p>`).join('') : `<p class="map-influence">${t('Influência dessa posição: {value}', { value: influence(body.base, body.sign) })}</p>`}</section>
    <section><h3>${t(body.set === 'transit' ? '{body} na {house} natal' : '{body} na {house}', { body: role, house: ordinal(body.house) })}</h3><p>${escapeHTML(houseText || planetInHouse[body.base]?.[body.house] || '')}</p></section>
    ${retroText ? `<section><h3>${t('Movimento retrógrado')}</h3><p>${escapeHTML(retroText)}</p></section>` : ''}${learning ? '</details>' : ''}
    <dl class="map-position"><div><dt>${t('Posição')}</dt><dd>${SIGN_NAMES[body.sign]} ${formatDegree(body)}</dd></div><div><dt>${t('Movimento')}</dt><dd>${body.retrograde ? t('Retrógrado') : t('Direto')}</dd></div></dl>
    ${related.length ? `<section aria-labelledby="map-related-title"><h3 id="map-related-title">${t('Conexões de {body}', { body: role })}</h3><div class="map-related">${related.map(aspect => `<button type="button" data-map-aspect="${aspect.id}">${aspectTitle(state, aspect)}</button>`).join('')}</div></section>` : ''}</div>`;
}

const bodyLabel = (state, body) => body.set === 'natal' || body.set === 'earth' ? body.name : who(state, body);
export function selectableBodies(state) {
  if (state?.status !== 'ok') return [];
  const ids = ['sun', 'moon', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
    ...(state.mode.id === 'natal' ? [...state.natal.bodies.filter(body => !PLANETS.includes(body.id)).map(body => body.id), 'asc', 'dsc', 'mc', 'ic'] : MINOR_BODIES.filter(id => state.scene.natal[id])),
    ...state.scene.outer.flatMap(set => set.bodies.map(body => body.id))];
  return ids.map(id => findBody(state, id)).filter(Boolean);
}

const STRIP_SPAN = 45;

export function initMapExplorer({ root, solar, header, profiles = profileStore, now = () => new Date() }) {
  const $ = selector => root.querySelector(selector);
  const reading = $('#map-reading');
  const content = $('#map-reading-content');
  const menu = $('#map-body-list');
  const aspectMenu = $('#map-aspect-list');
  const disc = $('.map-study');
  const status = $('#map-status');
  const panel = $('#map-panel');
  const panelBody = $('#map-panel-body');
  const handle = $('#panel-handle');
  const calendar = $('#map-calendar');
  const days = $('#calendar-days');
  const modeToggle = $('#mode-toggle');
  const modeOptions = $('#mode-options');
  const empty = $('#map-empty');
  const pageURL = globalThis.location?.href || 'http://localhost/';
  const notification = notificationLink(pageURL, pageURL);
  const MAP_VIEW_KEY = 'know-thyself.map-view';
  let savedView;
  try { savedView = JSON.parse(sessionStorage.getItem(MAP_VIEW_KEY)); } catch { /* navegação sem armazenamento */ }
  const requestedMode = new URL(pageURL).searchParams.get('mode');
  let mode = modeInfo(MODES.some(item => item.id === requestedMode) ? requestedMode : savedView?.mode).id;
  const savedDate = typeof savedView?.date === 'string' ? new Date(savedView.date) : null;
  let date = notification?.date || (Number.isFinite(savedDate?.getTime()) ? savedDate : now());
  let state = null;
  let selection = null;
  let expanded = true;
  let balanceKey = null;
  let rotation = null;
  let view = { zoom: 1, tilt: 45.5 };

  function compute() {
    let profile = null, partner = null, settings = {};
    try { profile = profiles.activeProfile(); partner = profiles.partnerProfile(); settings = profiles.getSettings(); }
    catch { /* armazenamento corrompido ou bloqueado: estado vazio abaixo */ }
    return buildMapState({ ...settings, profile, partner, mode, date });
  }

  // Sem calendário (natal): some com fade e guarda o espaço, para o disco não mudar de posição.
  function setCalendarOff(off) {
    calendar.hidden = false;
    calendar.dataset.off = String(off);
    calendar.inert = off;
    calendar.setAttribute('aria-hidden', String(off));
  }

  function renderCalendar() {
    const info = modeInfo(mode);
    setCalendarOff(!info.transits || state.status !== 'ok');
    if (calendar.dataset.off === 'true') return;
    if (!stripScrolling) rebuildStrip();
  }

  // Faixa de dias: o dia do centro é o escolhido. Rolar troca a data na hora; ao parar, a faixa se recentra.
  let stripScrolling = false, stripFrame = 0, stripTimer = 0, stripTouching = false, stripProgrammatic = false;
  function centerStrip(current) {
    stripProgrammatic = true;
    days.scrollLeft = current.offsetLeft + current.offsetWidth / 2 - days.clientWidth / 2;
    setTimeout(() => { stripProgrammatic = false; }, 80);
  }
  function rebuildStrip() {
    days.innerHTML = renderCalendarDays(date, now(), STRIP_SPAN);
    const current = days.querySelector('[aria-current="date"]');
    if (current) centerStrip(current);
  }
  function centeredDay() {
    const middle = days.scrollLeft + days.clientWidth / 2;
    let best = null, distance = Infinity;
    for (const button of days.children) {
      const gap = Math.abs(button.offsetLeft + button.offsetWidth / 2 - middle);
      if (gap < distance) { best = button; distance = gap; }
    }
    return best;
  }
  days.addEventListener('scroll', () => {
    if (stripProgrammatic) return;
    cancelAnimationFrame(stripFrame);
    stripFrame = requestAnimationFrame(() => {
      const button = centeredDay();
      if (!button || button.dataset.day === isoDay(date)) return;
      days.querySelector('[aria-current="date"]')?.removeAttribute('aria-current');
      button.setAttribute('aria-current', 'date');
      const [year, month, dayOfMonth] = button.dataset.day.split('-').map(Number);
      stripScrolling = true;
      setDate(new Date(year, month - 1, dayOfMonth, date.getHours(), date.getMinutes()), false);
      stripScrolling = false;
      tick();
    });
    clearTimeout(stripTimer);
    stripTimer = setTimeout(function settleStrip() {
      if (stripTouching) { stripTimer = setTimeout(settleStrip, 160); return; }
      const index = [...days.children].indexOf(days.querySelector('[aria-current="date"]'));
      if (index < 12 || index > days.children.length - 13) rebuildStrip();
      status.textContent = t('Data: {date}, {time}', { date: longDate(date), time: isoTime(date) });
    }, 200);
  }, { passive: true });
  days.addEventListener('pointerdown', () => { stripTouching = true; });
  for (const type of ['pointerup', 'pointercancel']) days.addEventListener(type, () => { stripTouching = false; });

  function renderMenus() {
    menu.innerHTML = selectableBodies(state).map(body => `<button type="button" data-map-body="${body.id}" aria-pressed="false"${body.set !== 'natal' && body.set !== 'earth' ? ` class="map-outer-${body.set}"` : ''}>${bodyLabel(state, body)}</button>`).join('');
    aspectMenu.innerHTML = (state.aspects || []).map(aspect => `<button type="button" data-map-aspect="${aspect.id}" aria-pressed="false">${aspectTitle(state, aspect)} · ${orbText(aspect)}</button>`).join('');
  }

  function renderPanel() {
    $('#map-panel-title').textContent = state.mode.title;
    $('#map-balance').innerHTML = state.balance.wheels.map(renderWheel).join('');
    $('#map-predominance').textContent = state.balance.influence;
    panelBody.innerHTML = renderPanelBody(state);
    if (balanceKey) showBalance(balanceKey, true);
  }

  function renderModes() {
    const info = modeInfo(mode);
    modeOptions.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    modeToggle.setAttribute('aria-label', t('Modo do mapa: {mode}. Trocar modo', { mode: info.label }));
    modeToggle.dataset.mode = mode;
    // O botão fechado mostra o ícone do modo atual; aberto, só os quatro modos aparecem.
    const icon = modeOptions.querySelector(`[data-mode="${mode}"] svg`);
    if (icon) modeToggle.replaceChildren(icon.cloneNode(true));
  }

  function update() {
    try { sessionStorage.setItem(MAP_VIEW_KEY, JSON.stringify({ mode, date: date.toISOString() })); } catch { /* navegação sem armazenamento */ }
    state = compute();
    root.dataset.empty = String(state.status !== 'ok');
    disc.setAttribute('aria-label', state.status === 'ok' ? t('Mapa 3D calculado do perfil ativo. Selecione um corpo ou uma linha.') : t('Disco do mapa vazio, sem planetas.'));
    root.dataset.mapMode = mode;
    const top = renderProfileHeader(state);
    if (header) { header.innerHTML = top.html; header.setAttribute('aria-label', top.label); header.setAttribute('href', state.mode.synastry ? `./perfil.html?compare=1&mode=${mode}` : './perfil.html'); }
    if (header && state.reason === 'no-profile') showFirstProfileHint(header);
    empty.hidden = state.status === 'ok' || state.reason === 'no-profile';
    panel.inert = state.status !== 'ok';
    if (state.status !== 'ok') {
      empty.innerHTML = `${escapeHTML(state.message)} <a href="perfil.html">${t('Abrir perfis')}</a>`;
      $('#map-balance').innerHTML = [['element', t('Elemento')], ['quality', t('Qualidade')], ['duality', t('Dualidade')]]
        .map(([key, title]) => renderWheel({ key, title, total: 0, categories: [] })).join('');
      $('#map-predominance').textContent = '';
      panelBody.innerHTML = '';
      panelBody.hidden = true;
      panel.dataset.raised = 'false';
      balanceKey = null;
      setCalendarOff(true);
      select(null, { quiet: true });
      solar.setData(emptySceneData());
      return;
    }
    renderModes();
    renderCalendar();
    renderMenus();
    renderPanel();
    const kept = solar.setData(state.scene);
    if (selection && !kept && !(selection.kind === 'body' && selection.id === 'earth')) select(null, { quiet: true });
    else if (selection) select(selection, { keepExpanded: true, quiet: true });
  }

  function setExpanded(next) {
    expanded = next;
    reading.dataset.expanded = String(next);
    const detail = content.querySelector('#map-reading-detail');
    const toggle = content.querySelector('#map-reading-toggle');
    if (!detail || !toggle) return;
    detail.hidden = !next;
    toggle.setAttribute('aria-expanded', String(next));
  }

  // Trocar de corpo mantém o estado recolhido; uma seleção nova a partir do nada abre expandida.
  function select(next, { keepExpanded = Boolean(selection), quiet = false } = {}) {
    const html = next ? renderMapReading(next, state, keepExpanded ? expanded : true) : '';
    if (next && !html) return;
    const needsFocus = !quiet && (reading.contains(document.activeElement) || menu.contains(document.activeElement) || panel.contains(document.activeElement));
    if (!next && needsFocus) disc.focus({ preventScroll: true });
    const changed = next?.id !== selection?.id || next?.kind !== selection?.kind;
    selection = next;
    solar.select(next);
    reading.hidden = !next;
    content.innerHTML = html;
    setExpanded(next ? (keepExpanded ? expanded : true) : false);
    root.querySelectorAll('#map-body-list button, #map-aspect-list button').forEach(button => {
      const chosen = (next?.kind === 'body' && button.dataset.mapBody === next.id) || (next?.kind === 'aspect' && button.dataset.mapAspect === next.id);
      button.setAttribute('aria-pressed', String(Boolean(chosen)));
    });
    if (quiet) return;
    if (!next) { status.textContent = t('Seleção removida'); return; }
    if (changed) tick();
    status.textContent = `${content.querySelector('#map-reading-title')?.textContent || ''} selecionado`;
    if (needsFocus) content.querySelector('#map-reading-toggle')?.focus({ preventScroll: true });
  }

  function setMode(next) {
    if (!MODES.some(item => item.id === next) || next === mode) return;
    mode = next;
    tick();
    update();
    status.textContent = `${modeInfo(mode).title}`;
  }

  function setDate(next, announce = true) {
    if (!Number.isFinite(next?.getTime())) return;
    date = next;
    update();
    if (announce) status.textContent = t('Data: {date}, {time}', { date: longDate(date), time: isoTime(date) });
  }

  // Painel como folha: fica na altura cheia e desce até mostrar só cabeçalho, rodas e frase (--sheet-y).
  const predominance = $('#map-predominance');
  let sheetY = 0;
  let hideTimer;
  // Fechada, a folha mostra o mesmo conteúdo em escala menor (cosmos.css): o disco é o foco.
  const collapsedY = () => { const balance = $('#map-balance'), summary = predominance.parentElement; return Math.max(0, panel.offsetHeight - (Math.max(balance.offsetTop + balance.offsetHeight, summary.offsetTop + summary.offsetHeight) + 6)); };
  function placeSheet(y) { sheetY = y; panel.style.setProperty('--sheet-y', `${y}px`); }
  // O disco ocupa todo o vão entre o calendário e o topo da gaveta fechada (o arco fica ~14px abaixo do topo).
  function fitDisc() {
    if (panel.dataset.raised !== 'false' || !calendar) return;
    const top = calendar.getBoundingClientRect().bottom + 6;
    const bottom = panel.getBoundingClientRect().top - sheetY + collapsedY() - 20;
    const flowTop = disc.getBoundingClientRect().top - parseFloat(getComputedStyle(disc).marginTop);
    disc.style.marginTop = `${Math.max(0, top - flowTop)}px`;
    disc.style.height = `${Math.max(120, bottom - top)}px`;
  }
  function revealSheet() { clearTimeout(hideTimer); panelBody.hidden = false; }
  function setRaised(raised) {
    if (state?.status !== 'ok') return;
    panel.dataset.raised = String(raised);
    handle.setAttribute('aria-expanded', String(raised));
    handle.setAttribute('aria-label', raised ? t('Recolher leitura do mapa') : t('Expandir leitura do mapa'));
    if (raised) revealSheet();
    else hideTimer = setTimeout(() => { if (panel.dataset.raised === 'false' && !('dragging' in panel.dataset)) { panelBody.hidden = true; } }, 450);
    placeSheet(raised ? 0 : collapsedY());
    fitDisc();
  }

  function showBalance(key, keep = false) {
    balanceKey = keep ? key : balanceKey === key ? null : key;
    if (balanceKey) panel.dataset.balance = balanceKey;
    else delete panel.dataset.balance;
    const target = panelBody.querySelector('#balance-reading');
    root.querySelectorAll('.balance-trigger').forEach(button => button.setAttribute('aria-expanded', String(button.dataset.balance === balanceKey)));
    if (!target) return;
    target.hidden = !balanceKey;
    target.innerHTML = balanceKey ? renderBalanceReading(state, balanceKey) : '';
    if (balanceKey && !keep) { setRaised(true); panelBody.scrollTop = target.offsetTop - panelBody.offsetTop; }
  }


  root.addEventListener('click', event => {
    const target = event.target;
    if (target.closest('#mode-toggle')) {
      modeOptions.hidden = false;
      modeToggle.setAttribute('aria-expanded', 'true');
      modeOptions.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
      return;
    }
    const modeButton = target.closest('[data-mode]');
    if (modeButton && modeOptions.contains(modeButton)) {
      setMode(modeButton.dataset.mode);
      modeOptions.hidden = true;
      modeToggle.setAttribute('aria-expanded', 'false');
      modeToggle.focus({ preventScroll: true });
      return;
    }
    const day = target.closest('[data-day]');
    if (day) {
      day.scrollIntoView({ inline: 'center', block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    if (target.closest('#panel-handle')) {
      setRaised(panel.dataset.raised !== 'true');
      return;
    }
    const body = target.closest('[data-map-body]');
    if (body) { select({ kind: 'body', id: body.dataset.mapBody }); return; }
    const aspect = target.closest('[data-map-aspect]');
    if (aspect) { select({ kind: 'aspect', id: aspect.dataset.mapAspect }); return; }
    const action = target.closest('[data-map-action]')?.dataset.mapAction;
    if (action === 'toggle-reading' && selection) { setExpanded(!expanded); return; }
    if (action === 'clear') { select(null); disc.focus({ preventScroll: true }); return; }
    const wheel = target.closest('.balance-trigger, .wheel-segments [data-balance]');
    if (wheel) showBalance(wheel.dataset.balance);
  });


  // Arrasto vertical em qualquer ponto do painel recolhido (ou no cabeçalho / topo da leitura, se elevado) move a folha com o dedo.
  let sheetDrag = null;
  let suppressPanelClick = 0;
  let touchStartY = 0;
  panel.addEventListener('pointerdown', event => {
    if (event.button > 0 || event.target.closest('#mode-dock')) return;
    sheetDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: sheetY, header: Boolean(event.target.closest('.map-panel-header')), locked: false, v: 0, lastY: event.clientY, lastT: event.timeStamp };
  });
  panel.addEventListener('pointermove', event => {
    if (sheetDrag?.id !== event.pointerId) return;
    const dx = event.clientX - sheetDrag.x;
    const dy = event.clientY - sheetDrag.y;
    if (!sheetDrag.locked) {
      // Lateral fica com a troca de área (orbit.js); elevado, o corpo rola e só o puxão do topo para baixo move a folha.
      if (Math.abs(dx) >= 10 && Math.abs(dx) > Math.abs(dy)) { sheetDrag = null; return; }
      if (Math.abs(dy) < 8) return;
      if (panel.dataset.raised === 'true' && !sheetDrag.header && (dy < 0 || panelBody.scrollTop > 0)) { sheetDrag = null; return; }
      sheetDrag.locked = true;
      panel.dataset.dragging = '';
      revealSheet();
      try { panel.setPointerCapture(event.pointerId); } catch {}
    }
    event.stopPropagation();
    const dt = event.timeStamp - sheetDrag.lastT;
    if (dt > 0) {
      sheetDrag.v = sheetDrag.v * .2 + (event.clientY - sheetDrag.lastY) / dt * .8;
      sheetDrag.lastY = event.clientY;
      sheetDrag.lastT = event.timeStamp;
    }
    placeSheet(Math.min(collapsedY(), Math.max(0, sheetDrag.from + dy)));
  });
  function endSheet(event) {
    if (sheetDrag?.id !== event.pointerId) return;
    const previous = sheetDrag;
    sheetDrag = null;
    if (!previous.locked) return;
    delete panel.dataset.dragging;
    suppressPanelClick = performance.now() + 350;
    const velocity = event.timeStamp - previous.lastT > 80 ? 0 : previous.v;
    // Basta passar de 20% do caminho na direção do gesto, ou um flick.
    const max = collapsedY();
    setRaised(Math.abs(velocity) >= .35 ? velocity < 0 : previous.from > max / 2 ? sheetY < max * .8 : sheetY < max * .2);
  }
  panel.addEventListener('pointerup', endSheet);
  panel.addEventListener('pointercancel', endSheet);
  panel.addEventListener('click', event => {
    if (performance.now() >= suppressPanelClick) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  // iOS: no topo da leitura, puxar para baixo é da folha, não da rolagem.
  panelBody.addEventListener('touchstart', event => { touchStartY = event.touches[0].clientY; }, { passive: true });
  panelBody.addEventListener('touchmove', event => {
    if (event.cancelable && (sheetDrag?.locked || (panelBody.scrollTop <= 0 && event.touches[0].clientY > touchStartY))) event.preventDefault();
  }, { passive: false });
  panel.addEventListener('wheel', event => {
    if (panel.dataset.raised === 'false' && event.deltaY > 4 && Math.abs(event.deltaY) > Math.abs(event.deltaX)) { event.preventDefault(); setRaised(true); }
  }, { passive: false });
  let sheetFrame;
  const sheetObserver = new ResizeObserver(() => {
    cancelAnimationFrame(sheetFrame);
    // Geometria no próximo frame evita redimensionar dentro da entrega do observer.
    sheetFrame = requestAnimationFrame(() => {
      if (panel.dataset.raised !== 'false' || 'dragging' in panel.dataset) return;
      panel.style.transition = 'none';
      placeSheet(collapsedY());
      fitDisc();
      panel.offsetHeight;
      panel.style.transition = '';
    });
  });
  sheetObserver.observe(panel);
  sheetObserver.observe(predominance);

  root.addEventListener('keydown', event => {
    if (event.target === disc && ['+', '=', '-', '_', '0', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        if (modeInfo(mode).transits) setDate(addDays(date, event.key === 'ArrowRight' ? 1 : -1));
        return;
      }
      if (['+', '='].includes(event.key)) solar.setZoom(view.zoom + .25);
      if (['-', '_'].includes(event.key)) solar.setZoom(view.zoom - .25);
      if (event.key === 'ArrowUp') solar.setTilt(view.tilt + 5);
      if (event.key === 'ArrowDown') solar.setTilt(view.tilt - 5);
      if (event.key === '0') solar.resetView();
      status.textContent = t('Visão do mapa: zoom {zoom}%, inclinação {tilt} graus', { zoom: Math.round(view.zoom * 100), tilt: Math.round(view.tilt) });
      return;
    }
    if (event.key !== 'Escape') return;
    if (!modeOptions.hidden) { event.preventDefault(); modeOptions.hidden = true; modeToggle.setAttribute('aria-expanded', 'false'); modeToggle.focus(); }
    else if (selection) { event.preventDefault(); select(null); disc.focus({ preventScroll: true }); }
    else if (panel.dataset.raised === 'true') { event.preventDefault(); setRaised(false); handle.focus(); }
  });

  // Giro em arco no aro: 1 dia a cada 15°, só nos modos com trânsitos.
  function rotate(totalDegrees) {
    if (!modeInfo(mode).transits || state?.status !== 'ok') return;
    rotation ??= { start: date, days: 0 };
    const next = rotationDays(totalDegrees);
    if (next === rotation.days) return;
    rotation.days = next;
    date = addDays(rotation.start, next);
    tick();
    update();
    status.textContent = t('Data: {date}', { date: longDate(date) });
  }
  function rotateEnd() { rotation = null; }

  profiles.onProfilesChange?.(() => update());
  setRaised(false);
  update();
  if (notification) {
    if (state.profile?.id === notification.profile && findAspect(state, notification.aspect)) select({ kind: 'aspect', id: notification.aspect }, { keepExpanded: false });
    else status.textContent = t('Esta leitura não está mais disponível. Confira o perfil e os ajustes do mapa.');
  }
  return { select, syncView(next) { view = next; }, rotate, rotateEnd, setMode, setDate, getState: () => state };
}
