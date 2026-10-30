import test from 'node:test';
import assert from 'node:assert/strict';
import { sphereEnergyReading, observedSphereReadings } from './sphere-energy.js';
import { spheres } from './tree.js';
import { computeTree } from './cabala-engine.js';
const tree = computeTree({ name: 'Teste Alfa Beta', birthDate: '1996-01-02', cabala: { firstNames: 'Teste', paternalSurname: 'Beta', maternalSurname: 'Alfa', language: 'pt', order: 'maternal-first' } });

test('every sphere explains its meaning, current ratio and an observation question', () => {
  for (const sphere of spheres) {
    const reading = sphereEnergyReading(sphere.id, { tree });
    assert.ok(reading.title);
    assert.equal(reading.paragraphs.length, reading.karma > 0 ? 3 : 2);
    assert.equal(reading.value, tree.values[sphere.id]);
    assert.ok(reading.question.endsWith('?'));
    assert.doesNotMatch(reading.paragraphs.join(' '), /Você é|sua personalidade|você tem bloqueio/i);
  }
  assert.equal(sphereEnergyReading('unknown', { tree }), null);
  assert.equal(sphereEnergyReading('kether'), null);
});

test('observed readings stay preserved as source and cannot be activated by caller identity or value', () => {
  for (const [id, value] of [['chokmah', '8/4'], ['binah', '8/4'], ['tiphareth', '5/8']]) {
    const general = sphereEnergyReading(id, { tree });
    for (const options of [{ value, treeId: 'provided-personal-tree' }, { value: '9/4' }, { treeId: 'another-person' }]) {
      assert.deepEqual(sphereEnergyReading(id, { tree, ...options }), general);
    }
    assert.notDeepEqual(observedSphereReadings[`${id}:${value}`], general);
    assert.equal(sphereEnergyReading(id, { value, treeId: 'provided-personal-tree' }), null);
  }
});
