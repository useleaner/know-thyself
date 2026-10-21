import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMapState, SIGN_NAMES, formatDegree } from './map-data.js';
import { renderPanelBody, renderWheel, renderProfileHeader, calendarDays, renderCalendarDays, renderBalanceReading, shareText, escapeHTML } from './map-readings.js';
import { natalSynthesis } from './natal-readings.js';
import { natalBalanceTexts, natalBalanceEvenTexts } from './natal-catalog.js';
import { balance as externalBalanceTexts } from './interpretations.js';

const profile = { name: 'Perfil sintético A', birthDate: '1991-06-17', birthTime: '04:23', timeUnknown: false, place: 'Local sintético A', lat: -22.9, lon: -43.2, timezone: 'America/Sao_Paulo' };
const day = new Date('2026-10-18T20:19:00Z');

test('empty wheels retain their rings and title without invented counts or a reading action', () => {
  const html = renderWheel({ key: 'element', title: 'Elemento', total: 0, categories: [] });
  assert.match(html, /Elemento: ainda não calculado/);
  assert.match(html, /class="wheel-rim"/);
  assert.match(html, /<h3>Elemento<\/h3>/);
  assert.doesNotMatch(html, /<button|data-count=|NaN|undefined/);
});

test('panel body: transit modes show the day aspect, contextual balance texts and day positions with R', () => {
  const state = buildMapState({ profile, mode: 'transits', date: day });
  const html = renderPanelBody(state);
  assert.match(html, /Aspecto do dia/);
  assert.match(html, /Orbe: \d+,\d\d° (aproximando|afastando)/);
  assert.match(html, /Neste trânsito/);
  assert.match(html, /Elementos, qualidades e dualidades/);
  assert.ok(state.balance.notes.length > 0);
  for (const note of state.balance.notes) assert.ok(html.includes(escapeHTML(externalBalanceTexts[note.key][note.kind])));
  assert.match(html, /Posição dos planetas em trânsito · 18 de outubro de 2026/);
  assert.equal((html.match(/<li>/g) || []).length, 13, 'ten planets plus node, Lilith and Chiron (default points)');
  assert.match(html, /Libra, 25°\d\d′/, 'calculated Sun on the selected day');
  assert.match(html, /Escorpião, 3°\d\d′ <abbr title="Retrógrado">R<\/abbr>/, 'calculated retrograde Venus on the selected day');
  assert.doesNotMatch(html, /Seu mapa em conjunto/);
  assert.doesNotMatch(html, /Quíron não é calculado|rascunho/);
  assert.doesNotMatch(html, /ilustrativ|sem cálculo|Premium/);
});

test('panel body: natal positions and synthesis use calculated facts; synastry still warns about a missing partner', () => {
  const state = buildMapState({ profile, mode: 'natal', date: day });
  const html = renderPanelBody(state);
  assert.doesNotMatch(html, /Aspecto do dia/);
  assert.match(html, /Posição dos planetas no mapa natal/);
  for (const body of state.natal.bodies) assert.ok(html.includes(`${SIGN_NAMES[body.sign]}, ${formatDegree(body)}`));
  assert.match(html, /Seu mapa em conjunto/);
  const synthesis = natalSynthesis(state);
  assert.ok(synthesis.length >= 3);
  for (const section of synthesis) {
    const paragraphs = section.paragraphs || [section.text];
    assert.equal(paragraphs.join(' '), section.text);
    assert.ok(html.includes(`<div class="natal-synthesis-group"><h4>${escapeHTML(section.title)}</h4>${paragraphs.map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join('')}</div>`));
    for (const id of section.bodies || []) assert.ok(state.natal.bodies.some(body => body.id === id));
    for (const id of section.aspectIds || []) assert.ok(state.aspects.some(aspect => aspect.id === id));
  }
  const alone = renderPanelBody(buildMapState({ profile, mode: 'synastry', date: day }));
  assert.match(alone, /class="panel-notice">Escolha a pessoa para comparar no perfil do topo\.<\/p>/);
});

test('wheels: segment lengths follow counts, accessible labels name every category and natal texts match the distribution', () => {
  const state = buildMapState({ profile, mode: 'natal', date: day });
  const quality = renderWheel(state.balance.wheels[1]);
  assert.match(quality, /aria-label="Qualidade: Cardinal 5, Fixa 6, Mutável 4"/);
  assert.match(quality, /data-category="fixed" data-count="6" cx="60" cy="60" r="46" pathLength="15" stroke="url\(#balance-fixed\)" stroke-dasharray="6 9" stroke-dashoffset="-5"/);
  assert.match(quality, /data-balance="quality"/);
  const reading = renderBalanceReading(state, 'quality');
  assert.match(reading, /<span>Fixa<\/span><b>6<\/b>/);
  assert.ok(reading.includes(escapeHTML(natalBalanceEvenTexts.quality[0])));
  assert.ok(renderBalanceReading(state, 'element').includes(escapeHTML(natalBalanceTexts.terra.excess[0])));
  assert.doesNotMatch(reading, /Quíron não é calculado/);
  const empty = renderWheel({ key: 'duality', title: 'Dualidade', total: 2, categories: [{ key: 'feminina', name: 'Feminina', count: 0 }, { key: 'masculina', name: 'Masculina', count: 2 }] });
  assert.equal((empty.match(/data-category=/g) || []).length, 1, 'zero counts draw no segment');
});

