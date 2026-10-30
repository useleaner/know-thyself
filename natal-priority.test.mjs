import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, BODY_NAMES, SIGN_NAMES } from './map-data.js';
import { DEFAULT_ORBS } from './astro-engine.js';
import { natalReadingPriority, natalSynthesis, natalSignReading, natalHouseReading } from './natal-readings.js';

function stateOf() {
  return { status: 'ok', mode: { id: 'natal' }, profile: { name: 'Prioridade sintética', birthTime: '12:00', timeUnknown: false },
    natal: { asc: 0, mc: 90, bodies: PLANETS.map((id, index) => ({ id, longitude: 16 + index * 30, sign: index, house: index + 1 })) },
    aspects: [], orbs: { ...DEFAULT_ORBS }, balance: { wheels: [
      { key: 'element', total: 10, categories: ['fogo', 'terra', 'ar', 'agua'].map((key, i) => ({ key, name: key, count: [3, 3, 2, 2][i] })) },
      { key: 'quality', total: 10, categories: ['cardinal', 'fixa', 'mutavel'].map((key, i) => ({ key, name: key, count: [4, 3, 3][i] })) }
    ] } };
}
function move(state, id, longitude) {
  Object.assign(state.natal.bodies.find(body => body.id === id), { longitude, sign: Math.floor(longitude / 30) });
}
const item = (state, id) => natalReadingPriority(state).find(entry => entry.body.id === id);
const aspect = (from, to, kind, orb) => ({ id: `${from}~${kind}~${to}`, from, to, kind, orb });

// Distância circular, sem degrau na cúspide ou preferência pelo lado do horizonte.
test('aproximar um planeta de qualquer ângulo aumenta continuamente sua angularidade', () => {
  const state = stateOf();
  const values = [20, 15, 14, 7, 1, 0].map(distance => { move(state, 'neptune', distance); return item(state, 'neptune').angular; });
  assert.equal(values[0], 0); assert.equal(values[1], 0); assert.equal(values.at(-1), 1);
  for (let i = 2; i < values.length; i++) assert.ok(values[i] > values[i - 1]);
  for (const angle of [0, 90, 180, 270]) {
    move(state, 'neptune', (angle + 359) % 360); const before = item(state, 'neptune').angular;
    move(state, 'neptune', (angle + 1) % 360); assert.equal(item(state, 'neptune').angular, before);
  }
  state.natal.asc = 359;
  move(state, 'neptune', 0); const acrossZero = item(state, 'neptune').angular;
  move(state, 'neptune', 358); assert.equal(item(state, 'neptune').angular, acrossZero);
});

test('líder angular sem aspectos abre a síntese com os textos factuais de seu signo e casa', () => {
  const state = stateOf(); move(state, 'neptune', 0);
  const winner = natalReadingPriority(state)[0]; assert.equal(winner.body.id, 'neptune');
  const first = natalSynthesis(state)[0];
  assert.equal(first.key, 'priority-neptune');
  assert.equal(first.title, `${BODY_NAMES.neptune} em ${SIGN_NAMES[winner.body.sign]}, Casa ${winner.body.house}`);
  assert.deepEqual(first.paragraphs, [natalSignReading('neptune', winner.body.sign), natalHouseReading('neptune', winner.body.house)]);
  assert.ok(natalSynthesis(state).some(section => section.key === 'luminaries'));
  // Muitas conexões não invertem a ordem lexicográfica da angularidade.
  state.aspects = PLANETS.filter(id => !['sun', 'neptune'].includes(id)).map(id => aspect('sun', id, 'square', 0));
  assert.equal(natalReadingPriority(state)[0].body.id, 'neptune');
});

test('atividade respeita orbes configurados, inclusive limite zero e aspectos no limite', () => {
  const state = stateOf(); state.aspects = [aspect('sun', 'moon', 'square', 3)];
  state.orbs.square = 6; assert.equal(item(state, 'sun').activity, .5);
  state.orbs.square = 12; assert.equal(item(state, 'sun').activity, .75);
  state.orbs.square = 3; assert.equal(item(state, 'sun').activity, 0);
  state.orbs.square = 0; assert.equal(item(state, 'sun').activity, 0);
  state.aspects[0].orb = 0; assert.equal(item(state, 'sun').activity, 1);
  for (const invalid of [NaN, Infinity, -1]) { state.aspects[0].orb = invalid; assert.equal(item(state, 'sun').activity, 0); }
  state.aspects[0].orb = 0;
  for (const invalid of [NaN, Infinity, -1]) { state.orbs.square = invalid; assert.equal(item(state, 'sun').activity, 0); }
});

test('um parceiro contribui uma vez pelo maior aspecto e não penaliza quadratura ou oposição', () => {
  const state = stateOf(); state.orbs = { square: 6, trine: 6, opposition: 6 };
  state.aspects = [aspect('sun', 'moon', 'square', 2)]; const baseline = item(state, 'sun').activity;
  state.aspects.push(aspect('moon', 'sun', 'square', 2), aspect('sun', 'moon', 'trine', 4));
  assert.equal(item(state, 'sun').activity, baseline); assert.equal(item(state, 'moon').activity, baseline);
  state.aspects.push(aspect('moon', 'sun', 'opposition', 1)); assert.equal(item(state, 'sun').activity, 1 - 1 / 6);
  for (const kind of ['square', 'trine', 'opposition']) {
    state.aspects = [aspect('sun', 'moon', kind, 1)]; assert.equal(item(state, 'sun').activity, 1 - 1 / 6);
  }
});

