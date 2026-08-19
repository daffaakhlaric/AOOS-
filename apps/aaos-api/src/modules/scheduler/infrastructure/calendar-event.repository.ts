import type { SupabaseClientLike } from "@aos/lead-store";

import type {
  CalendarEventRecurrence,
  CalendarEventResult,
  CalendarEventStatus,
  StoredCalendarEvent,
} from "../domain/calendar-event.js";

const TABLE = "calendar_events";

/** Raw `calendar_events` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/006_calendar_events.sql`. */
export interface CalendarEventRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly event_type: string;
  readonly title: string;
  readonly description: string | null;
  readonly scheduled_at: string;
  readonly timezone: string;
  readonly recurrence: string;
  readonly recurrence_days: number[] | null;
  readonly recurrence_time: string | null;
  readonly status: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly duration_ms: number | null;
  readonly target_id: string | null;
  readonly target_name: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly result: CalendarEventResult | null;
  readonly error_message: string | null;
  readonly created_by: string;
  readonly parent_event_id: string | null;
  readonly created_at: string;
}

export class CalendarEventRepositoryError extends Error {}

function toDomain(row: CalendarEventRow): StoredCalendarEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    eventType: row.event_type,
    title: row.title,
    ...(row.description !== null ? { description: row.description } : {}),
    scheduledAt: row.scheduled_at,
    timezone: row.timezone,
    recurrence: row.recurrence as CalendarEventRecurrence,
    ...(row.recurrence_days !== null ? { recurrenceDays: row.recurrence_days } : {}),
    ...(row.recurrence_time !== null ? { recurrenceTime: row.recurrence_time } : {}),
    status: row.status as CalendarEventStatus,
    ...(row.started_at !== null ? { startedAt: row.started_at } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at } : {}),
    ...(row.duration_ms !== null ? { durationMs: row.duration_ms } : {}),
    ...(row.target_id !== null ? { targetId: row.target_id } : {}),
    ...(row.target_name !== null ? { targetName: row.target_name } : {}),
    ...(row.metadata !== null ? { metadata: row.metadata } : {}),
    ...(row.result !== null ? { result: row.result } : {}),
    ...(row.error_message !== null ? { errorMessage: row.error_message } : {}),
    createdBy: row.created_by,
    ...(row.parent_event_id !== null ? { parentEventId: row.parent_event_id } : {}),
    createdAt: row.created_at,
  };
}

export interface CreateCalendarEventInput {
  readonly id: string;
  readonly tenantId: string;
  readonly eventType: string;
  readonly title: string;
  readonly description?: string;
  readonly scheduledAt: string;
  readonly timezone?: string;
  readonly recurrence: CalendarEventRecurrence;
  readonly recurrenceDays?: readonly number[];
  readonly recurrenceTime?: string;
  readonly targetId?: string;
  readonly targetName?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: string;
  readonly parentEventId?: string;
}

export interface UpdateCalendarEventInput {
  readonly title?: string;
  readonly description?: string;
  readonly scheduledAt?: string;
  readonly recurrence?: CalendarEventRecurrence;
  readonly recurrenceDays?: readonly number[];
  readonly recurrenceTime?: string;
  readonly metadata?: Record<string, unknown>;
}

