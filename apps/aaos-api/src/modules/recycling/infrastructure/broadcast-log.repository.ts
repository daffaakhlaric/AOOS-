import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "broadcast_logs";

/** Raw `broadcast_logs` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/010_recycling.sql`. */
export interface BroadcastLogRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly lead_id: string;
  readonly template_id: string | null;
  readonly message_sent: string;
  readonly status: string;
  readonly sent_at: string;
  readonly delivered_at: string | null;
  readonly read_at: string | null;
  readonly replied: boolean;
  readonly replied_at: string | null;
  readonly converted_to_hot: boolean;
  readonly converted_at: string | null;
}

export type BroadcastLogInsert = Omit<
  BroadcastLogRow,
  | "id"
  | "status"
  | "sent_at"
  | "delivered_at"
  | "read_at"
  | "replied"
  | "replied_at"
  | "converted_to_hot"
  | "converted_at"
>;

export class BroadcastLogRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `broadcast_logs` (TAB 3's Riwayat Broadcast + the reply-
 * detection hook's write path), on the same shared `SupabaseClientLike` port + `SUPABASE_CLIENT`
 * DI token every other `aaos-api` repository uses.
 */
export class BroadcastLogRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(values: BroadcastLogInsert): Promise<BroadcastLogRow> {
    const { data, error } = await this.client
      .from<BroadcastLogRow>(TABLE)
      .insert({
        ...values,
        status: "SENT",
        delivered_at: null,
        read_at: null,
        replied: false,
        replied_at: null,
        converted_to_hot: false,
        converted_at: null,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new BroadcastLogRepositoryError(
        `BroadcastLogRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async listByTenant(tenantId: string, limit = 200): Promise<readonly BroadcastLogRow[]> {
    const { data, error } = await this.client
      .from<BroadcastLogRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sent_at", { ascending: false })
      .limit(limit);
    if (error !== null) {
      throw new BroadcastLogRepositoryError(
        `BroadcastLogRepository.listByTenant failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  /** Every log for one lead, most recent first — the reply-detection hook's "find the most recent un-replied broadcast" read. */
  async listByLead(leadId: string): Promise<readonly BroadcastLogRow[]> {
    const { data, error } = await this.client
      .from<BroadcastLogRow>(TABLE)
      .select("*")
      .eq("lead_id", leadId)
      .order("sent_at", { ascending: false });
    if (error !== null) {
      throw new BroadcastLogRepositoryError(
        `BroadcastLogRepository.listByLead failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  /** Marks one log row `replied = true, replied_at = repliedAtIso` — the reply-detection hook's ONLY write to this table (never touches `converted_to_hot`, per coordinator note section 9). */
  async markReplied(id: string, repliedAtIso: string): Promise<void> {
    const { error } = await this.client
      .from<BroadcastLogRow>(TABLE)
      .update({ replied: true, replied_at: repliedAtIso })
      .eq("id", id);
    if (error !== null) {
      throw new BroadcastLogRepositoryError(
        `BroadcastLogRepository.markReplied failed: ${error.message}`,
      );
    }
  }
}
