-- AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY (Phase 1) -- 007_tenants_waba.sql
-- Backs the new `modules/superadmin` (Super Admin panel: tenant CRUD + impersonate) and
-- `modules/settings` (tenant Settings page: Meta Ads Configuration + WABA cards) in
-- apps/aaos-api. Same shape convention as 001-006 -- snake_case columns, `gen_random_uuid()`
-- primary keys, `TIMESTAMPTZ` timestamps -- applied against the SAME Supabase project every
-- other AAOS table lives in (see app.module.ts's `SUPABASE_CLIENT` wiring).
--
-- COORDINATOR NOTE (docs/PROMPT-AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY.md), section 1: the raw
-- spec's Part 8 also proposed a `tenant_admins` table (email/password_hash/role) for a custom
-- bcrypt+JWT auth system. That table is DELIBERATELY NOT created here -- a tenant admin is a
-- real Supabase Auth user (`auth.users`, provisioned via `supabase.auth.admin.createUser`,
-- mirroring `modules/sales`'s `SalesHumansService`/AAOS-SALES-MGMT-CRM-AUTH pattern) with
-- `user_metadata: { tenantId, vertical, role: 'manager' | 'owner' }`. No email/password ever
-- lands in a table this app owns.
--
-- COLUMN-FOR-COLUMN CONTRACT with `TenantRow` in
-- src/modules/superadmin/infrastructure/tenant.repository.ts and `WabaConfigRow` in
-- src/modules/settings/infrastructure/waba-config.repository.ts. Any future column MUST be
-- added there in the same change.
--
-- SCOPE: Phase 1 only (see coordinator note section 7). `listings` (Property vertical) is
-- Phase 2, not created here. Existing tables (`leads`, `conversations`, etc.) already carry a
-- `tenant_id TEXT NOT NULL DEFAULT 'dss-motor'` column (coordinator note section 2) -- wiring
-- every repository to read the real tenant id from the authenticated session instead of relying
-- on that default is Phase 1b/ongoing hardening, not part of this migration.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `POST /api/v1/superadmin/tenants` or `GET/POST /api/v1/settings/waba` can persist real rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,

  -- AUTOMOTIVE | PROPERTY. Free TEXT (not a CHECK/ENUM) so Phase 2's PROPERTY vertical work
  -- doesn't need a schema change -- validated by Zod at the API boundary
  -- (`CreateTenantBodySchema`), matching `calendar_events.event_type`'s precedent.
  vertical            TEXT NOT NULL DEFAULT 'AUTOMOTIVE',

  -- TRIAL | ACTIVE | SUSPENDED.
  status              TEXT NOT NULL DEFAULT 'TRIAL',
  trial_ends_at       TIMESTAMPTZ,

  -- Per-tenant Meta Ads override (coordinator note section 4). NULL means "use this deployment's
  -- META_ACCESS_TOKEN/META_AD_ACCOUNT_IDS/META_API_VERSION env-var default" -- see
  -- `to-connector-config.ts`'s per-call override path. Never returned raw to the Super Admin
  -- panel (masked in `TenantResponseDto`); the tenant's OWN `/settings` page may show/edit its
  -- own token.
  meta_access_token   TEXT,
  meta_ad_account_id  TEXT,
  meta_api_version    TEXT DEFAULT 'v21.0',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_status   ON tenants(status);
CREATE INDEX idx_tenants_vertical ON tenants(vertical);

CREATE TABLE waba_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  branch_id         TEXT NOT NULL,
  phone_number      TEXT NOT NULL,
  waba_id           TEXT NOT NULL,
  phone_number_id   TEXT NOT NULL,
  access_token      TEXT NOT NULL,

  -- ACTIVE | INACTIVE. Set by the tenant's own "Test" action failing/succeeding, or manually.
  status            TEXT NOT NULL DEFAULT 'ACTIVE',
  last_tested_at    TIMESTAMPTZ,
  last_test_result  TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, branch_id)
);

CREATE INDEX idx_waba_tenant ON waba_configs(tenant_id);

-- Seed the real, already-live `dss-motor` tenant so every pre-existing row's
-- `tenant_id TEXT NOT NULL DEFAULT 'dss-motor'` default resolves to a real `tenants` row once
-- Phase 1b starts enforcing the FK/lookup -- this migration itself does not add that FK to the
-- pre-existing tables (out of scope, see header note), but seeding this row now means Phase 1b
-- doesn't need a second migration just to backfill it.
INSERT INTO tenants (tenant_id, name, vertical, status)
VALUES ('dss-motor', 'DSS Motor (Mobix)', 'AUTOMOTIVE', 'ACTIVE')
ON CONFLICT (tenant_id) DO NOTHING;
