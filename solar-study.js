import * as THREE from './vendor/three.module.js';
import { t } from './i18n.js';
import { fixtureSceneData, emptySceneData, BODY_NAMES, BODY_GLYPHS, angleDelta } from './map-data.js';

const defaultTilt = 45.5;
const cameraDistance = Math.hypot(7.5, 10.5);
const cameraTilt = Math.atan2(7.5, 10.5) + THREE.MathUtils.degToRad(10);
const cameraPosition = () => new THREE.Vector3(0, cameraDistance * Math.sin(cameraTilt), cameraDistance * Math.cos(cameraTilt));
const signLabels = ['♈︎', '♉︎', '♊︎', '♋︎', '♌︎', '♍︎', '♎︎', '♏︎', '♐︎', '♑︎', '♒︎', '♓︎'];
const signNames = [t('Áries'), t('Touro'), t('Gêmeos'), t('Câncer'), t('Leão'), t('Virgem'), t('Libra'), t('Escorpião'), t('Sagitário'), t('Capricórnio'), t('Aquário'), t('Peixes')];
// Segundo conjunto fora do aro dos signos (5,05–5,5): parceiro/trânsitos em 5,95 e, com os dois, trânsitos em 6,55.
export const OUTER_RADII = [5.95, 6.55];
const OUTER_COLORS = { transit: '#8fd8cc', partner: '#e9a6d2' };
const OUTER_SCALE = .8;
const bodyGlyphs = {
  sun: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  mercury: '<circle cx="12" cy="11" r="4.5"/><path d="M7.5 3c0 6 9 6 9 0M12 15.5V22M8.5 19h7"/>',
  venus: '<circle cx="12" cy="8" r="5.5"/><path d="M12 13.5V22M8 18.5h8"/>',
  earth: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4v16"/>',
  mars: '<circle cx="9" cy="15" r="6"/><path d="m13.3 10.7 7-7M15 3h6v6"/>',
  jupiter: '<path d="M6 3c10 0 6 10-2 11h16M14 4v18"/>',
  saturn: '<path d="M7 2v18M3 7h8M7 13c8-8 14-2 9 5-4 6 1 6 4 3"/>',
  uranus: '<circle cx="12" cy="18.5" r="3"/><path d="M12 15.5V3M4 3v11M20 3v11M4 8.5h16"/>',
  neptune: '<path d="M5 4c0 12 14 12 14 0M12 2v20M8 18h8M3 6l2-2 2 2M17 6l2-2 2 2"/>',
  moon: '<path d="M16.5 3a9.5 9.5 0 1 0 0 18 9.8 9.8 0 0 1 0-18Z"/>',
  pluto: '<path d="M7 21V3h6a5 5 0 0 1 0 10H7M7 21h12"/>',
  chiron: '<circle cx="10" cy="17.5" r="4"/><path d="M10 13.5V2M10 8l7-6M10 8l7 6"/>',
  ceres: '<path d="M12 21v-8M12 13a6 6 0 1 0-6-6"/>',
  pallas: '<circle cx="12" cy="8" r="5"/><path d="M12 13v9M8 18h8M12 3V1"/>',
  juno: '<path d="M12 3v18M7 7l5 3 5-3M6 14h12"/>',
  vesta: '<path d="M12 4v13M7 11l5 6 5-6M7 21h10"/>'
};

