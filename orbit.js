import { t } from './i18n.js';
import { tick as haptic } from './haptics.js';

const names = ['map', 'kaballah', 'correspondences'];
const labels = [t('Mapa astral'), t('Kaballah'), t('Correspondências')];

export function wrap(value, period = 3) {
  return ((value % period) + period) % period;
}

export const EDGE = 24;

export function horizontalIntent(dx, dy) {
  return Math.abs(dx) >= 10 && Math.abs(dx) > Math.abs(dy);
}

// Flick: dedo rápido (px/ms) troca de área mesmo sem percorrer o limiar.
export function gestureStep(dx, width, velocity = 0) {
  const threshold = Math.max(64, Math.min(110, width * .24));
  const flick = Math.abs(velocity) >= .3 && Math.abs(dx) >= 30 && Math.sign(velocity) === Math.sign(dx);
  return Math.abs(dx) >= threshold || flick ? -Math.sign(dx) : 0;
}

export function orbitPose(index, position, width) {
  const degrees = (wrap(index - position + 1.5) - 1.5) * 120;
  const radians = degrees * Math.PI / 180;
  const radius = width * 1.25;
  return {
    x: Math.sin(radians) * radius,
    z: (Math.cos(radians) - 1) * radius,
    rotation: degrees
  };
}

