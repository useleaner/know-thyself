import test from 'node:test';
import assert from 'node:assert/strict';
import { initPlanetSelector } from './planet-selector.js';
import { planetFacts, planetNotes } from './planet-data.js';

function fixture() {
  let focused;
  class Element {
    constructor(text = '') {
      this.textContent = text;
      this.attributes = new Map();
      this.dataset = {};
      this.listeners = new Map();
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name); }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    focus() { focused = this; }
    set innerHTML(html) {
      this.buttons = [...html.matchAll(/<button ([^>]+)>/g)].map(match => {
        const button = new Element();
        for (const attribute of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) button.setAttribute(attribute[1], attribute[2]);
        button.dataset.planet = button.getAttribute('data-planet');
        return button;
      });
    }
    querySelectorAll() { return this.buttons; }
  }
  const ids = ['planet-selector', 'planet-emblem', 'planet-preview', 'planet-name', 'planet-context', 'planet-note'];
  const nodes = Object.fromEntries(ids.map(id => [id, new Element()]));
  const originals = Array.from({ length: 14 }, (_, index) => `Dado original ${index + 1}`);
  const fields = originals.map(value => new Element(value));
  const originalNote = 'Nota original da Lua, preservada da captura.';
  nodes['planet-note'].textContent = originalNote;
  const root = { querySelector: selector => nodes[selector.slice(1)], querySelectorAll: () => fields };
  const scrolls = [];
  const viewport = { scrollTo: options => scrolls.push(options) };
  initPlanetSelector({ root, viewport });
  return {
    nodes, originals, originalNote, fields, scrolls,
    get buttons() { return nodes['planet-selector'].buttons; },
    get focused() { return focused; },
    click(index) { this.buttons[index].listeners.get('click')(); },
    key(key) {
      const event = { key, prevented: false, preventDefault() { this.prevented = true; } };
      nodes['planet-selector'].listeners.get('keydown')(event);
      return event;
    }
  };
}

test('seven selections update the custom asset and show each transcribed sheet', () => {
  const f = fixture();
  const ids = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const names = ['Sol', 'Lua', 'Mercúrio', 'Vênus', 'Marte', 'Júpiter', 'Saturno'];
  assert.equal(f.nodes['planet-name'].textContent, 'Sol');
  assert.deepEqual(f.fields.map(field => field.textContent), planetFacts.sun);
  assert.equal(f.buttons[0].getAttribute('aria-pressed'), 'true');
  assert.equal(f.scrolls.length, 0, 'initialization preserves the current scroll');
  ids.forEach((id, index) => {
    f.click(index);
    assert.equal(f.buttons[index].getAttribute('aria-label'), names[index]);
    assert.equal(f.buttons[index].getAttribute('title'), names[index]);
    assert.equal(f.nodes['planet-name'].textContent, names[index]);
    assert.equal(f.nodes['planet-emblem'].src, `assets/planets/${id}.svg`);
    assert.equal(f.nodes['planet-preview'].src, `assets/planets/${id}.svg`);
    assert.deepEqual(f.buttons.map(button => button.getAttribute('aria-pressed')), ids.map((_, buttonIndex) => String(buttonIndex === index)));
    if (id !== 'moon') {
      assert.deepEqual(f.fields.map(field => field.textContent), planetFacts[id]);
      assert.equal(f.nodes['planet-note'].textContent, planetNotes[id]);
    }
  });
  assert.equal(f.scrolls.length, 7);
  assert.deepEqual(f.scrolls.at(-1), { top: 0, behavior: 'instant' });
});

test('every planet has a distinct descriptive note', () => {
  assert.deepEqual(Object.keys(planetNotes).sort(), ['moon', ...Object.keys(planetFacts)].sort());
  assert.equal(new Set(Object.values(planetNotes)).size, 7);
  Object.values(planetNotes).forEach(note => assert.ok(note.length > 150));
});

test('every non-moon planet has exactly fourteen non-empty fields', () => {
  assert.deepEqual(Object.keys(planetFacts), ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']);
  Object.values(planetFacts).forEach(values => {
    assert.equal(values.length, 14);
    assert.ok(values.every(value => value.trim() && value !== '—'));
  });
});

test('returning to Moon restores all fourteen captured texts and its original note', () => {
  const f = fixture();
  f.click(5);
  f.click(1);
  assert.deepEqual(f.fields.map(field => field.textContent), f.originals);
  assert.equal(f.nodes['planet-note'].textContent, planetNotes.moon);
});

test('vertical keys, Home and End select with one roving tab stop and focus', () => {
  const f = fixture();
  for (const [key, index] of [['ArrowUp', 6], ['ArrowUp', 5], ['Home', 0], ['End', 6], ['ArrowDown', 0], ['ArrowDown', 1]]) {
    assert.equal(f.key(key).prevented, true);
    assert.equal(f.focused, f.buttons[index]);
    assert.deepEqual(f.buttons.map(button => button.tabIndex), f.buttons.map((_, buttonIndex) => buttonIndex === index ? 0 : -1));
    assert.equal(f.buttons[index].getAttribute('aria-pressed'), 'true');
  }
  assert.equal(f.key('ArrowRight').prevented, false);
  assert.equal(f.nodes['planet-name'].textContent, 'Lua');
});
