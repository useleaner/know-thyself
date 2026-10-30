// Árvore pessoal pelo método Villarrubia/Haut/Millera, *Manual de Kabbalah Práctica — Séfer ha-Neshamah*,
// Parte III (blocos, famílias de números, ocultos e tipos de linha), com dados explícitos e idioma escolhido.
import { personalPaths } from './tree.js';
import { cabalaAlphabetFor, normalizeCabala } from './cabala-input.js';

// Parser/tabelas legados só para fixtures históricas; remover quando as auditorias deixarem de depender deles.
const PT23 = ['ABCDEFGHI', 'JLMNOPQRS', 'TUVXZ'];
const INTL = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ'];
const PARTICLES = new Set(['da', 'das', 'de', 'do', 'dos', 'e', 'y', 'del', 'di', 'van', 'von']);
const SUFFIXES = new Set(['junior', 'jr', 'filho', 'neto', 'sobrinho', 'segundo', 'terceiro']);

const digitSum = n => [...String(n)].reduce((sum, digit) => sum + Number(digit), 0);
const reduce22 = n => { while (n > 22) n = digitSum(n); return n; };
// Um valor válido e as reduções seguintes da mesma família (ex.: 21 → 3; 19 → 10 → 1).
function chain(n) {
  const out = [n];
  while (out.at(-1) >= 10) out.push(digitSum(out.at(-1)));
  return out;
}
const unique = list => [...new Set(list)];
const block = (visible = [], hidden = []) => ({ visible, hidden });
const isEmpty = b => !b.visible.length;

const letters = text => text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z]/g, '');

// Agrupa o nome civil: partículas vão com o sobrenome seguinte, Junior/Filho/Neto com o anterior.
// No Brasil o sobrenome materno vem antes do paterno; o último grupo é o paterno.
// Primeiro grupo = prenome; nomes compostos ("João Pedro") viram prenome + sobrenome materno.
export function splitName(fullName = '') {
  const groups = [];
  let pending = [];
  for (const word of String(fullName).trim().split(/\s+/).filter(Boolean)) {
    const key = letters(word).toLowerCase();
    if (groups.length && SUFFIXES.has(key)) { groups[groups.length - 1] += ` ${word}`; continue; }
    if (groups.length && PARTICLES.has(key)) { pending.push(word); continue; }
    groups.push([...pending, word].join(' '));
    pending = [];
  }
  const [first = '', ...surnames] = groups;
  return { first, paternal: surnames.at(-1) || '', maternal: surnames.slice(0, -1).join(' ') };
}

export function alphabetFor(birthDate) {
  return String(birthDate) < '2009-01-01' ? PT23 : INTL;
}

// Blocos 1–3: soma simples; oculto pela soma com multiplicadores ×1/×10/×100 (seção 6.2.H).
export function nameBlock(text, table, legacyFallback = false) {
  const word = letters(text);
  if (!word) return block();
  // K, W e Y não existem no português de 23 letras; o nome inteiro passa à tabela de 26.
  if (legacyFallback && table === PT23 && /[KWY]/.test(word)) table = INTL;
  let simple = 0, weighted = 0;
  for (const char of word) {
    const row = table.findIndex(line => line.includes(char));
    if (row < 0) throw new Error('Unsupported letter in Cabala alphabet');
    const value = table[row].indexOf(char) + 1;
    simple += value;
    weighted += value * 10 ** row;
  }
  const visible = unique(chain(reduce22(simple)));
  const hidden = reduce22(weighted);
  return block(visible, hidden >= 10 && !visible.includes(hidden) ? [hidden] : []);
}

// Blocos combinados: uma escolha de cada fonte, soma, reduz a ≤22 e segue a família.
// Ocultos só entram depois das combinações visíveis; em A, B e C valem como linhas comuns.
function combine(sources, { hidden = true, hiddenAsVisible = false } = {}) {
  const present = sources.filter(source => !isEmpty(source));
  // O livro não trata bloco ausente (pessoa sem sobrenome materno); ignorado na soma, e sem fonte suficiente o bloco fica vazio.
  if (present.length < 2) return block();
  const sums = pick => present.reduce((acc, source) => acc.flatMap(total => pick(source).map(n => total + n)), [0]);
  const visible = unique(sums(source => source.visible).flatMap(total => chain(reduce22(total))));
  if (!hidden) return block(visible);
  const extra = unique(sums(source => [...source.visible, ...source.hidden]).flatMap(total => chain(reduce22(total)))).filter(n => !visible.includes(n));
  return hiddenAsVisible ? block([...visible, ...extra]) : block(visible, extra);
}

