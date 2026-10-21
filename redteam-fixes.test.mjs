import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProfileHeader, renderCalendarDays } from './map-readings.js';
import { searchPlaces } from './geocode.js';

const profile = id => ({ id, name: 'Ana', birthDate: '1996-03-14', birthTime: '14:30', place: 'Curitiba, Paraná, Brasil' });

test('o cabeçalho não traz avisos de exemplo', () => {
  assert.doesNotMatch(renderProfileHeader({ profile: profile('seed-sample'), natal: null }).html, /Mapa de exemplo/);
  assert.doesNotMatch(renderProfileHeader({ profile: profile('abc'), natal: null }).html, /Mapa de exemplo/);
});

test('calendário tem um só Tab, no dia escolhido', () => {
  const html = renderCalendarDays(new Date(2026, 9, 19), new Date(2026, 9, 19));
  assert.equal((html.match(/tabindex="0"/g) || []).length, 1);
  assert.equal((html.match(/tabindex="-1"/g) || []).length, 30);
});

test('busca de cidade remove sugestões com o mesmo rótulo', async () => {
  const r = { latitude: -25, longitude: -49, timezone: 'America/Sao_Paulo', name: 'Curitiba', admin1: 'Paraná', country: 'Brasil' };
  const fetch = async () => ({ ok: true, json: async () => ({ results: [r, { ...r, latitude: -24 }, { ...r, name: 'Curitibanos' }] }) });
  const found = await searchPlaces('curitiba', { fetch });
  assert.deepEqual(found.map(p => p.label), ['Curitiba, Paraná, Brasil', 'Curitibanos, Paraná, Brasil']);
});
