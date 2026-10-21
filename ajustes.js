import { getSettings, setSettings, onProfilesChange, connectProfiles } from './profiles.js';
import { readSession, isLocalPreview } from './login.js?v=20261019-caminhos';
import { t, lang, setLang } from './i18n.js';

if (!isLocalPreview(location.href)) await readSession().then(session => session?.user && connectProfiles()).catch(() => {});

const requested = new URLSearchParams(location.search).get('view');
const status = document.querySelector('#status');
const houses = [['placidus', t('Placidus'), t('Casas de tamanhos diferentes')], ['equal', t('Casas iguais'), t('30° cada, a partir do Ascendente')], ['whole', t('Signos inteiros'), t('Cada signo é uma casa')]];
const orbs = [['conjunction', t('Conjunção')], ['opposition', t('Oposição')], ['trine', t('Trígono')], ['square', t('Quadratura')], ['sextile', t('Sextil')]];
const points = [['node', t('Nó Norte'), '☊︎'], ['lilith', t('Lilith'), '⚸︎'], ['chiron', t('Quíron'), '⚷︎'], ['ceres', t('Ceres'), '⚳︎'], ['pallas', t('Palas Atena'), '⚴︎'], ['juno', t('Juno'), '⚵︎'], ['vesta', t('Vesta'), '⚶︎']];
const check = '<svg class="settings-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';

document.querySelector('#house-system').insertAdjacentHTML('beforeend', houses.map(([id, name, copy]) => `<label class="settings-option"><input type="radio" name="houseSystem" value="${id}"><span class="option-copy">${name}<small>${copy}</small></span>${check}</label>`).join(''));
document.querySelector('#manual-orbs').innerHTML = orbs.map(([id, name]) => `<li><div class="settings-row"><span class="settings-label">${name}</span><span class="orb-stepper"><button type="button" data-orb="${id}" data-step="-1" aria-label="${t('Diminuir {name}', { name })}">−</button><output id="orb-${id}" aria-label="${t('Orbe de {name}', { name })}"></output><button type="button" data-orb="${id}" data-step="1" aria-label="${t('Aumentar {name}', { name })}">+</button></span></div></li>`).join('');
for (const [index, selector] of [[0, '#points-settings'], [2, '#asteroid-settings']]) {
  document.querySelector(selector).innerHTML = points.slice(index, index === 0 ? 2 : undefined).map(([id, name, glyph]) => `<li><label class="settings-row switch-row"><span class="point-glyph" aria-hidden="true">${glyph}</span><span class="settings-label">${name}</span><input type="checkbox" role="switch" data-point="${id}"><span class="settings-switch" aria-hidden="true"></span></label></li>`).join('');
}

function toggle(button, open = button.getAttribute('aria-expanded') !== 'true') {
  button.setAttribute('aria-expanded', String(open));
  document.getElementById(button.getAttribute('aria-controls')).hidden = !open;
}
document.querySelectorAll('.settings-toggle').forEach(button => button.addEventListener('click', () => toggle(button)));
const deepLink = requested && document.getElementById(`toggle-${requested}`);
if (deepLink) toggle(deepLink, true);

function render() {
  try {
    const settings = getSettings();
    document.querySelector('#house-value').textContent = houses.find(([id]) => id === settings.houseSystem)[1];
    document.querySelector('#zodiac-value').textContent = settings.zodiac === 'tropical' ? t('Tropical') : t('Sideral');
    document.querySelector('#orbs-value').textContent = settings.orbMode === 'auto' ? t('Automático') : t('Manual');
    const active = Object.values(settings.points).filter(Boolean).length;
    document.querySelector('#points-value').textContent = t(active === 1 ? '{n} ativo' : '{n} ativos', { n: active });
    document.querySelector('#language-value').textContent = lang === 'en' ? 'English' : 'Português';
    document.querySelectorAll('input[name="language"]').forEach(input => { input.checked = input.value === lang; });
    for (const name of ['houseSystem', 'zodiac']) document.querySelectorAll(`input[name="${name}"]`).forEach(input => { input.checked = input.value === settings[name]; });
    document.querySelectorAll('[data-zodiac-copy]').forEach(copy => { copy.hidden = copy.dataset.zodiacCopy !== settings.zodiac; });
    document.querySelector('#automatic-orbs').checked = settings.orbMode === 'auto';
    document.querySelector('#manual-orbs').hidden = settings.orbMode === 'auto';
    document.querySelector('#orb-auto-note').hidden = settings.orbMode !== 'auto';
    for (const [id] of orbs) document.querySelector(`#orb-${id}`).value = `${settings.orbs[id]}°`;
    document.querySelectorAll('[data-orb]').forEach(button => { button.disabled = Number(button.dataset.step) < 0 ? settings.orbs[button.dataset.orb] === 0 : settings.orbs[button.dataset.orb] === 15; });
    document.querySelectorAll('[data-point]').forEach(input => { input.checked = settings.points[input.dataset.point]; });
  } catch {
    document.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
    status.textContent = t('Não foi possível acessar os dados salvos. Reabra a página ou tente outro navegador.');
  }
}
function save(patch) {
  const fail = () => { render(); status.textContent = t('Não foi possível salvar o ajuste. Libere espaço no navegador e tente novamente.'); };
  try { Promise.resolve(setSettings(patch)).then(() => { status.textContent = ''; }, fail); }
  catch { fail(); }
}
document.querySelectorAll('input[name="houseSystem"], input[name="zodiac"]').forEach(input => input.addEventListener('change', () => save({ [input.name]: input.value })));
document.querySelector('#automatic-orbs').addEventListener('change', event => save({ orbMode: event.target.checked ? 'auto' : 'manual' }));
document.querySelectorAll('[data-point]').forEach(input => input.addEventListener('change', () => save({ points: { [input.dataset.point]: input.checked } })));
document.querySelectorAll('[data-orb]').forEach(button => button.addEventListener('click', () => {
  try {
    save({ orbs: { [button.dataset.orb]: getSettings().orbs[button.dataset.orb] + Number(button.dataset.step) } });
    // No limite (0 ou 15) o botão tocado desativa; o foco passa para o oposto em vez de se perder.
    if (button.disabled) document.querySelector(`[data-orb="${button.dataset.orb}"][data-step="${-Number(button.dataset.step)}"]`).focus();
  }
  catch { status.textContent = t('Não foi possível ler os ajustes. Reabra a página e tente novamente.'); }
}));
// Trocar o idioma recarrega a página já traduzida, mantendo o painel de idioma aberto.
document.querySelectorAll('input[name="language"]').forEach(input => input.addEventListener('change', () => {
  try { setLang(input.value); location.replace('./ajustes.html?view=idioma'); }
  catch { render(); status.textContent = t('Não foi possível salvar o ajuste. Libere espaço no navegador e tente novamente.'); }
}));
onProfilesChange(render);
render();

const motion = matchMedia('(prefers-reduced-motion: reduce)');
function parallax() {
  const y = motion.matches ? 0 : window.scrollY;
  document.querySelector('.nebula-far').style.transform = `translateY(${-Math.min(y * .028, 32)}px)`;
  document.querySelector('.nebula-near').style.transform = `translateY(${-Math.min(y * .065, 64)}px)`;
}
addEventListener('scroll', parallax, { passive: true });
motion.addEventListener('change', parallax);
parallax();
