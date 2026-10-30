import { t } from './i18n.js';
import { cabalaPersonalPathTexts } from './cabala-path-texts.js';
import { cabalaLearningTexts } from './cabala-learning-texts.js';
import { spheres } from './tree.js';
const words = cabalaLearningTexts.labels;
const sphere = id => spheres.find(item => item.id === id);

export function pathReadingTypes(path) {
  const types = [...new Set(path.samples.map(sample => sample.type))];
  if (!path.samples.length) types.push('empty');
  if (path.gift) types.push('gift');
  if (path.samples.length >= 3) types.push('blocked');
  return types.filter(type => type in cabalaLearningTexts.types);
}

export function personalPathReading(path) {
  const from = sphere(path.from), to = sphere(path.to);
  if (!from || !to || !Number.isInteger(path.number) || path.number < 1 || path.number > 22) return null;
  const vars = { from: from.name, to: to.name, fromMeaning: from.subtitle, toMeaning: to.subtitle };
  const lines = path.samples.length;
  const karma = path.samples.filter(sample => sample.type === 'karma').length;
  const counted = lines - karma;
  return { text: t(words.path[0], vars), relationshipText: t(cabalaPersonalPathTexts[path.number][0]), types: pathReadingTypes(path), lines, counted, karma,
    countText: [counted ? t(words.pathCount[0], { ...vars, counted }) : '', karma ? t(words.pathKarma[0], { karma }) : ''].filter(Boolean).join(' '),
    question: t(words.pathQuestion[0], vars),
    conditions: pathReadingTypes(path).map(type => ({ type, text: t(cabalaLearningTexts.types[type][0]) })) };
}

// Relaciona somente caminhos da árvore fornecida; valor igual de esfera não seleciona perfil de referência.
export function sphereConnections(id, tree) {
  return (tree?.paths || []).filter(path => path.from === id || path.to === id).map(path => ({
    number: path.number, other: path.from === id ? path.to : path.from, ...personalPathReading(path)
  }));
}
