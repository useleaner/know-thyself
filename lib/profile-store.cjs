const { neon } = require('@neondatabase/serverless');
const { encrypt, decrypt, fingerprint } = require('./crypto.cjs');
let client;
function database() {
  if (!process.env.DATABASE_URL) throw new Error('database_not_configured');
  return client ??= neon(process.env.DATABASE_URL);
}

// HMACs ligam a conta à identidade sem usar nome/e-mail como chave pública.
async function registerAccount(user, sql = database()) {
  // O subject Google é estável mesmo quando o endereço de e-mail muda.
  const google = user.sub.startsWith('email:') ? null : fingerprint(`google:${user.sub}`);
  const email = fingerprint(`email:${user.email.toLowerCase()}`);
  if (google) {
    const [existing] = await sql`SELECT id FROM kt_accounts WHERE google_hash = ${google}`;
    if (existing) return existing.id;
  }
  const [account] = await sql`
    INSERT INTO kt_accounts (email_hash, google_hash) VALUES (${email}, ${google})
    ON CONFLICT (email_hash) DO UPDATE SET google_hash = COALESCE(kt_accounts.google_hash, EXCLUDED.google_hash)
    WHERE EXCLUDED.google_hash IS NULL OR kt_accounts.google_hash IS NULL OR kt_accounts.google_hash = EXCLUDED.google_hash
    RETURNING id`;
  if (!account) throw new Error('identity_conflict');
  return account.id;
}

async function accountFor(user, sql = database()) {
  if (!user.accountId) throw new Error('account_inactive');
  const google = user.sub.startsWith('email:') ? null : fingerprint(`google:${user.sub}`);
  const email = fingerprint(`email:${user.email.toLowerCase()}`);
  const [account] = await sql`SELECT id FROM kt_accounts WHERE id = ${user.accountId}
    AND (google_hash = ${google} OR (${google}::text IS NULL AND email_hash = ${email}))`;
  if (!account) throw new Error('account_inactive');
  return account.id;
}

async function read(accountId, sql = database()) {
  const [row] = await sql`SELECT data, revision FROM kt_profile_states WHERE account_id = ${accountId}`;
  return { accountId, state: row ? JSON.parse(decrypt(row.data)) : null, revision: row?.revision ?? 0 };
}

// Comparação e escrita atômicas impedem uma aba antiga de apagar alterações novas.
async function write(accountId, state, revision, sql = database()) {
  const data = encrypt(JSON.stringify(state));
  const [row] = revision === 0
    ? await sql`INSERT INTO kt_profile_states (account_id, data, revision) VALUES (${accountId}, ${data}, 1)
        ON CONFLICT (account_id) DO NOTHING RETURNING revision`
    : await sql`UPDATE kt_profile_states SET data = ${data}, revision = revision + 1, updated_at = now()
        WHERE account_id = ${accountId} AND revision = ${revision} RETURNING revision`;
  return row ? { accountId, state, revision: row.revision } : null;
}

module.exports = { database, registerAccount, accountFor, read, write };
