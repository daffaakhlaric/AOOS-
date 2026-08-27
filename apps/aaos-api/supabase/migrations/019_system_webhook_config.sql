-- AAOS-SETTINGS-WEBHOOK-CONFIG (Part C) -- 019_system_webhook_config.sql
-- Single-row, superadmin-editable override table for the GLOBAL Meta/WhatsApp webhook
-- verify-token + app-secret pairs (docs/PROMPT-AAOS-SETTINGS-WEBHOOK-CONFIG.md finding #4/#5) --
-- one Meta App/WhatsApp BSP app receives EVERY tenant's webhook traffic under one shared secret;
-- there is no per-tenant webhook secret in this app's real architecture, and this table is
-- deliberately NOT tenant-scoped (no `tenant_id` column) -- confirmed with the user before this
-- table was added.
--
-- CONVENTION: application code always reads/writes the row with `id = 'default'`, NEVER inserts a
-- second row -- `WebhookSecretsService`/`SystemWebhookConfigRepository` always upsert onto this
-- fixed id. A missing row (fresh install, no overrides saved yet) is a real, valid, honest state,
-- not an error -- every column is NULL-able, and NULL means "no override -- use `.env`."
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `WebhookSecretsService`'s DB-backed override path can take effect.

CREATE TABLE IF NOT EXISTS system_webhook_config (
  id                             TEXT PRIMARY KEY DEFAULT 'default',
  whatsapp_webhook_verify_token  TEXT,
  whatsapp_webhook_app_secret    TEXT,
  meta_webhook_verify_token      TEXT,
  meta_webhook_app_secret        TEXT,
  updated_at                     TIMESTAMPTZ
);
