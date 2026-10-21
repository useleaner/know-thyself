import { readFile, writeFile } from 'node:fs/promises';
import { renderTree } from './tree.js';
import { paths } from './study-data.js';

// A prévia precisa renderizar mesmo se o módulo interativo ainda não carregou.
for (const mode of ['base', 'personal']) {
  let svg = renderTree(mode, paths);
  let imageIndex = 0;
  for (const image of [...svg.matchAll(/<image\b([^>]+)\/>/g)]) {
    const attributes = Object.fromEntries([...image[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
    let source = await readFile(new URL(attributes.href, import.meta.url), 'utf8');
    const prefix = `asset-${imageIndex++}-`;
    source = source.replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`)
      .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`);
    source = source.replace(/<svg\b[^>]*>/, opening => opening.replace(/\s(?:x|y|width|height)="[^"]*"/g, '')
      .replace('<svg ', `<svg x="${attributes.x}" y="${attributes.y}" width="${attributes.width}" height="${attributes.height}" `));
    svg = svg.replace(image[0], source);
  }
  svg = svg.replace(/\s(?:role|tabindex|aria-label|aria-labelledby|data-sphere|data-path)="[^"]*"/g, '');
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length || /<image\b/.test(svg)) throw new Error(`Prévia ${mode}: recursos ou IDs inválidos.`);
  await writeFile(new URL(`assets/tree-preview-${mode}.svg`, import.meta.url), svg);
}
console.log('Duas prévias SVG independentes, sem imagens externas, IDs duplicados ou controles.');