// O ASC fica à esquerda (-X); planetas, signos e régua compartilham a mesma orientação natal.
function longitudePoint(longitude, radius = 5, y = .04, ascendant = 0) {
  const angle = THREE.MathUtils.degToRad(180 + ascendant - longitude);
  return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

// Distâncias visuais sem escala astronômica; só os ângulos vêm do mapa fornecido.
// Terra central, Lua próxima e uma faixa por planeta; o Sol ocupa a terceira, entre Vênus e Marte.
const bodies = [
  { id: 'sun', radius: .31, color: '#e6ae54', orbit: 1.95, height: .36 },
  { id: 'mercury', radius: .20, color: '#8b847b', orbit: 1.05, height: .24 },
  { id: 'venus', radius: .27, color: '#d9b990', orbit: 1.5, height: .31 },
  { id: 'earth', radius: .30, color: '#487ca1', orbit: 0, height: .34 },
  { id: 'mars', radius: .23, color: '#a95f40', orbit: 2.4, height: .27 },
  { id: 'jupiter', radius: .42, color: '#bda48c', orbit: 2.85, height: .45 },
  { id: 'saturn', radius: .35, color: '#c6b48e', orbit: 3.3, height: .40 },
  { id: 'uranus', radius: .29, color: '#8ec8ca', orbit: 3.75, height: .33 },
  { id: 'neptune', radius: .28, color: '#3e67aa', orbit: 4.2, height: .32 },
  { id: 'moon', radius: .21, color: '#b8b9ba', orbit: 0.55, height: .25 },
  { id: 'pluto', radius: .20, color: '#c7b9aa', orbit: 4.65, height: .24 },
  { id: 'chiron', radius: .20, color: '#b4a691', orbit: 3.2, height: .24 },
  { id: 'ceres', radius: .17, color: '#8d8a86', orbit: 2.9, height: .22 },
  { id: 'pallas', radius: .17, color: '#85849a', orbit: 3.65, height: .22 },
  { id: 'juno', radius: .16, color: '#a98d72', orbit: 4.4, height: .21 },
  { id: 'vesta', radius: .16, color: '#b9a183', orbit: 2.45, height: .21 }
];
// Corpos menores: atlas próprio (3×3, mesma grade do atlas dos planetas), na ordem abaixo.
const MINOR = ['chiron', 'ceres', 'pallas', 'juno', 'vesta'];

function applyAtlas(planets, atlas) {
  planets.forEach(planet => {
    const { row, column } = planet.userData;
    if (row === undefined) return;
    const map = atlas.clone();
    const inset = .003;
    map.colorSpace = THREE.SRGBColorSpace;
    map.repeat.set(1 / 3 - inset * 2, 1 / 3 - inset * 2);
    map.offset.set(column / 3 + inset, (2 - row) / 3 + inset);
    map.needsUpdate = true;
    planet.material.map = map;
    planet.material.color.set('#ffffff');
    if (planet.name === 'sun') {
      planet.material.emissiveMap = map;
      planet.material.emissive.set('#ffffff');
    }
    planet.material.needsUpdate = true;
  });
}

function applyMinorAtlas(planets, atlas) {
  const minor = planets.filter(planet => MINOR.includes(planet.name));
  minor.forEach(planet => {
    const index = MINOR.indexOf(planet.name);
    Object.assign(planet.userData, { row: Math.floor(index / 3), column: index % 3 });
  });
  applyAtlas(minor, atlas);
}

function circle(radius, material) {
  const points = Array.from({ length: 128 }, (_, index) => {
    const angle = index / 128 * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  });
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
}

export function buildSolarScene({ atlas = null, minorAtlas = null, data = fixtureSceneData() } = {}) {
  const ascendant = data.asc;
  const at = (longitude, radius, y) => longitudePoint(longitude, radius, y, ascendant);
  const natalPlacements = data.natal;
  const scene = new THREE.Scene();
  const system = new THREE.Group();
  scene.add(system);
  const camera = new THREE.PerspectiveCamera(38, 320 / 300, .1, 100);
  camera.position.copy(cameraPosition());
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#fff6e6', '#142641', 1.15));
  const light = new THREE.DirectionalLight('#fff3df', 2.1);
  light.position.set(-5, 8, 7);
  scene.add(light);

  const planets = bodies.filter(body => body.id === 'earth' ? Object.keys(natalPlacements).length > 0 : natalPlacements[body.id]).map(body => {
    const index = bodies.indexOf(body);
    const material = new THREE.MeshStandardMaterial({ color: body.color, roughness: .92, metalness: 0 });
    if (body.id === 'sun') {
      material.emissive.set(body.color);
      material.emissiveIntensity = .55;
    }
    const planet = new THREE.Mesh(new THREE.SphereGeometry(body.radius, 32, 24), material);
    planet.name = body.id;
    planet.userData = { id: body.id, radius: body.radius };
    if (index < 9) Object.assign(planet.userData, { row: Math.floor(index / 3), column: index % 3 });
    if (body.id === 'earth') planet.position.set(0, body.height, 0);
    else planet.position.copy(at(natalPlacements[body.id].longitude, body.orbit, body.height));
    planet.rotation.y = index * .7;
    system.add(planet);
    return planet;
  });
  const natalCount = planets.length;
  const outerLeaders = [];
  const outerGuides = [];
  data.outer.forEach((set, setIndex) => {
    const radius = OUTER_RADII[setIndex];
    const color = OUTER_COLORS[set.key] || '#cfd8f0';
    const guide = circle(radius, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .3, depthWrite: false }));
    guide.name = `outer-guide-${set.key}`;
    outerGuides.push(guide);
    system.add(guide);
    const leaderMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: .55, depthWrite: false });
    set.bodies.forEach(item => {
      const base = bodies.find(body => body.id === item.base);
      const baseIndex = bodies.indexOf(base);
      const material = new THREE.MeshStandardMaterial({ color: base.color, roughness: .92, metalness: 0, emissive: color, emissiveIntensity: .12 });
      const planet = new THREE.Mesh(new THREE.SphereGeometry(base.radius * OUTER_SCALE, 32, 24), material);
      planet.name = item.id;
      planet.userData = { id: item.id, base: item.base, set: set.key, radius: base.radius * OUTER_SCALE };
      if (baseIndex < 9) Object.assign(planet.userData, { row: Math.floor(baseIndex / 3), column: baseIndex % 3 });
      planet.position.copy(at(item.longitude, radius, .2));
      system.add(planet);
      planets.push(planet);
      const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([planet.position.clone(), at(item.longitude, 5.5, .02)]), leaderMaterial);
      leader.userData = { bodyId: item.id, longitude: item.longitude };
      outerLeaders.push(leader);
      system.add(leader);
    });
  });
  if (atlas) applyAtlas(planets, atlas);
  if (minorAtlas) applyMinorAtlas(planets, minorAtlas);

  // Linhas de aspecto: natal × natal, trânsito × natal ou parceiro × natal, conforme o modo.
  const aspectLines = data.aspects.map(aspect => {
    const points = [aspect.from, aspect.to].map(id => planets.find(planet => planet.name === id).position.clone());
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({
      color: aspect.color, transparent: true, opacity: .9, depthWrite: false
    }));
    line.name = aspect.id;
    line.userData = aspect;
    system.add(line);
    return line;
  });
  const selectionRings = planets.map(planet => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(planet.userData.radius + .09, .012, 8, 64),
      new THREE.MeshBasicMaterial({ color: '#e6d3a6', transparent: true, opacity: .95, depthTest: false, depthWrite: false }));
    ring.name = `selection-${planet.name}`;
    ring.position.copy(planet.position);
    ring.quaternion.copy(camera.quaternion);
    ring.visible = false;
    ring.renderOrder = 4;
    system.add(ring);
    return ring;
  });

  const saturnRing = new THREE.Mesh(new THREE.RingGeometry(.43, .65, 64), new THREE.MeshStandardMaterial({
    color: '#c3ad8a', roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: .66, depthWrite: false
  }));
  saturnRing.name = 'saturn-ring';
  const saturn = planets.find(planet => planet.name === 'saturn');
  if (saturn) saturnRing.position.copy(saturn.position);
  saturnRing.visible = Boolean(saturn);
  saturnRing.rotation.set(-Math.PI / 2 + .28, 0, -.25);
  system.add(saturnRing);

  const orbitMaterial = new THREE.LineBasicMaterial({ color: '#decbaa', transparent: true, opacity: .24, depthWrite: false });
  const orbitalRings = bodies.filter(body => body.orbit > 0 && !MINOR.includes(body.id)).sort((a, b) => a.orbit - b.orbit).map(body => {
    const ring = circle(body.orbit, orbitMaterial);
    system.add(ring);
    return ring;
  });
  const cusps = data.cusps || Array.from({ length: 12 }, (_, index) => ascendant + index * 30);
  const zodiac = new THREE.Group();
  zodiac.name = 'zodiac';
  zodiac.userData.sectors = 12;
  // A régua de graus ocupa 4,62–5; os signos têm faixa própria em 5,05–5,5, sem sobrepor a régua.
  zodiac.add(circle(4.15, orbitMaterial), circle(4.85, orbitMaterial), circle(5, orbitMaterial), circle(5.05, orbitMaterial), circle(5.5, orbitMaterial));
  // Cúspides calculadas no sistema escolhido; sem mapa (cena padrão), casas iguais a partir do ASC transcrito.
  const discLabels = [];
  const dividers = [];
  const signDividerPoints = [];
  signLabels.forEach((text, index) => {
    const longitude = index * 30;
    const cusp = cusps[index];
    const span = ((cusps[(index + 1) % 12] - cusp) % 360 + 360) % 360;
    dividers.push(at(cusp, 4.15, 0), at(cusp, 4.85, 0));
    signDividerPoints.push(at(longitude, 5.05, 0), at(longitude, 5.5, 0));
    discLabels.push({ kind: 'sign', text, name: signNames[index], position: at(longitude + 15, 5.28, 0) },
      { kind: 'house', text: String(index + 1), position: at(cusp + span / 2, 4.3, 0) });
  });
  const houseDividers = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(dividers),
    new THREE.LineBasicMaterial({ color: '#decbaa', transparent: true, opacity: .48, depthWrite: false }));
  const signDividers = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(signDividerPoints), houseDividers.material);
  zodiac.add(houseDividers, signDividers);
  const ticks = [];
  const tickColors = [];
  for (let degree = 0; degree < 360; degree++) {
    const inner = degree % 30 === 0 ? 4.62 : degree % 5 === 0 ? 4.8 : 4.91;
    ticks.push(at(degree, inner, .012), at(degree, 5, .012));
    const color = new THREE.Color(degree % 5 === 0 ? '#fff1d6' : '#dcc39d');
    tickColors.push(...color.toArray(), ...color.toArray());
  }
  const tickGeometry = new THREE.BufferGeometry().setFromPoints(ticks);
  tickGeometry.setAttribute('color', new THREE.Float32BufferAttribute(tickColors, 3));
  const degreeTicks = new THREE.LineSegments(tickGeometry,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .82, depthWrite: false }));
  degreeTicks.name = 'degree-ruler';
  zodiac.add(degreeTicks);
  const rulerLightMaterial = new THREE.LineBasicMaterial({ color: '#fff1d6', transparent: true, opacity: .18,
    blending: THREE.AdditiveBlending, depthWrite: false });
  const rulerLight = new THREE.Group();
  rulerLight.name = 'floating-ruler-light';
  rulerLight.position.y = .055;
  rulerLight.add(new THREE.LineSegments(tickGeometry, rulerLightMaterial), circle(5, rulerLightMaterial));
  zodiac.add(rulerLight);

  // Ângulos: horizonte (ASC–DSC) e meridiano (MC–IC). Núcleo fino + halo aditivo que irradia das bordas;
  // sem hora de nascimento (sem MC) nada é desenhado.
  const angleGlowMaterial = new THREE.MeshBasicMaterial({ color: '#f1d9a8', transparent: true, opacity: .6,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const angleAxes = new THREE.Group();
  angleAxes.name = 'angle-axes';
  if (Number.isFinite(data.mc)) {
    // Halo: alfa cai do eixo para fora e da borda para o centro (raio 0 ainda guarda ~18%).
    const size = 32;
    const pixels = new Uint8Array(size * size * 4);
    for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
      const across = 1 - Math.abs(row / (size - 1) * 2 - 1);
      const along = Math.abs(column / (size - 1) * 2 - 1);
      pixels.set([255, 255, 255, Math.round(255 * across ** 2.6 * (.22 + .78 * along ** 2.5))], (row * size + column) * 4);
    }
    angleGlowMaterial.map = new THREE.DataTexture(pixels, size, size);
    angleGlowMaterial.map.magFilter = angleGlowMaterial.map.minFilter = THREE.LinearFilter;
    angleGlowMaterial.map.needsUpdate = true;
    // Raios dos ângulos: entram pela borda e perdem força antes de chegar à Terra (não se cruzam no centro).
    const coreMid = new THREE.LineBasicMaterial({ color: '#f1d9a8', transparent: true, opacity: .4, depthWrite: false });
    const coreFaint = new THREE.LineBasicMaterial({ color: '#f1d9a8', transparent: true, opacity: .14, depthWrite: false });
    const coreRim = new THREE.LineBasicMaterial({ color: '#fff1d6', transparent: true, opacity: .95, depthWrite: false });
    const mid = [], faint = [], rim = [];
    [['asc', 'dsc', data.asc], ['mc', 'ic', data.mc]].forEach(([from, to, longitude]) => {
      for (const direction of [longitude, longitude + 180]) {
        const end = at(direction, 5.62, .03), tip = at(direction, 1.35, .03);
        rim.push(end, at(direction, 4.15, .03));
        mid.push(at(direction, 4.15, .03), at(direction, 2.6, .03));
        faint.push(at(direction, 2.6, .03), tip);
        // Halo afinando: largo na borda, quase um fio na ponta; o alfa da textura cai junto (u 0 → .5).
        const radial = new THREE.Vector3(-(tip.z - end.z), 0, tip.x - end.x).normalize();
        const quad = new THREE.BufferGeometry().setFromPoints([end.clone().addScaledVector(radial, .2), tip.clone().addScaledVector(radial, .025), end.clone().addScaledVector(radial, -.2), tip.clone().addScaledVector(radial, -.025)]);
        quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, .5, 1, 0, 0, .5, 0], 2));
        quad.setIndex([0, 2, 1, 2, 3, 1]);
        const glow = new THREE.Mesh(quad, angleGlowMaterial);
        glow.position.y = -.01;
        angleAxes.add(glow);
      }
      [[from, longitude], [to, longitude + 180]].forEach(([id, point]) => {
        discLabels.push({ kind: 'angle', bodyId: id, text: BODY_GLYPHS[id], name: BODY_NAMES[id], position: at(point, 5.72, 0) });
      });
    });
    angleAxes.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(faint), coreFaint),
      new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(mid), coreMid),
      new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rim), coreRim));
  }
  zodiac.add(angleAxes);

  const leaderMaterial = new THREE.LineBasicMaterial({ color: '#f3d6a7', transparent: true, opacity: .6, depthWrite: false });
  const degreeMaterial = new THREE.MeshBasicMaterial({ color: '#fff1d6', transparent: true, opacity: .95, depthWrite: false });
  const markerGlowMaterial = new THREE.MeshBasicMaterial({ color: '#efd4a0', transparent: true, opacity: .2,
    blending: THREE.AdditiveBlending, depthWrite: false });
  const bodyLeaders = [];
  const degreeMarkers = [];
  const degreeHalos = [];
  planets.forEach((planet, index) => {
    const base = planet.userData.base || planet.name;
    discLabels.push({ kind: 'body', bodyId: planet.name, name: BODY_NAMES[base], svg: bodyGlyphs[base], position: planet.position.clone(),
      ...(planet.userData.set && { outer: planet.userData.set }) });
    if (planet.name === 'earth' || index >= natalCount) return;
    const placement = natalPlacements[planet.name];
    const anchor = at(placement.longitude, 5, .04);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([planet.position.clone(), anchor]), leaderMaterial);
    line.userData = { bodyId: planet.name, longitude: placement.longitude };
    bodyLeaders.push(line);
    zodiac.add(line);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 8), degreeMaterial);
    marker.position.copy(anchor);
    marker.userData = { ...line.userData };
    degreeMarkers.push(marker);
    zodiac.add(marker);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), markerGlowMaterial);
    halo.position.copy(anchor);
    degreeHalos.push(halo);
    zodiac.add(halo);
    discLabels.push({ kind: 'degree', bodyId: planet.name, selectedOnly: true,
      text: placement.degree, position: at(placement.longitude, 5.18, .06) });
  });
  system.add(zodiac);

  return { scene, camera, system, planets, aspectLines, selectionRings, orbitalRings, zodiac, discLabels, houseDividers, signDividers, saturnRing,
    degreeTicks, rulerLight, rulerLightMaterial, angleAxes, angleGlowMaterial, bodyLeaders, degreeMarkers, degreeHalos, degreeMaterial, markerGlowMaterial,
    outerLeaders, outerGuides, outerKey: data.outer.map(set => set.key).join(), rimOuter: data.outer.length ? OUTER_RADII[data.outer.length - 1] + .45 : 5.6,
    view: { zoom: 1, tilt: defaultTilt }, selection: null };
}

