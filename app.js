import { renderTree, spheres, beadStyles } from './tree.js';
import { computeTree, pathCycles } from './cabala-engine.js?v=20261020-ciclos';
import { sphereStudy, paths, sources } from './study-data.js';
import { sphereEnergyReading } from './sphere-energy.js';
import { personalPathReading, sphereConnections } from './cabala-readings.js';
import { cabalaLineTexts } from './cabala-path-texts.js';
import { initOrbit } from './orbit.js';
import { initPlanetSelector } from './planet-selector.js?v=20261019-estrutura';
import { initSolarStudy } from './solar-study.js?v=20261019-eixos';
import { initMapExplorer } from './map-explorer.js?v=20261019-eixos';
import { activeProfile, onProfilesChange } from './profiles.js';
import { t, locale } from './i18n.js';

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
let mode = 'base';
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
for (const [key, entry] of Object.entries(lineTypes)) entry.description = t(cabalaLineTexts[key][0]);

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
    : t('Suas energias e seus caminhos,<br>em uma leitura pessoal da árvore.');
  document.querySelector('#base-note').hidden = mode !== 'base';
  document.querySelector('#base-help').hidden = mode !== 'base';
  const person = activeProfile();
  personalTree = computeTree(person);
  const personalAvailable = mode !== 'personal' || Boolean(personalTree);
  if (mode === 'personal' && !personalAvailable) {
    document.querySelector('#tree-description').textContent = person ? person.name : t('Cadastre seus dados de nascimento.');
  }
  document.querySelector('#reading-help').hidden = mode !== 'personal' || !personalAvailable;
  document.querySelector('.tree-figure figcaption').hidden = !personalAvailable;
  circles.hidden = !personalAvailable;
  mount.innerHTML = personalAvailable ? renderTree(mode, paths, personalTree) : `<div class="map-empty"><p>${person ? t('Sua árvore pessoal ainda não está disponível.') : t('Cadastre uma pessoa para começar.')}</p>${person ? '' : `<a href="./perfil.html">${t('Cadastrar dados de nascimento')}</a>`}</div>`;
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
function sourceHTML(url = sources[0].url) {
  const source = sources.find(item => item.url === url) || sources[0];
  return `<p class="source-note">${t('Referência:')} <a href="${source.url}" target="_blank" rel="noreferrer">${source.label}</a>.</p>`;
}
function symbolHTML(symbol) {
  const elements = {
    '🜁': '<path d="m10 3 8 14H2Z M5 12h10"/>',
    '🜄': '<path d="m10 17 8-14H2Z"/>',
    '🜂': '<path d="m10 3 8 14H2Z"/>'
  };
  if (!symbol || /^[12]$/.test(symbol)) return '';
  return `<span class="correspondence-symbol" aria-hidden="true">${elements[symbol] ? `<svg viewBox="0 0 20 20">${elements[symbol]}</svg>` : symbol}</span>`;
}
function showSphere(id, trigger) {
  if (mode === 'personal' && !personalTree) return;
  const sphere = spheres.find(item => item.id === id);
  const study = sphereStudy[id];
  if (!sphere || !study) return;
  if (mode === 'base') {
    openSheet(`${orbHTML(sphere)}<h2 id="sheet-title">${sphere.name}</h2><p class="sheet-subtitle">${study.meaning} <span class="hebrew-name" lang="he" dir="rtl">${study.hebrew}</span></p><p>${study.description}</p><dl><div><dt>${t('Correspondência')}</dt><dd>${symbolHTML(study.symbol)}${study.correspondence}</dd></div><div><dt>${t('Cor · escala Queen')}</dt><dd>${sphere.queenColor}</dd></div></dl>${sourceHTML()}`, trigger);
  } else {
    const value = personalTree.values[id];
    const reading = sphereEnergyReading(id, { value });
    const connections = sphereConnections(id, personalTree).map(connection => {
      const other = spheres.find(item => item.id === connection.other);
      const labels = connection.types.map(type => lineTypes[type].label).join(' · ');
      return `<section><h3>${t('Caminho {n} · {from} e {to}', { n: connection.number, from: sphere.name, to: other.name })}</h3><p>${labels}</p><p>${connection.text}</p></section>`;
    }).join('');
    openSheet(`${orbHTML(sphere)}<h2 id="sheet-title">${sphere.name}</h2><p class="sheet-subtitle">${t('Sua energia')} · ${sphere.subtitle} · ${value}</p><h3>${reading.title}</h3>${reading.paragraphs.map(text => `<p>${text}</p>`).join('')}${connections}`, trigger);
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
    openSheet(`<span class="path-letter" lang="he">${path.letter}</span><h2 id="sheet-title">${t('Caminho {n}', { n: path.number })}</h2><p class="sheet-subtitle">${from} <span aria-hidden="true">↔</span> ${to}</p><p>${path.description}</p><dl><div><dt>${t('Letra hebraica')}</dt><dd><span lang="he">${path.letter}</span> · ${path.letterName}</dd></div><div><dt>${t('Correspondência')}</dt><dd>${symbolHTML(path.symbol)}${attribution}</dd></div><div><dt>${t('Carta do Tarô (Thoth)')}</dt><dd>${path.thoth}</dd></div></dl>${sourceHTML(path.source)}`, trigger);
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
    openSheet(`<span class="personal-path-number">${path.number}</span><h2 id="sheet-title">${t('Seu caminho {n}', { n: path.number })}</h2><p class="sheet-subtitle">${from} <span aria-hidden="true">↔</span> ${to}</p><p>${reading.text}</p><div class="path-reading">${descriptions.map(entry => `<div class="path-reading-item">${legendRow(entry)}<p>${entry[1].description}</p></div>`).join('')}</div>${cycles}${cycleNote}`, trigger);
  }
}
function activateTreeItem(target) {
  const sphere = target.closest('.sphere-node');
  if (sphere) { showSphere(sphere.dataset.sphere, sphere); return; }
  const path = target.closest('.path-node');
  if (path) showPath(Number(path.dataset.path), path);
}
mount.addEventListener('click', event => activateTreeItem(event.target));
mount.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateTreeItem(event.target); }
});
closeButton.addEventListener('click', closeSheet);
backdrop.addEventListener('click', closeSheet);
document.addEventListener('keydown', event => {
  if (sheet.hidden) return;
  if (event.key === 'Escape') closeSheet();
  if (event.key === 'Tab') {
    const focusable = [...sheet.querySelectorAll('button:not([disabled]),a[href],select:not([disabled]),input:not([disabled]),[tabindex="0"]')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
setMode('base', false);
onProfilesChange(() => {
  setMode(mode, false);
  if (!sheet.hidden && mode === 'personal') closeSheet();
});
mapExplorer = initMapExplorer({ root: scene.querySelector('[data-area="map"]'), solar: solarStudy, header: document.querySelector('#profile-button') });
