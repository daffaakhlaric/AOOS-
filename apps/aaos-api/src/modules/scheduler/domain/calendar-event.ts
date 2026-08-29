/**
 * Domain shape for one stored `calendar_events` row (AAOS-KALENDER-AKTIVITAS). Kept in one small
 * self-contained file with no upstream `@aos/*` package entity of its own, mirroring
 * `modules/scraper`/`modules/meta-interests`'s precedent for a module whose domain is purely a
 * persisted row, not a wrapped package aggregate.
 *
 * SCOPE (see `docs/PROMPT-AAOS-KALENDER-AKTIVITAS.md`'s COORDINATOR NOTE section 1): only 5 of
 * the spec's 14 proposed event types are implemented in this pass — `CalendarEventType` below is
 * intentionally narrower than the spec's own `CalendarEventType` union. The 9 excluded types (6
 * campaign-mutating types with no human-approval gate at execution time, plus 3 types with zero
 * real backing anywhere in this codebase) are never selectable and have no `executeEvent()`
 * handler.
 *
 * `RECYCLING_RUN` was added by AAOS-LEAD-RECYCLING-BROADCAST (coordinator note section 7) — the
 * REAL mechanism for Clara's daily auto-recycling broadcast is this existing due-window cron, not
 * a second, parallel `@Cron`.
 *
 * `AB_TEST_CHECK` was added by AAOS-ABTESTING-LOOKALIKE Part 1 (coordinator note section 5) —
 * monitors running A/B tests and launches DRAFT ones whose creative packages finished generating.
 * It is the first event type to use the new `"INTERVAL_HOURS"` recurrence below (real 6-hour
 * cadence, matching the spec's own "every 6 hours" cron intent without faking a cron-expression
 * `scheduled_at`).
 *
 * `LOOKALIKE_SYNC` was added by AAOS-ABTESTING-LOOKALIKE Part 2 (coordinator note section 5) —
 * uploads newly-HOT leads' phone numbers into the tenant's Meta Custom Audience. Uses a normal
 * `"DAILY"` recurrence (seeded at 02:00) — no new recurrence type needed for this one.
 *
 * `SAMANTHA_INTELLIGENCE_REFRESH` was added by AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4 (coordinator
 * note section 7) — runs `IntelligenceService.refresh()`: aggregates the 5 real signal services
 * (seasonal/trends/competitor/inventory/lead/closing) and synthesizes a campaign strategy via
 * `LlmService.campaignStrategy`, persisting the result to `intelligence_signals`. Uses a normal
 * `"DAILY"` recurrence (seeded at 06:00) — no new recurrence type needed for this one, same choice
 * as `LOOKALIKE_SYNC`.
 *
 * AGENT RENAME (Phase 7, Tamara→Samantha / Jessy→Clara): `TAMARA_PULL_DATA`/`TAMARA_ANALYZE`/
 * `TAMARA_INTELLIGENCE_REFRESH` are kept below, permanently, alongside their new
 * `SAMANTHA_*`-prefixed equivalents — real `calendar_events` rows already seeded by
 * `006_calendar_events.sql`'s (and `016_intelligence.sql`'s) historical `INSERT` statements still
 * carry the OLD literal `event_type` string values, and that historical SQL is never rewritten.
 * `SchedulerService.executeEvent`'s switch recognizes both spellings for each pair (routing to the
 * same handler); only new event types created going forward should use the `SAMANTHA_*` spelling —
 * same backward-compat discipline as `@aos/lead-store`'s `MessageSenderType` keeping `"JESSY"`.
 */
export const SUPPORTED_CALENDAR_EVENT_TYPES = [
  "SCRAPER_RUN",
  "TAMARA_PULL_DATA",
  "SAMANTHA_PULL_DATA",
  "TAMARA_ANALYZE",
  "SAMANTHA_ANALYZE",
  "KAI_REFRESH_CHECK",
  "DAILY_DIGEST",
  "RECYCLING_RUN",
  "AB_TEST_CHECK",
  "LOOKALIKE_SYNC",
  "TAMARA_INTELLIGENCE_REFRESH",
  "SAMANTHA_INTELLIGENCE_REFRESH",
] as const;

export type CalendarEventType = (typeof SUPPORTED_CALENDAR_EVENT_TYPES)[number];

export function isSupportedCalendarEventType(value: string): value is CalendarEventType {
  return (SUPPORTED_CALENDAR_EVENT_TYPES as readonly string[]).includes(value);
}

export type CalendarEventStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";
/**
 * `"INTERVAL_HOURS"` was added by AAOS-ABTESTING-LOOKALIKE (coordinator note section 5) — a real,
 * additive extension for event types that need to recur every N hours (e.g. `AB_TEST_CHECK` every
 * 6 hours), rather than once a day/week/month. `scheduled_at` stays a real ISO timestamp — never a
 * cron-expression string — and `recurrenceIntervalHours` below carries the "every N hours" step,
 * read by `SchedulerService.nextOccurrence()`'s new `"INTERVAL_HOURS"` case.
 */
export type CalendarEventRecurrence = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "INTERVAL_HOURS";

/** Real, handler-reported outcome of one executed event — never a fabricated/optimistic value. */
export interface CalendarEventResult {
  readonly summary: string;
  readonly [key: string]: unknown;
}

export interface StoredCalendarEvent {
  readonly id: string;
  readonly tenantId: string;
  /**
   * Free-form `string` rather than `CalendarEventType`: a row's `event_type` is validated to be a
   * supported type at the `POST`/`PUT` API boundary (`CreateCalendarEventBodySchema`), but this
   * domain type must still be able to represent — and `SchedulerService.executeEvent` must still
   * be able to safely reject — a stray unsupported value already sitting in the table (e.g. from
   * an older seed, or written directly against Supabase), per coordinator note section 1's "mark
   * it FAILED with a clear message" requirement.
   */
  readonly eventType: string;
  readonly title: string;
  readonly description?: string;
  readonly scheduledAt: string;
  readonly timezone: string;
  readonly recurrence: CalendarEventRecurrence;
  readonly recurrenceDays?: readonly number[];
  readonly recurrenceTime?: string;
  /** Only meaningful when `recurrence === "INTERVAL_HOURS"` — the real "every N hours" step. */
  readonly recurrenceIntervalHours?: number;
  readonly status: CalendarEventStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly targetId?: string;
  readonly targetName?: string;
  readonly metadata?: Record<string, unknown>;
  readonly result?: CalendarEventResult;
  readonly errorMessage?: string;
  readonly createdBy: string;
  readonly parentEventId?: string;
  readonly createdAt: string;
}
