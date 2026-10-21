import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { computeTree } from './cabala-engine.js';
import { spheres, personalPaths } from './tree.js';
import { sphereStudy, paths } from './study-data.js';
import { sphereEnergyReading, observedSphereReadings } from './sphere-energy.js';
import { cabalaSphereTexts, cabalaStudyPathTexts, cabalaPersonalPathTexts, cabalaLineTexts, cabalaTranslations } from './cabala-catalog.js';
import { personalPathReading, sphereConnections, pathReadingTypes } from './cabala-readings.js';
import EN from './i18n-en.js';
const first = { name: 'Teste Alfa Beta', birthDate: '1996-01-02' };
const second = { name: 'Teste Alfa Beta', birthDate: '1996-01-22' };

test('Cabala: catálogo completo com idiomas e fronteiras entre estudo e árvore pessoal', () => {
  assert.deepEqual(Object.keys(cabalaSphereTexts).sort(), spheres.map(s => s.id).sort());
  assert.deepEqual(Object.keys(cabalaStudyPathTexts).map(Number), Array.from({ length: 22 }, (_, i) => i + 11));
  assert.deepEqual(Object.keys(cabalaPersonalPathTexts).map(Number), Array.from({ length: 22 }, (_, i) => i + 1));
  assert.equal(Object.keys(cabalaLineTexts).length, 12);
  for (const [pt, en] of Object.entries(cabalaTranslations)) {
    assert.ok(pt.trim() && en.trim());
    assert.equal(EN[pt], en);
    assert.equal((pt.match(/\{\w+\}/g) || []).sort().join(), (en.match(/\{\w+\}/g) || []).sort().join());
  }
  for (const sphere of spheres) {
    assert.equal(sphereStudy[sphere.id].description, cabalaSphereTexts[sphere.id].study[0]);
    assert.deepEqual(sphereEnergyReading(sphere.id).paragraphs, cabalaSphereTexts[sphere.id].personal.map(pair => pair[0]));
  }
  for (const path of paths) assert.equal(path.description, cabalaStudyPathTexts[path.number][0]);
  assert.equal(paths.find(path => path.number === 11).to, 'chokmah');
  assert.equal(personalPaths.find(path => path.number === 1).to, 'binah');
});

test('Cabala: coincidência dos três valores observados nunca seleciona prosa da referência', () => {
  const tree = computeTree(first), other = computeTree(second);
  assert.equal(tree.values.binah, '8/4');
  assert.equal(tree.values.tiphareth, '5/8');
  assert.equal(other.values.chokmah, '8/4');
  for (const [id, value] of [['binah', '8/4'], ['tiphareth', '5/8'], ['chokmah', '8/4']]) {
    const general = sphereEnergyReading(id);
    assert.deepEqual(sphereEnergyReading(id, { value, treeId: 'provided-personal-tree' }), general);
    assert.notDeepEqual(general, observedSphereReadings[`${id}:${value}`]);
  }
  assert.equal(sphereEnergyReading('unknown'), null);
  const caller = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(caller, /provided-personal-tree/);
});

test('Cabala: relações, tipos e valores usam somente a árvore sintética atual', () => {
  for (const profile of [first, second, { name: 'Teste Costa', birthDate: '2012-05-06' }, { name: 'Teste', birthDate: '1980-10-11' }]) {
    const tree = computeTree(profile);
    for (const sphere of spheres) {
      const expected = tree.paths.filter(path => path.from === sphere.id || path.to === sphere.id);
      const readings = sphereConnections(sphere.id, tree);
      assert.deepEqual(readings.map(item => item.number), expected.map(path => path.number));
      readings.forEach((reading, index) => {
        assert.equal(reading.text, cabalaPersonalPathTexts[expected[index].number][0]);
        assert.equal(reading.lines, expected[index].samples.length);
        assert.deepEqual(reading.types, pathReadingTypes(expected[index]));
      });
      const numerator = expected.reduce((sum, path) => sum + path.samples.filter(sample => sample.type !== 'karma').length, 0);
      assert.equal(tree.values[sphere.id], `${numerator}/${expected.length}`);
    }
  }
  assert.deepEqual(sphereConnections('binah', null), []);
  assert.equal(computeTree(null), null);
  assert.equal(computeTree({ name: '', birthDate: '2000-01-01' }), null);
  assert.equal(personalPathReading({ number: 99, samples: [] }), null);
});

test('Cabala: as doze condições não inventam tipo ou força a partir da contagem', () => {
  for (const type of Object.keys(cabalaLineTexts).filter(type => !['gift', 'empty', 'blocked'].includes(type))) {
    assert.deepEqual(pathReadingTypes({ samples: [{ type }] }), [type]);
  }
  assert.deepEqual(pathReadingTypes({ samples: [] }), ['empty']);
  assert.deepEqual(pathReadingTypes({ samples: [], gift: true }), ['empty', 'gift']);
  assert.deepEqual(pathReadingTypes({ samples: [{ type: 'standard' }, { type: 'hidden' }, { type: 'karma' }] }), ['standard', 'hidden', 'karma', 'blocked']);
  assert.deepEqual(pathReadingTypes({ samples: [{ type: 'invented' }] }), []);
});

test('Cabala: carga EN real traduz todos estudos, reflexões, relações e condições', () => {
  const script = `globalThis.localStorage={getItem:()=> 'en'};const assert=(await import('node:assert/strict')).default;const m=await import('./cabala-catalog.js');const {sphereEnergyReading}=await import('./sphere-energy.js');const {sphereStudy,paths}=await import('./study-data.js');const {personalPathReading}=await import('./cabala-readings.js');const {computeTree}=await import('./cabala-engine.js');for(const[id,item]of Object.entries(m.cabalaSphereTexts)){assert.equal(sphereStudy[id].description,item.study[1]);assert.deepEqual(sphereEnergyReading(id).paragraphs,item.personal.map(pair=>pair[1]));}for(const path of paths)assert.equal(path.description,m.cabalaStudyPathTexts[path.number][1]);for(const path of computeTree(${JSON.stringify(first)}).paths){const r=personalPathReading(path);assert.equal(r.text,m.cabalaPersonalPathTexts[path.number][1]);for(const c of r.conditions)assert.equal(c.text,m.cabalaLineTexts[c.type][1]);}console.log('Cabala EN ok');`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: new URL('.', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Cabala EN ok/);
});