export function fitSolarDiscLabels(model, { width, height, visibleWidth = width }) {
  const fittingCamera = model.camera.clone();
  fittingCamera.clearViewOffset();
  fittingCamera.fov = 38;
  fittingCamera.aspect = width / height;
  fittingCamera.zoom = 1;
  fittingCamera.position.copy(cameraPosition());
  fittingCamera.lookAt(0, 0, 0);
  fittingCamera.updateProjectionMatrix();
  fittingCamera.updateMatrixWorld(true);
  const horizontalLimit = Math.max(.1, (visibleWidth - 36) / width);
  const verticalLimit = Math.max(.1, (height - 28) / height);
  let scale = 1;
  for (const label of model.discLabels) {
    if (label.kind !== 'sign' && label.kind !== 'house' && label.kind !== 'angle' && !label.outer) continue;
    const point = label.position.clone().project(fittingCamera);
    scale = Math.max(scale, Math.abs(point.x) / horizontalLimit, Math.abs(point.y) / verticalLimit);
  }
  model.camera.aspect = width / height;
  model.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(19)) * scale));
  model.camera.updateProjectionMatrix();
}

export function setSolarViewport(model, { width, height, slot }) {
  // A câmera conserva a composição no slot; o framebuffer só termina na borda da tela.
  model.camera.setViewOffset(slot.width, slot.height, -slot.left, -slot.top, width, height);
}