export function initOrbit({ scene, onChange = () => {} }) {
  const areas = names.map(name => scene.querySelector(`[data-area="${name}"]`));
  const viewports = areas.map(area => area?.querySelector('.area-scroll'));
  if (viewports.some(viewport => !viewport)) throw new Error('Orbit requires map, kaballah and correspondences, each with an .area-scroll.');
  const controls = [...document.querySelectorAll('[data-go]')];
  const status = document.querySelector('.orbit-status');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointers = new Set();
  let width = Math.max(1, scene.getBoundingClientRect().width);
  let active = 0;
  let position = 0;
  let destination = 0;
  let frame = 0;
  let drag = null;
  let suppressClickUntil = 0;
  let wheelTotal = 0;
  let wheelLocked = false;
  let wheelTimer;

  scene.style.touchAction = 'pan-y';

  function activeViewport() { return viewports[active]; }

  function render() {
    scene.style.perspective = `${width * .8}px`;
    areas.forEach((area, index) => {
      const pose = orbitPose(index, position, width);
      area.style.transform = `translateX(-50%) translate3d(${pose.x}px,0,${pose.z}px) rotateY(${pose.rotation}deg)`;
      area.style.zIndex = String(Math.round(1000 + pose.z / width * 100));
      area.style.filter = `brightness(${1 + pose.z / (width * 1.25) * .3})`;
    });
  }

  function setActive(index, initial = false) {
    const changed = active !== index;
    const previous = areas[active];
    active = index;
    areas[active].inert = false;
    areas[active].setAttribute('aria-hidden', 'false');
    if (changed && previous.contains(document.activeElement)) {
      (controls.find(button => button.dataset.go === names[active]) || activeViewport()).focus({ preventScroll: true });
    }
    areas.forEach((area, areaIndex) => {
      const selected = areaIndex === active;
      area.dataset.active = String(selected);
      area.setAttribute('aria-hidden', String(!selected));
      area.inert = !selected;
    });
    controls.forEach(button => {
      if (button.dataset.go === names[active]) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (changed || initial) onChange(names[active], activeViewport());
  }

  function cancelTween() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function settle(focus) {
    if (scene.inert) return;
    if (status) status.textContent = labels[active];
    if (focus) activeViewport().focus({ preventScroll: true });
  }

  function snapTo(target, focus = false) {
    cancelTween();
    const start = position;
    if (reducedMotion.matches || Math.abs(target - start) < .001) {
      position = wrap(target);
      destination = position;
      render();
      settle(focus);
      return;
    }
    const started = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - started) / 800);
      position = start + (target - start) * (1 - (1 - progress) ** 3);
      render();
      if (progress < 1) frame = requestAnimationFrame(tick);
      else {
        frame = 0;
        position = wrap(target);
        destination = position;
        render();
        settle(focus);
      }
    }
    frame = requestAnimationFrame(tick);
  }

  function releaseDrag() {
    const previous = drag;
    drag = null;
    if (previous?.locked) {
      suppressClickUntil = performance.now() + 120;
      if (scene.hasPointerCapture(previous.id)) scene.releasePointerCapture(previous.id);
    }
    return previous;
  }

  function cancelDrag() {
    if (!releaseDrag()) return;
    snapTo(destination);
  }

  function goTo(name, { focus = false } = {}) {
    const index = names.indexOf(name);
    if (index < 0 || scene.inert) return;
    releaseDrag();
    destination += wrap(index - active + 1.5) - 1.5;
    if (index !== active) haptic();
    setActive(index);
    snapTo(destination, focus);
  }

  // Bordas sempre navegam; fora delas, controles marcados e o aro/pinça do mapa (orbitLocal) ficam com o gesto.
  function localGesture(event) {
    if (event.pointerType === 'touch' && (event.clientX < EDGE || event.clientX > innerWidth - EDGE)) return false;
    return Boolean(event.orbitLocal || event.target.closest?.('[data-orbit-gesture="local"]'));
  }

  document.addEventListener('pointerdown', event => {
    pointers.add(event.pointerId);
    if (pointers.size > 1) cancelDrag();
  }, true);
  scene.addEventListener('pointerdown', event => {
    if (scene.inert || localGesture(event) || event.button > 0 || pointers.size > 1 || event.isPrimary === false) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, locked: false, start: position, lastX: event.clientX, lastT: event.timeStamp, velocity: 0 };
  });
  scene.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (scene.inert || pointers.size > 1) { cancelDrag(); return; }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const dt = event.timeStamp - drag.lastT;
    if (dt > 0) {
      drag.velocity = drag.velocity * .2 + (event.clientX - drag.lastX) / dt * .8;
      drag.lastX = event.clientX;
      drag.lastT = event.timeStamp;
    }
    if (!drag.locked) {
      if (Math.abs(dy) >= 14 && Math.abs(dy) > Math.abs(dx) * 1.2) { cancelDrag(); return; }
      if (!horizontalIntent(dx, dy)) return;
      cancelTween();
      drag.locked = true;
        drag.start = position;
      try { scene.setPointerCapture(event.pointerId); }
      catch { cancelDrag(); return; }
    }
    if (event.cancelable) event.preventDefault();
    if (!reducedMotion.matches) {
      const travel = Math.min(.92, Math.max(0, Math.abs(dx) - 10) * .82 / (width * .95));
      position = drag.start - Math.sign(dx) * travel;
      render();
    }
  });
  document.addEventListener('pointerup', event => {
    pointers.delete(event.pointerId);
    if (drag?.id !== event.pointerId) return;
    const previous = releaseDrag();
    if (!previous.locked) return;
    if (scene.inert || pointers.size) { snapTo(destination); return; }
    // Dedo parado antes de soltar não conta como flick.
    const velocity = event.timeStamp - previous.lastT > 80 ? 0 : previous.velocity;
    const step = gestureStep(event.clientX - previous.x, width, velocity);
    goTo(names[wrap(active + step)]);
  });
  document.addEventListener('pointercancel', event => {
    pointers.delete(event.pointerId);
    if (drag?.id !== event.pointerId) return;
    // O iOS cancela o ponteiro quando assume o gesto: se o arrasto já era nosso, conclui pelo último ponto em vez de voltar.
    const previous = releaseDrag();
    if (!previous.locked || scene.inert || pointers.size) { snapTo(destination); return; }
    goTo(names[wrap(active + gestureStep(previous.lastX - previous.x, width, previous.velocity))]);
  });
  scene.addEventListener('lostpointercapture', event => {
    // Só a perda da captura da própria cena: a de um filho (ex.: disco do mapa) sobe até aqui quando assumimos o swipe.
    if (event.target === scene && drag?.id === event.pointerId) cancelDrag();
  });
  scene.addEventListener('click', event => {
    if (performance.now() >= suppressClickUntil) return;
    suppressClickUntil = 0;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  scene.addEventListener('wheel', event => {
    if (scene.inert || localGesture(event) || event.ctrlKey || pointers.size || Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.35) return;
    event.preventDefault();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelTotal = 0; wheelLocked = false; }, 180);
    if (wheelLocked) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1;
    const delta = event.deltaX * unit;
    if (Math.sign(delta) !== Math.sign(wheelTotal)) wheelTotal = 0;
    wheelTotal += delta;
    const step = gestureStep(-wheelTotal, width);
    if (step) {
      wheelLocked = true;
      wheelTotal = 0;
      goTo(names[wrap(active + step)]);
    }
  }, { passive: false });

  controls.forEach(button => {
    button.addEventListener('click', () => goTo(button.dataset.go));
    button.addEventListener('keydown', event => {
      if (scene.inert || !['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : wrap(active + (event.key === 'ArrowRight' ? 1 : -1));
      goTo(names[index]);
      controls.find(control => control.dataset.go === names[index])?.focus({ preventScroll: true });
    });
  });
  reducedMotion.addEventListener('change', () => {
    releaseDrag();
    cancelTween();
    position = active;
    destination = active;
    render();
    settle(false);
  });
  window.addEventListener('blur', () => { pointers.clear(); cancelDrag(); });
  new ResizeObserver(() => {
    const nextWidth = Math.max(1, scene.getBoundingClientRect().width);
    if (nextWidth !== width) {
      width = nextWidth;
      cancelDrag();
    }
    render();
  }).observe(scene);

  setActive(0, true);
  render();
  settle(false);
  return { goTo, activeViewport };
}
