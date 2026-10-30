import { renderTree, spheres, beadStyles } from './tree.js';
import { computeTree, pathCycles } from './cabala-engine.js?v=20261023-reference';
import { sphereStudy, paths } from './study-data.js?v=20261024-cabala-clarity';
import { sphereEnergyReading } from './sphere-energy.js';
import { personalPathReading, sphereConnections } from './cabala-readings.js';
import { cabalaLearningTexts } from './cabala-learning-texts.js';
import { initOrbit } from './orbit.js';
import { initPlanetSelector } from './planet-selector.js?v=20261019-estrutura';
import { initSolarStudy } from './solar-study.js?v=20261024-planet-lanes';
import { initMapExplorer } from './map-explorer.js?v=20261024-cabala-clarity';
import { activeProfile, onProfilesChange } from './profiles.js';
import { t, locale } from './i18n.js';

const learningWords = cabalaLearningTexts.labels;

const viewport = document.querySelector('#viewport');
const mount = document.querySelector('#tree-mount');
const panel = document.querySelector('#tree-panel');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const far = document.querySelector('.nebula-far');
const near = document.querySelector('.nebula-near');
const dust = document.querySelector('.stardust');
const circles = document.querySelector('.tree-worlds');
const scene = document.querySelector('#orbit-scene');
let activeViewport = viewport;
const TREE_MODE_KEY = 'know-thyself.tree-mode';
const requestedTree = new URL(location.href).searchParams.get('tree');
let mode = ['base', 'personal'].includes(requestedTree) ? requestedTree : 'base';
if (!['base', 'personal'].includes(requestedTree)) {
  try { if (sessionStorage.getItem(TREE_MODE_KEY) === 'personal') mode = 'personal'; } catch { /* navegação sem armazenamento */ }
}
let personalTree = null;

const lineTypes = {
  standard: { label: t('Padrão') },
  hidden: { label: t('Oculta') },
  primary: { label: t('Missão principal') },
  'primary-hidden': { label: t('Missão principal oculta') },
  secondary: { label: t('Missão secundária') },
  'secondary-hidden': { label: t('Missão secundária oculta') },
  'short-crisis': { label: t('Crises de curto prazo') },
  'long-crisis': { label: t('Crises de longo prazo') },
  karma: { label: t('Karma ou tarefa pendente') },
  gift: { label: t('Dons') },
  empty: { label: t('Sem linhas') },
  blocked: { label: t('Três ou mais linhas') }
};
for (const [key, entry] of Object.entries(lineTypes)) entry.description = t(cabalaLearningTexts.types[key][0]);

// Amostra do legend: as mesmas contas de luz da árvore, numa linha curta.
function legendSample(key) {
  const bead = beadStyles[key];
  const row = (y, style) => style.dim
    ? `<path class="path-color" d="M6 ${y}H62" stroke="${style.core}" stroke-opacity=".45" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="0 ${style.gap}"/>`
    : `<path d="M6 ${y}H62" stroke="${style.halo}" stroke-opacity=".16" stroke-width="15" stroke-linecap="round" stroke-dasharray="0 ${style.gap}"/><path d="M6 ${y}H62" stroke="${style.halo}" stroke-opacity=".5" stroke-width="9" stroke-linecap="round" stroke-dasharray="0 ${style.gap}"/><path d="M6 ${y}H62" stroke="${style.core}" stroke-width="4.2" stroke-linecap="round" stroke-dasharray="0 ${style.gap}"/>`;
  if (key === 'gift') return '<img src="assets/path-marker-gift.svg" alt="" width="26" height="26">';
  const guide = `<path d="M6 16H62" stroke="#fff" stroke-opacity="${key === 'empty' || key === 'blocked' ? '.18' : '.14'}" stroke-width="1.2"/>`;
  const rows = key === 'empty' ? '' : key === 'blocked' ? [6, 16, 26].map(y => row(y, beadStyles.standard)).join('') : bead ? row(16, bead) : '';
  return `<svg viewBox="0 0 68 32" width="68" height="32" aria-hidden="true">${guide}${rows}</svg>`;
}
function legendRow([key, type]) {
  return `<div class="legend-row"><span class="line-sample" aria-hidden="true">${legendSample(key)}</span><span>${type.label}</span></div>`;
}
document.querySelector('#line-legend').innerHTML = Object.entries(lineTypes).map(legendRow).join('');