export function projectSolarDiscLabels(model, { width, height }) {
  model.scene.updateMatrixWorld(true);
  model.camera.updateMatrixWorld(true);
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(model.camera.matrixWorld, 0);
  return model.discLabels.map(label => {
    const position = model.system.localToWorld(label.position.clone());
    const point = position.clone().project(model.camera);
    let size;
    if (label.kind === 'body') {
      const planet = model.planets.find(planet => planet.name === label.bodyId);
      const edge = position.addScaledVector(cameraRight, planet.userData.radius).project(model.camera);
      size = Math.min(18, Math.abs(edge.x - point.x) * width * .65);
    }
    return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2, size,
      visible: point.z >= -1 && point.z <= 1 && (!label.selectedOnly || model.selection?.kind === 'body' && model.selection.id === label.bodyId) };
  });
}

export function solarInteractionRect(model, { width, height }) {
  model.camera.updateMatrixWorld(true);
  const bounds = model.discLabels.map(label => {
    const point = label.position.clone().project(model.camera);
    return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
  });
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(model.camera.matrixWorld, 0);
  for (const planet of model.planets) {
    const point = planet.position.clone().project(model.camera);
    const edge = planet.position.clone().addScaledVector(cameraRight, planet.userData.radius + (planet.name === 'saturn' ? .35 : 0)).project(model.camera);
    const x = (point.x + 1) * width / 2;
    const y = (1 - point.y) * height / 2;
    const radius = Math.abs(edge.x - point.x) * width / 2 + 18;
    bounds.push({ x: x - radius, y: y - radius }, { x: x + radius, y: y + radius });
  }
  const left = Math.max(0, Math.min(...bounds.map(point => point.x)) - 18);
  const top = Math.max(0, Math.min(...bounds.map(point => point.y)) - 18);
  const right = Math.min(width, Math.max(...bounds.map(point => point.x)) + 18);
  const bottom = Math.min(height, Math.max(...bounds.map(point => point.y)) + 18);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export function setSolarView(model, { zoom = model.view.zoom, tilt = model.view.tilt } = {}) {
  const nextZoom = Number.isFinite(zoom) ? THREE.MathUtils.clamp(zoom, 1, 2.5) : model.view.zoom;
  const nextTilt = Number.isFinite(tilt) ? THREE.MathUtils.clamp(tilt, 20, 75) : model.view.tilt;
  const angle = cameraTilt + THREE.MathUtils.degToRad(nextTilt - defaultTilt);
  model.camera.zoom = nextZoom;
  model.camera.position.set(0, cameraDistance * Math.sin(angle), cameraDistance * Math.cos(angle));
  model.camera.lookAt(0, 0, 0);
  model.camera.updateProjectionMatrix();
  model.selectionRings.forEach(ring => ring.quaternion.copy(model.camera.quaternion));
  model.view = { zoom: nextZoom, tilt: nextTilt };
  return { ...model.view };
}

export function solarGestureView(start, points) {
  const [first, second] = points;
  const distance = Math.hypot(second.x - first.x, second.y - first.y);
  const midpoint = (first.y + second.y) / 2;
  return {
    zoom: start.zoom * distance / Math.max(1, start.distance),
    tilt: start.tilt - (midpoint - start.midpoint) * .22
  };
}

function selectSolarTarget(model, selection) {
  const aspect = selection?.kind === 'aspect' && model.aspectLines.find(line => line.name === selection.id);
  const body = selection?.kind === 'body' && model.planets.find(planet => planet.name === selection.id);
  model.selection = aspect || body ? { kind: selection.kind, id: selection.id } : null;
  const selectedBodies = aspect ? [aspect.userData.from, aspect.userData.to] : body ? [body.name] : [];
  model.selectionRings.forEach((ring, index) => {
    ring.visible = selectedBodies.includes(model.planets[index].name);
    ring.material.color.set(aspect ? aspect.userData.color : '#e6d3a6');
  });
  model.aspectLines.forEach(line => {
    const related = aspect ? line === aspect : body && [line.userData.from, line.userData.to].includes(body.name);
    line.material.opacity = model.selection ? related ? 1 : .16 : .68;
  });
}

export function pickSolarTarget(model, xNDC, yNDC, { width = 320, height = 300 } = {}) {
  if (![xNDC, yNDC, width, height].every(Number.isFinite) || width <= 0 || height <= 0 || Math.abs(xNDC) > 1 || Math.abs(yNDC) > 1) return null;
  model.scene.updateMatrixWorld(true);
  model.camera.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(xNDC, yNDC), model.camera);
  const hit = ray.intersectObjects(model.planets, false)[0];
  if (hit) return { kind: 'body', id: hit.object.name };

  const pointer = new THREE.Vector2((xNDC + 1) * width / 2, (1 - yNDC) * height / 2);
  function screenPoint(point) {
    const projected = point.clone().project(model.camera);
    return { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2, z: projected.z };
  }
  let closestBody = null;
  let closestDistance = Infinity;
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(model.camera.matrixWorld, 0);
  for (const planet of model.planets) {
    const center = screenPoint(planet.position);
    if (center.z < -1 || center.z > 1) continue;
    const edge = screenPoint(planet.position.clone().addScaledVector(cameraRight, planet.userData.radius));
    const radius = Math.max(18, Math.hypot(edge.x - center.x, edge.y - center.y) + 6);
    const distance = Math.hypot(pointer.x - center.x, pointer.y - center.y);
    if (distance <= radius && distance < closestDistance) {
      closestBody = planet;
      closestDistance = distance;
    }
  }
  if (closestBody) return { kind: 'body', id: closestBody.name };

  let closestAspect = null;
  closestDistance = 10;
  for (const line of model.aspectLines) {
    if (!line.visible) continue;
    const positions = line.geometry.attributes.position;
    const first = screenPoint(new THREE.Vector3().fromBufferAttribute(positions, 0));
    const second = screenPoint(new THREE.Vector3().fromBufferAttribute(positions, 1));
    if (first.z < -1 || first.z > 1 || second.z < -1 || second.z > 1) continue;
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const lengthSquared = dx * dx + dy * dy;
    const along = lengthSquared ? THREE.MathUtils.clamp(((pointer.x - first.x) * dx + (pointer.y - first.y) * dy) / lengthSquared, 0, 1) : 0;
    const distance = Math.hypot(pointer.x - first.x - dx * along, pointer.y - first.y - dy * along);
    if (distance < closestDistance) {
      closestAspect = line;
      closestDistance = distance;
    }
  }
  return closestAspect ? { kind: 'aspect', id: closestAspect.name } : null;
}

