import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildMapState, findBody } from './map-data.js';
import { renderMapReading, selectableBodies } from './map-explorer.js';
import { escapeHTML } from './map-readings.js';
import { natalSignTexts, natalHouseTexts, natalTranslations } from './natal-catalog.js';
import { natalSignReading, natalHouseReading, natalDignityReading } from './natal-readings.js';

const ids = ['chiron', 'ceres', 'pallas', 'juno', 'vesta'];
const points = Object.fromEntries(ids.map(id => [id, true]));
const profile = { name: 'Alba sintética', birthDate: '1991-06-17', birthTime: '04:23', timeUnknown: false, place: 'São Paulo, Brasil', lat: -23.55, lon: -46.63, timezone: 'America/Sao_Paulo' };

test('five minor-body catalogs cover all signs and houses with distinct PT/EN pairs', () => {
  const seenPT = new Set(), seenEN = new Set();
  for (const id of ids) {
    assert.equal(natalSignTexts[id].length, 12, id);
    assert.equal(natalHouseTexts[id].length, 13, id);
    assert.equal(natalHouseTexts[id][0], null);
    for (const [index, pair] of natalSignTexts[id].entries()) assert.equal(natalSignReading(id, index), pair[0]);
    for (let house = 1; house <= 12; house++) assert.equal(natalHouseReading(id, house), natalHouseTexts[id][house][0]);
    for (const pair of [...natalSignTexts[id], ...natalHouseTexts[id].slice(1)]) {
      assert.equal(pair.length, 2);
      assert.equal(natalTranslations[pair[0]], pair[1]);
      seenPT.add(pair[0]); seenEN.add(pair[1]);
    }
  }
  assert.equal(seenPT.size, 120);
  assert.equal(seenEN.size, 120);
});

test('calculated visible minor bodies select their own sign/house text without new aspects or dignities', () => {
  for (const houseSystem of ['placidus', 'equal', 'whole']) {
    const state = buildMapState({ profile, mode: 'natal', points, houseSystem });
    for (const id of ids) {
      const body = findBody(state, id);
      assert.equal(body.id, id);
      assert.ok(selectableBodies(state).some(item => item.id === id));
      const html = renderMapReading({ kind: 'body', id }, state);
      assert.ok(html.includes(escapeHTML(natalSignTexts[id][body.sign][0])));
      assert.ok(html.includes(escapeHTML(natalHouseTexts[id][body.house][0])));
      assert.doesNotMatch(html, /<p><\/p>|>undefined<|>NaN<|\{\w+\}/);
      assert.deepEqual(natalDignityReading(body), []);
      assert.ok(!state.aspects.some(aspect => aspect.from === id || aspect.to === id));
    }
  }
});

test('hidden or absent minor bodies never appear in menus or receive a fabricated reading', () => {
  const hidden = buildMapState({ profile, mode: 'natal', points: Object.fromEntries(ids.map(id => [id, false])) });
  for (const id of ids) {
    assert.equal(findBody(hidden, id), null);
    assert.ok(!selectableBodies(hidden).some(body => body.id === id));
    assert.equal(renderMapReading({ kind: 'body', id }, hidden), '');
  }
  const transits = buildMapState({ profile, mode: 'transits', points });
  for (const id of ids) assert.equal(findBody(transits, `transit-${id}`), null);
});

test('English minor-body readings use the matching English entries with no language mutation', () => {
  const code = `globalThis.localStorage={getItem:()=> 'en'};
    const {buildMapState,findBody}=await import('./map-data.js');
    const {renderMapReading}=await import('./map-explorer.js');
    const {escapeHTML,renderPositions}=await import('./map-readings.js');
    const {natalSignTexts,natalHouseTexts}=await import('./natal-catalog.js');
    const assert=(await import('node:assert/strict')).default;
    const state=buildMapState({profile:${JSON.stringify(profile)},mode:'natal',points:${JSON.stringify(points)}});
    for(const id of ${JSON.stringify(ids)}){
      const body=findBody(state,id),html=renderMapReading({kind:'body',id},state);
      assert.ok(html.includes(escapeHTML(natalSignTexts[id][body.sign][1])),id+':sign');
      assert.ok(html.includes(escapeHTML(natalHouseTexts[id][body.house][1])),id+':house');
      assert.ok(renderPositions(state).includes('aria-label="Read about '+body.name+' in '),id+':label');
    }`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: new URL('./', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
