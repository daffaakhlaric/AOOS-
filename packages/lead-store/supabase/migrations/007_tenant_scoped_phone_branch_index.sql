-- AAOS Multi-Tenant Phase 1B -- 007_tenant_scoped_phone_branch_index.sql
-- Replaces `idx_leads_phone_branch` (001_initial_schema.sql: `UNIQUE(lead_phone, branch_id)`) with
-- a tenant-scoped `UNIQUE(tenant_id, lead_phone, branch_id)` index.
--
-- WHY: `BranchId` is a small, fixed, tenant-agnostic enum (BINTARO|CINERE|UMUM|BANDUNG). The
-- original index (and `CreateLead`'s idempotency check it backs, via `findByPhoneAndBranch`) was
-- only correct in a single-tenant world -- two DIFFERENT tenants both onboarding a lead with the
-- same phone number at, say, BINTARO would collide on the old unique constraint. This migration
-- (paired with the same-day `ILeadRepository` code change adding a required `tenantId` filter to
-- every real query method) makes both the lookup AND the uniqueness guarantee tenant-scoped.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- deploying the corresponding `@aos/lead-store` code change.

DROP INDEX IF EXISTS idx_leads_phone_branch;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_tenant_phone_branch
  ON leads(tenant_id, lead_phone, branch_id);