/** A `SupabaseClientLike`-typed value whose real underlying object (see `app.module.ts`'s `SUPABASE_CLIENT` wiring — the real `@supabase/supabase-js` client bridged at that one composition boundary) also supports `.delete()`. `SupabaseClientLike` (`@aos/lead-store`'s shared port) deliberately does not declare `.delete()` — no repository needed it before this one — so this one extra capability is reached via a local, `unknown`-mediated cast confined to this file, the same discipline `SupabaseClient.ts` itself uses for its one cast. Widening the shared cross-package port for one repository's one method would be a bigger change than this narrow, well-documented workaround. */
interface DeletableSupabaseClient {
  from(table: string): {
    delete(): {
      eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

/**
 * Supabase-backed persistence for `calendar_events` (AAOS-KALENDER-AKTIVITAS), on the same shared
 * `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api` repository uses —
 * one Supabase client for the whole app, not a second connection. Structurally mirrors
 * `modules/meta-interests/infrastructure/meta-interest.repository.ts` and
 * `modules/scraper/infrastructure/scrape-job.repository.ts`.
 */
export class CalendarEventRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(input: CreateCalendarEventInput): Promise<StoredCalendarEvent> {
    const { data, error } = await this.client
      .from<CalendarEventRow>(TABLE)
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        event_type: input.eventType,
        title: input.title,
        description: input.description ?? null,
        scheduled_at: input.scheduledAt,
        timezone: input.timezone ?? "Asia/Jakarta",
        recurrence: input.recurrence,
        recurrence_days: input.recurrenceDays !== undefined ? [...input.recurrenceDays] : null,
        recurrence_time: input.recurrenceTime ?? null,
        status: "PENDING",
        target_id: input.targetId ?? null,
        target_name: input.targetName ?? null,
        metadata: input.metadata ?? null,
        created_by: input.createdBy ?? "system",
        parent_event_id: input.parentEventId ?? null,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new CalendarEventRepositoryError(
        `CalendarEventRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return toDomain(data);
  }

  async findById(id: string): Promise<StoredCalendarEvent | undefined> {
    const { data, error } = await this.client
      .from<CalendarEventRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new CalendarEventRepositoryError(
        `CalendarEventRepository.findById failed: ${error.message}`,
      );
    }
    return data === null ? undefined : toDomain(data);
  }

  /** Every event for a tenant scheduled within `[fromIso, toIso]` inclusive, earliest first — backs `GET /api/v1/calendar?range=`/`?month=`. */
  async listByRange(
    tenantId: string,
    fromIso: string,
    toIso: string,
  ): Promise<readonly StoredCalendarEvent[]> {
    const { data, error } = await this.client
      .from<CalendarEventRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", fromIso)
      .lte("scheduled_at", toIso)
      .order("scheduled_at", { ascending: true })
      .limit(500);
    if (error !== null) {
      throw new CalendarEventRepositoryError(
        `CalendarEventRepository.listByRange failed: ${error.message}`,
      );
    }
    return (data ?? []).map(toDomain);
  }

  /** `PENDING` events due to run — the cron's own read (`scheduled_at` within the last minute, per `SchedulerService.checkAndRunDueEvents`). */
  async listDuePending(
    tenantId: string,
    fromIso: string,
    toIso: string,
  ): Promise<readonly StoredCalendarEvent[]> {
    const { data, error } = await this.client
      .from<CalendarEventRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "PENDING")
      .gte("scheduled_at", fromIso)
      .lte("scheduled_at", toIso)
      .order("scheduled_at", { ascending: true })
      .limit(200);
    if (error !== null) {
      throw new CalendarEventRepositoryError(
        `CalendarEventRepository.listDuePending failed: ${error.message}`,
      );
    }
    return (data ?? []).map(toDomain);
  }

  async update(id: string, input: UpdateCalendarEventInput): Promise<void> {
    const values: Partial<CalendarEventRow> = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.scheduledAt !== undefined ? { scheduled_at: input.scheduledAt } : {}),
      ...(input.recurrence !== undefined ? { recurrence: input.recurrence } : {}),
      ...(input.recurrenceDays !== undefined ? { recurrence_days: [...input.recurrenceDays] } : {}),
      ...(input.recurrenceTime !== undefined ? { recurrence_time: input.recurrenceTime } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    };
    const { error } = await this.client.from<CalendarEventRow>(TABLE).update(values).eq("id", id);
    if (error !== null) {
      throw new CalendarEventRepositoryError(
        `CalendarEventRepository.update failed: ${error.message}`,
      );
    }
  }

  async delete(id: string): Promise<void> {
    const client = this.client as unknown as DeletableSupabaseClient;
    const { error } = await client.from(TABLE).delete().eq("id", id);
    if (error !== null) {
      throw new CalendarEventRepositoryError(
        `CalendarEventRepository.delete failed: ${error.message}`,
      );
    }
  }

  async markRunning(id: string, startedAt: string): Promise<void> {
    const { error } = await this.client
      .from<CalendarEventRow>(TABLE)
      .update({ status: "RUNNING", started_at: startedAt })
      .eq("id", id);
    if (error !== null) {
      throw new CalendarEventRepositoryError(
        `CalendarEventRepository.markRunning failed: ${error.message}`,
      );
    }
  }

  async markDone(
    id: string,
    completedAt: string,
    durationMs: number,
    result: CalendarEventResult,
  ): Promise<void> {
    const { error } = await this.client
      .from<CalendarEventRow>(TABLE)
      .update({ status: "DONE", completed_at: completedAt, duration_ms: durationMs, result })
      .eq("id", id);
    if (error !== null) {
      throw new CalendarEventRepositoryError(
        `CalendarEventRepository.markDone failed: ${error.message}`,
      );
    }
  }

  async markFailed(
    id: string,
    completedAt: string,
    durationMs: number,
    errorMessage: string,
  ): Promise<void> {
    const { error } = await this.client
      .from<CalendarEventRow>(TABLE)
      .update({
        status: "FAILED",
        completed_at: completedAt,
        duration_ms: durationMs,
        error_message: errorMessage,
      })
      .eq("id", id);
    if (error !== null) {
      throw new CalendarEventRepositoryError(
        `CalendarEventRepository.markFailed failed: ${error.message}`,
      );
    }
  }

  async markSkipped(id: string): Promise<void> {
    const { error } = await this.client
      .from<CalendarEventRow>(TABLE)
      .update({ status: "SKIPPED" })
      .eq("id", id);
    if (error !== null) {
      throw new CalendarEventRepositoryError(
        `CalendarEventRepository.markSkipped failed: ${error.message}`,
      );
    }
  }
}
