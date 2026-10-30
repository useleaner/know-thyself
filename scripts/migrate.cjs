const { readFileSync } = require('node:fs');
const { database } = require('../lib/profile-store.cjs');

async function main() {
  const target = process.argv[2];
  if (target !== undefined && target !== 'users') throw new Error('invalid_target');
  const schemas = target === 'users' ? ['profile-schema.sql', 'user-schema.sql'] : ['profile-schema.sql', 'user-schema.sql', 'notification-schema.sql'];
  const statements = schemas.flatMap(file => readFileSync(require.resolve(`../lib/${file}`), 'utf8').split(';').map(s => s.trim()).filter(Boolean));
  const sql = database();
  await sql.transaction(statements.map(statement => sql.query(statement)));
  console.log('Schema do Know Thyself atualizado.');
}
main().catch(() => { console.error('Não foi possível atualizar o schema. Confira DATABASE_URL e a conexão.'); process.exitCode = 1; });
