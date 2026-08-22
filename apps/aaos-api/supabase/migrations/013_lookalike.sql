-- AAOS-ABTESTING-LOOKALIKE Part 2 -- 013_lookalike.sql
-- Backs `modules/lookalike`'s LookalikeService/MetaAudienceRepository. Applied against the SAME
-- Supabase project every other AAOS table lives in (see app.module.ts's `SUPABASE_CLIENT`
-- wiring) -- same convention as 001-012: snake_case columns, `gen_random_uuid()` primary keys,
-- `TIMESTAMPTZ` timestamps.
--
-- This table lives HERE (in apps/aaos-api's own migration folder), not in any package --
-- `meta_audiences` is a new, aaos-api-owned concept with no real backing in any `@aos/*` package
-- (coordinator note section 7). The sibling `leads.synced_to_meta_audience`/`synced_at` columns
-- (owned by `@aos/lead-store`, since `leads` itself is) live instead in
-- packages/lead-store/supabase/migrations/006_lookalike_sync_fields.sql.
--
-- COLUMN-FOR-COLUMN CONTRACT with `MetaAudienceRow` in
-- src/modules/lookalike/infrastructure/meta-audience.repository.ts. Any future column MUST be
-- added there too.
--
-- Depends on 011_calendar_interval_hours.sql having already run (LOOKALIKE_SYNC below uses the
-- pre-existing "DAILY" recurrence -- no new recurrence type needed for this one, coordinator note
-- section 5).
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `LookalikeService`'s endpoints can persist/read real data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE meta_audiences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL DEFAULT 'dss-motor',
  meta_audience_id    TEXT NOT NULL UNIQUE,
  audience_type       TEXT NOT NULL, -- HOT_LEADS|LOOKALIKE_1PCT|LOOKALIKE_2PCT|LOOKALIKE_3PCT
  name                TEXT NOT NULL,
  size                INTEGER,       -- real, AAOS-tracked count (phone numbers uploaded so far)
  origin_audience_id  TEXT,          -- for a LOOKALIKE_* row: the parent HOT_LEADS meta_audience_id
  percentage          INTEGER,       -- for a LOOKALIKE_* row: 1, 2, or 3
  status              TEXT NOT NULL DEFAULT 'ACTIVE',
  last_updated_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meta_audiences_tenant ON meta_audiences(tenant_id);
CREATE INDEX idx_meta_audiences_type   ON meta_audiences(tenant_id, audience_type);

-- Seed the LOOKALIKE_SYNC Kalender event (coordinator note section 5) -- a normal "DAILY"
-- recurrence at 02:00, checked by the SAME generic `calendar_events` due-window cron every other
-- event type already uses (`SchedulerService.checkAndRunDueEvents`), not a second, parallel
-- `@Cron`. No new recurrence type needed for this one (unlike AB_TEST_CHECK's INTERVAL_HOURS).
INSERT INTO calendar_events
  (event_type, title, description, scheduled_at, recurrence, created_by)
VALUES
  ('LOOKALIKE_SYNC', 'Sync Hot Leads ke Meta', 'Upload hot leads baru ke Meta Custom Audience',
   (date_trunc('day', NOW()) + INTERVAL '1 day' + INTERVAL '2 hours'), 'DAILY', 'system');
