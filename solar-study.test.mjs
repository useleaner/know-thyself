import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { ascendant, natalPlacements } from './sample-chart.js';
import { mapAspects, emptySceneData, fixtureSceneData } from './map-data.js';
import { buildSolarScene, fitSolarDiscLabels, pickSolarTarget, projectSolarDiscLabels, setSolarView, setSolarViewport, solarGestureView, solarInteractionRect } from './solar-study.js';

test('empty account retains the disc without planets, aspects or personal positions', () => {
  const model = buildSolarScene({ data: emptySceneData() });
  assert.equal(model.planets.length, 0);
  assert.equal(model.aspectLines.length, 0);
  assert.equal(model.selectionRings.length, 0);
  assert.equal(model.bodyLeaders.length, 0);
  assert.equal(model.degreeMarkers.length, 0);
  assert.equal(model.outerGuides.length, 0);
  assert.equal(model.saturnRing.visible, false);
  assert.equal(model.orbitalRings.length, 10);
  assert.equal(model.discLabels.length, 24);
  assert.ok(model.discLabels.every(label => ['sign', 'house'].includes(label.kind)));
  assert.equal(pickSolarTarget(model, 0, 0), null);
});

test('ASC, DSC, MC and IC retain their rays and labels without planet-like endpoint spheres', () => {
  const data = fixtureSceneData();
  data.mc = 270;
  const model = buildSolarScene({ data });
  const labels = model.discLabels.filter(label => label.kind === 'angle');
  assert.deepEqual(labels.map(label => label.bodyId), ['asc', 'dsc', 'mc', 'ic']);
  assert.equal(model.angleAxes.children.filter(item => item.isLineSegments).length, 3);
  assert.equal(model.angleAxes.children.filter(item => item.isMesh).length, 4, 'only the four flat ray glows remain');
  assert.ok(model.angleAxes.children.every(item => item.geometry.type !== 'SphereGeometry'));
  const empty = buildSolarScene({ data: emptySceneData() });
  assert.equal(empty.angleAxes.children.length, 0);
});

test('each planet has its own evenly spaced lane, with Earth central and Sun in the third planet lane', async () => {
  const { buildMapState } = await import('./map-data.js');
  const order = ['moon', 'mercury', 'venus', 'sun', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  const profile = { name: 'Perfil fictício A', birthDate: '1991-06-17', birthTime: '04:23', timeUnknown: false, place: 'São Paulo', lat: -23.55, lon: -46.63, timezone: 'America/Sao_Paulo' };
  const partner = { ...profile, name: 'Perfil fictício B', birthDate: '1995-07-10' };
  for (const mode of ['natal', 'transits', 'synastry', 'synastry-transits']) {
    const state = buildMapState({ profile, partner, mode, date: new Date('2026-10-18T20:19:00Z') });
    const data = structuredClone(state.scene);
    const model = buildSolarScene({ data });
    const radial = planet => Math.hypot(planet.position.x, planet.position.z);
    const natal = model.planets.filter(planet => order.includes(planet.name)).sort((a, b) => radial(a) - radial(b));
    assert.deepEqual(natal.map(planet => planet.name), order, mode);
    const planets = natal.filter(planet => planet.name !== 'moon');
    for (let i = 1; i < planets.length; i++) {
      assert.ok(Math.abs(radial(planets[i]) - radial(planets[i - 1]) - .45) < 1e-10, `${mode}: separate lanes for ${planets[i - 1].name}/${planets[i].name}`);
    }
    assert.ok(radial(natal[0]) + natal[0].userData.radius < radial(planets[0]) - planets[0].userData.radius, 'Moon stays by Earth, inside Mercury');
    const laneRadii = model.orbitalRings.map(ring => Math.hypot(ring.geometry.attributes.position.getX(0), ring.geometry.attributes.position.getZ(0)));
    assert.equal(laneRadii.length, order.length);
    for (let i = 0; i < natal.length; i++) assert.ok(Math.abs(laneRadii[i] - radial(natal[i])) < 1e-6, `${mode}: ${natal[i].name} follows its own ring`);
    assert.deepEqual(model.planets.find(planet => planet.name === 'earth').position.toArray(), [0, .34, 0]);
    for (const planet of natal) {
      const angle = (180 + data.asc - data.natal[planet.name].longitude) * Math.PI / 180;
      assert.ok(planet.position.clone().setY(0).normalize().distanceTo(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))) < 1e-10, `${mode}: ${planet.name}`);
    }
    data.outer.forEach((set, index) => {
      for (const body of set.bodies) {
        const planet = model.planets.find(planet => planet.name === body.id);
        const angle = (180 + data.asc - body.longitude) * Math.PI / 180;
        assert.ok(Math.abs(radial(planet) - [5.95, 6.55][index]) < 1e-10, `${mode}: ${body.id}`);
        assert.ok(planet.position.clone().setY(0).normalize().distanceTo(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))) < 1e-10, body.id);
      }
    });
    assert.equal(model.orbitalRings.length, 10);
    assert.deepEqual(data, state.scene, 'scene construction never changes calculated input');
  }
});

