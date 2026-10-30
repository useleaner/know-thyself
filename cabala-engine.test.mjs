import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTree, computeBlocks, nameBlock, splitName, alphabetFor, pathCycles } from './cabala-engine.js';


test('caso fictício Alba Silva Costa (17/06/1991): valores, contagem dos 22 caminhos e dons iguais ao app Kabbalah', () => {
  // Valores conferidos no app Kabbalah de referência.
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

test('dados explícitos: aritmética EN26, prenomes integrais, famílias e blocos vocacionais', () => {
  // EN26: W=5,X=6; A=1,B=2. Soma 11 e ponderada 1100; cálculo independente abaixo.
  const profile = { birthDate: '2000-03-30', cabala: { firstNames: 'W X', paternalSurname: 'A', maternalSurname: 'B', language: 'en', order: 'paternal-first' } };
  const blocks = computeBlocks(profile);
  const visible = { 1: [11, 2], 2: [1], 3: [2], 4: [3], 5: [3], 6: [2], 7: [14, 5], 8: [8], 9: [22, 4, 13], 10: [12, 3], 11: [3], 12: [6], 13: [5], A: [15, 6], B: [11, 2], C: [8, 17] };
  for (const [key, values] of Object.entries(visible)) assert.deepEqual(blocks[key], { visible: values, hidden: [] }, `bloco ${key}`);
  const tree = computeTree(profile);
  const expectedTypes = { 1: ['standard'], 2: ['standard', 'standard', 'standard'], 3: ['standard', 'standard', 'primary', 'secondary'], 4: ['standard'], 5: ['standard', 'long-crisis'], 6: ['short-crisis'], 8: ['standard'], 11: ['standard'], 12: ['primary'], 13: ['standard'], 14: ['standard'], 15: ['karma'], 17: ['karma'], 22: ['standard'] };
  for (const path of tree.paths) assert.deepEqual(path.samples.map(sample => sample.type), expectedTypes[path.number] || [], `caminho ${path.number}`);
  assert.deepEqual(tree.paths.filter(path => path.gift).map(path => path.number).sort((a, b) => a - b), [2, 6, 8, 11]);
  assert.deepEqual(tree.values, { kether: '5/3', binah: '6/4', chokmah: '8/4', tiphareth: '8/8', geburah: '3/4', chesed: '3/4', hod: '1/5', netzach: '1/5', yesod: '1/4', malkuth: '0/3' });
});

test('EN26 independe do ano; PT usa conversão observada antes/depois de2009; nome civil não interfere', () => {
  const cabala = { firstNames: 'X Y', paternalSurname: 'A', maternalSurname: 'B', language: 'en', order: 'paternal-first' };
  assert.deepEqual(computeBlocks({ cabala, birthDate: '1991-06-17' })[1], { visible: [13, 4], hidden: [] });
  assert.deepEqual(computeBlocks({ cabala, birthDate: '2009-06-17' })[1], { visible: [13, 4], hidden: [] });
  const original = { birthDate: '1991-06-17', cabala };
  assert.deepEqual(computeTree({ ...original, name: 'Outro Nome Civil' }), computeTree(original));
  const pt = { ...cabala, language: 'pt', firstNames: 'Alba Maria' };
  assert.deepEqual(computeBlocks({ birthDate: '1991-06-17', cabala: pt })[1], { visible: [10, 1], hidden: [] });
  assert.deepEqual(computeBlocks({ birthDate: '2009-06-17', cabala: pt })[1], { visible: [4], hidden: [13] });
});

test('ordem declarada atribui sobrenomes aos blocos2/3 e altera a missão principal', () => {
  const cabala = { firstNames: 'Alba Maria', paternalSurname: 'Costa', maternalSurname: 'Silva', language: 'pt', order: 'paternal-first' };
  const profile = { birthDate: '1991-06-17', cabala };
  const first = computeBlocks(profile);
  const reversed = computeBlocks({ ...profile, cabala: { ...cabala, order: 'maternal-first' } });
  assert.deepEqual(first[2], reversed[3]);
  assert.deepEqual(first[3], reversed[2]);
  assert.deepEqual(first[1], { visible: [10, 1], hidden: [] });
  assert.notDeepEqual(first[10], reversed[10]);
  assert.notDeepEqual(computeTree(profile).paths, computeTree({ ...profile, cabala: { ...cabala, order: 'maternal-first' } }).paths);
});

test('ocultos nativos e derivados preservam tipo; vocacionais usam ocultos como visíveis', () => {
  // Ortega em EN26: soma 30→3; soma ponderada 363→12. +A+B gera 6/oculto 15; +A gera 4/oculto 13.
  const profile = { birthDate: '2000-03-30', cabala: { firstNames: 'Ortega', paternalSurname: 'A', maternalSurname: 'B', language: 'en', order: 'paternal-first' } };
  const b = computeBlocks(profile);
  assert.deepEqual(b[1], { visible: [3], hidden: [12] });
  assert.deepEqual(b[7], { visible: [6], hidden: [15] });
  assert.deepEqual(b[10], { visible: [4], hidden: [13] });
  assert.deepEqual(b.A, { visible: [7, 16], hidden: [] });
  assert.deepEqual(b.C, { visible: [18, 9], hidden: [] });
  const tree = computeTree(profile);
  assert.deepEqual(tree.paths.find(path => path.number === 13).samples, [{ type: 'primary-hidden' }]);
  assert.ok(tree.paths.find(path => path.number === 15).samples.some(sample => sample.type === 'hidden'));
});

test('árvore rejeita datas irreais e dados explícitos incompletos sem fallback nem exceção', () => {
  const cabala = { firstNames: 'Wanda', paternalSurname: 'Costa', maternalSurname: 'Silva', language: 'en', order: 'paternal-first' };
  const profile = { name: 'Alba Silva Costa', birthDate: '2000-02-29', cabala };
  assert.ok(computeTree(profile));
  for (const birthDate of ['2001-02-29', '2026-04-31', '2000-00-10', '2000-13-01', '2000-01-00', '0000-01-01', '2000-1-01', 2000]) {
    assert.equal(computeTree({ ...profile, birthDate }), null, String(birthDate));
  }
  for (const invalid of [null, {}, { ...cabala, language: 'pt' }, { ...cabala, language: 'es' }, { ...cabala, order: '' }, { ...cabala, maternalSurname: '' }, { ...cabala, firstNames: '王' }, { ...cabala, firstNames: '---' }]) {
    assert.equal(computeTree({ ...profile, cabala: invalid }), null, JSON.stringify(invalid));
    assert.throws(() => computeBlocks({ ...profile, cabala: invalid }));
  }
  assert.equal(computeTree({ name: '---', birthDate: '2000-01-01' }), null);
});


test('PT anterior a2009 não inventa fallback K/W/Y; EN e PT posterior a2009 os aceitam', () => {
  for (const firstNames of ['Kaya', 'Wanda', 'Yara', 'Kaya Wanda Yara']) {
    const cabala = { firstNames, paternalSurname: 'Costa', maternalSurname: 'Silva', language: 'pt', order: 'paternal-first' };
    assert.equal(computeTree({ cabala, birthDate: '2008-06-17' }), null, firstNames);
    assert.throws(() => computeBlocks({ cabala, birthDate: '2008-06-17' }), undefined, firstNames);
    assert.ok(computeTree({ cabala, birthDate: '2009-06-17' }), firstNames);
    assert.ok(computeTree({ cabala: { ...cabala, language: 'en' }, birthDate: '2008-06-17' }), firstNames);
    assert.throws(() => nameBlock(firstNames, alphabetFor('2008-06-17')));
  }
});
