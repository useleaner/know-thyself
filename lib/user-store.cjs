const profiles = require('./profile-store.cjs');

// Recebe somente a identidade já confirmada no login, nunca dados enviados pelo cliente.
async function recordLogin(user, sql = profiles.database()) {
  const id = await profiles.registerAccount(user, sql);
  await sql`UPDATE kt_accounts SET
    name = CASE WHEN ${user.sub.startsWith('email:')} AND name IS NOT NULL THEN name ELSE ${user.name} END,
    email = ${user.email.toLowerCase()}, last_login_at = now() WHERE id = ${id}`;
  return id;
}

async function remove(user, sql = profiles.database()) {
  const id = await profiles.accountFor(user, sql);
  const [removed] = await sql`DELETE FROM kt_accounts WHERE id = ${id} RETURNING id`;
  if (!removed) throw new Error('account_inactive');
  return removed.id;
}

async function list(cursor = null, sql = profiles.database()) {
  const rows = await sql`SELECT id, name, email, created_at, last_login_at FROM kt_accounts
    WHERE (${cursor}::uuid IS NULL OR (created_at, id) <
      (SELECT created_at, id FROM kt_accounts WHERE id = ${cursor}::uuid))
    ORDER BY created_at DESC, id DESC LIMIT 51`;
  return { users: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null };
}

module.exports = { recordLogin, list, accountFor: profiles.accountFor, remove };
