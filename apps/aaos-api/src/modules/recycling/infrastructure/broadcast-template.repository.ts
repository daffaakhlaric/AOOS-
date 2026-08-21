import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "broadcast_templates";

/** Raw `broadcast_templates` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/010_recycling.sql`. */
export interface BroadcastTemplateRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly content: string;
  readonly target_statuses: readonly string[];
  readonly cooldown_days: number;
  readonly status: string;
  readonly reply_rate: number;
  readonly hot_rate: number;
  readonly sent_count: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export type BroadcastTemplateInsert = Omit<
  BroadcastTemplateRow,
  "id" | "reply_rate" | "hot_rate" | "sent_count" | "created_at" | "updated_at"
>;
export type BroadcastTemplateUpdate = Partial<
  Omit<BroadcastTemplateRow, "id" | "tenant_id" | "created_at">
>;

export class BroadcastTemplateRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `broadcast_templates` (TAB 2's "buat/edit template"), on the
 * same shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api`
 * repository uses — mirrors `TenantRepository`/`CalendarEventRepository`'s structure directly.
 */
export class BroadcastTemplateRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(values: BroadcastTemplateInsert): Promise<BroadcastTemplateRow> {
    const { data, error } = await this.client
      .from<BroadcastTemplateRow>(TABLE)
      .insert({ ...values, reply_rate: 0, hot_rate: 0, sent_count: 0 })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new BroadcastTemplateRepositoryError(
        `BroadcastTemplateRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async findById(id: string): Promise<BroadcastTemplateRow | undefined> {
    const { data, error } = await this.client
      .from<BroadcastTemplateRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new BroadcastTemplateRepositoryError(
        `BroadcastTemplateRepository.findById failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  async listByTenant(tenantId: string): Promise<readonly BroadcastTemplateRow[]> {
    const { data, error } = await this.client
      .from<BroadcastTemplateRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error !== null) {
      throw new BroadcastTemplateRepositoryError(
        `BroadcastTemplateRepository.listByTenant failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  async update(id: string, values: BroadcastTemplateUpdate): Promise<BroadcastTemplateRow> {
    const { data, error } = await this.client
      .from<BroadcastTemplateRow>(TABLE)
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new BroadcastTemplateRepositoryError(
        `BroadcastTemplateRepository.update failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  /** `sent_count += 1`, done as a read-then-write since the shared `SupabaseClientLike` port has no atomic increment op — an honest tradeoff at this app's traffic scale (same discipline `LeadsService.getMessages`'s in-memory pagination doc already establishes for this codebase). */
  async incrementSentCount(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (existing === undefined) {
      return;
    }
    const { error } = await this.client
      .from<BroadcastTemplateRow>(TABLE)
      .update({ sent_count: existing.sent_count + 1, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error !== null) {
      throw new BroadcastTemplateRepositoryError(
        `BroadcastTemplateRepository.incrementSentCount failed: ${error.message}`,
      );
    }
  }
}
