import { randomUUID } from "node:crypto";

import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "agent_activities";

/** A single real tool call `ActivityLogger.logToolCall` appended to `tool_calls` (JSONB array). */
export interface ActivityToolCallEntry {
  readonly tool: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly at: string;
}

/** Raw `agent_activities` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/021_agent_activities.sql`. */
export interface ActivityRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly loop_id: string | null;
  readonly agent: string;
  readonly action_type: string;
  readonly mode: string;
  readonly status: string;
  readonly input: unknown;
  readonly output: unknown;
  readonly dev_preview: unknown;
  readonly reasoning: string | null;
  readonly tool_calls: readonly ActivityToolCallEntry[];
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly duration_ms: number | null;
  readonly error_message: string | null;
  readonly error_stack: string | null;
  readonly created_at: string;
}

/** `id` is deliberately excluded — `ActivityRepository.insert` generates it app-side via `randomUUID()`, same real precedent `CreativeLogRepository.append` already establishes for this app's own `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` columns (the DB default exists for direct-SQL inserts; every real application insert path generates and returns its own id up front instead). */
export type ActivityInsert = Omit<
  ActivityRow,
  "id" | "created_at" | "completed_at" | "duration_ms" | "error_message" | "error_stack"
> &
  Partial<Pick<ActivityRow, "completed_at" | "duration_ms" | "error_message" | "error_stack">>;

export type ActivityUpdate = Partial<Omit<ActivityRow, "id" | "tenant_id" | "created_at">>;

export interface ActivityListFilter {
  readonly agent?: string;
  readonly status?: string;
  readonly mode?: string;
  readonly limit?: number;
}

export class ActivityRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `agent_activities` (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B).
 * Built on the same shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other
 * `aaos-api` repository uses — see `TenantRepository`/`ListingRepository` for the precedent this
 * mirrors. Every read is explicitly tenant-scoped (never relies on the column's
 * `DEFAULT 'dss-motor'`), same discipline `ListingRepository`'s own docstring establishes.
 */
export class ActivityRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(values: ActivityInsert): Promise<ActivityRow> {
    const row: ActivityRow = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      completed_at: null,
      duration_ms: null,
      error_message: null,
      error_stack: null,
      ...values,
    };
    const { data, error } = await this.client
      .from<ActivityRow>(TABLE)
      .insert(row)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new ActivityRepositoryError(
        `ActivityRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async updateById(id: string, values: ActivityUpdate): Promise<ActivityRow> {
    const { data, error } = await this.client
      .from<ActivityRow>(TABLE)
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new ActivityRepositoryError(
        `ActivityRepository.updateById failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async findById(id: string): Promise<ActivityRow | undefined> {
    const { data, error } = await this.client
      .from<ActivityRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new ActivityRepositoryError(`ActivityRepository.findById failed: ${error.message}`);
    }
    return data ?? undefined;
  }

  /**
   * `GET /api/v1/activity-log` — tenant-scoped list, most-recent-first, filtered by `agent`/
   * `status`/`mode` when the caller passes any. `limit` defaults to 100 (dashboard's real page
   * size), applied AFTER the `eq(...)` filters so it caps the filtered result, not the whole
   * table — same ordering `ListingRepository`'s own `.list()` establishes.
   */
  async list(tenantId: string, filter: ActivityListFilter = {}): Promise<readonly ActivityRow[]> {
    let query = this.client.from<ActivityRow>(TABLE).select("*").eq("tenant_id", tenantId);
    if (filter.agent !== undefined) {
      query = query.eq("agent", filter.agent);
    }
    if (filter.status !== undefined) {
      query = query.eq("status", filter.status);
    }
    if (filter.mode !== undefined) {
      query = query.eq("mode", filter.mode);
    }
    query = query.order("created_at", { ascending: false }).limit(filter.limit ?? 100);
    const { data, error } = await query;
    if (error !== null) {
      throw new ActivityRepositoryError(`ActivityRepository.list failed: ${error.message}`);
    }
    return data ?? [];
  }
}