function disposeModel(model) {
  model.scene.traverse(object => {
    object.geometry?.dispose();
    for (const material of [object.material].flat().filter(Boolean)) { material.map?.dispose(); material.dispose(); }
  });
}

// Ponto do plano do disco sob o dedo: raio e ângulo (graus, crescendo no sentido horário da tela).
export function discPointAt(model, xNDC, yNDC) {
  model.scene.updateMatrixWorld(true);
  model.camera.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(xNDC, yNDC), model.camera);
  const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  if (!hit) return null;
  return { radius: Math.hypot(hit.x, hit.z), angle: THREE.MathUtils.radToDeg(Math.atan2(hit.z, hit.x)) };
}
// O giro de data só começa no aro externo (régua, signos e o anel do segundo conjunto).
export const isRimPoint = (model, point) => Boolean(point) && point.radius >= 4.6 && point.radius <= model.rimOuter;

export function initSolarStudy({ mount, previewMount, onSelect = () => {}, onViewChange = () => {}, onRotate = () => {}, onRotateEnd = () => {} }) {
  let model = buildSolarScene({ data: emptySceneData() });
  let atlasTexture = null;
  let minorTexture = null;
  const area = mount.closest('[data-area]');
  const viewport = mount.closest('.area-scroll');
  const device = mount.closest('.device');
  const orbitScene = area.parentElement;
  const surface = document.createElement('div');
  surface.className = 'solar-surface';
  const interaction = document.createElement('div');
  interaction.className = 'solar-interaction';
  const canvas = document.createElement('canvas');
  canvas.className = 'solar-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
  const labels = document.createElement('div');
  labels.className = 'solar-disc-labels';
  labels.setAttribute('aria-hidden', 'true');
  labels.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  let labelElements = [];
  function buildLabels() {
  labels.replaceChildren();
  labelElements = model.discLabels.map(label => {
    const element = document.createElement('span');
    element.className = `solar-disc-label solar-${label.kind}-label${label.outer ? ` solar-outer-label solar-${label.outer}-label` : ''}`;
    if (label.svg) element.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${label.svg}</svg>`;
    else element.textContent = label.text;
    if (label.name) element.title = label.name;
    element.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;color:#f8e6c7;text-shadow:0 1px 4px #080d23,0 0 5px #080d23;pointer-events:none';
    if (label.kind === 'angle') element.style.cssText += ';font-size:9px;letter-spacing:.14em;color:#f1d9a8;text-shadow:0 0 6px rgba(241,217,168,.55),0 1px 3px #080d23';
    labels.append(element);
    return element;
  });
  }
  buildLabels();
  const error = document.createElement('p');
  error.className = 'solar-error';
  error.setAttribute('role', 'status');
  error.hidden = true;
  let host = surface;
  let active = true;
  let renderer;
  let fallback;
  let contextLost = false;
  let textureFailed = false;
  let frame = 0;
  let lastTime = 0;
  const pointers = new Map();
  let tap = null;
  let gesture = null;
  let rotation = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const textureMessage = t('As texturas não carregaram. Exibindo geometria 3D simplificada.');
  mount.querySelector('.solar-loading')?.remove();
  surface.append(canvas, labels, interaction);
  area.append(surface);
  mount.append(error);

  function message(text) {
    error.textContent = text;
    error.hidden = !text;
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
  function showFallback(text) {
    stop();
    clearPointers();
    canvas.hidden = true;
    canvas.style.display = 'none';
    labels.hidden = true;
    interaction.hidden = true;
    if (!fallback) {
      fallback = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      fallback.classList.add('solar-fallback');
      fallback.setAttribute('viewBox', '0 0 320 300');
      fallback.setAttribute('aria-hidden', 'true');
      fallback.style.cssText = 'display:block;width:100%;height:100%';
      fallback.innerHTML = '<g fill="none" stroke="#decbaa" opacity=".5"><ellipse cx="160" cy="150" rx="132" ry="67"/><ellipse cx="160" cy="150" rx="96" ry="49"/><ellipse cx="160" cy="150" rx="56" ry="29"/></g>';
      (active ? mount : previewMount).insertBefore(fallback, error);
    }
    fallback.hidden = false;
    fallback.style.display = 'block';
    message(text);
  }
  function render() {
    if (!renderer || contextLost) return false;
    try { renderer.render(model.scene, model.camera); return true; }
    catch {
      showFallback(t('A visualização 3D está indisponível. Exibindo um esquema plano.'));
      return false;
    }
  }
  function animate(time) {
    frame = 0;
    if (!active || document.hidden || reducedMotion.matches || contextLost) return;
    const elapsed = lastTime ? Math.min(.05, (time - lastTime) / 1000) : 0;
    lastTime = time;
    model.planets.forEach(planet => { planet.rotation.y += elapsed * .04; });
    const pulse = Math.sin(time * .0018);
    model.rulerLightMaterial.opacity = .18 + pulse * .06;
    model.degreeMaterial.opacity = .9 + pulse * .07;
    model.markerGlowMaterial.opacity = .2 + pulse * .07;
    const breath = Math.sin(time * .0009);
    model.angleGlowMaterial.opacity = .6 + breath * .12;
    if (render()) frame = requestAnimationFrame(animate);
  }
  function refresh() {
    stop();
    model.rulerLightMaterial.opacity = .18;
    model.degreeMaterial.opacity = .95;
    model.markerGlowMaterial.opacity = .2;
    model.angleGlowMaterial.opacity = .6;
    if (!document.hidden && render() && active && !reducedMotion.matches) frame = requestAnimationFrame(animate);
  }
  function positionLabels() {
    labels.hidden = !active || canvas.hidden || contextLost;
    interaction.hidden = labels.hidden;
    if (labels.hidden) return;
    const projectedLabels = projectSolarDiscLabels(model, { width: host.clientWidth, height: host.clientHeight });
    // A perspectiva aproxima os anéis ao fundo; afasta só o número para preservar sua leitura.
    for (let index = 1; index < projectedLabels.length; index++) {
      if (model.discLabels[index].kind !== 'house' || model.discLabels[index - 1].kind !== 'sign') continue;
      const sign = projectedLabels[index - 1];
      const house = projectedLabels[index];
      const dx = house.x - sign.x;
      const dy = house.y - sign.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance < 18) {
        house.x = sign.x + dx / distance * 18;
        house.y = sign.y + dy / distance * 18;
      }
    }
    projectedLabels.forEach((point, index) => {
      const element = labelElements[index];
      element.hidden = !point.visible;
      element.style.transform = `translate(${point.x}px,${point.y}px) translate(-50%,-50%)`;
      if (point.size !== undefined) element.style.width = element.style.height = `${point.size}px`;
    });
    const bounds = solarInteractionRect(model, { width: host.clientWidth, height: host.clientHeight });
    interaction.style.cssText = `left:${bounds.left}px;top:${bounds.top}px;width:${bounds.width}px;height:${bounds.height}px`;
  }
  function resize() {
    if (!renderer) return;
    if (active) {
      surface.style.cssText = `left:${-(device.clientWidth - area.clientWidth) / 2}px;top:${-orbitScene.offsetTop}px;width:${device.clientWidth}px;height:${device.clientHeight}px`;
    }
    const width = host.clientWidth || 320;
    const height = host.clientHeight || 300;
    renderer.setSize(width, height, false);
    if (active) {
      let left = (device.clientWidth - area.clientWidth) / 2;
      let top = orbitScene.offsetTop - viewport.scrollTop;
      for (let node = mount; node && node !== area; node = node.offsetParent) {
        left += node.offsetLeft;
        top += node.offsetTop;
      }
      const slot = { left, top, width: mount.clientWidth || 320, height: mount.clientHeight || 300 };
      // O disco é o protagonista: pode ocupar a largura do aparelho, não só a coluna central.
      fitSolarDiscLabels(model, { ...slot, visibleWidth: Math.max(mount.parentElement.clientWidth, device.clientWidth - 16) || slot.width });
      setSolarViewport(model, { width, height, slot });
      // Conferência real: se algum rótulo ou corpo passar da borda do aparelho, abre o campo de visão na proporção exata.
      const half = width / 2;
      const reach = Math.max(0, ...projectSolarDiscLabels(model, { width, height }).filter((point, index) => point.visible && !model.discLabels[index].selectedOnly).map(point => Math.abs(point.x - half)));
      const limit = half - 22;
      if (reach > limit) {
        model.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(model.camera.fov / 2)) * reach / limit));
        model.camera.updateProjectionMatrix();
      }
      model.fitFov = model.camera.fov;
    }
    else {
      model.camera.clearViewOffset();
      model.camera.aspect = width / height;
      model.camera.fov = 38;
      model.camera.updateProjectionMatrix();
    }
    positionLabels();
    refresh();
  }
  function setActive(value) {
    active = Boolean(value);
    clearPointers();
    host = active ? surface : previewMount;
    surface.hidden = !active;
    interaction.hidden = !active || canvas.hidden;
    labels.hidden = !active || canvas.hidden;
    host.append(canvas, labels);
    const statusHost = active ? mount : previewMount;
    if (fallback) statusHost.append(fallback);
    statusHost.append(error);
    resize();
  }

  function select(selection) {
    selectSolarTarget(model, selection);
    positionLabels();
    refresh();
  }
  function exposeView() {
    interaction.dataset.zoom = model.view.zoom.toFixed(2);
    interaction.dataset.tilt = model.view.tilt.toFixed(2);
    device?.toggleAttribute('data-disc-zoomed', model.view.zoom > 1.02);
  }
  function changeView(view) {
    const previous = model.view;
    const next = setSolarView(model, view);
    exposeView();
    positionLabels();
    refresh();
    if (previous.zoom !== next.zoom || previous.tilt !== next.tilt) onViewChange(next);
  }
  function canInteract(event) {
    if (!active || host !== surface || !renderer || contextLost || canvas.hidden || document.hidden || canvas.closest('[inert]')) return false;
    const angle = Number(area?.style.transform.match(/rotateY\(([-\d.]+)deg\)/)?.[1] || 0);
    if (area?.dataset.active === 'false' || Math.abs(angle % 360) > .001) return false;
    return !event || event.clientX >= 0 && event.clientX <= innerWidth && event.clientY >= 0 && event.clientY <= innerHeight;
  }
  function clearPointers() {
    const ids = [...pointers.keys()];
    pointers.clear();
    tap = null;
    gesture = null;
    if (rotation) { rotation = null; onRotateEnd(); }
    ids.forEach(id => { if (interaction.hasPointerCapture(id)) interaction.releasePointerCapture(id); });
  }
  function startGesture() {
    const [first, second] = pointers.values();
    gesture = { ...model.view, distance: Math.hypot(second.x - first.x, second.y - first.y), midpoint: (first.y + second.y) / 2 };
  }
  function discPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return discPointAt(model, (event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
  }
  interaction.addEventListener('pointerdown', event => {
    if (event.button > 0 || !canInteract(event)) return;
    // Um dedo no disco deixa o swipe entre áreas acontecer; só o segundo dedo (pinça) fica local (orbit.js lê orbitLocal).
    if (pointers.size) event.orbitLocal = true;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { interaction.setPointerCapture(event.pointerId); }
    catch { /* sem captura (ponteiro sintético): os movimentos sobre o disco ainda chegam */ }
    if (pointers.size === 1) tap = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    else {
      tap = null;
      if (pointers.size === 2) startGesture();
      else gesture = null;
    }
  });
  interaction.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    if (!canInteract(event)) { clearPointers(); return; }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (tap && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) tap.moved = true;
    if (pointers.size === 2 && gesture) { event.preventDefault(); changeView(solarGestureView(gesture, [...pointers.values()])); return; }
  });
  interaction.addEventListener('pointerup', event => {
    if (!pointers.has(event.pointerId)) return;
    const tapped = tap?.id === event.pointerId && !tap.moved && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= 8 && canInteract(event);
    pointers.delete(event.pointerId);
    tap = null;
    gesture = null;
    if (rotation) { rotation = null; onRotateEnd(); }
    if (interaction.hasPointerCapture(event.pointerId)) interaction.releasePointerCapture(event.pointerId);
    if (pointers.size === 2) startGesture();
    if (!tapped) return;
    const rect = canvas.getBoundingClientRect();
    const xNDC = (event.clientX - rect.left) / rect.width * 2 - 1;
    const yNDC = 1 - (event.clientY - rect.top) / rect.height * 2;
    if (Math.abs(xNDC) > 1 || Math.abs(yNDC) > 1) return;
    const target = pickSolarTarget(model, xNDC, yNDC, { width: rect.width, height: rect.height });
    select(target);
    if (target) mount.closest('.map-study')?.focus({ preventScroll: true });
    onSelect(target);
  });
  interaction.addEventListener('pointercancel', clearPointers);
  interaction.addEventListener('lostpointercapture', event => { if (pointers.has(event.pointerId)) clearPointers(); });
  interaction.addEventListener('wheel', event => {
    if (!canInteract(event)) return;
    event.preventDefault();
    event.orbitLocal = true;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1;
    changeView({ zoom: model.view.zoom * Math.exp(-event.deltaY * unit * .0015) });
  }, { passive: false });
  window.addEventListener('blur', clearPointers);

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setClearColor('#000000', 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      contextLost = true;
      showFallback(t('A visualização 3D foi interrompida. Aguardando o contexto gráfico.'));
    });
    canvas.addEventListener('webglcontextrestored', () => {
      contextLost = false;
      canvas.hidden = false;
      canvas.style.display = 'block';
      if (fallback) { fallback.hidden = true; fallback.style.display = 'none'; }
      message(textureFailed ? textureMessage : '');
      resize();
    });
    new THREE.TextureLoader().load('assets/solar/minor-surfaces-v01.png', atlas => {
      minorTexture = atlas;
      applyMinorAtlas(model.planets, atlas);
      refresh();
    });
    new THREE.TextureLoader().load('assets/solar/planet-surfaces-v01.png', atlas => {
      atlasTexture = atlas;
      applyAtlas(model.planets, atlas);
      if (!contextLost) message('');
      refresh();
    }, undefined, () => {
      textureFailed = true;
      if (!contextLost) message(textureMessage);
      refresh();
    });
    resize();
  } catch {
    renderer = null;
    showFallback(t('WebGL indisponível neste navegador. Exibindo um esquema plano.'));
  }
  new ResizeObserver(resize).observe(mount);
  new ResizeObserver(resize).observe(previewMount);
  new ResizeObserver(resize).observe(device);
  viewport.addEventListener('scroll', () => { if (active) resize(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearPointers(); refresh(); });
  reducedMotion.addEventListener('change', refresh);
  // Troca os dados do mapa (perfil, modo, data) preservando zoom, inclinação, viewport e a seleção que ainda existir.
  // Troca de modo: o enquadramento desliza do anterior ao novo e o anel externo e as linhas surgem aos poucos.
  let morphFrame = 0;
  function morph(fromFov) {
    cancelAnimationFrame(morphFrame);
    const toFov = model.camera.fov;
    const target = model;
    const fading = [...target.outerGuides, ...target.outerLeaders, ...target.planets.filter(planet => planet.userData.set), ...target.aspectLines]
      .map(object => [object.material, object.material.opacity]);
    const outerLabels = labelElements.filter(element => element.classList.contains('solar-outer-label'));
    let started = 0, frames = 0;
    function step(now) {
      if (model !== target) return;
      // O primeiro quadro da cena nova é o mais caro (envio à GPU); o tempo da animação conta a partir do segundo.
      if (++frames === 2) started = now;
      const progress = started ? Math.min(1, (now - started) / 520) : 0;
      const eased = 1 - (1 - progress) ** 3;
      // O alvo pode ser recalculado por resize() durante a transição.
      target.camera.fov = fromFov + ((target.fitFov ?? toFov) - fromFov) * eased;
      target.camera.updateProjectionMatrix();
      fading.forEach(([material, base]) => { material.transparent = true; material.opacity = base * eased; });
      outerLabels.forEach(element => { element.style.opacity = String(eased); });
      positionLabels();
      render();
      if (progress < 1) morphFrame = requestAnimationFrame(step);
    }
    morphFrame = requestAnimationFrame(step);
  }
  function setData(data) {
    const previous = model;
    const fromFov = previous.camera.fov;
    model = buildSolarScene({ atlas: atlasTexture, minorAtlas: minorTexture, data });
    model.camera.copy(previous.camera);
    setSolarView(model, previous.view);
    const selection = previous.selection;
    disposeModel(previous);
    buildLabels();
    if (selection) selectSolarTarget(model, selection);
    resize();
    if (!reducedMotion.matches && previous.outerKey !== model.outerKey && renderer && active) {
      try { renderer.compile(model.scene, model.camera); } catch { /* compila no primeiro quadro */ }
      morph(fromFov);
    }
    exposeView();
    return model.selection;
  }
  exposeView();
  return {
    setActive,
    setData,
    select,
    setZoom: zoom => changeView({ zoom }),
    setTilt: tilt => changeView({ tilt }),
    resetView: () => changeView({ zoom: 1, tilt: defaultTilt }),
  };
}
