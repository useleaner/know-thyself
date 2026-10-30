import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCabala } from './cabala-input.js';

const cabala = { firstNames: ' Alba Maria ', paternalSurname: 'Costa', maternalSurname: 'Silva', language: 'pt', order: 'maternal-first' };

test('Cabala opcional; nomes explícitos e ordem preservados sem inferência', () => {
  assert.equal(normalizeCabala(undefined), undefined);
  assert.deepEqual(normalizeCabala({ ...cabala, ignored: 'extra' }), { ...cabala, firstNames: 'Alba Maria' });
  assert.equal(normalizeCabala({ ...cabala, firstNames: 'Álba-Maria' }).firstNames, 'Álba-Maria');
});

test('entrada incompleta ou fora do alfabeto nunca vira outro nome ou idioma', () => {
  for (const invalid of [null, [], {}, { ...cabala, firstNames: '' }, { ...cabala, maternalSurname: undefined }, { ...cabala, order: '' }, { ...cabala, language: 'constructor' }, { ...cabala, language: 'es' }, { ...cabala, paternalSurname: '李' }, { ...cabala, firstNames: '123' }, { ...cabala, maternalSurname: 'a'.repeat(121) }]) {
    assert.throws(() => normalizeCabala(invalid));
  }
  for (const language of ['pt', 'en']) {
    assert.equal(normalizeCabala({ ...cabala, language, firstNames: 'Kaya Wanda Yara' }).firstNames, 'Kaya Wanda Yara');
  }
});

test('validação com nascimento bloqueia letras sem tabela observada; armazenamento sem data preserva-as', () => {
  for (const firstNames of ['Kaya', 'Wanda', 'Yara']) {
    const input = { ...cabala, firstNames };
    assert.equal(normalizeCabala(input).firstNames, firstNames);
    assert.throws(() => normalizeCabala(input, '2008-06-17'));
    assert.equal(normalizeCabala(input, '2009-06-17').firstNames, firstNames);
    assert.equal(normalizeCabala({ ...input, language: 'en' }, '1984-11-23').firstNames, firstNames);
  }
});
