import { buildMapState, BODY_NAMES, ASPECT_INFO } from './map-data.js';
import { aspectText } from './interpretations.js';
import { contextAspectReading } from './natal-readings.js';
import { t } from './i18n.js';

// A mesma seleção e leitura do mapa; o servidor escolhe o idioma por inscrição.
export function dailyTransit(profile, settings, date, language = 'pt-BR') {
  const state = buildMapState({ ...settings, profile, date, mode: 'transits' });
  const aspect = state.dayAspect;
  if (state.status !== 'ok' || !aspect) return null;
  const from = t(BODY_NAMES[aspect.from.replace(/^transit-/, '')], undefined, language);
  const to = t(BODY_NAMES[aspect.to], undefined, language);
  const title = t('{aspect}: {natal} natal com {transit} em trânsito', {
    aspect: t(ASPECT_INFO[aspect.kind].name, undefined, language), natal: to, transit: from
  }, language);
  const contextual = contextAspectReading(aspect, state, language);
  const text = (contextual?.summary || aspectText(aspect.kind, from, to, 'transit', language)).replace(/\s+/g, ' ').trim();
  const body = text.length > 180 ? `${text.slice(0, 179).trimEnd()}…` : text;
  const query = new URLSearchParams({ mode: 'transits', profile: profile.id, at: date.toISOString(), aspect: aspect.id });
  return { title, body, url: `./universo.html?${query}`, tag: `daily-transit-${profile.id}-${date.toISOString().slice(0, 10)}` };
}
