// Cores Queen/Briah: The Golden Dawn, “The Four Colour Scales”. Materiais são direção artística.
import { t } from './i18n.js';
export const spheres = [
  { id: 'kether', name: 'Kether', subtitle: t('Divindade'), value: '4/3', x: 300, y: 80, queenColor: t('Branco luminoso'), material: t('Opala branca · luz difusa'), traditionalMeaning: t('Na escala Queen, o brilho branco de Kether representa a luz divina que antecede as demais cores.'), tones: ['#fffef3', '#dddde3', '#7b8096'], ink: '#151c30' },
  { id: 'binah', name: 'Binah', subtitle: t('Criatividade'), value: '8/4', x: 100, y: 195, queenColor: t('Preto'), material: t('Obsidiana · profundidade acetinada'), traditionalMeaning: t('A descrição tradicional de Binah fala de escuridão, mistério, profundidade e silêncio; nela todas as cores estão ocultas.'), tones: ['#666375', '#252330', '#080b18'], ink: '#fff7ea' },
  { id: 'chokmah', name: 'Chokmah', subtitle: t('Sabedoria'), value: '8/4', x: 500, y: 195, queenColor: t('Cinza perolado'), material: t('Prata enevoada · reflexo de pérola'), traditionalMeaning: t('Chokmah aparece como um cinza de nuvem, semelhante a uma névoa perolada transparente, contendo outras cores.'), tones: ['#ecebf2', '#9a9baa', '#454d67'], ink: '#141a2a' },
  { id: 'geburah', name: 'Geburah', subtitle: t('Poder'), value: '4/4', x: 100, y: 425, queenColor: t('Vermelho escarlate'), material: t('Vidro escarlate · veios de fogo'), traditionalMeaning: t('O vermelho puro e cintilante de Geburah é descrito como uma cor que reflete a raiz do vermelho e flameja com força.'), tones: ['#f79583', '#c52d47', '#551627'], ink: '#fff7ef' },
  { id: 'chesed', name: 'Chesed', subtitle: t('Amor'), value: '5/4', x: 500, y: 425, queenColor: t('Azul'), material: t('Safira · azul de profundidade'), traditionalMeaning: t('Chesed recebe um azul puro e brilhante, associado na fonte a paz, beneficência e magnificência.'), tones: ['#8aaceb', '#234fa6', '#101f54'], ink: '#fff7ef' },
  { id: 'tiphareth', name: 'Tiphareth', subtitle: t('Eu'), value: '5/8', x: 300, y: 540, queenColor: t('Amarelo dourado'), material: t('Ouro solar · polimento suave'), traditionalMeaning: t('Tiphareth recebe o amarelo dourado puro e cintilante. A fonte associa sua esfera de operação à luz solar.'), tones: ['#fff0bd', '#e6b64f', '#8b5b22'], ink: '#241b1b' },
  { id: 'hod', name: 'Hod', subtitle: t('Mente'), value: '4/5', x: 100, y: 655, queenColor: t('Laranja'), material: t('Âmbar · estrias translúcidas'), traditionalMeaning: t('O laranja de Hod resulta, na descrição tradicional, do encontro dos raios de Geburah e Tiphareth.'), tones: ['#ffd6a1', '#df873c', '#883e24'], ink: '#2b1c1a' },
  { id: 'netzach', name: 'Netzach', subtitle: t('Emoções'), value: '4/5', x: 500, y: 655, queenColor: t('Verde esmeralda'), material: t('Esmeralda · brilho líquido'), traditionalMeaning: t('A cor de Netzach é descrita como verde puro, brilhante e líquido, semelhante a uma esmeralda.'), tones: ['#8cd7b0', '#237f64', '#103d38'], ink: '#fff7ef' },
  { id: 'yesod', name: 'Yesod', subtitle: t('Ego'), value: '3/4', x: 300, y: 770, queenColor: t('Violeta'), material: t('Ametista · camadas de névoa'), traditionalMeaning: t('Yesod recebe um violeta profundo. A fonte associa sua esfera de operação ao raio lunar e às mudanças.'), tones: ['#cbb3ef', '#7952b1', '#392653'], ink: '#fff7ef' },
  { id: 'malkuth', name: 'Malkuth', subtitle: t('Corpo'), value: '3/3', x: 300, y: 1000, queenColor: t('Citrino, oliva, castanho e preto'), material: t('Quatro terras · superfície mineral'), traditionalMeaning: t('Malkuth reúne citrino, oliva, castanho avermelhado e preto. A divisão em quatro campos é visual; as quatro cores vêm da escala Queen.'), tones: ['#c5b56f', '#777343', '#27251f'], ink: '#fff7ef' },
];


