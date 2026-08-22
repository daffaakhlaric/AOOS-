import type { SupabaseClientLike } from "@aos/lead-store";

import type { MetaAudienceType, StoredMetaAudience } from "../domain/meta-audience.js";

const TABLE = "meta_audiences";

/** Raw `meta_audiences` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/013_lookalike.sql`. */
export interface MetaAudienceRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly meta_audience_id: string;
  readonly audience_type: string;
  readonly name: string;
  readonly size: number | null;
  readonly origin_audience_id: string | null;
  readonly percentage: number | null;
  readonly status: string;
  readonly last_updated_at: string | null;
  readonly created_at: string;
}

export interface CreateMetaAudienceInput {
  readonly id: string;
  readonly tenantId: string;
  readonly metaAudienceId: string;
  readonly audienceType: MetaAudienceType;
  readonly name: string;
  readonly originAudienceId?: string;
  readonly percentage?: number;
}

export class MetaAudienceRepositoryError extends Error {}

function toDomain(row: MetaAudienceRow): StoredMetaAudience {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    metaAudienceId: row.meta_audience_id,
    audienceType: row.audience_type as MetaAudienceType,
    name: row.name,
    ...(row.size !== null ? { size: row.size } : {}),
    ...(row.origin_audience_id !== null ? { originAudienceId: row.origin_audience_id } : {}),
    ...(row.percentage !== null ? { percentage: row.percentage } : {}),
    status: row.status as StoredMetaAudience["status"],
    ...(row.last_updated_at !== null ? { lastUpdatedAt: row.last_updated_at } : {}),
    createdAt: row.created_at,
  };
}

/**
 * Supabase-backed persistence for `meta_audiences` (AAOS-ABTESTING-LOOKALIKE Part 2), on the same
 * shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api` repository
 * uses.
 */
export class MetaAudienceRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(input: CreateMetaAudienceInput): Promise<StoredMetaAudience> {
    const { data, error } = await this.client
      .from<MetaAudienceRow>(TABLE)
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        meta_audience_id: input.metaAudienceId,
        audience_type: input.audienceType,
        name: input.name,
        size: null,
        origin_audience_id: input.originAudienceId ?? null,
        percentage: input.percentage ?? null,
        status: "ACTIVE",
        last_updated_at: null,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new MetaAudienceRepositoryError(
        `MetaAudienceRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return toDomain(data);
  }

  async findByTenantAndType(
    tenantId: string,
    audienceType: MetaAudienceType,
  ): Promise<StoredMetaAudience | undefined> {
    const { data, error } = await this.client
      .from<MetaAudienceRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("audience_type", audienceType)
      .maybeSingle();
    if (error !== null) {
      throw new MetaAudienceRepositoryError(
        `MetaAudienceRepository.findByTenantAndType failed: ${error.message}`,
      );
    }
    return data === null ? undefined : toDomain(data);
  }

  async listByTenant(tenantId: string): Promise<readonly StoredMetaAudience[]> {
    const { data, error } = await this.client
      .from<MetaAudienceRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (error !== null) {
      throw new MetaAudienceRepositoryError(
        `MetaAudienceRepository.listByTenant failed: ${error.message}`,
      );
    }
    return (data ?? []).map(toDomain);
  }

  async updateSize(id: string, size: number, lastUpdatedAtIso: string): Promise<void> {
    const { error } = await this.client
      .from<MetaAudienceRow>(TABLE)
      .update({ size, last_updated_at: lastUpdatedAtIso })
      .eq("id", id);
    if (error !== null) {
      throw new MetaAudienceRepositoryError(
        `MetaAudienceRepository.updateSize failed: ${error.message}`,
      );
    }
  }
}
