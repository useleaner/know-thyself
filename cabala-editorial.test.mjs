import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { computeTree } from './cabala-engine.js';
import { spheres, personalPaths } from './tree.js';
import { sphereStudy, paths } from './study-data.js';
import { sphereEnergyReading, observedSphereReadings } from './sphere-energy.js';
import { cabalaSphereTexts, cabalaStudyPathTexts, cabalaPersonalPathTexts, cabalaLineTexts, cabalaTranslations, cabalaLearningTexts } from './cabala-catalog.js';
import { personalPathReading, sphereConnections, pathReadingTypes } from './cabala-readings.js';
import EN from './i18n-en.js';
const first = { name: 'Teste Alfa Beta', birthDate: '1996-01-02', cabala: { firstNames: 'Teste', paternalSurname: 'Beta', maternalSurname: 'Alfa', language: 'pt', order: 'maternal-first' } };
const second = { ...first, birthDate: '1996-01-22' };

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
    assert.equal(sphereEnergyReading(sphere.id, { tree: computeTree(first) }).paragraphs[0], cabalaLearningTexts.spheres[sphere.id][0]);
  }
  for (const path of paths) assert.equal(path.description, cabalaStudyPathTexts[path.number][0]);
  assert.equal(paths.find(path => path.number === 11).to, 'chokmah');
  assert.equal(personalPaths.find(path => path.number === 1).to, 'binah');
});

test('Cabala: coincidência dos três valores observados nunca seleciona prosa da referência', () => {
  const tree = computeTree(first), other = computeTree(second);
  assert.notDeepEqual(tree.values, other.values);
  for (const [id, value] of [['binah', '8/4'], ['tiphareth', '5/8'], ['chokmah', '8/4']]) {
    const general = sphereEnergyReading(id, { tree });
    assert.deepEqual(sphereEnergyReading(id, { value, tree, treeId: 'provided-personal-tree' }), general);
    assert.notDeepEqual(general, observedSphereReadings[`${id}:${value}`]);
    assert.equal(sphereEnergyReading(id), null);
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
        assert.equal(reading.text, personalPathReading(expected[index]).text);
        assert.equal(reading.relationshipText, cabalaPersonalPathTexts[expected[index].number][0]);
        assert.equal(Boolean(reading.countText), expected[index].samples.length > 0);
        assert.equal(reading.lines, expected[index].samples.length);
        assert.deepEqual(reading.types, pathReadingTypes(expected[index]));
      });
      const numerator = expected.reduce((sum, path) => sum + path.samples.filter(sample => sample.type !== 'karma').length, 0);
      assert.equal(tree.values[sphere.id], `${numerator}/${expected.length}`);
      const teaching = sphereEnergyReading(sphere.id, { tree });
      assert.equal(teaching.value, tree.values[sphere.id]);
      assert.equal(teaching.lines, numerator);
      assert.equal(teaching.paths, expected.length);
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
  const script = `globalThis.localStorage={getItem:()=> 'en'};const assert=(await import('node:assert/strict')).default;const m=await import('./cabala-catalog.js');const {sphereEnergyReading}=await import('./sphere-energy.js');const {sphereStudy,paths}=await import('./study-data.js');const {personalPathReading}=await import('./cabala-readings.js');const {computeTree}=await import('./cabala-engine.js');for(const[id,item]of Object.entries(m.cabalaSphereTexts)){assert.equal(sphereStudy[id].description,item.study[1]);assert.equal(sphereEnergyReading(id,{tree:computeTree(${JSON.stringify(first)})}).paragraphs[0],m.cabalaLearningTexts.spheres[id][1]);}for(const path of paths)assert.equal(path.description,m.cabalaStudyPathTexts[path.number][1]);for(const path of computeTree(${JSON.stringify(first)}).paths){const r=personalPathReading(path);assert.equal(r.text,(await import('./i18n.js')).t(m.cabalaLearningTexts.labels.path[0],{from:(await import('./tree.js')).spheres.find(s=>s.id===path.from).name,to:(await import('./tree.js')).spheres.find(s=>s.id===path.to).name,fromMeaning:(await import('./tree.js')).spheres.find(s=>s.id===path.from).subtitle,toMeaning:(await import('./tree.js')).spheres.find(s=>s.id===path.to).subtitle}));assert.equal(r.relationshipText,m.cabalaPersonalPathTexts[path.number][1]);for(const c of r.conditions)assert.equal(c.text,m.cabalaLearningTexts.types[c.type][1]);}console.log('Cabala EN ok');`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: new URL('.', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Cabala EN ok/);
});


