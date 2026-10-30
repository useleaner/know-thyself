import EN from './i18n-en.js';

// O português é o texto-fonte e a chave: t('texto') devolve a tradução ou o próprio texto.
// Trocar de idioma recarrega a página, então o idioma é lido uma vez por carga.
export const LANG_KEY = 'know-thyself.lang';
export const LANGS = ['pt-BR', 'en'];

// Fora do navegador (testes em Node) vale o idioma-fonte; no navegador, o salvo ou o do aparelho.
export function detectLang(storage = globalThis.localStorage, navigatorLang = globalThis.document ? globalThis.navigator?.language : undefined) {
  try {
    const saved = storage?.getItem(LANG_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* armazenamento bloqueado: segue o navegador */ }
  return !navigatorLang || /^pt\b/i.test(navigatorLang) ? 'pt-BR' : 'en';
}

export const lang = detectLang();
export const locale = lang === 'en' ? 'en-US' : 'pt-BR';
const dictionary = lang === 'en' ? EN : null;

export function t(text, vars, language = lang) {
  const out = (language === 'en' ? EN[text] : undefined) ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match)) : out;
}

export function setLang(next, storage = globalThis.localStorage) {
  if (!LANGS.includes(next)) throw new Error('Idioma inválido.');
  storage.setItem(LANG_KEY, next);
}

// HTML estático: traduz nós de texto e atributos legíveis pelo conteúdo em português.
const ATTRS = ['aria-label', 'placeholder', 'title', 'alt', 'content'];
export function translateDom(root = document) {
  const html = root.documentElement;
  if (html) html.lang = lang;
  if (dictionary) {
    const walker = root.createTreeWalker(root.body ?? root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const source = node.nodeValue.replace(/\s+/g, ' ').trim();
      if (source && dictionary[source]) node.nodeValue = node.nodeValue.replace(/\S[\s\S]*\S|\S/, dictionary[source]);
    }
    for (const attr of ATTRS) {
      for (const element of root.querySelectorAll(`[${attr}]`)) {
        if (element.tagName === 'META' && element.name !== 'description') continue;
        const source = element.getAttribute(attr).replace(/\s+/g, ' ').trim();
        if (dictionary[source]) element.setAttribute(attr, dictionary[source]);
      }
    }
    root.title = t(root.title);
  }
  html?.classList.remove('i18n-pending');
}

if (typeof document !== 'undefined') translateDom(document);
