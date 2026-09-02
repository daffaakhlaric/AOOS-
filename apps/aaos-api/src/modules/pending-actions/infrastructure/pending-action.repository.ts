import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "pending_agent_actions";

/**
 * Raw `pending_agent_actions` row shape (snake_case) — COLUMN-FOR-COLUMN with
 * `supabase/migrations/031_operating_mode.sql`. Any future column MUST be added in both files in
 * the same change (same discipline `TenantRow`/`LearningProposalRow` document on themselves).
 */
export interface PendingActionRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly agent: string;
  readonly action_type: string;
  readonly payload: Record<string, unknown>;
  readonly status: string;
  readonly decided_by: string | null;
  readonly decision_notes: string | null;
  readonly decided_at: string | null;
  readonly created_at: string;
}

export interface CreatePendingActionInput {
  readonly tenantId: string;
  readonly agent: string;
  readonly actionType: string;
  readonly payload: Record<string, unknown>;
}

export class PendingActionRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `pending_agent_actions` (AAOS-OPERATING-MODE-APPROVAL-GATE).
 * Built on the same shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other
 * `aaos-api` repository uses — see `LearningProposalRepository` for the precedent this mirrors
 * column-for-column (`create` always inserts `status: 'PENDING'`; `updateDecision` is the real
 * Approve/Reject writer, `void` return, same "caller re-reads if it needs the fresh row"
 * convention).
 */
export class PendingActionRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(input: CreatePendingActionInput): Promise<PendingActionRow> {
    const { data, error } = await this.client
      .from<PendingActionRow>(TABLE)
      .insert({
        tenant_id: input.tenantId,
        agent: input.agent,
        action_type: input.actionType,
        payload: input.payload,
        status: "PENDING",
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new PendingActionRepositoryError(
        `PendingActionRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async findById(id: string): Promise<PendingActionRow | undefined> {
    const { data, error } = await this.client
      .from<PendingActionRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new PendingActionRepositoryError(
        `PendingActionRepository.findById failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  /** The tenant's pending-action rows, newest-first, optionally filtered by real `status` — the pending-actions UI's real list source. */
  async listForTenant(tenantId: string, status?: string): Promise<readonly PendingActionRow[]> {
    let query = this.client.from<PendingActionRow>(TABLE).select("*").eq("tenant_id", tenantId);
    if (status !== undefined) {
      query = query.eq("status", status);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error !== null) {
      throw new PendingActionRepositoryError(
        `PendingActionRepository.listForTenant failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  /** Records a manager's real Approve/Reject decision — same `void` return convention `LearningProposalRepository.updateDecision` establishes. */
  async updateDecision(
    id: string,
    status: "APPROVED" | "REJECTED",
    decidedBy: string | undefined,
    decisionNotes: string | undefined,
    decidedAt: string,
  ): Promise<void> {
    const { error } = await this.client
      .from<PendingActionRow>(TABLE)
      .update({
        status,
        decided_by: decidedBy ?? null,
        decision_notes: decisionNotes ?? null,
        decided_at: decidedAt,
      })
      .eq("id", id);
    if (error !== null) {
      throw new PendingActionRepositoryError(
        `PendingActionRepository.updateDecision failed: ${error.message}`,
      );
    }
  }
}