test('Cabala: contagem ensina repetição, vazios e exclusão de karma e dons', () => {
  const path = (number, samples, gift = false) => ({ number, from: 'kether', to: number === 1 ? 'binah' : 'chokmah', samples: samples.map(type => ({ type })), gift });
  const empty = path(1, []);
  const repeated = path(22, ['standard', 'standard', 'hidden'], true);
  const karmic = path(2, ['karma', 'karma']);
  const tree = { paths: [empty, repeated, karmic] };
  const reading = sphereEnergyReading('kether', { tree });
  assert.equal(reading.value, '3/3');
  assert.equal(reading.karma, 2);
  assert.equal(personalPathReading(repeated).counted, 3);
  assert.equal(personalPathReading(karmic).counted, 0);
  assert.equal(personalPathReading(empty).lines, 0);
  assert.equal(personalPathReading(empty).countText, '');
  assert.doesNotMatch(personalPathReading(repeated).countText, /karma|\b0\b/i);
  assert.match(personalPathReading(karmic).countText, /karma: 2/);
  assert.doesNotMatch(personalPathReading(karmic).countText, /\b0\b/);
  assert.ok(personalPathReading(repeated).conditions.find(item => item.type === 'blocked').text.includes('multiplicidade'));
  assert.equal(sphereEnergyReading('kether', { tree: { paths: [empty] } }).value, '0/1');
  const a = sphereEnergyReading('chokmah', { tree: computeTree(first) });
  const b = sphereEnergyReading('chokmah', { tree: computeTree(second) });
  assert.notEqual(a.value, b.value);
  assert.notEqual(a.paragraphs[1], b.paragraphs[1]);
  assert.equal(a.paragraphs[0], b.paragraphs[0]);
  assert.equal(sphereEnergyReading('kether', { tree: { paths: [empty, repeated] } }).paragraphs.length, 2);
  assert.equal(reading.paragraphs.length, 3);
});


test('Cabala: tipos explicam dados informados sem atribuir o primeiro sobrenome a pai ou mãe', () => {
  const reading = personalPathReading({ number: 7, from: 'binah', to: 'tiphareth', samples: [{ type: 'primary' }, { type: 'secondary' }] });
  assert.match(reading.conditions[0].text, /prenomes.*primeiro sobrenome.*ordem salva/);
  assert.match(reading.conditions[1].text, /dois sobrenomes/);
  assert.doesNotMatch(reading.conditions[0].text, /sobrenome paterno|sobrenome materno/);
  assert.match(cabalaLearningTexts.types.primary[1], /given names.*first surname.*saved order/);
  assert.match(cabalaLearningTexts.types.secondary[1], /two birth surnames/);
  assert.equal(cabalaLearningTexts.labels.calculation[0], 'Origem e contagem');
  assert.equal(cabalaLearningTexts.labels.calculation[1], 'Origin and count');
  for (const type of ['short-crisis', 'long-crisis']) {
    assert.match(cabalaLearningTexts.types[type][0], type === 'short-crisis' ? /dia e mês/ : /mês e ano/);
  }
  for (const pair of [...Object.values(cabalaLearningTexts.types), cabalaLearningTexts.labels.excluded]) {
    for (const text of pair) assert.doesNotMatch(text, /\bblocos?\b|\bblocks?\b/i);
  }
});
