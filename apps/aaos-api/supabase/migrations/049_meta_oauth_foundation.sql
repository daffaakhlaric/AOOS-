-- EYVRA-META-OAUTH-WHATSAPP-SETUP (Sprint 1 — Foundation) -- 049_meta_oauth_foundation.sql
-- Real next migration number verified directly against this folder's actual latest
-- (048_campaign_auto_publish.sql) before choosing 049 -- no other 049 exists.
--
-- SCOPE: this migration is purely ADDITIVE foundation for a LATER sprint's real Meta OAuth
-- (Facebook Login) + WhatsApp Business Embedded Signup flow. It does NOT wire anything --
-- `MetaAdsConnectorRegistry.resolve()` (meta-ads-connector-registry.ts) and
-- `WhatsAppConnectorRegistry.resolve()` (whatsapp-connector-registry.ts) are NOT modified here and
-- keep reading exactly the same columns they already do today (`tenants.meta_access_token`,
-- `tenants.meta_ad_account_id`, `tenants.meta_api_version`, and `waba_configs`' existing columns).
-- Every new column below is nullable/defaulted so every existing row and every existing read path
-- is completely unaffected.
--
-- REAL, INVESTIGATED CORRECTIONS vs. the raw pasted spec this sprint is based on:
--   1. The spec's migrations use `tenant_id UUID NOT NULL REFERENCES tenants(id)` throughout. This
--      codebase's REAL, already-established convention (every migration this whole session,
--      `007_tenants_waba.sql` onward) is the separate `tenant_id TEXT UNIQUE NOT NULL` slug column
--      (`tenants.tenant_id`, e.g. `'dss-motor'`), never the `id UUID` primary key, for any
--      cross-table tenant scoping. `oauth_states`/`token_refresh_log` below both use
--      `tenant_id TEXT`, matching every other tenant-scoped table in this folder.
--   2. The spec proposes a new `meta_connections` table as the credential source of truth. This
--      codebase already HAS a real, working, per-tenant credential source of truth --
--      `tenants.meta_access_token`/`meta_ad_account_id`/`meta_api_version`, resolved by
--      `MetaAdsConnectorRegistry.resolve(tenantId)` and consumed by `campaigns.service.ts`,
--      `abtesting.service.ts`, `go-live.service.ts`, `intelligence.service.ts`. A second, parallel
--      credential table would fork that source of truth -- instead, this migration adds new
--      NULLABLE, OAuth-specific columns directly onto the EXISTING `tenants` row (see below), the
--      real row a later sprint's OAuth callback will populate.
--   3. The spec proposes `wa_connections`/`wa_conversations`/`wa_messages` tables. This codebase
--      already has a real, full WhatsApp connection (`waba_configs`, `007_tenants_waba.sql`) and
--      conversation/message pipeline (`@aos/lead-store`'s `leads`/`conversations`/`messages`,
--      backing Clara's real sales-agent flow via `modules/whatsapp-webhook`). This migration adds
--      new NULLABLE columns onto the EXISTING `waba_configs` row instead of forking that pipeline.
--   4. The spec proposes an `ai_leads` table. No lead FK is needed by anything in this migration --
--      not built.
--
-- WHY `tenants.meta_access_token` etc. are kept, untouched, alongside new OAuth-specific columns
-- (additive, not a replacement): `MetaAdsConnectorRegistry.resolve()` is used by many real,
-- already-working, already-audited callers this whole session -- replacing/renaming those columns
-- would break every one of them today, for a write-path (the OAuth callback) that doesn't exist
-- yet. The existing plain `meta_access_token` column also remains the real, explicit
-- manual-entry fallback path the user's own pasted spec (Prompt 9, "manual connection for existing
-- tenants") calls for -- a tenant that never runs OAuth keeps working exactly as it does today.
--
-- WHY a new `meta_access_token_encrypted` column (not encrypting the existing plain column in
-- place): the existing `meta_access_token` is the real, live, already-working manual-entry value
-- every current caller reads via `MetaAdsConnectorRegistry.resolve()` -- encrypting it in place
-- would require that registry to change (decrypt on every read) in the SAME migration that adds
-- the encryption capability, which is explicitly a later sprint's job once the OAuth write-path
-- exists to populate it. The new column holds ONLY an OAuth-obtained token, `EncryptionService`
-- (AES-256-GCM `"iv:authTag:encrypted"`)-encrypted at rest from day one, since it's written by a
-- real external OAuth exchange, never typed in by a human the way the manual token is.
--
-- WHY a new sibling table `system_meta_oauth_config` rather than extending
-- `system_webhook_config` (019_system_webhook_config.sql): investigated `system_webhook_config`'s
-- real real-world usage (`WebhookSecretsService`/`SystemWebhookConfigRepository`) before deciding.
-- `system_webhook_config` is scoped, by its own header comment, specifically to
-- "verify-token + app-secret pairs" for WEBHOOK SIGNATURE VERIFICATION (the shared secret every
-- inbound Meta/WhatsApp webhook request is HMAC-signed with) -- every column on it today is plain
-- TEXT, and its own tests/repository assume that. A Meta App's OAuth `client_id`/`client_secret`
-- (used for the real authorization-code exchange, a materially more sensitive, directly-usable
-- credential than a webhook verify secret) is a different domain, and `meta_app_secret` MUST be
-- `EncryptionService`-encrypted, which would introduce mixed plaintext/encrypted semantics onto a
-- table whose own established contract, tests, and real callers assume uniform plain TEXT. A new,
-- narrow sibling table -- same fixed-single-row `id = 'default'`, same
-- NULL-means-fall-back-to-.env convention, same repository/service SHAPE -- is the more honest,
-- less-invasive choice, and keeps `system_webhook_config`'s own existing contract completely
-- unchanged.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before any
-- of these new columns/tables can persist real rows. NOTHING in `apps/aaos-api/src` reads/writes
-- `oauth_states`/`token_refresh_log` yet, and NOTHING reads the new `tenants`/`waba_configs`
-- columns yet -- both are real, later-sprint's job (this migration is foundation only).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------------------------
-- 1. Global Meta App OAuth config -- single-row, superadmin-editable, mirrors
--    `system_webhook_config`'s exact shape/convention (see header note above for why this is a
--    sibling table, not an extension of that one).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_meta_oauth_config (
  id                          TEXT PRIMARY KEY DEFAULT 'default',
  meta_app_id                 TEXT,
  -- `EncryptionService`-produced "iv:authTag:encrypted" envelope -- NEVER a plaintext secret.
  meta_app_secret_encrypted   TEXT,
  -- WhatsApp Embedded Signup "Configuration ID" Meta issues per Meta App -- a later sprint's
  -- Embedded Signup flow needs it; stored here now so this table doesn't need a second migration
  -- just to add it.
  wa_config_id                TEXT,
  updated_at                  TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------------------------
-- 2. New, additive, nullable columns on the EXISTING `tenants` row -- a later sprint's OAuth
--    callback will populate these; `MetaAdsConnectorRegistry.resolve()` is NOT modified in this
--    sprint and does not read them yet.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS meta_access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS meta_token_expires_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_connection_source       TEXT NOT NULL DEFAULT 'manual'
    CHECK (meta_connection_source IN ('manual', 'oauth')),
  ADD COLUMN IF NOT EXISTS meta_fb_user_id              TEXT,
  ADD COLUMN IF NOT EXISTS meta_fb_user_name            TEXT;

-- ---------------------------------------------------------------------------------------------
-- 3. New, additive, nullable columns on the EXISTING `waba_configs` row -- a later sprint's
--    WhatsApp Embedded Signup flow will populate these; `WhatsAppConnectorRegistry.resolve()` is
--    NOT modified in this sprint and does not read them yet.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE waba_configs
  ADD COLUMN IF NOT EXISTS config_source          TEXT NOT NULL DEFAULT 'manual'
    CHECK (config_source IN ('manual', 'embedded_signup')),
  ADD COLUMN IF NOT EXISTS webhook_verified        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_verified_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fb_user_id              TEXT,
  ADD COLUMN IF NOT EXISTS fb_user_name            TEXT;

-- ---------------------------------------------------------------------------------------------
-- 4. `oauth_states` -- real, short-lived CSRF-protection state rows for a later sprint's real
--    OAuth callback (`state` round-tripped through Meta's authorization redirect, verified on
--    return). Real `tenant_id TEXT` convention (see header note #1), REFERENCES the real
--    `tenants.tenant_id` slug column, never `tenants.id`.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oauth_states (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  state            TEXT UNIQUE NOT NULL,
  redirect_after   TEXT,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_tenant   ON oauth_states(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires  ON oauth_states(expires_at);

-- Purely server-side CSRF bookkeeping -- no dashboard UI ever reads this table (unlike
-- `audit_log`/`market_signals`, which back a real manager-facing view), so RLS is enabled with
-- ZERO policies (deny-all to the anon/authenticated roles; the real writer,
-- `aaos-api`'s own service-role Supabase client, bypasses RLS the same way every other table's
-- writer in this app already does).
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------------------------
-- 5. `token_refresh_log` -- real audit trail for a later sprint's real Meta/WhatsApp token-refresh
--    job. RLS SHAPE copied exactly from `045_audit_log.sql`'s real, already-audited policy (same
--    `auth.jwt() -> 'user_metadata'` convention) since this table's real, natural real-world
--    consumer is the SAME tenant Settings page that would show "last refreshed" status.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS token_refresh_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL,

  connection_type  TEXT NOT NULL
                      CHECK (connection_type IN ('meta', 'wa')),

  success          BOOLEAN NOT NULL,
  error_message    TEXT,
  new_expires_at   TIMESTAMPTZ,

  refreshed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_refresh_log_tenant_refreshed
  ON token_refresh_log(tenant_id, refreshed_at DESC);

ALTER TABLE token_refresh_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_token_refresh_log" ON token_refresh_log
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );
