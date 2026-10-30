-- Chaves de identidade HMAC e perfis cifrados (AES-256-GCM, lib/crypto.cjs).
-- Metadados administrativos nominais são acrescentados por user-schema.sql.
CREATE TABLE IF NOT EXISTS kt_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL UNIQUE,
  google_hash text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kt_profile_states (
  account_id uuid PRIMARY KEY REFERENCES kt_accounts(id) ON DELETE CASCADE,
  data text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