test('reordenar aspectos não muda atividade, inclusive com contribuições fracionárias', () => {
  const state = stateOf(); state.orbs.square = 6;
  state.aspects = PLANETS.slice(1).map((id, i) => aspect('sun', id, 'square', i * .37));
  const before = natalReadingPriority(state).map(({ body, ...scores }) => ({ id: body.id, ...scores }));
  state.aspects.reverse();
  assert.deepEqual(natalReadingPriority(state).map(({ body, ...scores }) => ({ id: body.id, ...scores })), before);
});

test('regências de ASC e MC apenas desempataram angularidade e atividade iguais', () => {
  const state = stateOf(); state.natal.bodies.forEach(body => move(state, body.id, 45));
  assert.equal(item(state, 'mars').ruler, 1); assert.equal(item(state, 'moon').ruler, 1);
  assert.equal(item(state, 'sun').ruler, 0);
  assert.deepEqual(natalReadingPriority(state).slice(0, 2).map(entry => entry.body.id), ['moon', 'mars']);
  move(state, 'sun', 0); assert.equal(natalReadingPriority(state)[0].body.id, 'sun');
});

test('empates reais mantêm ambos líderes e empate geral conserva abertura anterior', () => {
  const state = stateOf(); move(state, 'neptune', 0); move(state, 'uranus', 0);
  assert.deepEqual(natalSynthesis(state).slice(0, 2).map(section => section.key), ['priority-uranus', 'priority-neptune']);
  state.natal.bodies = state.natal.bodies.filter(body => ['sun', 'moon'].includes(body.id));
  state.natal.asc = 0; state.natal.mc = 30;
  for (const body of state.natal.bodies) move(state, body.id, 75);
  assert.deepEqual(natalReadingPriority(state).map(entry => entry.body.id), ['sun', 'moon']);
  assert.equal(natalSynthesis(state)[0].key, 'luminaries');
  state.natal.bodies.reverse(); assert.deepEqual(natalReadingPriority(state).map(entry => entry.body.id), ['moon', 'sun']);
});

test('prioridade de ponte deixa de preferir Sol ou Lua sobre outro planeta mais angular', () => {
  const state = stateOf(); move(state, 'neptune', 0);
  state.aspects = [aspect('sun', 'moon', 'square', 1), aspect('sun', 'mercury', 'trine', 1),
    aspect('neptune', 'mars', 'square', 1), aspect('neptune', 'jupiter', 'trine', 1)];
  const section = natalSynthesis(state).find(section => section.key === 'connections');
  assert.ok(section.title.includes(BODY_NAMES.neptune));
  assert.deepEqual(new Set(section.aspectIds), new Set(state.aspects.slice(2).map(link => link.id)));
});

test('faltas, dados não finitos e outros modos não inventam prioridade', () => {
  assert.deepEqual(natalReadingPriority(), []);
  for (const mutate of [state => state.status = 'empty', state => state.mode.id = 'transits', state => state.profile.timeUnknown = true,
    state => state.profile.birthTime = '', state => state.profile.birthTime = '25:00', state => state.natal.asc = NaN,
    state => state.natal.mc = 360, state => delete state.natal]) {
    const state = stateOf(); mutate(state); assert.deepEqual(natalReadingPriority(state), []);
  }
  const state = stateOf(); state.natal.bodies.find(body => body.id === 'sun').longitude = Infinity;
  state.aspects = [null, aspect('sun', 'moon', 'square', 0)];
  assert.equal(item(state, 'sun'), undefined); assert.equal(item(state, 'moon').activity, 0);
  state.aspects = undefined; assert.ok(natalReadingPriority(state).every(entry => entry.activity === 0));
});

test('pontos, asteroides e cópias do mesmo planeta não entram na prioridade', () => {
  const state = stateOf();
  state.natal.bodies.push({ id: 'chiron', longitude: 0, sign: 0, house: 1 }, { id: 'node', longitude: 0, sign: 0, house: 1 }, { ...state.natal.bodies[0] });
  state.aspects = [aspect('chiron', 'sun', 'square', 0), aspect('node', 'sun', 'square', 0)];
  assert.equal(natalReadingPriority(state).length, 10); assert.equal(item(state, 'sun').activity, 0);
});

test('prioridade e síntese não alteram estado, corpos, aspectos ou orbes de entrada', () => {
  const state = stateOf(); move(state, 'neptune', 0); state.aspects = [aspect('sun', 'moon', 'square', 1)];
  const frozen = value => { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; };
  const before = JSON.stringify(state); frozen(state);
  assert.equal(natalReadingPriority(state)[0].body.id, 'neptune');
  assert.equal(natalSynthesis(state)[0].key, 'priority-neptune'); assert.equal(JSON.stringify(state), before);
});