test('natal balance readings remain authored after profile or house changes', () => {
  for (const current of [profile,
    { ...profile, birthDate: '1991-06-18' },
    { ...profile, birthTime: '04:24' },
    { ...profile, lat: -23 },
    { ...profile, lon: -44 },
    { ...profile, timezone: 'America/Manaus' }
  ]) for (const houseSystem of ['placidus', 'equal']) {
    const state = buildMapState({ profile: current, mode: 'natal', houseSystem, date: day });
    const html = renderPanelBody(state);
    for (const note of state.balance.notes) assert.ok(html.includes(`<p>${escapeHTML(natalBalanceTexts[note.key][note.kind][0])}</p>`));
    for (const wheel of state.balance.wheels) {
      const reading = renderBalanceReading(state, wheel.key);
      const notes = state.balance.notes.filter(note => wheel.categories.some(category => category.key === note.key));
      if (notes.length) for (const note of notes) assert.ok(reading.includes(escapeHTML(natalBalanceTexts[note.key][note.kind][0])));
      else assert.ok(reading.includes(escapeHTML(natalBalanceEvenTexts[wheel.key][0])));
    }
  }
});

test('profile header and share text escape user data and use calculated Sun and Ascendant', () => {
  const state = buildMapState({ profile: { ...profile, name: '<img src=x onerror=alert(1)>' }, mode: 'natal', date: day });
  const header = renderProfileHeader(state);
  assert.doesNotMatch(header.html, /<img/);
  assert.match(header.html, /&lt;img/);
  const sun = state.natal.bodies.find(body => body.id === 'sun');
  assert.ok(header.label.includes(`Sol em ${SIGN_NAMES[sun.sign]} e ascendente em ${SIGN_NAMES[Math.floor(state.natal.asc / 30)]}`));
  assert.match(header.html, /17 junho 1991 · 04:23/);
  assert.equal(escapeHTML(`"'&`), '&quot;&#39;&amp;');
  const transits = buildMapState({ profile, mode: 'transits', date: day });
  const text = shareText(transits);
  assert.match(text, /^Mapa Astral com Trânsitos — Perfil sintético A\n18 de outubro de 2026\nAspecto do dia: .+ \(orbe .+\)\n/);
  assert.ok(text.endsWith(transits.balance.predominance));
});

test('calendar strip centers the chosen day and marks today', () => {
  const selected = new Date(2026, 9, 18, 17, 19);
  const days = calendarDays(selected, new Date(2026, 9, 20));
  assert.equal(days.length, 31);
  assert.equal(days[15].iso, '2026-10-18');
  assert.equal(days[15].selected, true);
  assert.equal(days.filter(item => item.today).map(item => item.iso)[0], '2026-10-20');
  assert.equal(days[0].iso, '2026-10-03');
  const html = renderCalendarDays(selected, new Date(2026, 9, 18));
  assert.match(html, /data-day="2026-10-18" aria-label="Dom, 18 de outubro de 2026, hoje" tabindex="0" aria-current="date" data-today="true"/);
  assert.match(html, /calendar-today[^>]*>Hoje/);
});

test('barra do perfil não carrega a engrenagem: Ajustes é um botão à parte', () => {
  const empty = renderProfileHeader({ profile: null });
  assert.doesNotMatch(empty.html, /profile-settings|<svg/);
  assert.match(empty.html, /Cadastre uma pessoa/);
});

test('anel de elementos: cada arco centrado perto da sua ponta do pentagrama', async () => {
  const { pentagramRotation } = await import('./map-readings.js');
  const cats = [['agua', 2], ['fogo', 5], ['terra', 1], ['ar', 6]].map(([key, count]) => ({ key, count }));
  const total = 14, rot = pentagramRotation(cats, total), target = { agua: 72, fogo: 144, terra: 216, ar: 288 };
  let offset = 0;
  for (const c of cats) {
    const middle = ((offset + c.count / 2) / total * 360 + rot + 360) % 360;
    const error = Math.abs(((middle - target[c.key]) % 360 + 540) % 360 - 180);
    assert.ok(error < 60, `${c.key} ${middle} vs ${target[c.key]}`);
    offset += c.count;
  }
  const even = [['agua', 1], ['fogo', 1], ['terra', 1], ['ar', 1]].map(([key, count]) => ({ key, count }));
  assert.ok(Math.abs(pentagramRotation(even, 4)) < 1e-9); // erros +27/+9/-9/-27 se anulam
});
