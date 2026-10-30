import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerPWA } from './pwa.js';

test('registra offline sem pedir permissão de notificação', async () => {
  let call;
  assert.equal(await registerPWA({ register: async (...args) => { call = args; } }), true);
  assert.deepEqual(call, ['./sw.js', { type: 'module' }]);
});

test('browser sem suporte ou falha do worker não impede o app', async () => {
  assert.equal(await registerPWA(null), false);
  assert.equal(await registerPWA({ register: async () => { throw Error('offline'); } }), false);
});

import { initInstallOnboarding } from './pwa.js';
function onboardingFixture(surface = 'login', saved) {
  const nodes = new Map();
  const element = tag => ({ tag, dataset: {}, children: [], append(...children) { this.children.push(...children); for (const child of children) if (child.id) nodes.set(child.id, child); }, prepend(child) { this.children.unshift(child); if (child.id) nodes.set(child.id, child); }, setAttribute() {}, addEventListener(type, listener) { this[type] = listener; }, remove() { this.removed = true; nodes.delete(this.id); } });
  const surfaceNode = element('section');
  const root = { head: element('head'), body: element('body'), querySelector: selector => selector === `#${surface === 'login' ? 'login-screen' : surface === 'app' ? 'app-content' : 'birth-form'}` ? surfaceNode : nodes.get(selector.slice(1)), createElement: element };
  const store = new Map(saved ? [['know-thyself.install-onboarding.v1', saved]] : []);
  const storage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) };
  const options = { root, storage, navigator: { userAgent: 'iPhone' }, matchMedia: () => ({ matches: false }) };
  return { root, store, options };
}

test('instalação aparece na primeira entrada e dispensa sem bloquear login nem pedir permissões', () => {
  const f = onboardingFixture();
  const panel = initInstallOnboarding(f.options);
  assert.equal(panel.tag, 'aside'); assert.equal(panel.dataset.surface, 'login');
  assert.match(panel.children[1].textContent, /Safari/);
  assert.equal(initInstallOnboarding(f.options), null);
  const dismiss = panel.children.at(-1).children.at(-1);
  assert.equal(dismiss.textContent, 'Agora não'); dismiss.click();
  assert.equal(panel.removed, true);
  assert.equal(f.store.get('know-thyself.install-onboarding.v1'), 'dismissed');
  assert.equal(initInstallOnboarding(f.options), null);
});

test('instalação fica fora do cadastro, não reaparece dispensada e se esconde no standalone', () => {
  assert.equal(initInstallOnboarding(onboardingFixture('profile').options), null);
  assert.equal(initInstallOnboarding(onboardingFixture('app', 'dismissed').options), null);
  const f = onboardingFixture('app');
  assert.equal(initInstallOnboarding({ ...f.options, navigator: { standalone: true } }), null);
  assert.equal(initInstallOnboarding({ ...f.options, matchMedia: () => ({ matches: true }) }), null);
  const panel = initInstallOnboarding({ ...f.options, navigator: { userAgent: 'Android' } });
  assert.equal(panel.dataset.surface, 'app'); assert.match(panel.children[1].textContent, /Android/); assert.equal(panel.children.length, 3);
});

test('armazenamento bloqueado não impede abrir ou dispensar orientação; iPad desktop usa Safari', () => {
  const f = onboardingFixture('app');
  const panel = initInstallOnboarding({ ...f.options, storage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } }, navigator: { platform: 'MacIntel', maxTouchPoints: 5 } });
  assert.match(panel.children[1].textContent, /Safari/);
  assert.doesNotThrow(() => panel.children.at(-1).children.at(-1).click());
  assert.equal(panel.removed, true);
});
