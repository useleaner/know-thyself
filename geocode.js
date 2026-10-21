import { t, lang } from './i18n.js';
const URL_BASE = 'https://geocoding-api.open-meteo.com/v1/search';
const FRIENDLY = t('Não foi possível usar a busca de cidades agora. Tente de novo em instantes.');

// Só o texto digitado sai do navegador (Open-Meteo, https://open-meteo.com/en/terms).
export async function searchPlaces(query, { fetch = globalThis.fetch, timeoutMs = 8000 } = {}) {
  const name = String(query ?? '').trim().slice(0, 100);
  if (name.length < 2) return [];
  const url = `${URL_BASE}?${new URLSearchParams({ name, count: '6', language: lang === 'en' ? 'en' : 'pt', format: 'json' })}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error('http');
    const data = await res.json();
    const seen = new Set();
    return (Array.isArray(data?.results) ? data.results : []).flatMap(r => {
      if (!Number.isFinite(r?.latitude) || !Number.isFinite(r?.longitude) || typeof r.timezone !== 'string' || typeof r.name !== 'string') return [];
      const country = r.country || '', admin1 = r.admin1 || '';
      const label = [r.name, admin1, country].filter(Boolean).join(', ');
      if (seen.has(label)) return [];
      seen.add(label);
      return [{ label, lat: r.latitude, lon: r.longitude, timezone: r.timezone, country, admin1 }];
    });
  } catch (error) {
    throw new Error(ctl.signal.aborted ? t('A busca de cidades demorou demais. Tente de novo.') : FRIENDLY);
  } finally { clearTimeout(timer); }
}

const dtf = new Map();
function offsetAt(ms, timezone) { // deslocamento (ms) do fuso no instante UTC `ms`
  if (!dtf.has(timezone)) dtf.set(timezone, new Intl.DateTimeFormat('en-US', { timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', era: 'short' }));
  const p = Object.fromEntries(dtf.get(timezone).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const year = p.era === 'B' ? 1 - Number(p.year) : Number(p.year);
  const asUtc = new Date(0);
  asUtc.setUTCFullYear(year, p.month - 1, p.day);
  asUtc.setUTCHours(p.hour, p.minute, p.second, 0);
  return asUtc.getTime() - Math.floor(ms / 1000) * 1000;
}

// Retorna { date, status: 'ok'|'ambiguous'|'nonexistent', warning?, candidates: Date[] }.
export function localToUtcDetailed({ date, time, timezone }, { resolve } = {}) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? ''), clock = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  if (!d || !clock) throw new RangeError(t('Data ou hora inválida.'));
  const local = new Date(0);
  local.setUTCFullYear(+d[1], d[2] - 1, +d[3]);
  local.setUTCHours(+clock[1], +clock[2], 0, 0);
  if (local.getUTCFullYear() !== +d[1] || local.getUTCMonth() !== d[2] - 1 || local.getUTCDate() !== +d[3]) throw new RangeError(t('Data inválida.'));
  try { offsetAt(0, timezone); } catch { throw new RangeError(t('Fuso horário inválido.')); }
  const L = local.getTime(), day = 864e5;
  // Candidatos: os deslocamentos vizinhos; vale o que se confirma no próprio instante resultante.
  const valid = [...new Set([offsetAt(L - day, timezone), offsetAt(L + day, timezone)])].map(o => L - o).filter(u => offsetAt(u, timezone) === L - u).sort((a, b) => a - b);
  if (valid.length === 1) return { date: new Date(valid[0]), status: 'ok', candidates: [new Date(valid[0])] };
  if (valid.length > 1) {
    const candidates = valid.map(u => new Date(u));
    const pick = resolve === 'later' ? candidates.at(-1) : resolve === 'earlier' ? candidates[0] : null;
    return { date: pick, status: 'ambiguous', candidates, warning: t('Esse horário aconteceu duas vezes no fim do horário de verão; o mapa usa a primeira ocorrência.') };
  }
  const gap = new Date(L - offsetAt(L - day, timezone)); // com o deslocamento anterior ao salto: avança
  return { date: resolve === 'later' ? gap : null, status: 'nonexistent', candidates: [gap], warning: t('Esse horário não existiu no início do horário de verão; o mapa usa o horário logo após o salto.') };
}

export function localToUtc(args, opts) {
  const r = localToUtcDetailed(args, opts);
  if (r.date) return r.date;
  const e = new RangeError(t(r.status === 'ambiguous' ? 'Horário ambíguo. {warning}' : 'Horário que não existiu. {warning}', { warning: r.warning }));
  e.code = r.status;
  e.candidates = r.candidates;
  throw e;
}
