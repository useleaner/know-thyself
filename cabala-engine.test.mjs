import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTree, computeBlocks, nameBlock, splitName, alphabetFor, pathCycles } from './cabala-engine.js';


test('caso fictício Alba Silva Costa (17/06/1991): valores, contagem dos 22 caminhos e dons iguais ao app Kabbalah', () => {
  // Observado no app Kabbalah no iPhone em 20/10/2026 (docs/auditorias/2026-10-20/q2-cabala.json, repositório privado).
  const tree = computeTree({ name: 'Alba Silva Costa', birthDate: '1991-06-17' });
  assert.deepEqual(tree.values, { kether: '4/3', binah: '7/4', chokmah: '3/4', tiphareth: '9/8', geburah: '6/4', chesed: '4/4', hod: '6/5', netzach: '6/5', yesod: '3/4', malkuth: '2/3' });
  const counts = [1, 2, 0, 1, 1, 3, 3, 2, 1, 1, 1, 0, 1, 1, 0, 3, 1, 1, 1, 2, 0, 1];
  for (const path of tree.paths) assert.equal(path.samples.length, counts[path.number - 1], `caminho ${path.number}`);
  assert.deepEqual(tree.paths.filter(path => path.gift).map(path => path.number).sort((a, b) => a - b), [4, 5, 13, 14, 22]);
  assert.equal(alphabetFor('1991-06-17'), alphabetFor('2000-01-01'));
  assert.deepEqual(nameBlock('Ortega', ['ABC#DEFGH', 'IJKL@MNÑO', 'PQRSTUVWX', 'YZ']), { visible: [5], hidden: [14] }, 'exemplo do livro');
  assert.equal(alphabetFor('2009-01-01').length, 3);
  assert.notEqual(alphabetFor('2009-01-01'), alphabetFor('1991-06-17'));
  assert.ok(Object.keys(computeBlocks({ name: 'Alba Silva Costa', birthDate: '1991-06-17' })).length > 0);
});

test('ciclos: crise na metade e no fim (linha sozinha), no mínimo (uma fixa), sobrecarga no máximo (duas fixas)', () => {
  const profile = { name: 'Alba Silva Costa', birthDate: '1991-06-17' };
  const cycles = pathCycles(profile, computeTree(profile), new Date(Date.UTC(2026, 9, 20)));
  assert.ok(Object.values(cycles).flat().every(cycle => cycle.next > new Date(Date.UTC(2026, 9, 20))));
  const tree = path => ({ paths: [{ number: 1, samples: path.map(type => ({ type })) }] });
  const at = samples => pathCycles({ birthDate: '2000-01-01' }, tree(samples), new Date(Date.UTC(2000, 0, 2)))[1][0];
  // Ciclo curto de 2 meses: metade = 1 mês, mínimo = 1,5, máximo = 0,5.
  const days = date => Math.round((date - Date.UTC(2000, 0, 1)) / 864e5);
  assert.equal(days(at(['short-crisis']).next), 30);
  assert.equal(days(at(['short-crisis', 'standard']).next), 46);
  assert.equal(days(at(['short-crisis', 'standard', 'primary']).next), 15);
  assert.equal(at(['short-crisis', 'standard']).event, 'crisis');
  assert.equal(at(['short-crisis', 'standard', 'primary']).event, 'overload');
});

test('nome civil brasileiro: materno antes do paterno, partículas e Junior agrupados', () => {
  assert.deepEqual(splitName('Bento Rocha Junior'), { first: 'Bento', paternal: 'Rocha Junior', maternal: '' });
  assert.deepEqual(splitName('Maria da Silva dos Santos Filho'), { first: 'Maria', paternal: 'dos Santos Filho', maternal: 'da Silva' });
});

test('qualquer pessoa válida recebe árvore; dados inválidos não', () => {
  const tree = computeTree({ name: 'Ana Souza', birthDate: '1987-11-24' });
  assert.equal(tree.paths.length, 22);
  assert.ok(tree.paths.some(path => path.samples.length));
  for (const profile of [null, {}, { name: 'Ana' }, { name: 'Ana', birthDate: '24/11/1987' }]) assert.equal(computeTree(profile), null);
});
