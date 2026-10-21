import { t } from './i18n.js';
import { cabalaPersonalPathTexts, cabalaLineTexts } from './cabala-path-texts.js';

export function pathReadingTypes(path) {
  const types = [...new Set(path.samples.map(sample => sample.type))];
  if (!path.samples.length) types.push('empty');
  if (path.gift) types.push('gift');
  if (path.samples.length >= 3) types.push('blocked');
  return types.filter(type => type in cabalaLineTexts);
}

export function personalPathReading(path) {
  const text = cabalaPersonalPathTexts[path.number];
  if (!text) return null;
  return { text: t(text[0]), types: pathReadingTypes(path), lines: path.samples.length,
    conditions: pathReadingTypes(path).map(type => ({ type, text: t(cabalaLineTexts[type][0]) })) };
}

// Relaciona somente caminhos da árvore fornecida; valor igual de esfera não seleciona perfil de referência.
export function sphereConnections(id, tree) {
  return (tree?.paths || []).filter(path => path.from === id || path.to === id).map(path => ({
    number: path.number, other: path.from === id ? path.to : path.from, ...personalPathReading(path)
  }));
}
