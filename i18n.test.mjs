import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import EN from './i18n-en.js';
import { natalTranslations, translationPairs } from './natal-catalog.js';
import { bodyMeanings, pairedTexts, explicitExamples } from './aspect-context-texts.js';
import { cabalaTranslations } from './cabala-catalog.js';
import { t, detectLang, LANG_KEY } from './i18n.js';

const dir = new URL('./', import.meta.url);
const read = file => readFileSync(new URL(file, dir), 'utf8');
const unescape = text => text.replace(/\\(.)/g, '$1');
const norm = text => text.replace(/\s+/g, ' ').trim();
const LIT = String.raw`'((?:[^'\\\n]|\\.)*)'`;

// Mesmas regras do translateDom: textos e atributos legíveis do HTML; primeiro argumento literal de t() no JS.
function sourceKeys() {
  const keys = new Set([...Object.keys(natalTranslations), ...Object.keys(cabalaTranslations),
    ...translationPairs({ bodyMeanings, pairedTexts, explicitExamples }).map(([source]) => source)]);
  const add = text => { const key = norm(text); if (/[A-Za-zÀ-ú]/.test(key)) keys.add(key); };
  for (const file of readdirSync(dir).filter(name => name.endsWith('.js') && !name.startsWith('i18n') && !name.endsWith('.test.mjs'))) {
    const code = read(file);
    for (const match of code.matchAll(new RegExp(String.raw`\bt\(\s*` + LIT, 'g'))) add(unescape(match[1]));
    for (const match of code.matchAll(new RegExp(String.raw`\bt\([^()\n]*?\?\s*` + LIT + String.raw`\s*:\s*` + LIT, 'g'))) { add(unescape(match[1])); add(unescape(match[2])); }
  }
  for (const file of readdirSync(dir).filter(name => name.endsWith('.html'))) {
    const html = read(file).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, svg => svg.replace(/>[^<]*</g, '><'));
    for (const match of html.matchAll(/>([^<>]+)</g)) add(match[1].replace(/&nbsp;/g, ' ').replace(/&larr;/g, '←').replace(/&amp;/g, '&'));
    for (const match of html.matchAll(/\s(?:aria-label|placeholder|title|alt)="([^"]+)"/g)) add(match[1]);
  }
  return keys;
}

test('todo texto da interface tem tradução e nenhuma tradução sobra', () => {
  const keys = sourceKeys();
  assert.deepEqual([...keys].filter(key => !(key in EN)), [], 'sem tradução');
  assert.deepEqual(Object.keys(EN).filter(key => !keys.has(key)), [], 'tradução sem uso');
});

test('traduções mantêm os mesmos {marcadores} e não ficam vazias', () => {
  const marks = text => (text.match(/\{\w+\}/g) || []).sort().join();
  for (const [key, value] of Object.entries(EN)) {
    assert.ok(value.trim(), key);
    assert.equal(marks(value), marks(key), key);
  }
});

test('t devolve o texto-fonte fora do inglês e substitui marcadores', () => {
  assert.equal(t('Sol'), 'Sol');
  assert.equal(t('Reenviar em {n}s', { n: 9 }), 'Reenviar em 9s');
  assert.equal(t('texto sem tradução'), 'texto sem tradução');
});

test('idioma: salvo vence o aparelho; sem escolha segue o aparelho; inválido é ignorado', () => {
  const storage = value => ({ getItem: key => (key === LANG_KEY ? value : null) });
  assert.equal(detectLang(storage('en'), 'pt-BR'), 'en');
  assert.equal(detectLang(storage(null), 'en-US'), 'en');
  assert.equal(detectLang(storage(null), 'pt-PT'), 'pt-BR');
  assert.equal(detectLang(storage('fr'), 'pt-BR'), 'pt-BR');
  assert.equal(detectLang({ getItem() { throw new Error('blocked'); } }, 'en-GB'), 'en');
});
