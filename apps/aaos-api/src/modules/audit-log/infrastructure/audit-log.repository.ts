import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "audit_log";

/**
 * Raw `audit_log` row shape (snake_case) — COLUMN-FOR-COLUMN with
 * `supabase/migrations/045_audit_log.sql`. Any future column MUST be added in both files in the
 * same change (same discipline `PendingActionRow`/`LearningProposalRow` document on themselves).
 */
export interface AuditLogRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly agent: string;
  readonly action_type: string;
  readonly before_state: unknown;
  readonly after_state: unknown;
  readonly decided_by: "ai_auto" | "user_manual";
  readonly user_id: string | null;
  readonly mode: "DEV" | "LIVE";
  readonly related_verdict_id: string | null;
  readonly related_brief_id: string | null;
  readonly reversible: boolean;
  readonly created_at: string;
}

export interface CreateAuditLogInput {
  readonly tenantId: string;
  readonly agent: string;
  readonly actionType: string;
  readonly beforeState?: unknown;
  readonly afterState?: unknown;
  readonly decidedBy: "ai_auto" | "user_manual";
  readonly userId?: string;
  readonly mode: "DEV" | "LIVE";
  readonly relatedVerdictId?: string;
  readonly relatedBriefId?: string;
  readonly reversible: boolean;
}

export class AuditLogRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `audit_log` (AAOS LOOP UPGRADE, Sprint 6 Prompt 17). Built on the
 * same shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api`
 * repository uses — mirrors `PendingActionRepository`/`LearningProposalRepository` column-for-column.
 */
export class AuditLogRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(input: CreateAuditLogInput): Promise<AuditLogRow> {
    const { data, error } = await this.client
      .from<AuditLogRow>(TABLE)
      .insert({
        tenant_id: input.tenantId,
        agent: input.agent,
        action_type: input.actionType,
        before_state: input.beforeState ?? null,
        after_state: input.afterState ?? null,
        decided_by: input.decidedBy,
        user_id: input.userId ?? null,
        mode: input.mode,
        related_verdict_id: input.relatedVerdictId ?? null,
        related_brief_id: input.relatedBriefId ?? null,
        reversible: input.reversible,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new AuditLogRepositoryError(
        `AuditLogRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async findById(tenantId: string, id: string): Promise<AuditLogRow | undefined> {
    const { data, error } = await this.client
      .from<AuditLogRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new AuditLogRepositoryError(`AuditLogRepository.findById failed: ${error.message}`);
    }
    return data ?? undefined;
  }

  /** Newest-first, optionally filtered by real `agent` — the real Audit tab's list source. */
  async listForTenant(
    tenantId: string,
    options: { readonly agent?: string; readonly limit?: number } = {},
  ): Promise<readonly AuditLogRow[]> {
    let query = this.client.from<AuditLogRow>(TABLE).select("*").eq("tenant_id", tenantId);
    if (options.agent !== undefined) {
      query = query.eq("agent", options.agent);
    }
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 200);
    if (error !== null) {
      throw new AuditLogRepositoryError(
        `AuditLogRepository.listForTenant failed: ${error.message}`,
      );
    }
    return data ?? [];
  }
}
