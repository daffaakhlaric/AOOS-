import type { SupabaseClientLike } from "@aos/lead-store";

import type { CampaignHealth } from "../domain/campaign-health.js";
import type { SamanthaDecision } from "../domain/decision.js";
import type { CampaignDiagnosis } from "../domain/diagnosis.js";

const TABLE = "samantha_campaign_assessments";

/** Raw `samantha_campaign_assessments` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/056_samantha_campaign_assessments.sql`. */
export interface CampaignAssessmentRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly meta_campaign_id: string;
  readonly health: CampaignHealth;
  readonly diagnosis: CampaignDiagnosis;
  readonly decision: SamanthaDecision;
  readonly assessed_at: string;
}

/** camelCase read shape `CampaignHealthService.history` hands back to callers — mapped from `CampaignAssessmentRow`. */
export interface StoredAssessment {
  readonly id: string;
  readonly health: CampaignHealth;
  readonly diagnosis: CampaignDiagnosis;
  readonly decision: SamanthaDecision;
  readonly assessedAt: string;
}

export class CampaignAssessmentRepositoryError extends Error {}

function toStoredAssessment(row: CampaignAssessmentRow): StoredAssessment {
  return {
    id: row.id,
    health: row.health,
    diagnosis: row.diagnosis,
    decision: row.decision,
    assessedAt: row.assessed_at,
  };
}

/**
 * Supabase-backed persistence for `samantha_campaign_assessments` (EYVRA — SAMANTHA V2 Phase 6).
 * Every read/write is explicitly tenant-scoped via `.eq("tenant_id", tenantId)`, same discipline
 * `GrowthObjectiveRepository`/`MetricSnapshotRepository` already establish. `record()` is a plain
 * INSERT — rows here are never updated (see `056_samantha_campaign_assessments.sql`'s own header
 * doc for why); `assessed_at` is left to the DB's `DEFAULT now()` rather than a client-side
 * timestamp, same "let the DB own its own insert time" choice `AuditLogRepository.insert` makes.
 */
export class CampaignAssessmentRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async record(
    tenantId: string,
    metaCampaignId: string,
    health: CampaignHealth,
    diagnosis: CampaignDiagnosis,
    decision: SamanthaDecision,
  ): Promise<void> {
    const { error } = await this.client
      .from<CampaignAssessmentRow>(TABLE)
      .insert({
        tenant_id: tenantId,
        meta_campaign_id: metaCampaignId,
        health,
        diagnosis,
        decision,
      })
      .select("*")
      .single();
    if (error !== null) {
      throw new CampaignAssessmentRepositoryError(
        `CampaignAssessmentRepository.record failed: ${error.message}`,
      );
    }
  }

  /** `assessed_at DESC`, capped at `limit` — never an unbounded fetch. See `CampaignHealthService.history`'s own doc for where `limit` is validated/capped before reaching here. */
  async listHistory(
    tenantId: string,
    metaCampaignId: string,
    limit: number,
  ): Promise<readonly StoredAssessment[]> {
    const { data, error } = await this.client
      .from<CampaignAssessmentRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("meta_campaign_id", metaCampaignId)
      .order("assessed_at", { ascending: false })
      .limit(limit);
    if (error !== null) {
      throw new CampaignAssessmentRepositoryError(
        `CampaignAssessmentRepository.listHistory failed: ${error.message}`,
      );
    }
    return (data ?? []).map(toStoredAssessment);
  }

  /**
   * EYVRA — SAMANTHA V2 Phase 33 (PROMPT 34 — Historical Strategy Memory). The LATEST real,
   * persisted assessment per `meta_campaign_id`, for every campaign this tenant has ever recorded
   * one for — the real "what actually happened" signal `strategy-memory.ts`'s aggregation is built
   * on. No `.in()`/`GROUP BY` on the shared `SupabaseClientLike` port — same real gap
   * `GrowthObjectiveCampaignsRepository.findCampaignIdsForListings`'s own doc already establishes.
   * Same established fix: fetch the WHOLE tenant's real assessment history (bounded by one
   * tenant's real assessment volume, never unbounded), ordered `assessed_at DESC`, and reduce
   * in-memory — the FIRST row encountered per `meta_campaign_id` is, by that ordering, the latest
   * one for that campaign.
   */
  async listLatestPerCampaign(tenantId: string): Promise<ReadonlyMap<string, StoredAssessment>> {
    const { data, error } = await this.client
      .from<CampaignAssessmentRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("assessed_at", { ascending: false });
    if (error !== null) {
      throw new CampaignAssessmentRepositoryError(
        `CampaignAssessmentRepository.listLatestPerCampaign failed: ${error.message}`,
      );
    }
    const latestByCampaign = new Map<string, StoredAssessment>();
    for (const row of data ?? []) {
      if (!latestByCampaign.has(row.meta_campaign_id)) {
        latestByCampaign.set(row.meta_campaign_id, toStoredAssessment(row));
      }
    }
    return latestByCampaign;
  }
}
