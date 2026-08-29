-- AAOS-KALENDER-AKTIVITAS -- 006_calendar_events.sql
-- Backs `modules/scheduler`'s "Kalender Aktivitas Samantha & Kai" widget (embedded in the real
-- Overview page, `apps/aaos-dashboard/src/components/dashboard/DashboardClient.tsx`) and its
-- `@nestjs/schedule`-driven cron runner (`SchedulerService.checkAndRunDueEvents`). Same shape
-- convention as 001-005 -- snake_case columns, `gen_random_uuid()` primary keys,
-- `TIMESTAMPTZ` timestamps, JSONB for the low-volume `metadata`/`result` blobs -- applied against
-- the SAME Supabase project every other AAOS table lives in (see app.module.ts's
-- `SUPABASE_CLIENT` wiring).
--
-- COLUMN-FOR-COLUMN CONTRACT with `CalendarEventRow` in
-- src/modules/scheduler/infrastructure/calendar-event.repository.ts. Any future column MUST be
-- added there in the same change.
--
-- SCOPE (see docs/PROMPT-AAOS-KALENDER-AKTIVITAS.md's COORDINATOR NOTE, section 1 -- read that
-- file for the full history): the spec proposed 14 schedulable `event_type` values. Only 5 are
-- actually implemented by `SchedulerService.executeEvent`'s switch statement in this pass --
-- `SCRAPER_RUN`, `SAMANTHA_PULL_DATA`, `SAMANTHA_ANALYZE`, `KAI_REFRESH_CHECK`, `DAILY_DIGEST`. The
-- other 9 (6 campaign-mutating types with no human-approval gate at execution time, plus 3 types
-- with zero real backing anywhere in this codebase) are never offered by "Tambah Jadwal" and have
-- no handler -- `event_type` is intentionally left as free TEXT rather than a Postgres CHECK/ENUM
-- constraint so a future pass can extend the supported set without a migration, but the
-- application layer never writes anything outside the 5 supported values, and a stray row with an
-- unsupported type is marked FAILED with an honest "event type tidak didukung" message rather than
-- silently ignored.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `POST /api/v1/calendar` can persist real rows, and before `checkAndRunDueEvents` has anything to
-- find.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE calendar_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL DEFAULT 'dss-motor',

  -- One of the 5 supported types (see header note above) -- validated by Zod at the API boundary
  -- (`CreateCalendarEventBodySchema`), not by a DB constraint.
  event_type        TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,

  scheduled_at      TIMESTAMPTZ NOT NULL,
  timezone          TEXT NOT NULL DEFAULT 'Asia/Jakarta',

  -- ONCE | DAILY | WEEKLY | MONTHLY
  recurrence        TEXT NOT NULL DEFAULT 'ONCE',
  -- ISO weekday numbers (1=Senin .. 7=Minggu), only meaningful when recurrence = 'WEEKLY'.
  recurrence_days   INTEGER[],
  -- "HH:mm" 24h, informational -- `scheduled_at` is what the cron actually reads.
  recurrence_time   TEXT,

  -- PENDING | RUNNING | DONE | FAILED | SKIPPED
  status            TEXT NOT NULL DEFAULT 'PENDING',
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  duration_ms       INTEGER,

  -- Optional real Meta/ad-account/campaign id this event targets, purely for display -- none of
  -- the 5 supported handlers currently require it (they operate tenant-wide), kept for a future
  -- per-campaign event type.
  target_id         TEXT,
  target_name       TEXT,

  metadata          JSONB,
  -- Real measured outcome of the run (`result.summary` + handler-specific counts), NULL until the
  -- event has actually executed. Never a fabricated/optimistic value.
  result            JSONB,
  error_message     TEXT,

  created_by        TEXT NOT NULL DEFAULT 'system',
  -- Self-reference to the event this row's recurrence generated FROM (see `scheduleNext`). No FK
  -- constraint -- the parent row is routine history and may be pruned independently.
  parent_event_id   UUID,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cal_tenant ON calendar_events(tenant_id);
CREATE INDEX idx_cal_sched  ON calendar_events(scheduled_at);
CREATE INDEX idx_cal_status ON calendar_events(status);
CREATE INDEX idx_cal_type   ON calendar_events(event_type);

-- Seed default events -- ONLY the 4 seed rows whose event_type is one of the 5 supported types
-- (coordinator note section 1: `PERFORMANCE_REVIEW`/`BUDGET_CHECK` have no real backing anywhere
-- in this codebase, and `CAMPAIGN_BUDGET_UPDATE` is a campaign-mutating type excluded per the
-- user's round-1 "cuma yang aman dulu" decision -- none of the three is seeded here).
INSERT INTO calendar_events
  (event_type, title, description, scheduled_at, recurrence, recurrence_days, recurrence_time, created_by)
VALUES
  ('TAMARA_ANALYZE',   'Tamara Analisa Campaign', 'Analisa harian semua kampanye aktif',
   (CURRENT_DATE + TIME '06:00:00')::timestamptz, 'DAILY', NULL, '06:00', 'system'),
  ('DAILY_DIGEST',     'Daily Digest',            'Ringkasan performa harian Tamara',
   (CURRENT_DATE + TIME '06:00:00')::timestamptz, 'DAILY', NULL, '06:00', 'system'),
  ('TAMARA_PULL_DATA', 'Tarik Data Meta Ads',     'Sinkronisasi data iklan terbaru dari Meta',
   (CURRENT_DATE + TIME '06:30:00')::timestamptz, 'DAILY', NULL, '06:30', 'system'),
  ('KAI_REFRESH_CHECK','Kai Refresh Check',       'Cek iklan jenuh -> brief ke Kai',
   (CURRENT_DATE + TIME '08:00:00')::timestamptz, 'WEEKLY', ARRAY[1], '08:00', 'system');