test('eleven natal spheres preserve their heights, sizes, atlas order and one ring per lane', () => {
  const model = buildSolarScene();
  assert.equal(model.planets.length, 11);
  assert.equal(new Set(model.planets.map(planet => planet.geometry)).size, 11);
  for (const planet of model.planets) {
    assert.ok(planet.isMesh);
    assert.equal(planet.geometry.type, 'SphereGeometry');
    assert.equal(planet.geometry.parameters.widthSegments, 32);
    assert.equal(planet.geometry.parameters.heightSegments, 24);
    assert.ok(planet.position.y > planet.geometry.parameters.radius);
    assert.ok(planet.userData.radius >= .20 && planet.userData.radius <= .42);
    assert.ok(planet.material.isMeshStandardMaterial);
  }
  assert.deepEqual(model.planets.map(planet => planet.name), ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon', 'pluto']);
  assert.ok(model.planets[0].userData.radius < model.planets[5].userData.radius);
  assert.ok(model.camera.isPerspectiveCamera);
  assert.ok(model.camera.position.y > 0 && model.camera.position.z > 0);
  assert.ok(model.camera.getWorldDirection(new THREE.Vector3()).dot(model.camera.position.clone().negate().normalize()) > .999);
  assert.equal(model.orbitalRings.length, 10);
  assert.ok(model.orbitalRings.every(ring => ring.isLineLoop));
  assert.equal(model.zodiac.userData.sectors, 12);
  assert.equal(model.saturnRing.geometry.type, 'RingGeometry');
  assert.equal(model.saturnRing.material.side, THREE.DoubleSide);
  assert.equal(model.system.children.filter(child => child.geometry?.type === 'RingGeometry').length, 1);
  const earth = model.planets.find(planet => planet.name === 'earth');
  assert.deepEqual(earth.position.toArray(), [0, .34, 0]);
  const layout = [
    [.31, 1.95, .36], [.20, 1.05, .24], [.27, 1.5, .31], [.30, 0, .34],
    [.23, 2.4, .27], [.42, 2.85, .45], [.35, 3.3, .40], [.29, 3.75, .33],
    [.28, 4.2, .32], [.21, .55, .25], [.20, 4.65, .24]
  ];
  model.planets.forEach((planet, index) => {
    const [radius, orbit, y] = layout[index];
    assert.equal(planet.userData.radius, radius);
    assert.equal(planet.position.y, y);
    assert.ok(Math.abs(Math.hypot(planet.position.x, planet.position.z) - orbit) < 1e-10);
    if (planet.name === 'earth') return;
    const angle = (180 + ascendant - natalPlacements[planet.name].longitude) * Math.PI / 180;
    assert.ok(planet.position.clone().setY(0).normalize().distanceTo(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))) < 1e-10, planet.name);
  });
  assert.ok(Math.abs(model.camera.position.length() - Math.hypot(7.5, 10.5)) < 1e-10);
  assert.ok(Math.abs(Math.atan2(model.camera.position.y, model.camera.position.z) - Math.atan2(7.5, 10.5) - Math.PI / 18) < 1e-10);
  assert.deepEqual(model.view, { zoom: 1, tilt: 45.5 });
  assert.equal(model.scene.getObjectByName('mini-black-hole'), undefined);
});