for (let i = 0; i < 64; i++) {
  const point = document.createElement('span');
  point.className = 'dust';
  const size = .6 + ((i * 19) % 11) / 10;
  point.style.cssText = `left:${(i * 61 + 13) % 100}%;top:${(i * 37 + 7) % 100}%;width:${size}px;height:${size}px;opacity:${.16 + (i % 6) * .08}`;
  dust.append(point);
}
let pendingFrame = false;
function queueParallax() {
  if (!pendingFrame) { pendingFrame = true; requestAnimationFrame(updateParallax); }
}
function updateParallax() {
  pendingFrame = false;
  const scroll = reducedMotion.matches ? 0 : activeViewport.scrollTop;
  far.style.transform = `translate3d(0,${-Math.min(scroll * .028, 32)}px,0)`;
  near.style.transform = `translate3d(${Math.sin(scroll / 700) * 8}px,${-Math.min(scroll * .065, 64)}px,0)`;
  dust.style.transform = `translate3d(0,${-Math.min(scroll * .043, 44)}px,0)`;
  const treeScroll = reducedMotion.matches ? 0 : viewport.scrollTop;
  const depthY = reducedMotion.matches ? 0 : Math.tanh(treeScroll / 240) * 7;
  circles.style.transform = `translate3d(0,${depthY}px,-24px)`;
}
document.querySelectorAll('.area-scroll').forEach(area => area.addEventListener('scroll', () => {
  queueParallax();
}, { passive: true }));
reducedMotion.addEventListener('change', updateParallax);
let mapExplorer;
const solarStudy = initSolarStudy({
  mount: scene.querySelector('#solar-mount'), previewMount: scene.querySelector('#solar-preview'),
  onSelect: selection => mapExplorer?.select(selection),
  onViewChange: view => mapExplorer?.syncView(view),
  onRotate: total => mapExplorer?.rotate(total),
  onRotateEnd: () => mapExplorer?.rotateEnd()
});
const orbit = initOrbit({ scene, onChange(name, nextViewport) {
  activeViewport = nextViewport;
  solarStudy.setActive(name === 'map');
  const titles = { map: t('Seu mapa'), kaballah: t('Kaballah'), correspondences: t('Correspondências') };
  document.title = `Know Thyself — ${titles[name]}`;
  updateParallax();
} });
initPlanetSelector({ root: scene.querySelector('[data-area="correspondences"]'), viewport: scene.querySelector('.correspondence-scroll') });

const previewImage = scene.querySelector('.tree-preview-asset');
const livePreview = document.createElement('div');
previewImage.after(livePreview);

