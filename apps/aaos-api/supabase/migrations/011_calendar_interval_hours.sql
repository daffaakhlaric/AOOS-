-- AAOS-ABTESTING-LOOKALIKE -- 011_calendar_interval_hours.sql
-- Extends `calendar_events` (006) with a real `"INTERVAL_HOURS"` recurrence step, needed by
-- `AB_TEST_CHECK` (coordinator note section 5): the spec asked for a 6-hour cadence, but the
-- existing `CalendarEventRecurrence` model only understood ONCE|DAILY|WEEKLY|MONTHLY with a real
-- ISO `scheduled_at` timestamp (never a cron-expression string). This is an additive extension,
-- not a rewrite -- `recurrence_interval_hours` is NULL for every existing DAILY/WEEKLY/MONTHLY row
-- and is only read by `SchedulerService.nextOccurrence()`'s new `"INTERVAL_HOURS"` case.
--
-- COLUMN-FOR-COLUMN CONTRACT with `CalendarEventRow` in
-- src/modules/scheduler/infrastructure/calendar-event.repository.ts.
--
-- NOT auto-applied by this repo's tooling -- run this (and 012_abtesting.sql, which seeds an
-- INTERVAL_HOURS row and therefore depends on this column existing first) against the real
-- Supabase project before AB_TEST_CHECK can be scheduled.

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_interval_hours INTEGER;