test('Chiron is added only from supplied natal data without changing the other bodies or atlas cells', () => {
  const original = buildSolarScene({ atlas: new THREE.Texture() });
  assert.equal(original.planets.some(planet => planet.name === 'chiron'), false);
  const data = fixtureSceneData();
  data.natal.chiron = { longitude: 243.75, degree: '3°45′' };
  const model = buildSolarScene({ atlas: new THREE.Texture(), data });
  assert.equal(model.planets.length, original.planets.length + 1);
  original.planets.forEach((planet, index) => {
    const preserved = model.planets[index];
    assert.equal(preserved.name, planet.name);
    assert.deepEqual(preserved.position.toArray(), planet.position.toArray());
    assert.deepEqual(preserved.userData, planet.userData);
    assert.deepEqual(preserved.geometry.parameters, planet.geometry.parameters);
    assert.deepEqual(preserved.material.map?.offset.toArray(), planet.material.map?.offset.toArray());
  });
  assert.equal(model.orbitalRings.length, 10);
  assert.equal(model.aspectLines.length, original.aspectLines.length);
  assert.equal(model.outerGuides.length, 0);
  const chiron = model.planets.at(-1);
  assert.equal(chiron.name, 'chiron');
  assert.equal(chiron.geometry.type, 'SphereGeometry');
  assert.equal(chiron.material.map, null);
  assert.equal(chiron.userData.row, undefined);
  assert.ok(chiron.position.y > chiron.userData.radius);
  assert.ok(Math.abs(Math.hypot(chiron.position.x, chiron.position.z) - 3.2) < 1e-10);
  const angle = (180 + data.asc - data.natal.chiron.longitude) * Math.PI / 180;
  assert.ok(chiron.position.clone().setY(0).normalize().distanceTo(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))) < 1e-10);
  const leader = model.bodyLeaders.find(line => line.userData.bodyId === 'chiron');
  const endpoint = new THREE.Vector3().fromBufferAttribute(leader.geometry.attributes.position, 1);
  assert.ok(endpoint.distanceTo(new THREE.Vector3(Math.cos(angle) * 5, .04, Math.sin(angle) * 5)) < 1e-6);
  const label = model.discLabels.find(item => item.kind === 'body' && item.bodyId === 'chiron');
  assert.ok(label.position.equals(chiron.position));
  assert.match(label.svg, /<circle .*<path /);
  assert.doesNotMatch(label.svg, /<text|<image/);
  assert.ok(label.name);
  const ring = model.selectionRings.at(-1);
  assert.equal(ring.name, 'selection-chiron');
  assert.ok(ring.position.equals(chiron.position));
});

test('a sparse Chiron map keeps its own material and supports projected picking and degree selection labels', () => {
  const data = emptySceneData();
  data.asc = 80;
  data.natal.chiron = { longitude: 170, degree: '20°00′' };
  const model = buildSolarScene({ atlas: new THREE.Texture(), data });
  assert.deepEqual(model.planets.map(planet => planet.name), ['earth', 'chiron']);
  const chiron = model.planets[1];
  assert.equal(chiron.material.map, null, 'Chiron never inherits a planetary atlas cell after filtering');
  assert.equal(model.planets[0].userData.row, 1, 'Earth retains its original atlas cell');
  const degreeIndex = model.discLabels.findIndex(item => item.kind === 'degree' && item.bodyId === 'chiron');
  assert.equal(model.discLabels[degreeIndex].text, data.natal.chiron.degree);
  for (const tilt of [20, 45.5, 75]) {
    setSolarView(model, { zoom: 1, tilt });
    const point = project(model, chiron.position);
    const picked = pickSolarTarget(model, point.x, point.y);
    assert.deepEqual(picked, { kind: 'body', id: 'chiron' });
    assert.equal(projectSolarDiscLabels(model, { width: 320, height: 300 })[degreeIndex].visible, false);
    model.selection = picked;
    assert.equal(projectSolarDiscLabels(model, { width: 320, height: 300 })[degreeIndex].visible, true);
    model.selection = null;
  }
});