// Contas de luz: cada tipo de linha tem halo e núcleo; "gap" é o espaço entre contas, `dim` apaga o halo (linhas ocultas).
export const beadStyles = {
  standard: { halo: '#e9dcc8', core: '#fffaf0', gap: 14 },
  hidden: { core: '#fffaf0', gap: 14, dim: true },
  primary: { halo: '#6f9be8', core: '#dbe7ff', gap: 11 },
  'primary-hidden': { core: '#dbe7ff', gap: 11, dim: true },
  secondary: { halo: '#4fc79b', core: '#dcfff0', gap: 11 },
  'secondary-hidden': { core: '#dcfff0', gap: 11, dim: true },
  'long-crisis': { halo: '#f0705a', core: '#ffdcd2', gap: 10 },
  'short-crisis': { halo: '#f0705a', core: '#ffdcd2', gap: 26 },
  karma: { halo: '#b48ae6', core: '#f1e3ff', gap: 11 }
};
const sample = type => ({ type });

// Posições dos marcadores e uma árvore de referência anônima do app Kabbalah; cabala-engine.js reproduz estas linhas.
export const personalPaths = [
  { id: 1, number: 1, from: 'kether', to: 'binah', x: 200, y: 139, samples: [sample('secondary'), sample('standard')] },
  { id: 22, number: 22, from: 'kether', to: 'chokmah', x: 400, y: 139, gift: true, samples: [sample('standard')] },
  { id: 3, number: 3, from: 'chokmah', to: 'binah', x: 235, y: 195, samples: [sample('primary'), sample('standard'), sample('standard'), sample('standard'), sample('standard')] },
  { id: 2, number: 2, from: 'kether', to: 'tiphareth', x: 300, y: 310, gift: true, samples: [sample('standard')] },
  { id: 7, number: 7, from: 'binah', to: 'geburah', x: 100, y: 310, samples: [] },
  { id: 5, number: 5, from: 'chokmah', to: 'chesed', x: 500, y: 310, samples: [sample('long-crisis')] },
  { id: 6, number: 6, from: 'binah', to: 'tiphareth', x: 170, y: 315.75, gift: true, samples: [sample('short-crisis')] },
  { id: 4, number: 4, from: 'chokmah', to: 'tiphareth', x: 430, y: 315.75, gift: true, samples: [sample('standard')] },
  { id: 8, number: 8, from: 'chesed', to: 'geburah', x: 180, y: 425, samples: [sample('standard')] },
  { id: 11, number: 11, from: 'geburah', to: 'tiphareth', x: 220, y: 494, samples: [sample('karma')] },
  { id: 9, number: 9, from: 'chesed', to: 'tiphareth', x: 380, y: 494, samples: [sample('standard')] },
  { id: 12, number: 12, from: 'geburah', to: 'hod', x: 100, y: 540, samples: [sample('primary'), sample('hidden'), sample('standard')] },
  { id: 10, number: 10, from: 'chesed', to: 'netzach', x: 500, y: 540, samples: [sample('secondary'), sample('standard')] },
  { id: 15, number: 15, from: 'tiphareth', to: 'hod', x: 220, y: 586, samples: [sample('karma')] },
  { id: 13, number: 13, from: 'tiphareth', to: 'netzach', x: 380, y: 586, gift: true, samples: [sample('standard')] },
  { id: 14, number: 14, from: 'tiphareth', to: 'yesod', x: 300, y: 620, samples: [] },
  { id: 16, number: 16, from: 'netzach', to: 'hod', x: 180, y: 655, samples: [] },
  { id: 19, number: 19, from: 'hod', to: 'yesod', x: 200, y: 712, samples: [sample('secondary')] },
  { id: 17, number: 17, from: 'netzach', to: 'yesod', x: 400, y: 712, samples: [] },
  { id: 20, number: 20, from: 'hod', to: 'malkuth', x: 200, y: 825, samples: [] },
  { id: 18, number: 18, from: 'netzach', to: 'malkuth', x: 400, y: 825, samples: [sample('hidden')] },
  { id: 21, number: 21, from: 'yesod', to: 'malkuth', x: 300, y: 882, samples: [sample('primary-hidden'), sample('standard')] },
];

