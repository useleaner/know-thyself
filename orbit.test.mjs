import test from 'node:test';
import assert from 'node:assert/strict';
import { initOrbit, wrap, horizontalIntent, gestureStep, orbitPose } from './orbit.js';

function fixture() {
  const frames = new Map();
  let nextFrame = 0;
  class Element {
    constructor(parent = null, dataset = {}) {
      this.parent = parent;
      this.dataset = dataset;
      this.style = {};
      this.attributes = new Map();
      this.listeners = new Map();
      this.captures = new Set();
      this.scrollTop = 0;
      this.inert = false;
    }
    addEventListener(type, listener, options) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push({ listener, capture: options === true || Boolean(options?.capture) });
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name); }
    getBoundingClientRect() { return { width: this.width || 390 }; }
    focus() { document.activeElement = this; }
    contains(element) {
      for (let node = element; node; node = node.parent) if (node === this) return true;
      return false;
    }
    closest() {
      for (let node = this; node; node = node.parent) if (node.dataset.orbitGesture === 'local') return node;
      return null;
    }
    hasPointerCapture(id) { return this.captures.has(id); }
    setPointerCapture(id) { this.captures.add(id); }
    releasePointerCapture(id) {
      this.captures.delete(id);
      emit(this, 'lostpointercapture', { pointerId: id });
    }
  }
  const document = new Element();
  const scene = new Element(document);
  const status = new Element(document);
  const names = ['map', 'kaballah', 'correspondences'];
  const areas = Object.fromEntries(names.map(name => [name, new Element(scene, { area: name })]));
  const viewports = Object.fromEntries(names.map(name => [name, new Element(areas[name])]));
  const controls = Object.fromEntries(names.map(name => [name, new Element(document, { go: name })]));
  names.forEach(name => { areas[name].querySelector = () => viewports[name]; });
  scene.querySelector = selector => areas[names.find(name => selector.includes(`"${name}"`))];
  document.querySelectorAll = () => Object.values(controls);
  document.querySelector = () => status;
  document.activeElement = document;
  const reducedMotion = new Element();
  reducedMotion.matches = false;
  let resize;
  Object.assign(globalThis, {
    document,
    window: new Element(),
    matchMedia: () => reducedMotion,
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class {
      constructor(callback) { resize = callback; }
      observe() {}
    }
  });
  function emit(target, type, values = {}) {
    const event = {
      type, target, button: 0, pointerId: 1, isPrimary: true, clientX: 0, clientY: 0,
      deltaX: 0, deltaY: 0, deltaMode: 0, cancelable: true, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
      ...values
    };
    const path = [];
    for (let node = target; node; node = node.parent) path.push(node);
    for (const capture of [true, false]) {
      for (const node of capture ? [...path].reverse() : path) {
        for (const entry of node.listeners.get(type) || []) {
          if (event.stopped) return event;
          if (entry.capture === capture) entry.listener(event);
        }
      }
    }
    return event;
  }
  const changes = [];
  const api = initOrbit({ scene, onChange: (name, viewport) => changes.push({ name, viewport }) });
  return {
    api, scene, status, areas, viewports, controls, reducedMotion, changes, emit, document,
    local: new Element(viewports.map, { orbitGesture: 'local' }),
    step(milliseconds) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach(callback => callback(performance.now() + milliseconds));
    },
    flush() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach(callback => callback(performance.now() + 850));
      assert.equal(frames.size, 0, 'snap finishes within 800 ms');
    },
    resize(width) { scene.width = width; resize(); },
    get pendingFrames() { return frames.size; }
  };
}

test('circular geometry wraps continuously and faces the active area forward', () => {
  assert.equal(wrap(-1), 2);
  assert.equal(wrap(7), 1);
  assert.deepEqual(orbitPose(0, 0, 390), orbitPose(0, 3, 390));
  assert.deepEqual(orbitPose(2, 2, 390), { x: 0, z: 0, rotation: 0 });
  const right = orbitPose(1, 0, 390);
  const left = orbitPose(2, 0, 390);
  assert.ok(right.x > 0 && left.x < 0);
  assert.ok(right.z < 0 && left.z < 0);
  const wider = orbitPose(1, 0, 780);
  assert.equal(wider.x, right.x * 2);
  assert.equal(wider.z, right.z * 2);
  assert.equal(right.rotation, 120);
  assert.equal(left.rotation, -120);
  assert.ok(Math.cos(right.rotation * Math.PI / 180) < 0, 'right neighbour exposes its mirrored reverse');
  assert.ok(Math.cos(left.rotation * Math.PI / 180) < 0, 'left neighbour exposes its mirrored reverse');
});

