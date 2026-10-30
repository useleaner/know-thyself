import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyMeanings, pairedTexts, explicitExamples } from './aspect-context-texts.js';
import { natalSynthesisContext } from './natal-synthesis-texts.js';

const ids = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('catálogo não natal cobre cada par e cada mesmo astro com PT/EN próprios', () => {
  assert.deepEqual(Object.keys(bodyMeanings).sort(), [...ids].sort());
  for (const id of ids) assert.ok(natalSynthesisContext.functions[id]);
  for (const pair of Object.values(bodyMeanings)) {
    assert.equal(pair.length, 2);
    assert.notEqual(pair[0], pair[1]);
    for (const text of pair) assert.ok(text.length > 50 && text.endsWith('.'));
  }
  const expected = new Set(ids.flatMap((from, i) => ids.slice(i).map(to => [from, to].sort().join('-'))));
  assert.equal(expected.size, 55);
  assert.deepEqual(Object.keys(pairedTexts).sort(), [...expected].sort());
  for (const [key, pair] of Object.entries(pairedTexts)) {
    assert.equal(pair.length, 2, key);
    assert.notEqual(pair[0], pair[1], key);
    for (const text of pair) {
      assert.ok(text.trim().length > 100, key);
      assert.deepEqual(placeholders(text), [], key);
      assert.doesNotMatch(text, /\bundefined\b|\bNaN\b|<[^>]+>/, key);
    }
  }
  for (const language of [0, 1]) assert.equal(new Set(Object.values(pairedTexts).map(pair => pair[language])).size, 55);
});

test('amostras direcionais conservam donos e paridade PT/EN sem reutilizar a ordem inversa', () => {
  assert.deepEqual(Object.keys(explicitExamples).sort(), ['synastry:mercury>mars:square', 'transit:saturn>moon:square']);
  for (const entry of Object.values(explicitExamples)) {
    assert.equal(entry.paragraphs.length, 2);
    for (const pair of entry.paragraphs) {
      assert.equal(pair.length, 2);
      assert.deepEqual(placeholders(pair[0]), placeholders(pair[1]));
      for (const placeholder of placeholders(pair[0])) assert.ok(['fromOwner', 'toOwner'].includes(placeholder));
    }
  }
  const transit = explicitExamples['transit:saturn>moon:square'].paragraphs.map(pair => pair[0]).join(' ');
  assert.match(transit, /Lua natal de \{toOwner\}/);
  assert.match(transit, /Saturno em trânsito/);
  assert.doesNotMatch(transit, /\{fromOwner\}/);
  const synastry = explicitExamples['synastry:mercury>mars:square'].paragraphs[0][0];
  assert.match(synastry, /Mercúrio de \{fromOwner\}/);
  assert.match(synastry, /Marte de \{toOwner\}/);
  assert.equal(explicitExamples['transit:moon>saturn:square'], undefined);
  assert.equal(explicitExamples['synastry:mars>mercury:square'], undefined);
});
