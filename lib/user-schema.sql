-- Dados administrativos de identidade, separados dos perfis de nascimento cifrados.
ALTER TABLE kt_accounts ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE kt_accounts ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE kt_accounts ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
CREATE INDEX IF NOT EXISTS kt_accounts_created_id_idx ON kt_accounts (created_at DESC, id DESC);