test('all eleven SVG body symbols stay centered and smaller than their projected spheres at every view', () => {
  const model = buildSolarScene();
  const glyphs = model.discLabels.filter(label => label.kind === 'body');
  assert.deepEqual(glyphs.map(label => label.bodyId), model.planets.map(planet => planet.name));
  for (const [index, label] of glyphs.entries()) {
    assert.match(label.svg, /<(?:path|circle) /);
    assert.doesNotMatch(label.svg, /<text|<image/);
    assert.ok(label.name);
    assert.ok(label.position.equals(model.planets[index].position));
  }
  for (const { width, height, zoom, tilt } of [
    { width: 320, height: 300, zoom: 1, tilt: 45.5 },
    { width: 390, height: 693, zoom: 2, tilt: 70 },
    { width: 1440, height: 900, zoom: 2.5, tilt: 20 }
  ]) {
    fitSolarDiscLabels(model, { width: 320, height: 300 });
    setSolarViewport(model, { width, height, slot: { left: 35, top: 180, width: 320, height: 300 } });
    setSolarView(model, { zoom, tilt });
    const projectedLabels = projectSolarDiscLabels(model, { width, height });
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(model.camera.matrixWorld, 0);
    glyphs.forEach((label, index) => {
      const planet = model.planets[index];
      const center = project(model, planet.position);
      const edge = project(model, planet.position.clone().addScaledVector(cameraRight, planet.userData.radius));
      const diameter = Math.abs(edge.x - center.x) * width;
      const overlay = projectedLabels[model.discLabels.indexOf(label)];
      assert.ok(Math.abs(overlay.x - (center.x + 1) * width / 2) < 1e-10, label.bodyId);
      assert.ok(Math.abs(overlay.y - (1 - center.y) * height / 2) < 1e-10, label.bodyId);
      assert.ok(overlay.size > 0 && overlay.size < diameter, label.bodyId);
      assert.ok(overlay.size <= 18, label.bodyId);
      assert.ok(Math.abs(overlay.size - Math.min(18, diameter * .65)) < 1e-10, label.bodyId);
      assert.ok(label.position.equals(model.planets[index].position));
    });
  }
});

test('the pearl gold ruler has 360 exact ticks and an independent raised light layer', () => {
  const { degreeTicks, rulerLight, rulerLightMaterial, orbitalRings } = buildSolarScene();
  const points = degreeTicks.geometry.attributes.position;
  assert.equal(points.count, 720);
  assert.equal(degreeTicks.geometry.attributes.color.count, 720);
  assert.ok(degreeTicks.material.vertexColors);
  assert.ok(degreeTicks.material.opacity > .7);
  for (let degree = 0; degree < 360; degree++) {
    const inner = new THREE.Vector3().fromBufferAttribute(points, degree * 2);
    const outer = new THREE.Vector3().fromBufferAttribute(points, degree * 2 + 1);
    assert.ok(Math.abs(Math.hypot(outer.x, outer.z) - 5) < 1e-6);
    assert.ok(Math.abs(Math.hypot(inner.x, inner.z) - (degree % 30 === 0 ? 4.62 : degree % 5 === 0 ? 4.8 : 4.91)) < 1e-6);
    const angle = (180 + ascendant - degree) * Math.PI / 180;
    assert.ok(outer.clone().setY(0).normalize().distanceTo(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))) < 1e-6);
  }
  assert.ok(rulerLight.position.y > .012);
  assert.equal(rulerLight.children[0].geometry, degreeTicks.geometry);
  assert.notEqual(rulerLightMaterial, degreeTicks.material);
  assert.equal(rulerLightMaterial.blending, THREE.AdditiveBlending);
  assert.equal(rulerLightMaterial.depthWrite, false);
  assert.equal(orbitalRings.length, 10);
});

test('each non Earth sphere and its ruler connector share the exact natal longitude and ascendant orientation', () => {
  const model = buildSolarScene();
  assert.equal(model.bodyLeaders.length, 10);
  assert.equal(model.degreeMarkers.length, 10);
  assert.equal(model.degreeHalos.length, 10);
  for (const [index, line] of model.bodyLeaders.entries()) {
    const body = model.planets.find(planet => planet.name === line.userData.bodyId);
    const placement = natalPlacements[body.name];
    const points = line.geometry.attributes.position;
    const start = new THREE.Vector3().fromBufferAttribute(points, 0);
    const end = new THREE.Vector3().fromBufferAttribute(points, 1);
    assert.notEqual(body.name, 'earth');
    assert.ok(start.distanceTo(body.position) < 1e-6);
    const angle = (180 + ascendant - placement.longitude) * Math.PI / 180;
    assert.ok(end.distanceTo(new THREE.Vector3(Math.cos(angle) * 5, .04, Math.sin(angle) * 5)) < 1e-6);
    assert.equal(line.userData.longitude, placement.longitude);
    assert.ok(model.degreeMarkers[index].position.distanceTo(end) < 1e-6);
    assert.ok(model.degreeHalos[index].position.distanceTo(end) < 1e-6);
    assert.ok(body.position.clone().setY(0).normalize().distanceTo(end.clone().setY(0).normalize()) < 1e-6);
    const signIndex = Math.floor(placement.longitude / 30);
    const sign = model.discLabels.filter(label => label.kind === 'sign')[signIndex];
    assert.ok(end.clone().setY(0).angleTo(sign.position) < Math.PI / 12 + 1e-6, body.name);
    const degreeLabel = model.discLabels.find(label => label.kind === 'degree' && label.bodyId === body.name);
    assert.equal(degreeLabel.text, placement.degree);
    assert.equal(degreeLabel.selectedOnly, true);
  }
});