test('all three functions keep one circular radius and equal spacing throughout rotation', () => {
  for (const width of [390, 775]) {
    const radius = width * 1.25;
    for (const position of [0, .2, .75, 1, 1.4, 2, 2.8, 3]) {
      const poses = [0, 1, 2].map(index => orbitPose(index, position, width));
      poses.forEach((pose, index) => {
        assert.ok(Math.abs(Math.hypot(pose.x, pose.z + radius) - radius) < 1e-8);
        const next = poses[(index + 1) % 3];
        assert.ok(Math.abs(Math.hypot(pose.x - next.x, pose.z - next.z) - Math.sqrt(3) * radius) < 1e-8);
      });
      if (Number.isInteger(position)) {
        const left = orbitPose(wrap(position - 1), position, width);
        const right = orbitPose(wrap(position + 1), position, width);
        assert.ok(Math.abs(left.x + right.x) < 1e-8);
        assert.ok(Math.abs(left.z - right.z) < 1e-8);
      }
    }
  }
});

test('gesture requires intentional horizontal travel and never skips areas', () => {
  assert.equal(horizontalIntent(9, 0), false);
  assert.equal(horizontalIntent(20, 20), false);
  assert.equal(horizontalIntent(20, 18), true);
  assert.equal(horizontalIntent(-30, 5), true);
  // Flick: rápido e na mesma direção troca com 30px; lento ou contrário, não.
  assert.equal(gestureStep(-30, 390, -.3), 1);
  assert.equal(gestureStep(30, 390, .5), -1);
  assert.equal(gestureStep(-29, 390, -1), 0);
  assert.equal(gestureStep(-60, 390, -.2), 0);
  assert.equal(gestureStep(-60, 390, .5), 0);
  for (const [width, threshold] of [[200, 64], [390, 93.6], [600, 110]]) {
    assert.equal(gestureStep(-threshold + 1, width), 0);
    assert.equal(gestureStep(-threshold, width), 1);
    assert.equal(gestureStep(threshold, width), -1);
  }
  assert.equal(gestureStep(10000, 390), -1);
});

test('navigation updates accessibility, announces only on settle and preserves scroll', () => {
  const f = fixture();
  assert.equal(f.api.activeViewport(), f.viewports.map);
  assert.equal(f.areas.map.dataset.active, 'true');
  assert.equal(f.areas.kaballah.inert, true);
  assert.equal(f.controls.map.getAttribute('aria-current'), 'page');
  assert.equal(f.scene.style.perspective, '312px');
  assert.equal(f.areas.map.style.filter, 'brightness(1)');
  assert.equal(f.areas.kaballah.style.filter, f.areas.correspondences.style.filter);
  assert.ok(Number(f.areas.kaballah.style.filter.match(/[\d.]+/)[0]) < .6, 'background assets recede into shadow');
  f.viewports.map.scrollTop = 246;
  f.api.goTo('kaballah');
  assert.equal(f.changes.at(-1).viewport, f.viewports.kaballah);
  assert.equal(f.status.textContent, 'Mapa astral');
  assert.equal(f.areas.map.getAttribute('aria-hidden'), 'true');
  f.step(600);
  assert.equal(f.pendingFrames, 1, 'the wider orbit has a longer settling movement');
  f.flush();
  assert.equal(f.status.textContent, 'Kaballah');
  f.viewports.kaballah.scrollTop = 572;
  f.api.goTo('map');
  f.flush();
  assert.equal(f.viewports.map.scrollTop, 246);
  f.api.goTo('kaballah', { focus: true });
  f.flush();
  assert.equal(f.viewports.kaballah.scrollTop, 572);
  assert.equal(f.document.activeElement, f.viewports.kaballah);
  f.api.goTo('invalid');
  assert.equal(f.changes.length, 4);
});

