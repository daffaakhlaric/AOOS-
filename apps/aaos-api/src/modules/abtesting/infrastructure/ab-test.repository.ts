import type { SupabaseClientLike } from "@aos/lead-store";

import type { AbTestStatus, StoredAbTest } from "../domain/ab-test.js";

const TABLE = "ab_tests";

/** Raw `ab_tests` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/012_abtesting.sql`. */
export interface AbTestRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly campaign_id: string;
  readonly ad_set_id: string;
  readonly page_id: string;
  readonly wa_link: string;
  readonly mode: string;
  readonly status: string;
  readonly threshold_spend: number;
  readonly threshold_days: number;
  readonly min_margin_pct: number;
  readonly auto_pause_loser: boolean;
  readonly auto_scale_winner: boolean;
  readonly winner_variant_id: string | null;
  readonly winner_rph_lead: number | null;
  readonly improvement_pct: number | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly failed_reason: string | null;
  readonly created_at: string;
}

export interface CreateAbTestInput {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly campaignId: string;
  readonly adSetId: string;
  readonly pageId: string;
  readonly waLink: string;
  readonly mode: "AUTO" | "MANUAL";
  readonly thresholdSpend: number;
  readonly thresholdDays: number;
  readonly minMarginPct: number;
  readonly autoPauseLoser: boolean;
  readonly autoScaleWinner: boolean;
}

export class AbTestRepositoryError extends Error {}

function toDomain(row: AbTestRow): StoredAbTest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    campaignId: row.campaign_id,
    adSetId: row.ad_set_id,
    pageId: row.page_id,
    waLink: row.wa_link,
    mode: row.mode as "AUTO" | "MANUAL",
    status: row.status as AbTestStatus,
    thresholdSpend: row.threshold_spend,
    thresholdDays: row.threshold_days,
    minMarginPct: row.min_margin_pct,
    autoPauseLoser: row.auto_pause_loser,
    autoScaleWinner: row.auto_scale_winner,
    ...(row.winner_variant_id !== null ? { winnerVariantId: row.winner_variant_id } : {}),
    ...(row.winner_rph_lead !== null ? { winnerRphLead: row.winner_rph_lead } : {}),
    ...(row.improvement_pct !== null ? { improvementPct: row.improvement_pct } : {}),
    ...(row.started_at !== null ? { startedAt: row.started_at } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at } : {}),
    ...(row.failed_reason !== null ? { failedReason: row.failed_reason } : {}),
    createdAt: row.created_at,
  };
}

/**
 * Supabase-backed persistence for `ab_tests` (AAOS-ABTESTING-LOOKALIKE), on the same shared
 * `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api` repository uses.
 */
export class AbTestRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(input: CreateAbTestInput): Promise<StoredAbTest> {
    const { data, error } = await this.client
      .from<AbTestRow>(TABLE)
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        name: input.name,
        campaign_id: input.campaignId,
        ad_set_id: input.adSetId,
        page_id: input.pageId,
        wa_link: input.waLink,
        mode: input.mode,
        status: "DRAFT",
        threshold_spend: input.thresholdSpend,
        threshold_days: input.thresholdDays,
        min_margin_pct: input.minMarginPct,
        auto_pause_loser: input.autoPauseLoser,
        auto_scale_winner: input.autoScaleWinner,
        winner_variant_id: null,
        winner_rph_lead: null,
        improvement_pct: null,
        started_at: null,
        completed_at: null,
        failed_reason: null,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new AbTestRepositoryError(
        `AbTestRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return toDomain(data);
  }

  async findById(tenantId: string, id: string): Promise<StoredAbTest | undefined> {
    const { data, error } = await this.client
      .from<AbTestRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new AbTestRepositoryError(`AbTestRepository.findById failed: ${error.message}`);
    }
    return data === null ? undefined : toDomain(data);
  }

  async listByTenant(tenantId: string, status?: AbTestStatus): Promise<readonly StoredAbTest[]> {
    let query = this.client
      .from<AbTestRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (status !== undefined) {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error !== null) {
      throw new AbTestRepositoryError(`AbTestRepository.listByTenant failed: ${error.message}`);
    }
    return (data ?? []).map(toDomain);
  }

  async listByStatus(tenantId: string, status: AbTestStatus): Promise<readonly StoredAbTest[]> {
    return this.listByTenant(tenantId, status);
  }

  /** Every test (any status) run against one campaign — the service reads their variants' angles to feed `selectUnusedAngleSet` (spec's "belum pernah di-test untuk campaign ini"). */
  async listByCampaign(tenantId: string, campaignId: string): Promise<readonly StoredAbTest[]> {
    const { data, error } = await this.client
      .from<AbTestRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("campaign_id", campaignId);
    if (error !== null) {
      throw new AbTestRepositoryError(`AbTestRepository.listByCampaign failed: ${error.message}`);
    }
    return (data ?? []).map(toDomain);
  }

  async markStatus(id: string, status: AbTestStatus): Promise<void> {
    const { error } = await this.client.from<AbTestRow>(TABLE).update({ status }).eq("id", id);
    if (error !== null) {
      throw new AbTestRepositoryError(`AbTestRepository.markStatus failed: ${error.message}`);
    }
  }

  async markRunning(id: string, startedAtIso: string): Promise<void> {
    const { error } = await this.client
      .from<AbTestRow>(TABLE)
      .update({ status: "RUNNING", started_at: startedAtIso })
      .eq("id", id);
    if (error !== null) {
      throw new AbTestRepositoryError(`AbTestRepository.markRunning failed: ${error.message}`);
    }
  }

  async markFailed(id: string, reason: string): Promise<void> {
    const { error } = await this.client
      .from<AbTestRow>(TABLE)
      .update({ status: "FAILED", failed_reason: reason })
      .eq("id", id);
    if (error !== null) {
      throw new AbTestRepositoryError(`AbTestRepository.markFailed failed: ${error.message}`);
    }
  }

  async markComplete(
    id: string,
    winnerVariantId: string,
    winnerRphLead: number,
    improvementPct: number,
    completedAtIso: string,
  ): Promise<void> {
    const { error } = await this.client
      .from<AbTestRow>(TABLE)
      .update({
        status: "COMPLETE",
        winner_variant_id: winnerVariantId,
        winner_rph_lead: winnerRphLead,
        improvement_pct: improvementPct,
        completed_at: completedAtIso,
      })
      .eq("id", id);
    if (error !== null) {
      throw new AbTestRepositoryError(`AbTestRepository.markComplete failed: ${error.message}`);
    }
  }
}