function setMode(nextMode, resetScroll = true) {
  mode = nextMode;
  try { sessionStorage.setItem(TREE_MODE_KEY, mode); } catch { /* navegação sem armazenamento */ }
  panel.dataset.mode = mode;
  panel.setAttribute('aria-labelledby', `tab-${mode}`);
  document.querySelectorAll('[role="tab"]').forEach(tab => {
    const selected = tab.dataset.mode === mode;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelector('#tree-title').textContent = mode === 'base' ? t('Árvore da Vida') : t('A sua árvore');
  document.querySelector('#tree-description').innerHTML = mode === 'base'
    ? t('Dez esferas, vinte e dois caminhos.<br>Explore as relações entre eles.')
    : t(learningWords.intro[0]);
  document.querySelector('#base-note').hidden = mode !== 'base';
  document.querySelector('#base-help').hidden = mode !== 'base';
  const person = activeProfile();
  personalTree = person?.cabala ? computeTree(person) : null;
  const personalAvailable = mode !== 'personal' || Boolean(personalTree);
  if (mode === 'personal' && !personalAvailable) {
    document.querySelector('#tree-description').textContent = person ? person.name : t('Cadastre seus dados de nascimento.');
  }
  document.querySelector('#reading-help').hidden = mode !== 'personal' || !personalAvailable;
  document.querySelector('.tree-figure figcaption').hidden = !personalAvailable;
  circles.hidden = !personalAvailable;
  mount.innerHTML = personalAvailable ? renderTree(mode, paths, personalTree) : person?.cabala
    ? `<div class="map-empty"><p>${t('Este nome contém letras sem conversão confirmada no alfabeto selecionado.')}</p><a href="./ajustes.html?view=cabala-idioma">${t('Ajustes')}</a></div>`
    : `<div class="map-empty"><p>${person ? t('Complete seu perfil para gerar sua árvore pessoal.') : t('Cadastre uma pessoa para começar.')}</p><a href="${person ? './perfil.html?cabala=1' : './perfil.html?view=new'}">${person ? t('Editar perfil') : t('Novo perfil')}</a></div>`;
  // Prévia lateral: estática na estrutura base; na pessoal, a mesma árvore calculada, sem IDs duplicados nem alvos de foco.
  const live = mode === 'personal' && personalTree;
  previewImage.style.display = live ? 'none' : '';
  livePreview.style.display = live ? '' : 'none';
  livePreview.innerHTML = live ? renderTree('personal', paths, personalTree)
    .replace(/\s(?:role|tabindex|aria-label|aria-labelledby|data-sphere|data-path)="[^"]*"/g, '')
    .replace(/<title\b[^>]*>.*?<\/title>|<desc\b[^>]*>.*?<\/desc>/g, '')
    .replace(/\bid="/g, 'id="pv-').replace(/url\(#/g, 'url(#pv-')
    .replace('class="tree-svg', 'class="tree-preview-asset tree-svg') : '';
  if (resetScroll) viewport.scrollTo({ top: 0, behavior: 'instant' });
  updateParallax();
}
document.querySelectorAll('[role="tab"]').forEach(tab => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const targetMode = event.key === 'Home' ? 'base' : event.key === 'End' ? 'personal' : mode === 'base' ? 'personal' : 'base';
    setMode(targetMode);
    document.querySelector(`#tab-${targetMode}`).focus();
  });
});

const sheet = document.querySelector('#study-sheet');
const backdrop = document.querySelector('#sheet-backdrop');
const closeButton = document.querySelector('#sheet-close');
let returnFocus;
let previousOverflow;
let lockedViewport;
const backgroundSurfaces = [scene, document.querySelector('.cosmos-header'), document.querySelector('.orbit-controls')];
function openSheet(content, trigger) {
  const wasHidden = sheet.hidden;
  returnFocus = trigger || document.activeElement;
  document.querySelector('#sheet-content').innerHTML = content;
  sheet.hidden = false;
  backdrop.hidden = false;
  if (wasHidden) {
    lockedViewport = activeViewport;
    previousOverflow = lockedViewport.style.overflowY;
    lockedViewport.style.overflowY = 'hidden';
  }
  backgroundSurfaces.forEach(surface => { surface.inert = true; });
  sheet.scrollTop = 0;
  closeButton.focus();
}
function closeSheet() {
  sheet.hidden = true;
  backdrop.hidden = true;
  lockedViewport.style.overflowY = previousOverflow || '';
  backgroundSurfaces.forEach(surface => { surface.inert = false; });
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}
function orbHTML(sphere) {
  return `<img class="sheet-orb" src="assets/spheres/${sphere.id}.svg" alt="" width="76" height="76">`;
}
function symbolHTML(symbol) {
  const elements = {
    '🜁': '<path d="m10 3 8 14H2Z M5 12h10"/>',
    '🜄': '<path d="m10 17 8-14H2Z"/>',
    '🜂': '<path d="m10 3 8 14H2Z"/>',
    '⊕': '<circle cx="10" cy="10" r="8"/><path d="M2 10h16M10 2v16"/>'
  };
  const assets = {
    '☉': 'planets/sun', '☽': 'planets/moon', '☿': 'planets/mercury', '♀': 'planets/venus',
    '♂': 'planets/mars', '♃': 'planets/jupiter', '♄': 'planets/saturn',
    '♈': 'zodiac/aries', '♉': 'zodiac/taurus', '♊': 'zodiac/gemini', '♋': 'zodiac/cancer',
    '♌': 'zodiac/leo', '♍': 'zodiac/virgo', '♎': 'zodiac/libra', '♏': 'zodiac/scorpio',
    '♐': 'zodiac/sagittarius', '♑': 'zodiac/capricorn', '♒': 'zodiac/aquarius', '♓': 'zodiac/pisces'
  };
  const icon = elements[symbol] ? `<svg viewBox="0 0 20 20">${elements[symbol]}</svg>`
    : assets[symbol] ? `<img src="assets/${assets[symbol]}.svg" width="20" height="20" alt="">` : '';
  return icon ? `<span class="correspondence-symbol" aria-hidden="true">${icon}</span>` : '';
}
function showSphere(id, trigger) {
  if (mode === 'personal' && !personalTree) return;
  const sphere = spheres.find(item => item.id === id);
  const study = sphereStudy[id];
  if (!sphere || !study) return;
  if (mode === 'base') {
    openSheet(`${orbHTML(sphere)}<h2 id="sheet-title">${sphere.name}</h2><p class="sheet-subtitle">${study.meaning} <span class="hebrew-name" lang="he" dir="rtl">${study.hebrew}</span></p><p>${study.description}</p><dl><div><dt>${t('Correspondência')}</dt><dd>${symbolHTML(study.symbol)}${study.correspondence}</dd></div><div><dt>${t('Cor · escala Queen')}</dt><dd>${sphere.queenColor}</dd></div></dl>`, trigger);
  } else {
    const value = personalTree.values[id];
    const reading = sphereEnergyReading(id, { tree: personalTree });
    const connections = sphereConnections(id, personalTree).map(connection => {
      const other = spheres.find(item => item.id === connection.other);
      const labels = connection.types.map(type => lineTypes[type].label).join(' · ');
      return `<section><h3>${t('Caminho {n} · {from} e {to}', { n: connection.number, from: sphere.name, to: other.name })}</h3><p class="cabala-relationship">${connection.relationshipText}</p>${connection.countText ? `<details class="cabala-calculation"><summary>${t(learningWords.calculation[0])}</summary><p>${labels}</p><p>${connection.countText}</p></details>` : ''}</section>`;
    }).join('');
    openSheet(`${orbHTML(sphere)}<h2 id="sheet-title">${sphere.name}</h2><p class="sheet-subtitle">${t('Sua energia')} · ${sphere.subtitle} · ${value}</p><h3>${reading.title}</h3><p>${reading.paragraphs[0]}</p><h3>${t(learningWords.observe[0])}</h3><p>${reading.question}</p><h3>${t(learningWords.connections[0])}</h3>${connections}<details class="cabala-calculation"><summary>${t(learningWords.calculation[0])}</summary><h3>${t(learningWords.count[0], { value })}</h3>${reading.paragraphs.slice(1).map(text => `<p>${text}</p>`).join('')}</details>`, trigger);
  }
}
function showPath(number, trigger) {
  if (mode === 'personal' && !personalTree) return;
  const path = (mode === 'base' ? paths : personalTree.paths).find(item => item.number === number);
  if (!path) return;
  const from = spheres.find(sphere => sphere.id === path.from).name;
  const to = spheres.find(sphere => sphere.id === path.to).name;
  if (mode === 'base') {
    const attribution = path.attribution || '';
    openSheet(`<span class="path-letter" lang="he">${path.letter}</span><h2 id="sheet-title">${t('Caminho {n}', { n: path.number })}</h2><p class="sheet-subtitle">${from} <span aria-hidden="true">↔</span> ${to}</p><p>${path.description}</p><dl><div><dt>${t('Letra hebraica')}</dt><dd><span lang="he">${path.letter}</span> · ${path.letterName}</dd></div><div><dt>${t('Correspondência')}</dt><dd>${symbolHTML(path.symbol)}${attribution}</dd></div><div><dt>${t('Carta do Tarô (Thoth)')}</dt><dd>${path.thoth}</dd></div></dl>`, trigger);
  } else {
    const reading = personalPathReading(path);
    if (!reading) return;
    const descriptions = reading.types.map(type => [type, lineTypes[type]]);
    const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const cycles = (pathCycles(activeProfile(), personalTree)[path.number] || []).map(cycle => {
      const vars = { n: cycle.months >= 12 ? cycle.months / 12 : cycle.months, date: monthYear.format(cycle.next) };
      const text = cycle.months >= 12
        ? cycle.event === 'overload' ? t('Ciclo de {n} anos · marco simbólico de concentração: {date}.', vars) : t('Ciclo de {n} anos · marco simbólico de revisão: {date}.', vars)
        : cycle.event === 'overload' ? t('Ciclo de {n} meses · marco simbólico de concentração: {date}.', vars) : t('Ciclo de {n} meses · marco simbólico de revisão: {date}.', vars);
      return `<p class="path-cycle">${text}</p>`;
    }).join('');
    const cycleNote = cycles ? `<p>${t('Essas datas situam etapas simbólicas do ciclo, sem prever acontecimentos.')}</p>` : '';
    openSheet(`<span class="personal-path-number">${path.number}</span><h2 id="sheet-title">${t('Seu caminho {n}', { n: path.number })}</h2><p class="sheet-subtitle">${from} <span aria-hidden="true">↔</span> ${to}</p><p class="cabala-relationship">${reading.relationshipText}</p><div class="path-reading">${descriptions.map(entry => `<div class="path-reading-item">${legendRow(entry)}<p>${entry[1].description}</p></div>`).join('')}</div>${reading.countText ? `<details class="cabala-calculation"><summary>${t(learningWords.calculation[0])}</summary><p>${reading.countText}</p></details>` : ''}${cycles}${cycleNote}<h3>${t(learningWords.observe[0])}</h3><p>${reading.question}</p>`, trigger);
  }
}
function activateTreeItem(target) {
  const sphere = target.closest('.sphere-node');
  if (sphere) { showSphere(sphere.dataset.sphere, sphere); return; }
  const path = target.closest('.path-node');
  if (path) showPath(Number(path.dataset.path), path);
}
mount.addEventListener('click', event => {
  let target = event.target;
  if (event.detail && target.closest('.path-node')) {
    // Alvos de44px se sobrepõem na árvore estreita: o marcador mais próximo decide, não a ordem do SVG.
    let nearest = 22;
    for (const marker of mount.querySelectorAll('.path-marker-hit')) {
      const point = marker.getPointAtLength(0).matrixTransform(marker.getScreenCTM());
      const distance = Math.hypot(point.x - event.clientX, point.y - event.clientY);
      if (distance < nearest) { nearest = distance; target = marker; }
    }
  }
  activateTreeItem(target);
});
mount.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateTreeItem(event.target); }
});
closeButton.addEventListener('click', closeSheet);
backdrop.addEventListener('click', closeSheet);
document.addEventListener('keydown', event => {
  if (sheet.hidden) return;
  if (event.key === 'Escape') closeSheet();
  if (event.key === 'Tab') {
    const focusable = [...sheet.querySelectorAll('button:not([disabled]),a[href],select:not([disabled]),input:not([disabled]),summary,[tabindex="0"]')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
setMode(mode, false);
onProfilesChange(() => {
  setMode(mode, false);
  if (!sheet.hidden && mode === 'personal') closeSheet();
});
mapExplorer = initMapExplorer({ root: scene.querySelector('[data-area="map"]'), solar: solarStudy, header: document.querySelector('#profile-button') });
