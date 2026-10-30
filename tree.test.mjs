import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderTree, spheres, personalPaths, beadStyles } from './tree.js';
import { paths } from './study-data.js';
import { computeTree } from './cabala-engine.js';

test('marcadores das duas árvores têm tamanho intermediário igual e preservam dom e alvo de toque', () => {
  const tree = computeTree({ name: 'Teste Marcadores Sintético', birthDate: '1991-06-17' });
  const personal = renderTree('personal', paths, tree);
  for (const svg of [renderTree('base', paths), personal]) {
    const markers = [...svg.matchAll(/<g class="path-marker">(.*?)<\/g>/gs)].map(match => match[1]);
    assert.equal(markers.length, 22);
    for (const marker of markers) {
      assert.match(marker, /class="path-marker-hit" d="M[-\d.]+ [-\d.]+h\.01"[^>]*stroke-width="44" stroke-linecap="round" vector-effect="non-scaling-stroke" pointer-events="stroke"/);
      assert.match(marker, /class="path-focus"[^>]*r="22.5"/);
      assert.match(marker, /<image[^>]*width="41.2" height="41.2"/);
    }
    assert.equal((svg.match(/class="sphere-asset"[^>]*width="108" height="108"/g) || []).length, 10);
  }
  assert.equal((personal.match(/class="path-number"[^>]*font-size="19"/g) || []).length, 22);
  assert.equal((personal.match(/assets\/path-marker-gift.svg/g) || []).length, tree.paths.filter(path => path.gift).length);
});

test('new filaments preserve every path, sample and interactive target', () => {
  for (const [mode, connections] of [['base', paths], ['personal', personalPaths]]) {
    const svg = renderTree(mode, paths);
    assert.equal((svg.match(/class="sphere-node"/g) || []).length, spheres.length);
    assert.equal((svg.match(/class="path-hit"/g) || []).length, connections.length);
    assert.equal((svg.match(/class="path-color"/g) || []).length,
      mode === 'base' ? connections.length : connections.reduce((sum, path) => sum + path.samples.length, 0));
    for (const path of svg.matchAll(/class="path-hit" d="([^"]+)"/g)) {
      assert.match(path[1], /^M[-\d.]+ [-\d.]+L[-\d.]+ [-\d.]+$/);
    }
    assert.doesNotMatch(svg, /NaN|Infinity|r="65"/);
  }
});

test('background worlds retain the three correspondence anchors outside the interactive tree', async () => {
  const circles = await readFile(new URL('./assets/world-orbits.svg', import.meta.url), 'utf8');
  for (const y of [310, 540, 770]) assert.ok(circles.includes(`href="#orbital-rim" x="300" y="${y}"`));
  assert.match(circles, /<circle r="230"/);
  assert.match(circles, /<circle r="221"/);
  assert.equal((circles.match(/<use /g) || []).length, 3);
  assert.doesNotMatch(circles, /<radialGradient|<linearGradient|<filter|<text[ >]/);
  assert.doesNotMatch(renderTree(), /world-orbits|world-circles/);
  const html = await readFile(new URL('./universo.html', import.meta.url), 'utf8');
  assert.match(html, /class="tree-worlds"[^]*?<\/div>\s*<div id="tree-mount">/);
});

test('caminhos de luz: fileiras a partir da borda, primeira linha no lado positivo e contas por tipo', () => {
  const svg = renderTree('personal');
  const path1 = svg.match(/data-path="1".*?<path class="path-hit"/s)[0];
  // Guia central, depois Missão secundária (lado positivo) e Padrão.
  assert.match(path1, /<path d="M261.9 101.9L138.1 173.1" fill="none" stroke="#fff" stroke-opacity=".14"/);
  assert.match(path1, /d="M265.1 107.6L141.4 178.7"[^>]*stroke="#dcfff0"[^>]*stroke-dasharray="0 11"/);
  assert.match(path1, /d="M258.6 96.3L134.9 167.4"[^>]*stroke="#fffaf0"[^>]*stroke-dasharray="0 14"/);
  assert.equal(beadStyles['short-crisis'].gap, 26);
  assert.ok(beadStyles.hidden.dim && !beadStyles.hidden.halo);
  // Sem filtro de blur: some em linhas retas e pesa no iPhone.
  assert.doesNotMatch(svg, /filter=|feGaussianBlur/);
  // Caminho sem linhas mostra só o fio-guia.
  assert.match(svg.match(/data-path="7".*?<path class="path-hit"/s)[0], /stroke-opacity=".18"/);
});


test('marcadores ficam sobre o próprio caminho e afastados das outras linhas e esferas', () => {
  const byId = Object.fromEntries(spheres.map(sphere => [sphere.id, sphere]));
  const distanceToSegment = (point, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
  };
  for (const path of personalPaths) {
    assert.ok(distanceToSegment(path, byId[path.from], byId[path.to]) < 2, `caminho ${path.number} fora da linha`);
    for (const sphere of spheres) {
      assert.ok(Math.hypot(path.x - sphere.x, path.y - sphere.y) >= 78, `caminho ${path.number} encosta em ${sphere.id}`);
    }
    for (const other of personalPaths.filter(other => other !== path)) {
      assert.ok(distanceToSegment(path, byId[other.from], byId[other.to]) > 30, `caminho ${path.number} encobre ${other.number}`);
    }
  }
  const tree = computeTree({ name: 'Teste Layout Sintético', birthDate: '1991-06-17' });
  const base = renderTree('base', paths), personal = renderTree('personal', paths, tree);
  for (const { x, y } of personalPaths) {
    const hit = `class="path-marker-hit" d="M${x} ${y}h.01"`;
    assert.ok(base.includes(hit));
    assert.ok(personal.includes(hit));
  }
});
