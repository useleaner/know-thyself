import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPlaces, localToUtc, localToUtcDetailed } from './geocode.js';

const reply = body => async (url, opts) => ({ ok: true, status: 200, json: async () => body, url, opts });
test('searchPlaces monta a URL, normaliza e envia só o texto digitado', async () => {
  let seen;
  const fetch = async url => { seen = url; return { ok: true, json: async () => ({ results: [
    { name: 'Passo Fundo', admin1: 'Rio Grande do Sul', country: 'Brasil', latitude: -28.26278, longitude: -52.40667, timezone: 'America/Sao_Paulo' },
    { name: 'Lixo', latitude: 'x', longitude: 1, timezone: 'UTC' }] }) }; };
  const out = await searchPlaces(' Passo Fundo ', { fetch });
  const u = new URL(seen);
  assert.equal(u.origin + u.pathname, 'https://geocoding-api.open-meteo.com/v1/search');
  assert.deepEqual([...u.searchParams.keys()].sort(), ['count', 'format', 'language', 'name']);
  assert.equal(u.searchParams.get('name'), 'Passo Fundo');
  assert.deepEqual(out, [{ label: 'Passo Fundo, Rio Grande do Sul, Brasil', lat: -28.26278, lon: -52.40667, timezone: 'America/Sao_Paulo', country: 'Brasil', admin1: 'Rio Grande do Sul' }]);
});
test('searchPlaces: consulta curta não chama a rede; sem resultados dá lista vazia', async () => {
  const fetch = async () => { throw new Error('não deveria chamar'); };
  assert.deepEqual(await searchPlaces('a', { fetch }), []);
  assert.deepEqual(await searchPlaces('zzzz', { fetch: reply({ generationtime_ms: 1 }) }), []);
});
test('searchPlaces: erro HTTP, rede e timeout viram mensagem amigável', async () => {
  await assert.rejects(searchPlaces('Curitiba', { fetch: async () => ({ ok: false, status: 500 }) }), /busca de cidades/i);
  await assert.rejects(searchPlaces('Curitiba', { fetch: async () => { throw new TypeError('x'); } }), /busca de cidades/i);
  const hang = (url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new DOMException('a', 'AbortError'))));
  await assert.rejects(searchPlaces('Curitiba', { fetch: hang, timeoutMs: 10 }), /demorou/i);
});
test('1/3/2000 09:30 em São Paulo: horário de verão já acabou (27/02/2000), UTC-3', () => {
  assert.equal(localToUtc({ date: '2000-03-01', time: '09:30', timezone: 'America/Sao_Paulo' }).toISOString(), '2000-03-01T12:30:00.000Z');
  assert.equal(localToUtc({ date: '2000-02-20', time: '09:30', timezone: 'America/Sao_Paulo' }).toISOString(), '2000-02-20T11:30:00.000Z');
});
test('horário inexistente (salto do DST) falha com aviso; resolve explícito avança', () => {
  const args = { date: '2018-11-04', time: '00:30', timezone: 'America/Sao_Paulo' };
  assert.throws(() => localToUtc(args), e => e.code === 'nonexistent' && /não existiu/.test(e.message));
  const d = localToUtcDetailed(args);
  assert.equal(d.status, 'nonexistent');
  assert.ok(d.warning);
  assert.equal(localToUtc(args, { resolve: 'later' }).toISOString(), '2018-11-04T03:30:00.000Z');
});
test('horário ambíguo (repetido) falha com aviso; resolve escolhe a ocorrência', () => {
  const args = { date: '2018-02-17', time: '23:30', timezone: 'America/Sao_Paulo' };
  assert.throws(() => localToUtc(args), e => e.code === 'ambiguous');
  assert.equal(localToUtc(args, { resolve: 'earlier' }).toISOString(), '2018-02-18T01:30:00.000Z');
  assert.equal(localToUtc(args, { resolve: 'later' }).toISOString(), '2018-02-18T02:30:00.000Z');
});
test('entradas inválidas são rejeitadas', () => {
  for (const a of [{ date: '2000-02-30', time: '10:00', timezone: 'UTC' }, { date: '2000-01-01', time: '25:00', timezone: 'UTC' }, { date: '2000-01-01', time: '10:00', timezone: 'Nao/Existe' }]) assert.throws(() => localToUtc(a));
  assert.equal(localToUtc({ date: '2000-01-01', time: '10:00', timezone: 'UTC' }).toISOString(), '2000-01-01T10:00:00.000Z');
});
