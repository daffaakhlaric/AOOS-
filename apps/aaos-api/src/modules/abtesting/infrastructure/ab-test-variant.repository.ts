import type { SupabaseClientLike } from "@aos/lead-store";

import type { AbTestVariantStatus, StoredAbTestVariant } from "../domain/ab-test.js";

const TABLE = "ab_test_variants";

/** Raw `ab_test_variants` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/012_abtesting.sql`. */
export interface AbTestVariantRow {
  readonly id: string;
  readonly ab_test_id: string;
  readonly tenant_id: string;
  readonly variant_label: string;
  readonly angle: string;
  readonly creative_package_id: string;
  readonly meta_ad_id: string | null;
  readonly status: string;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly conversations: number;
  readonly leads: number;
  readonly rph_lead: number | null;
  readonly ctr: number | null;
  readonly last_synced_at: string | null;
  readonly created_at: string;
}

export interface CreateAbTestVariantInput {
  readonly id: string;
  readonly abTestId: string;
  readonly tenantId: string;
  readonly variantLabel: string;
  readonly angle: string;
  readonly creativePackageId: string;
}

export interface UpdateAbTestVariantInsightsInput {
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly conversations: number;
  readonly leads: number;
  readonly rphLead: number | null;
  readonly ctr: number | null;
  readonly lastSyncedAtIso: string;
}

export class AbTestVariantRepositoryError extends Error {}

function toDomain(row: AbTestVariantRow): StoredAbTestVariant {
  return {
    id: row.id,
    abTestId: row.ab_test_id,
    tenantId: row.tenant_id,
    variantLabel: row.variant_label,
    angle: row.angle,
    creativePackageId: row.creative_package_id,
    ...(row.meta_ad_id !== null ? { metaAdId: row.meta_ad_id } : {}),
    status: row.status as AbTestVariantStatus,
    spend: row.spend,
    impressions: row.impressions,
    clicks: row.clicks,
    conversations: row.conversations,
    leads: row.leads,
    ...(row.rph_lead !== null ? { rphLead: row.rph_lead } : {}),
    ...(row.ctr !== null ? { ctr: row.ctr } : {}),
    ...(row.last_synced_at !== null ? { lastSyncedAt: row.last_synced_at } : {}),
    createdAt: row.created_at,
  };
}

/**
 * Supabase-backed persistence for `ab_test_variants` (AAOS-ABTESTING-LOOKALIKE), on the same
 * shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api` repository
 * uses.
 */
export class AbTestVariantRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(input: CreateAbTestVariantInput): Promise<StoredAbTestVariant> {
    const { data, error } = await this.client
      .from<AbTestVariantRow>(TABLE)
      .insert({
        id: input.id,
        ab_test_id: input.abTestId,
        tenant_id: input.tenantId,
        variant_label: input.variantLabel,
        angle: input.angle,
        creative_package_id: input.creativePackageId,
        meta_ad_id: null,
        status: "PENDING_CREATIVE",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversations: 0,
        leads: 0,
        rph_lead: null,
        ctr: null,
        last_synced_at: null,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new AbTestVariantRepositoryError(
        `AbTestVariantRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return toDomain(data);
  }

  async listByAbTest(abTestId: string): Promise<readonly StoredAbTestVariant[]> {
    const { data, error } = await this.client
      .from<AbTestVariantRow>(TABLE)
      .select("*")
      .eq("ab_test_id", abTestId)
      .order("variant_label", { ascending: true });
    if (error !== null) {
      throw new AbTestVariantRepositoryError(
        `AbTestVariantRepository.listByAbTest failed: ${error.message}`,
      );
    }
    return (data ?? []).map(toDomain);
  }

  async markStatus(id: string, status: AbTestVariantStatus): Promise<void> {
    const { error } = await this.client
      .from<AbTestVariantRow>(TABLE)
      .update({ status })
      .eq("id", id);
    if (error !== null) {
      throw new AbTestVariantRepositoryError(
        `AbTestVariantRepository.markStatus failed: ${error.message}`,
      );
    }
  }

  /** Sets the real Meta ad id once the variant's ad is actually created, and flips status to `RUNNING`. */
  async markLaunched(id: string, metaAdId: string): Promise<void> {
    const { error } = await this.client
      .from<AbTestVariantRow>(TABLE)
      .update({ meta_ad_id: metaAdId, status: "RUNNING" })
      .eq("id", id);
    if (error !== null) {
      throw new AbTestVariantRepositoryError(
        `AbTestVariantRepository.markLaunched failed: ${error.message}`,
      );
    }
  }

  async updateInsights(id: string, input: UpdateAbTestVariantInsightsInput): Promise<void> {
    const { error } = await this.client
      .from<AbTestVariantRow>(TABLE)
      .update({
        spend: input.spend,
        impressions: input.impressions,
        clicks: input.clicks,
        conversations: input.conversations,
        leads: input.leads,
        rph_lead: input.rphLead,
        ctr: input.ctr,
        last_synced_at: input.lastSyncedAtIso,
      })
      .eq("id", id);
    if (error !== null) {
      throw new AbTestVariantRepositoryError(
        `AbTestVariantRepository.updateInsights failed: ${error.message}`,
      );
    }
  }
}