const sphereById = Object.fromEntries(spheres.map(sphere => [sphere.id, sphere]));
const meanings = { kether: t('Coroa'), chokmah: t('Sabedoria'), binah: t('Entendimento'), chesed: t('Misericórdia'), geburah: t('Força'), tiphareth: t('Beleza'), netzach: t('Vitória'), hod: t('Esplendor'), yesod: t('Fundamento'), malkuth: t('Reino') };
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const LANE = 13, SPHERE_EDGE = 44;
// A primeira linha fica do lado positivo do eixo; as fileiras começam na borda das esferas.
function geometry(path, lane = 0, laneCount = 1) {
  const from = sphereById[path.from];
  const to = sphereById[path.to];
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const ux = (to.x - from.x) / distance, uy = (to.y - from.y) / distance;
  const spread = ((laneCount - 1) / 2 - lane) * LANE;
  const dx = uy * spread, dy = -ux * spread;
  const n = value => +value.toFixed(1);
  return `M${n(from.x + ux * SPHERE_EDGE + dx)} ${n(from.y + uy * SPHERE_EDGE + dy)}L${n(to.x - ux * SPHERE_EDGE + dx)} ${n(to.y - uy * SPHERE_EDGE + dy)}`;
}

function beads(d, bead) {
  const dash = `stroke-dasharray="0 ${bead.gap}"`;
  if (bead.dim) return `<path class="path-color" d="${d}" fill="none" stroke="${bead.core}" stroke-opacity=".45" stroke-width="3.4" stroke-linecap="round" ${dash}/>`;
  // Halo em dois traços largos e translúcidos: o blur SVG some em linhas retas (bbox de largura 0) e pesa no iPhone.
  return `<path d="${d}" fill="none" stroke="${bead.halo}" stroke-opacity=".16" stroke-width="15" stroke-linecap="round" ${dash}/><path d="${d}" fill="none" stroke="${bead.halo}" stroke-opacity=".5" stroke-width="9" stroke-linecap="round" ${dash}/><path class="path-color" d="${d}" fill="none" stroke="${bead.core}" stroke-width="4.2" stroke-linecap="round" ${dash}/>`;
}

function pathNode(path, personal) {
  const slot = personal ? path : personalPaths.find(item => (item.from === path.from && item.to === path.to) || (item.from === path.to && item.to === path.from));
  const from = sphereById[path.from];
  const to = sphereById[path.to];
  const x = slot?.x ?? (from.x + to.x) / 2;
  const y = slot?.y ?? (from.y + to.y) / 2;
  const { number } = path;
  const d = geometry(path);
  const markerSize = 41.2;
  const focusRadius = 22.5;
  const samples = personal ? path.samples : [{ halo: path.color || '#a6aedf' }];
  const label = personal ? t(path.gift ? 'Seu caminho {n}, dom' : 'Seu caminho {n}', { n: number }) : `${t('Caminho {n}', { n: number })}, ${path.letterName || ''}, ${path.attribution || ''}`;
  const guide = `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${samples.length ? '.14' : '.18'}" stroke-width="1.2"/>`;
  const geometryMarkup = guide + samples.map((sample, index) => beads(geometry(path, index, samples.length), personal ? beadStyles[sample.type] : { ...beadStyles.standard, halo: sample.halo })).join('');
  const letter = !personal && path.letter ? `<text class="path-letter" x="${x}" y="${y + 16}" text-anchor="middle" font-family="Georgia,serif" font-size="13" fill="#d3cce9">${escape(path.letter)}</text>` : '';
  // O traço não escalável mantém o alvo de44px quando a árvore SVG encolhe no celular.
  return `<g class="path-node ${personal ? 'path-personal' : 'path-base'}" data-path="${number}" role="button" tabindex="0" aria-label="${escape(label)}"><title>${escape(label)}</title><g class="path-geometry" pointer-events="none">${geometryMarkup}</g><path class="path-hit" d="${d}" fill="none" stroke="transparent" stroke-width="40" pointer-events="stroke"/><g class="path-marker"><path class="path-marker-hit" d="M${x} ${y}h.01" fill="none" stroke="transparent" stroke-width="44" stroke-linecap="round" vector-effect="non-scaling-stroke" pointer-events="stroke"/><circle class="path-focus" cx="${x}" cy="${y}" r="${focusRadius}" fill="none" stroke="#f0eaff" stroke-width="1.5" opacity="0"/><image href="assets/path-marker${personal && path.gift ? '-gift' : ''}.svg" x="${x - markerSize / 2}" y="${y - markerSize / 2}" width="${markerSize}" height="${markerSize}" pointer-events="none"/><text class="path-number" x="${x}" y="${y + (letter ? 1 : personal ? 6.5 : 7)}" text-anchor="middle" font-family="Space,sans-serif" font-size="${letter ? '20' : personal ? '19' : '24'}" font-weight="500" fill="${personal && path.gift ? '#ffdf9b' : '#f0eafa'}" pointer-events="none">${number}</text>${letter}</g></g>`;
}

