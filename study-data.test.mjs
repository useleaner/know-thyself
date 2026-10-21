import test from 'node:test';
import assert from 'node:assert/strict';
import { paths } from './study-data.js';

test('all 22 hermetic paths carry a Thoth card and a concrete attribution', () => {
  assert.equal(paths.length, 22);
  paths.forEach(path => {
    assert.ok(path.thoth, `path ${path.number} needs a Thoth card`);
    assert.ok(path.attribution && !path.attributionPending);
  });
});

test('diagram follows Crowley/Thoth: He=Aquarius, Tzaddi=Aries, no thothNote', () => {
  const he = paths.find(path => path.letterName === 'He');
  const tzaddi = paths.find(path => path.letterName === 'Tzaddi');
  assert.deepEqual([he.number, he.attribution, he.thoth, he.symbol], [15, 'Aquário', 'A Estrela', '♒']);
  assert.deepEqual([tzaddi.number, tzaddi.attribution, tzaddi.thoth, tzaddi.symbol], [28, 'Áries', 'O Imperador', '♈']);
  assert.ok(paths.every(path => !('thothNote' in path)));
});

test('Thoth card names follow the path order 11-32', () => {
  const names = 'O Louco,O Mago,A Sacerdotisa,A Imperatriz,A Estrela,O Hierofante,Os Amantes,A Carruagem,Luxúria,O Eremita,A Fortuna,Ajuste,O Enforcado,A Morte,Arte,O Diabo,A Torre,O Imperador,A Lua,O Sol,O Éon,O Universo'.split(',');
  assert.deepEqual(paths.map(path => path.thoth), names);
  assert.deepEqual(paths.map(path => path.number), names.map((_, i) => i + 11));
});
