import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT, planetInSign, planetInHouse, aspect, aspectText, influence, balance } from './interpretations.js';

const planets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const ok = (t) => typeof t === 'string' && t.length >= 80 && t.length <= 700 && !/\bTODO\b/.test(t);

test('combinações completas, válidas e únicas', () => {
  assert.equal(DRAFT, true);
  const all = [];
  for (const p of planets) {
    assert.equal(planetInSign[p].length, 12);
    for (let s = 0; s < 12; s++) all.push(planetInSign[p][s]);
    for (let h = 1; h <= 12; h++) all.push(planetInHouse[p][h]);
  }
  assert.equal(all.length, 240);
  all.forEach((t) => assert.ok(ok(t), t));
  assert.equal(new Set(all).size, all.length);
});

test('aspectos e balanço', () => {
  const kinds = ['conjunction', 'opposition', 'trine', 'square', 'sextile'];
  const texts = [];
  for (const k of kinds) {
    assert.ok(ok(aspect[k]));
    for (const c of ['natal', 'transit', 'synastry']) {
      const t = aspectText(k, 'Sol', 'Lua', c);
      assert.ok(ok(t) && t.includes('Sol') && t.includes('Lua'));
      texts.push(t);
    }
  }
  assert.equal(new Set(texts).size, 15);
  const b = ['fogo', 'terra', 'ar', 'agua', 'cardinal', 'fixa', 'mutavel', 'masculina', 'feminina'];
  const bt = b.flatMap((k) => [balance[k].excess, balance[k].lack]);
  bt.forEach((t) => assert.ok(ok(t)));
  assert.equal(new Set(bt).size, 18);
});

test('dignidades', () => {
  assert.equal(influence('sun', 4), 'forte');
  assert.equal(influence('sun', 0), 'forte');
  assert.equal(influence('sun', 10), 'fraca');
  assert.equal(influence('sun', 6), 'fraca');
  assert.equal(influence('sun', 1), 'neutra');
  assert.equal(influence('mercury', 11), 'fraca');
  assert.equal(influence('pluto', 7), 'forte');
  assert.equal(influence('neptune', 5), 'fraca');
});
