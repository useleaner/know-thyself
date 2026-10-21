import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { encrypt, decrypt, fingerprint } = createRequire(import.meta.url)('./lib/crypto.cjs');

const env = { ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') };

test('perfis cifrados: ida e volta, iv aleatório, adulteração detectada e chave obrigatória', () => {
  const state = JSON.stringify({ version: 1, profiles: [{ name: 'Alba', birthDate: '1991-06-17' }] });
  const a = encrypt(state, env), b = encrypt(state, env);
  assert.notEqual(a, b);
  assert.ok(!Buffer.from(a, 'base64').toString('latin1').includes('Alba'));
  assert.equal(decrypt(a, env), state);
  const raw = Buffer.from(a, 'base64');
  raw[raw.length - 1] ^= 1;
  assert.throws(() => decrypt(raw.toString('base64'), env));
  assert.throws(() => decrypt(a, { ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64') }));
  assert.throws(() => encrypt(state, { ENCRYPTION_KEY: 'curta' }), /encryption_not_configured/);
});

test('identificadores viram impressão estável, sem o valor original', () => {
  const email = fingerprint('email:pessoa@example.com', env);
  assert.equal(email, fingerprint('email:pessoa@example.com', env));
  assert.notEqual(email, fingerprint('email:outra@example.com', env));
  assert.ok(!email.includes('pessoa'));
});