test('each atlas cell uses independent inset UV transforms in the supplied row order', () => {
  const atlas = new THREE.Texture();
  const { planets } = buildSolarScene({ atlas });
  assert.equal(new Set(planets.slice(0, 9).map(planet => planet.material.map)).size, 9);
  planets.slice(0, 9).forEach((planet, index) => {
    const map = planet.material.map;
    const row = Math.floor(index / 3);
    const column = index % 3;
    assert.equal(map.colorSpace, THREE.SRGBColorSpace);
    assert.ok(map.offset.x > column / 3);
    assert.ok(map.offset.x + map.repeat.x < (column + 1) / 3);
    assert.ok(map.offset.y > (2 - row) / 3);
    assert.ok(map.offset.y + map.repeat.y < (3 - row) / 3);
    assert.ok(Math.abs(map.repeat.x - map.repeat.y) < 1e-10);
    assert.equal(planet.material.color.getHex(), 0xffffff);
  });
  assert.equal(planets[0].material.emissiveMap, planets[0].material.map);
  for (const planet of planets.slice(9)) {
    assert.equal(planet.material.map, null, 'Lua e Plutão não reutilizam células de outro planeta');
    assert.equal(planet.userData.row, undefined);
    assert.equal(planet.userData.column, undefined);
  }
  assert.equal(atlas.repeat.x, 1, 'atlas transforms are not mutated across planets');
});

function project(model, point) {
  model.scene.updateMatrixWorld(true);
  model.camera.updateMatrixWorld(true);
  return point.clone().project(model.camera);
}

test('signs use natal orientation and the twelve approximate equal houses start at the ascendant on the left', () => {
  const model = buildSolarScene();
  const signs = model.discLabels.filter(label => label.kind === 'sign');
  const houses = model.discLabels.filter(label => label.kind === 'house');
  assert.deepEqual(signs.map(label => label.text), Array.from({ length: 12 }, (_, index) => String.fromCodePoint(0x2648 + index, 0xFE0E)));
  assert.deepEqual(signs.map(label => label.name), ['Áries', 'Touro', 'Gêmeos', 'Câncer', 'Leão', 'Virgem', 'Libra', 'Escorpião', 'Sagitário', 'Capricórnio', 'Aquário', 'Peixes']);
  assert.deepEqual(houses.map(label => label.text), Array.from({ length: 12 }, (_, index) => String(index + 1)));
  assert.equal(model.houseDividers.geometry.attributes.position.count, 24);
  assert.equal(model.signDividers.geometry.attributes.position.count, 24);
  assert.equal(ascendant, 123 + 4/60);
  const firstHouseCusp = new THREE.Vector3().fromBufferAttribute(model.houseDividers.geometry.attributes.position, 0);
  assert.ok(firstHouseCusp.distanceTo(new THREE.Vector3(-4.15, 0, 0)) < 1e-6);
  signs.forEach((label, index) => {
    assert.ok(Math.abs(label.position.length() - 5.28) < 1e-10);
    assert.ok(Math.abs(houses[index].position.length() - 4.3) < 1e-10);
    const signAngle = (180 + ascendant - (index * 30 + 15)) * Math.PI / 180;
    assert.ok(label.position.clone().normalize().distanceTo(new THREE.Vector3(Math.cos(signAngle), 0, Math.sin(signAngle))) < 1e-10);
    const houseAngle = (180 - (index * 30 + 15)) * Math.PI / 180;
    assert.ok(houses[index].position.clone().normalize().distanceTo(new THREE.Vector3(Math.cos(houseAngle), 0, Math.sin(houseAngle))) < 1e-10);
    assert.ok(Math.abs(label.position.angleTo(signs[(index + 1) % 12].position) - Math.PI / 6) < 1e-10);
  });
});

