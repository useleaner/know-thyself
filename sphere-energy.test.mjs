import test from 'node:test';
import assert from 'node:assert/strict';
import { sphereEnergyReading, observedSphereReadings } from './sphere-energy.js';
import { spheres } from './tree.js';

test('every sphere has useful reflective content without repeating its score', () => {
  for (const sphere of spheres) {
    const reading = sphereEnergyReading(sphere.id);
    assert.ok(reading.title);
    assert.equal(reading.paragraphs.length, 3);
    assert.doesNotMatch(reading.paragraphs.join(' '), /\d+\/\d+|Seu valor|referência do exemplo|aparece com valor/i);
  }
  assert.equal(sphereEnergyReading('unknown'), null);
});

test('observed readings stay preserved as source and cannot be activated by caller identity', () => {
  for (const [id, value] of [['chokmah', '8/4'], ['binah', '8/4'], ['tiphareth', '5/8']]) {
    const general = sphereEnergyReading(id);
    const specific = sphereEnergyReading(id, { value, treeId: 'provided-personal-tree' });
    assert.equal(specific, general);
    assert.notDeepEqual(observedSphereReadings[`${id}:${value}`], general);
    assert.equal(sphereEnergyReading(id, { value: '9/4', treeId: 'provided-personal-tree' }), general);
    assert.equal(sphereEnergyReading(id, { value, treeId: 'another-person' }), general);
    assert.equal(sphereEnergyReading(id, { value }), general);
  }
  assert.equal(sphereEnergyReading('kether', { value: '4/3', treeId: 'provided-personal-tree' }), sphereEnergyReading('kether'));
});
