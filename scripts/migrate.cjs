const { readFileSync } = require('node:fs');
const { database } = require('../lib/profile-store.cjs');

async function main() {
  const statements = readFileSync(require.resolve('../lib/profile-schema.sql'), 'utf8').split(';').map(s => s.trim()).filter(Boolean);
  const sql = database();
  await sql.transaction(statements.map(statement => sql.query(statement)));
  console.log('Schema do Know Thyself atualizado.');
}
main().catch(() => { console.error('Não foi possível atualizar o schema. Confira DATABASE_URL e a conexão.'); process.exitCode = 1; });