test('rim labels fit the narrower visible figure and follow zoom and tilt without changing camera distance', () => {
  for (const [width, height, visibleWidth] of [[320, 300, 258], [360, 237, 290], [520, 352, 420], [360, 157, 290]]) {
    const model = buildSolarScene();
    const cameraPosition = model.camera.position.clone();
    fitSolarDiscLabels(model, { width, height, visibleWidth });
    assert.ok(model.camera.fov >= 38);
    assert.ok(model.camera.position.equals(cameraPosition));
    for (const label of model.discLabels) {
      const point = project(model, label.position);
      assert.ok(Math.abs(point.x) * width / 2 <= visibleWidth / 2 - 18 + 1e-8, label.text);
      assert.ok(Math.abs(point.y) * height / 2 <= height / 2 - 14 + 1e-8, label.text);
    }
    const label = model.discLabels[0];
    const before = project(model, label.position);
    setSolarView(model, { zoom: 2 });
    const zoomed = project(model, label.position);
    assert.ok(Math.abs(zoomed.x - before.x * 2) < 1e-10);
    assert.ok(Math.abs(zoomed.y - before.y * 2) < 1e-10);
    setSolarView(model, { tilt: 60 });
    assert.notEqual(project(model, label.position).y, zoomed.y);
    assert.ok(Math.abs(model.camera.position.length() - cameraPosition.length()) < 1e-10);
  }
});

test('picking finds all eleven projected bodies before their connected aspects and tolerates a near touch', () => {
  const model = buildSolarScene();
  for (const planet of model.planets) {
    const point = project(model, planet.position);
    assert.deepEqual(pickSolarTarget(model, point.x, point.y), { kind: 'body', id: planet.name });
  }
  const moon = model.planets.find(planet => planet.name === 'moon');
  const point = project(model, moon.position);
  const earth = project(model, model.planets.find(planet => planet.name === 'earth').position);
  const offset = new THREE.Vector2(-(point.y - earth.y) * 150, (point.x - earth.x) * 160).normalize().multiplyScalar(14);
  assert.deepEqual(pickSolarTarget(model, point.x + offset.x / 160, point.y + offset.y / 150), { kind: 'body', id: 'moon' });
  assert.equal(pickSolarTarget(model, 1.1, 0), null);
  assert.equal(pickSolarTarget(model, 0, 0, { width: 0, height: 300 }), null);
  assert.equal(pickSolarTarget(model, NaN, 0), null);
});

test('the screen viewport preserves the slot composition and keeps zoomed bodies beyond that slot pickable', () => {
  for (const [width, height, slot] of [
    [390, 693, { left: 35, top: 180, width: 320, height: 235 }],
    [435, 774, { left: 10, top: 220, width: 415, height: 304 }]
  ]) {
    const model = buildSolarScene();
    fitSolarDiscLabels(model, { ...slot, visibleWidth: slot.width * .8 });
    const original = model.planets.map(planet => project(model, planet.position));
    setSolarViewport(model, { width, height, slot });
    const initialInteraction = solarInteractionRect(model, { width, height });
    assert.ok(initialInteraction.height < height, 'empty screen space remains available for page gestures');
    model.planets.forEach((planet, index) => {
      const expanded = project(model, planet.position);
      assert.ok(Math.abs((expanded.x + 1) * width / 2 - (slot.left + (original[index].x + 1) * slot.width / 2)) < 1e-8);
      assert.ok(Math.abs((1 - expanded.y) * height / 2 - (slot.top + (1 - original[index].y) * slot.height / 2)) < 1e-8);
    });
    setSolarView(model, { zoom: 2.5, tilt: 65 });
    const visibleOutsideSlot = model.planets.filter(planet => {
      const point = project(model, planet.position);
      const x = (point.x + 1) * width / 2;
      const y = (1 - point.y) * height / 2;
      return Math.abs(point.x) < 1 && Math.abs(point.y) < 1
        && (x < slot.left || x > slot.left + slot.width || y < slot.top || y > slot.top + slot.height);
    });
    assert.ok(visibleOutsideSlot.length > 0);
    const interaction = solarInteractionRect(model, { width, height });
    for (const planet of visibleOutsideSlot) {
      const point = project(model, planet.position);
      const x = (point.x + 1) * width / 2;
      const y = (1 - point.y) * height / 2;
      assert.ok(x >= interaction.left && x <= interaction.left + interaction.width);
      assert.ok(y >= interaction.top && y <= interaction.top + interaction.height);
      assert.deepEqual(pickSolarTarget(model, point.x, point.y, { width, height }), { kind: 'body', id: planet.name });
    }
    const firstFov = model.camera.fov;
    fitSolarDiscLabels(model, { ...slot, visibleWidth: slot.width * .8 });
    assert.ok(Math.abs(model.camera.fov - firstFov) < 1e-10, 'refitting ignores the previous screen offset');
    model.camera.clearViewOffset();
    assert.equal(model.camera.view.enabled, false, 'the lateral preview can restore its own viewport');
  }
});