function sphereNode(sphere, personal, value = sphere.value) {
  const { id, name, subtitle, x, y } = sphere;
  const valueX = x === 100 ? 44 : x === 500 ? 557 : 360;
  const label = personal ? t('{name}, {subtitle}, energia {value}. Abrir sua esfera.', { name, subtitle, value: value.replace('/', ` ${t('de')} `) }) : t('{name}, {meaning}. Sobre a esfera.', { name, meaning: meanings[id] });
  return `<g class="sphere-node" role="button" tabindex="0" data-sphere="${id}" aria-label="${escape(label)}"><title>${name} · ${sphere.queenColor}</title><circle class="sphere-focus" cx="${x}" cy="${y}" r="51" fill="none" stroke="#f0eaff" stroke-width="1.5" opacity="0"/><circle cx="${x}" cy="${y}" r="48" fill="transparent"/><image class="sphere-asset" href="assets/spheres/${id}.svg" x="${x - 54}" y="${y - 54}" width="108" height="108" pointer-events="none"/><circle cx="${x}" cy="${y}" r="47" fill="url(#kt-light-${id})" pointer-events="none"/><text class="sphere-name" x="${x}" y="${y - 3}" fill="#fcf6ff" text-anchor="middle" font-family="Space,sans-serif" font-size="${name === 'Tiphareth' ? '17' : '18'}" font-weight="600" stroke="#0b1027" stroke-width="3.5" paint-order="stroke" stroke-opacity=".9">${name}</text><text class="sphere-subtitle" x="${x}" y="${y + 16}" fill="#f1eafa" text-anchor="middle" font-family="Space,sans-serif" font-size="${!personal && meanings[id].length > 9 ? 13 : 15}" stroke="#0b1027" stroke-width="3" paint-order="stroke" stroke-opacity=".9">${personal ? subtitle : meanings[id]}</text>${personal ? `<text class="sphere-value" x="${valueX}" y="${y + 7}" fill="#eddcc7" text-anchor="${x === 100 ? 'end' : 'start'}" font-family="Space,sans-serif" font-size="22" font-weight="500">${value}</text>` : ''}</g>`;
}

// `tree` vem de computeTree (cabala-engine.js); sem ele, a árvore pessoal mostra a referência.
export function renderTree(mode = 'base', paths = [], tree = null) {
  const personal = mode === 'personal';
  const renderedPaths = personal ? tree?.paths || personalPaths : paths;
  return `<svg class="tree-svg tree-${personal ? 'personal' : 'base'}" viewBox="0 0 600 1100" xmlns="http://www.w3.org/2000/svg" role="group" aria-labelledby="kt-title kt-description"><title id="kt-title">${personal ? t('A sua árvore') : t('Árvore da Vida: estudo dos dez sefirot e 22 caminhos')}</title><desc id="kt-description">${personal ? t('Toque nas esferas e nos caminhos para ver seus detalhes.') : t('Árvore de estudo com as dez esferas e seus caminhos. Toque nos elementos para estudar suas correspondências.')}</desc><defs>${spheres.map(sphere => `<radialGradient id="kt-light-${sphere.id}" cx=".43" cy=".38" r=".62"><stop stop-color="${sphere.tones[0]}" stop-opacity=".8"/><stop offset=".55" stop-color="${sphere.tones[1]}" stop-opacity=".55"/><stop offset="1" stop-color="${sphere.tones[1]}" stop-opacity="0"/></radialGradient>`).join('')}</defs><g class="tree-structure" id="kt-structure"><g class="tree-paths">${renderedPaths.map(path => pathNode(path, personal)).join('')}</g><g class="tree-spheres">${spheres.map(sphere => sphereNode(sphere, personal, tree?.values[sphere.id])).join('')}</g></g></svg>`;
}