test('focus leaves a departing area before it becomes inert', () => {
  const f = fixture();
  f.viewports.map.focus();
  f.api.goTo('correspondences');
  assert.equal(f.document.activeElement, f.controls.correspondences);
  assert.equal(f.areas.map.inert, true);
  f.flush();
});

test('successive commands retain their circular direction while a snap is running', () => {
  const f = fixture();
  f.api.goTo('kaballah');
  f.step(20);
  f.api.goTo('correspondences');
  f.step(20);
  const x = Number(f.areas.map.style.transform.match(/translate3d\(([^p]+)px/)[1]);
  assert.ok(x < 0, 'map keeps travelling left while the next area approaches');
  f.flush();
  assert.equal(f.api.activeViewport(), f.viewports.correspondences);
});

test('modal inert state ignores navigation, pointers and horizontal wheel', () => {
  const f = fixture();
  f.scene.inert = true;
  f.api.goTo('kaballah');
  f.emit(f.controls.kaballah, 'click');
  f.emit(f.scene, 'pointerdown');
  f.emit(f.scene, 'pointermove', { clientX: -150 });
  f.emit(f.scene, 'pointerup', { clientX: -150 });
  const wheel = f.emit(f.scene, 'wheel', { deltaX: 100 });
  assert.equal(wheel.defaultPrevented, false);
  assert.equal(f.changes.length, 1);
});

test('a modal opened mid-snap keeps its focus and receives no background announcement', () => {
  const f = fixture();
  f.api.goTo('kaballah', { focus: true });
  f.scene.inert = true;
  f.controls.map.focus();
  f.flush();
  assert.equal(f.document.activeElement, f.controls.map);
  assert.equal(f.status.textContent, 'Mapa astral');
  assert.equal(f.api.activeViewport(), f.viewports.kaballah);
});

test('vertical, diagonal, pinch and reserved local gestures remain native', () => {
  const f = fixture();
  f.emit(f.scene, 'pointerdown');
  assert.equal(f.emit(f.scene, 'pointermove', { clientX: 8, clientY: 110 }).defaultPrevented, false);
  f.emit(f.scene, 'pointerup', { clientX: 8, clientY: 110 });
  assert.equal(f.emit(f.scene, 'wheel', { deltaX: 40, deltaY: 35 }).defaultPrevented, false);
  assert.equal(f.emit(f.scene, 'wheel', { deltaX: 100, ctrlKey: true }).defaultPrevented, false);
  f.emit(f.scene, 'pointerdown');
  f.emit(f.scene, 'pointerdown', { pointerId: 2, isPrimary: false });
  f.emit(f.scene, 'pointermove', { clientX: -150 });
  f.emit(f.scene, 'pointerup', { clientX: -150 });
  f.emit(f.scene, 'pointerup', { pointerId: 2 });
  f.emit(f.local, 'pointerdown');
  f.emit(f.local, 'pointermove', { clientX: -150 });
  f.emit(f.local, 'pointerup', { clientX: -150 });
  assert.equal(f.emit(f.local, 'wheel', { deltaX: 100 }).defaultPrevented, false);
  f.emit(f.scene, 'pointerdown', { orbitLocal: true });
  f.emit(f.scene, 'pointermove', { clientX: -150 });
  f.emit(f.scene, 'pointerup', { clientX: -150 });
  assert.equal(f.changes.length, 1);
});

test('a child losing capture to the swipe does not cancel it', () => {
  const f = fixture();
  f.emit(f.scene, 'pointerdown');
  f.emit(f.scene, 'pointermove', { clientX: -20 });
  f.emit(f.local, 'lostpointercapture');
  f.emit(f.scene, 'pointermove', { clientX: -10000 });
  f.emit(f.scene, 'pointerup', { clientX: -10000 });
  f.flush();
  assert.equal(f.api.activeViewport(), f.viewports.kaballah);
});

test('touch on the screen edge navigates even over local controls', () => {
  const f = fixture();
  globalThis.innerWidth = 390;
  f.emit(f.local, 'pointerdown', { pointerType: 'touch', clientX: 380 });
  f.emit(f.local, 'pointermove', { pointerType: 'touch', clientX: 230 });
  f.emit(f.local, 'pointerup', { pointerType: 'touch', clientX: 230 });
  f.flush();
  assert.equal(f.api.activeViewport(), f.viewports.kaballah);
  delete globalThis.innerWidth;
});

test('short drag snaps back and suppresses click; long drag advances one area', () => {
  const f = fixture();
  f.emit(f.scene, 'pointerdown');
  assert.equal(f.scene.captures.size, 0, 'click is not captured on pointerdown');
  assert.equal(f.emit(f.scene, 'pointermove', { clientX: -50 }).defaultPrevented, true);
  f.emit(f.scene, 'pointerup', { clientX: -50 });
  assert.equal(f.emit(f.scene, 'click').defaultPrevented, true);
  f.flush();
  assert.equal(f.api.activeViewport(), f.viewports.map);
  f.emit(f.scene, 'pointerdown');
  f.emit(f.scene, 'pointermove', { clientX: -10000 });
  f.emit(f.scene, 'pointerup', { clientX: -10000 });
  f.flush();
  assert.equal(f.api.activeViewport(), f.viewports.kaballah);
  assert.equal(f.changes.length, 2);
});

test('pointer cancellation and capture loss reset without navigating', () => {
  const f = fixture();
  for (const cancellation of ['pointercancel', 'lostpointercapture']) {
    f.emit(f.scene, 'pointerdown');
    f.emit(f.scene, 'pointermove', { clientX: -150 });
    f.emit(f.scene, cancellation);
    f.emit(f.scene, 'pointerup', { clientX: -150 });
    f.flush();
    assert.equal(f.api.activeViewport(), f.viewports.map);
  }
  assert.equal(f.changes.length, 1);
});

test('a width change cancels a drag without confirming stale coordinates', () => {
  const f = fixture();
  f.emit(f.scene, 'pointerdown');
  f.emit(f.scene, 'pointermove', { clientX: -150 });
  f.resize(520);
  f.emit(f.scene, 'pointerup', { clientX: -150 });
  f.flush();
  assert.equal(f.changes.length, 1);
  assert.equal(f.api.activeViewport(), f.viewports.map);
});

test('trackpad accumulates horizontal travel and ignores momentum until quiet', async () => {
  const f = fixture();
  f.emit(f.scene, 'wheel', { deltaX: 50 });
  assert.equal(f.changes.length, 1);
  f.emit(f.scene, 'wheel', { deltaX: 70 });
  f.flush();
  assert.equal(f.api.activeViewport(), f.viewports.kaballah);
  f.emit(f.scene, 'wheel', { deltaX: 200 });
  assert.equal(f.changes.length, 2);
  await new Promise(resolve => setTimeout(resolve, 195));
  f.emit(f.scene, 'wheel', { deltaX: 130 });
  f.flush();
  assert.equal(f.api.activeViewport(), f.viewports.correspondences);
});

test('navigation keys stay on controls and reduced motion cancels spatial travel', () => {
  const f = fixture();
  f.emit(f.controls.map, 'keydown', { key: 'ArrowLeft' });
  assert.equal(f.document.activeElement, f.controls.correspondences);
  f.emit(f.controls.correspondences, 'keydown', { key: 'Home' });
  assert.equal(f.api.activeViewport(), f.viewports.map);
  f.emit(f.viewports.map, 'keydown', { key: 'ArrowRight' });
  assert.equal(f.api.activeViewport(), f.viewports.map);
  f.api.goTo('kaballah');
  assert.equal(f.pendingFrames, 1);
  f.reducedMotion.matches = true;
  f.emit(f.reducedMotion, 'change');
  assert.equal(f.pendingFrames, 0);
  assert.equal(f.status.textContent, 'Kaballah');
  const before = f.areas.kaballah.style.transform;
  f.emit(f.scene, 'pointerdown');
  f.emit(f.scene, 'pointermove', { clientX: -150 });
  assert.equal(f.areas.kaballah.style.transform, before);
  f.emit(f.scene, 'pointerup', { clientX: -150 });
  assert.equal(f.pendingFrames, 0);
  assert.equal(f.api.activeViewport(), f.viewports.correspondences);
  f.resize(520);
  assert.ok(f.areas.map.style.transform.includes('translate3d('));
});