test('all supplied aspects connect their bodies and visible aspect hits disappear when hidden', () => {
  const model = buildSolarScene();
  setSolarView(model, { zoom: 2 });
  assert.equal(model.aspectLines.length, mapAspects.length);
  assert.deepEqual(model.aspectLines.map(line => line.name), mapAspects.map(aspect => aspect.id));
  let checkedHit = false;
  for (const line of model.aspectLines) {
    const aspect = mapAspects.find(item => item.id === line.name);
    const points = line.geometry.attributes.position;
    const first = new THREE.Vector3().fromBufferAttribute(points, 0);
    const second = new THREE.Vector3().fromBufferAttribute(points, 1);
    assert.ok(first.distanceTo(model.planets.find(body => body.name === aspect.from).position) < 1e-6);
    assert.ok(second.distanceTo(model.planets.find(body => body.name === aspect.to).position) < 1e-6);
    // Short conjunctions and crossings can be obscured by bodies or another line; the menu remains available.
    for (const fraction of [.25, .5, .75]) {
      const point = project(model, first.clone().lerp(second, fraction));
      const hit = pickSolarTarget(model, point.x, point.y);
      if (hit?.kind !== 'aspect' || hit.id !== line.name) continue;
      checkedHit = true;
      line.visible = false;
      assert.notDeepEqual(pickSolarTarget(model, point.x, point.y), hit);
      line.visible = true;
    }
  }
  assert.ok(checkedHit, 'at least one unobscured aspect must be selectable in the composed chart');
});

test('zoom and tilt clamp safely, preserve the camera orbit, and reset to the original camera', () => {
  const model = buildSolarScene();
  const originalPosition = model.camera.position.clone();
  const originalDistance = originalPosition.length();
  assert.deepEqual(setSolarView(model, { zoom: 5, tilt: 95 }), { zoom: 2.5, tilt: 75 });
  assert.equal(model.camera.zoom, 2.5);
  assert.ok(Math.abs(model.camera.position.length() - originalDistance) < 1e-10);
  assert.equal(model.camera.position.x, 0, 'tilt does not rotate azimuth');
  assert.deepEqual(setSolarView(model, { zoom: -1, tilt: -5 }), { zoom: 1, tilt: 20 });
  assert.deepEqual(setSolarView(model, { zoom: NaN, tilt: Infinity }), { zoom: 1, tilt: 20 });
  setSolarView(model, { zoom: 1, tilt: 45.5 });
  assert.ok(model.camera.position.distanceTo(originalPosition) < 1e-10);
});

test('two fingers change zoom by distance and tilt by midpoint, without an azimuth gesture', () => {
  const start = { zoom: 1.2, tilt: 35.5, distance: 100, midpoint: 150 };
  assert.deepEqual(solarGestureView(start, [{ x: 0, y: 150 }, { x: 200, y: 150 }]), { zoom: 2.4, tilt: 35.5 });
  assert.deepEqual(solarGestureView(start, [{ x: 0, y: 200 }, { x: 100, y: 200 }]), { zoom: 1.2, tilt: 24.5 });
  const model = buildSolarScene();
  assert.deepEqual(setSolarView(model, solarGestureView(start, [{ x: 0, y: -300 }, { x: 1000, y: -300 }])), { zoom: 2.5, tilt: 75 });
});

