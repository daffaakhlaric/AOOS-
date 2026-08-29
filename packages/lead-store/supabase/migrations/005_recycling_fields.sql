-- AAOS-LEAD-RECYCLING-BROADCAST -- 005_recycling_fields.sql
-- Additive columns on `leads` for Clara's Lead Recycling & Broadcast feature
-- (docs/PROMPT-AAOS-LEAD-RECYCLING-BROADCAST.md). Lives HERE, in @aos/lead-store's own migration
-- folder, not apps/aaos-api/supabase/migrations -- per the coordinator note's section 1: `leads`
-- itself (and every column on it) is owned by @aos/lead-store, exactly like 001-004 before it.
-- The two brand-new tables this feature needs (`broadcast_templates`, `broadcast_logs`) are NOT
-- here -- they're conceptually owned by `apps/aaos-api`'s new `RecyclingService`/`recycling`
-- module (the only thing that ever reads/writes them), so they live in
-- apps/aaos-api/supabase/migrations/010_recycling.sql instead, even though `broadcast_logs.lead_id`
-- FK-references this table's `leads(id)` -- both migration sets are applied against the SAME
-- Supabase project (no cross-database FK issue), and this repo has no single unified migration
-- runner spanning both folders (each package/app applies its own migrations independently, per
-- existing precedent -- e.g. apps/aaos-api's own 001-009 already assume `leads` exists from this
-- package's 001, without importing/copying its DDL).
--
-- COLUMN-FOR-COLUMN CONTRACT with `LeadRow` in src/infrastructure/mappers/LeadMapper.ts. Any
-- future column MUST be added there in the same change.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `RecyclingService`'s pool/broadcast-send/reply-detection code path can persist real values.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS
  broadcast_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS
  last_broadcast_at TIMESTAMPTZ;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS
  last_broadcast_template_id UUID;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS
  recycling_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_recycling
  ON leads(tenant_id, status, recycling_archived);