export function computeBlocks({ name, birthDate, cabala }) {
  const [year, month, day] = String(birthDate).split('-').map(Number);
  const explicit = normalizeCabala(cabala, birthDate);
  const table = explicit ? cabalaAlphabetFor(explicit.language, birthDate) : alphabetFor(birthDate);
  // pp. 442–443: preservar a ordem declarada dos sobrenomes nos blocos 2/3.
  const { first, paternal, maternal } = explicit ? {
    first: explicit.firstNames,
    paternal: explicit.order === 'paternal-first' ? explicit.paternalSurname : explicit.maternalSurname,
    maternal: explicit.order === 'paternal-first' ? explicit.maternalSurname : explicit.paternalSurname
  } : splitName(name);
  const b = {};
  b[1] = nameBlock(first, table, !explicit);
  b[2] = nameBlock(paternal, table, !explicit);
  b[3] = nameBlock(maternal, table, !explicit);
  b[4] = block(unique(chain(reduce22(day))));
  b[5] = block(unique(chain(month)));
  b[6] = block(unique(chain(reduce22(digitSum(year)))));
  b[7] = combine([b[1], b[2], b[3]]);
  b[8] = combine([b[4], b[5], b[6]], { hidden: false });
  b[9] = combine([b[7], b[8]]);
  b[10] = combine([b[1], b[2]]);
  b[11] = combine([b[2], b[3]]);
  b[12] = combine([b[4], b[5]], { hidden: false });
  b[13] = combine([b[5], b[6]], { hidden: false });
  b.A = combine([b[10], b[11]], { hiddenAsVisible: true });
  b.B = combine([b[12], b[13]], { hiddenAsVisible: true });
  b.C = combine([b.A, b.B], { hiddenAsVisible: true });
  return b;
}

// Figura 36: tipo de linha conforme o bloco de origem.
const LINE = { 10: ['primary', 'primary-hidden'], 11: ['secondary', 'secondary-hidden'], 12: ['short-crisis'], 13: ['long-crisis'] };

export function computeTree(profile) {
  const date = profile?.birthDate;
  if ((!profile?.name && !profile?.cabala) || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000-')) return null;
  const birth = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== date) return null;
  let b;
  try { b = computeBlocks(profile); } catch { return null; }
  if (!b[1].visible.length) return null;
  const lines = Object.fromEntries(personalPaths.map(path => [path.number, []]));
  for (let k = 1; k <= 13; k++) {
    const [visibleType, hiddenType] = LINE[k] || ['standard', 'hidden'];
    b[k].visible.forEach(n => lines[n].push(visibleType));
    b[k].hidden.forEach(n => lines[n].push(hiddenType));
  }
  // Blocos A, B e C: número novo vira linha de triângulos (karma); número já presente vira cruz (dom).
  const gifts = new Set();
  const occupied = new Set(Object.keys(lines).filter(n => lines[n].length).map(Number));
  for (const k of ['A', 'B', 'C']) {
    for (const n of b[k].visible) occupied.has(n) ? gifts.add(n) : lines[n].push('karma');
  }
  const paths = personalPaths.map(({ samples, gift, ...layout }) => ({ ...layout, gift: gifts.has(layout.number), samples: lines[layout.number].map(type => ({ type })) }));
  return { paths, values: sphereValues(paths) };
}

// Seções 9–10: linhas dos blocos 12 e 13 oscilam num ciclo (curto: dia + mês, em meses; longo: mês + dígitos do ano, em anos).
// Sozinha no caminho, a linha zera na metade e no fim do ciclo (crise); com uma fixa, zera no mínimo (3/4);
// com duas ou mais fixas, passa de 2 no máximo (1/4) e o caminho sobrecarrega (anticrise).
// Duas linhas variáveis no mesmo caminho são tratadas em separado, sem o ciclo combinado das figuras 40–43.
const MONTH_MS = 365.2425 / 12 * 864e5;
export function pathCycles(profile, tree, now = new Date()) {
  const [year, month, day] = String(profile?.birthDate).split('-').map(Number);
  const birth = Date.UTC(year, month - 1, day);
  const elapsed = (now - birth) / MONTH_MS;
  const lengths = { 'short-crisis': day + month, 'long-crisis': (month + digitSum(year)) * 12 };
  const cycles = {};
  for (const path of tree?.paths || []) {
    const fixed = path.samples.filter(({ type }) => !(type in lengths) && type !== 'karma').length;
    for (const { type } of path.samples.filter(({ type }) => type in lengths)) {
      const length = lengths[type];
      const phases = fixed === 0 ? [0.5, 1] : fixed === 1 ? [0.75] : [0.25];
      let next;
      for (let turn = Math.floor(elapsed / length); !next; turn++) {
        next = phases.map(phase => (turn + phase) * length).find(at => at > elapsed);
      }
      (cycles[path.number] ||= []).push({ type, months: length, event: fixed >= 2 ? 'overload' : 'crisis', next: new Date(birth + next * MONTH_MS) });
    }
  }
  return cycles;
}

// Seção 8: linhas que chegam à sefirá (sem as de A, B e C) / caminhos que confluem nela.
export function sphereValues(paths) {
  const values = {};
  for (const path of paths) {
    for (const id of [path.from, path.to]) {
      const value = values[id] ||= { lines: 0, paths: 0 };
      value.paths++;
      value.lines += path.samples.filter(sample => sample.type !== 'karma').length;
    }
  }
  return Object.fromEntries(Object.entries(values).map(([id, value]) => [id, `${value.lines}/${value.paths}`]));
}