test('calculated data: cusps drive the houses, the second ring sits outside the sign band and cross lines connect both sets', async () => {
  const { buildMapState } = await import('./map-data.js');
  const { OUTER_RADII, discPointAt, isRimPoint } = await import('./solar-study.js');
  const profile = { name: 'D', birthDate: '1991-06-17', birthTime: '04:23', timeUnknown: false, place: 'S', lat: -23.55, lon: -46.63333333333333, timezone: 'America/Sao_Paulo' };
  const state = buildMapState({ profile, mode: 'transits', date: new Date('2026-10-18T20:19:00Z') });
  const model = buildSolarScene({ data: state.scene });
  assert.equal(model.planets.length, Object.keys(state.scene.natal).length + 1 + 10);
  assert.equal(model.orbitalRings.length, 10);
  assert.deepEqual(model.view, { zoom: 1, tilt: 45.5 });
  const natalSizes = buildSolarScene().planets.map(planet => [planet.name, planet.userData.radius, planet.position.y]);
  natalSizes.forEach(([name, radius, y]) => {
    const planet = model.planets.find(item => item.name === name);
    assert.equal(planet.userData.radius, radius, name);
    assert.equal(planet.position.y, y, name);
  });
  const outer = model.planets.filter(planet => planet.userData.set === 'transit');
  assert.equal(outer.length, 10);
  for (const planet of outer) {
    assert.ok(Math.abs(Math.hypot(planet.position.x, planet.position.z) - OUTER_RADII[0]) < 1e-9);
    assert.ok(OUTER_RADII[0] - planet.userData.radius > 5.5, 'outside the sign band');
  }
  const firstCusp = new THREE.Vector3().fromBufferAttribute(model.houseDividers.geometry.attributes.position, 0);
  assert.ok(firstCusp.distanceTo(new THREE.Vector3(-4.15, 0, 0)) < 1e-6, 'ASC stays on the left');
  const tenth = new THREE.Vector3().fromBufferAttribute(model.houseDividers.geometry.attributes.position, 18);
  const mcAngle = (180 + state.scene.asc - state.scene.cusps[9]) * Math.PI / 180;
  assert.ok(tenth.clone().normalize().distanceTo(new THREE.Vector3(Math.cos(mcAngle), 0, Math.sin(mcAngle))) < 1e-6, 'MC cusp, not an equal house');
  assert.equal(model.aspectLines.length, state.aspects.length);
  for (const line of model.aspectLines) {
    const start = new THREE.Vector3().fromBufferAttribute(line.geometry.attributes.position, 0);
    assert.ok(start.distanceTo(model.planets.find(planet => planet.name === line.userData.from).position) < 1e-6);
  }
  assert.equal(model.discLabels.filter(label => label.outer === 'transit').length, 10);
  fitSolarDiscLabels(model, { width: 320, height: 300 });
  for (const planet of outer) {
    const point = project(model, planet.position);
    const hit = pickSolarTarget(model, point.x, point.y);
    assert.equal(hit.kind, 'body');
    if (hit.id === planet.name) continue;
    assert.ok(model.planets.find(item => item.name === hit.id), 'overlapping bodies resolve to a neighbour');
  }
  for (const label of model.discLabels.filter(item => item.outer)) {
    const projected = project(model, label.position);
    assert.ok(Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1, 'the second ring fits the slot');
  }
  const rim = project(model, new THREE.Vector3(-5.2, 0, 0));
  const center = project(model, new THREE.Vector3(0, 0, 0));
  assert.ok(isRimPoint(model, discPointAt(model, rim.x, rim.y)));
  assert.ok(!isRimPoint(model, discPointAt(model, center.x, center.y)), 'the inner disc stays free for selection and area swipes');
  const angleA = discPointAt(model, project(model, new THREE.Vector3(-5.2, 0, 0)).x, rim.y).angle;
  const towardViewer = project(model, new THREE.Vector3(-5.2 * Math.cos(.3), 0, 5.2 * Math.sin(.3)));
  assert.ok(discPointAt(model, towardViewer.x, towardViewer.y).angle < angleA, 'moving the left rim downward on screen is anticlockwise');
});

test('minor bodies take their own atlas cell and never a planetary one', () => {
  const data = fixtureSceneData();
  data.natal.chiron = { longitude: 243.75, degree: '3°45′' };
  data.natal.vesta = { longitude: 100, degree: '10°00′' };
  const model = buildSolarScene({ atlas: new THREE.Texture(), minorAtlas: new THREE.Texture(), data });
  const chiron = model.planets.find(planet => planet.name === 'chiron'), vesta = model.planets.find(planet => planet.name === 'vesta');
  assert.ok(chiron.material.map && vesta.material.map, 'minor bodies are textured');
  assert.deepEqual([chiron.userData.row, chiron.userData.column], [0, 0]);
  assert.deepEqual([vesta.userData.row, vesta.userData.column], [1, 1]);
  assert.notEqual(chiron.material.map.offset.x, model.planets.find(planet => planet.name === 'sun').material.map.offset.x + 1);
});
