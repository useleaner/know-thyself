import { planetFacts, planetNotes } from './planet-data.js';
import { t } from './i18n.js';

const planets = [
  { id: 'sun', name: t('Sol') },
  { id: 'moon', name: t('Lua') },
  { id: 'mercury', name: t('Mercúrio') },
  { id: 'venus', name: t('Vênus') },
  { id: 'mars', name: t('Marte') },
  { id: 'jupiter', name: t('Júpiter') },
  { id: 'saturn', name: t('Saturno') }
];

export function initPlanetSelector({ root, viewport }) {
  const nav = root.querySelector('#planet-selector');
  const emblem = root.querySelector('#planet-emblem');
  const preview = root.querySelector('#planet-preview');
  const name = root.querySelector('#planet-name');
  const note = root.querySelector('#planet-note');
  const fields = [...root.querySelectorAll('#planet-facts dd')];
  if (!nav || !emblem || !preview || !name || !note || fields.length !== 14) {
    throw new Error('Planet selector requires its navigation, images, labels, note and 14 correspondence fields.');
  }
  const moonValues = fields.map(field => field.textContent);
  let selected = 0;
  nav.innerHTML = planets.map(planet => `<button type="button" class="planet-choice" data-planet="${planet.id}" aria-label="${planet.name}" title="${planet.name}"><img src="assets/planets/${planet.id}.svg" width="32" height="32" alt=""></button>`).join('');
  const buttons = [...nav.querySelectorAll('button')];

  function select(index, resetScroll = true) {
    selected = index;
    const planet = planets[selected];
    buttons.forEach((button, buttonIndex) => {
      button.setAttribute('aria-pressed', String(buttonIndex === selected));
      button.tabIndex = buttonIndex === selected ? 0 : -1;
    });
    emblem.src = preview.src = `assets/planets/${planet.id}.svg`;
    name.textContent = planet.name;
    fields.forEach((field, fieldIndex) => { field.textContent = planet.id === 'moon' ? moonValues[fieldIndex] : planetFacts[planet.id][fieldIndex]; });
    note.textContent = planetNotes[planet.id];
    if (resetScroll) viewport.scrollTo({ top: 0, behavior: 'instant' });
  }

  buttons.forEach((button, index) => button.addEventListener('click', () => select(index)));
  nav.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? planets.length - 1
      : (selected + (event.key === 'ArrowDown' ? 1 : -1) + planets.length) % planets.length;
    select(index);
    buttons[index].focus({ preventScroll: true });
  });
  select(0, false);
}
