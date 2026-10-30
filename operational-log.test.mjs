import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { logFailure } = createRequire(import.meta.url)('./lib/operational-log.cjs');

test('registro operacional aceita só códigos conhecidos, sem dados arbitrários', () => {
  const entries = [], logger = { error: text => entries.push(JSON.parse(text)) };
  logFailure('profiles_unavailable', logger);
  logFailure('email=private@example.com', logger);
  logFailure({ token: 'secret' }, logger);
  assert.deepEqual(entries, [{ type: 'kt.failure', event: 'profiles_unavailable' }]);
});
