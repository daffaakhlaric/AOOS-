-- AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG (Phase A) -- 020_tenant_mode.sql
-- Backs the new per-tenant, DB-driven DEV/LIVE mode gate (`modules/mode-guard`'s
-- `ModeGuardService`) and the tenant Settings page's new "Mode Operasi" card
-- (`modules/settings`'s `PATCH /api/v1/settings/mode`).
--
-- See docs/PROMPT-AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG.md, Phase A point 1, for the full reasoning
-- this migration follows column-for-column.
--
-- DEFAULT IS 'LIVE', NOT 'DEV', DELIBERATELY: `dss-motor` is a real, already-operating production
-- tenant (seeded by 007_tenants_waba.sql, status='ACTIVE') whose Samantha/Kai automation must not
-- silently go quiet the moment this migration runs. A brand-new tenant created via the Super Admin
-- panel can still be given `mode: 'DEV'` explicitly at INSERT time (see
-- `SuperadminService.create` in aaos-api) -- that is a separate, safe, application-level default
-- for genuinely new tenants, not this column's own DB default, which must preserve today's
-- behavior for every tenant that already exists.
--
-- COLUMN-FOR-COLUMN CONTRACT with `TenantRow` in
-- src/modules/superadmin/infrastructure/tenant.repository.ts. Any future column MUST be added
-- there in the same change.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `PATCH /api/v1/settings/mode` or `ModeGuardService.resolveMode` can read/write a real per-tenant
-- mode.

ALTER TABLE tenants
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'LIVE' CHECK (mode IN ('DEV', 'LIVE')),
  ADD COLUMN mode_changed_at TIMESTAMPTZ,
  ADD COLUMN mode_changed_by TEXT;

CREATE INDEX idx_tenants_mode ON tenants(mode);
