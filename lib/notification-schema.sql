-- Inscrição, perfil, horário, idioma e fuso cifrados, endpoint só como HMAC.
CREATE TABLE IF NOT EXISTS kt_push_subscriptions (
  endpoint_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES kt_accounts(id) ON DELETE CASCADE,
  data text NOT NULL,
  next_due_at timestamptz NOT NULL,
  last_day date,
  lease_id uuid,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kt_push_due ON kt_push_subscriptions(next_due_at);
CREATE INDEX IF NOT EXISTS kt_push_account ON kt_push_subscriptions(account_id);
