import type { SupabaseClientLike } from "@aos/lead-store";

import type { StoredMetaInterest } from "../domain/meta-interest.js";

const TABLE = "meta_interests";

/**
 * Raw `meta_interests` row shape (snake_case) — COLUMN-FOR-COLUMN with
 * `supabase/migrations/005_meta_interests.sql`. Any future column MUST be added in both files in
 * the same change.
 */
export interface MetaInterestRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly audience_size_lower: number;
  readonly audience_size_upper: number;
  readonly path: string[];
  readonly topic: string | null;
  readonly search_term: string;
  readonly fetched_at: string;
}

export class MetaInterestRepositoryError extends Error {}

function toDomain(row: MetaInterestRow): StoredMetaInterest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    audienceSizeLower: row.audience_size_lower,
    audienceSizeUpper: row.audience_size_upper,
    path: row.path,
    ...(row.topic !== null ? { topic: row.topic } : {}),
    searchTerm: row.search_term,
    fetchedAt: row.fetched_at,
  };
}

/** What `save` writes — the domain shape minus the storage-managed `fetchedAt`, which the caller supplies as one shared timestamp per sync run. */
export type SaveMetaInterestInput = Omit<StoredMetaInterest, "fetchedAt">;

/**
 * Supabase-backed persistence for `meta_interests` (AAOS-SIMULASI-TARGETING), on the same shared
 * `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api` repository uses —
 * one Supabase client for the whole app, not a second connection.
 *
 * WHY `save` IS A READ-THEN-INSERT-OR-UPDATE RATHER THAN A NATIVE `upsert`: the shared
 * `SupabaseClientLike` port (`@aos/lead-store`'s `SupabaseTypes.ts`) declares only
 * `select`/`insert`/`update` — it has no `upsert`. Widening that cross-package port for this one
 * table would change a contract five other repositories and every hand-rolled test fake depend on,
 * for a table whose sync writes a few dozen rows by hand-triggered request. The semantics are
 * identical (Meta's own interest id is the primary key, so re-running a sync refreshes rather than
 * duplicates); the only cost is one extra round-trip per row, which is irrelevant at this volume.
 */
export class MetaInterestRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /**
   * Idempotently persists one real Meta interest. Returns `"inserted"` or `"updated"` so the sync
   * endpoint can report what genuinely happened rather than a single opaque count.
   */
  async save(input: SaveMetaInterestInput, fetchedAt: string): Promise<"inserted" | "updated"> {
    const existing = await this.findById(input.id);
    const values = {
      tenant_id: input.tenantId,
      name: input.name,
      audience_size_lower: input.audienceSizeLower,
      audience_size_upper: input.audienceSizeUpper,
      path: [...input.path],
      topic: input.topic ?? null,
      search_term: input.searchTerm,
      fetched_at: fetchedAt,
    };

    if (existing !== undefined) {
      const { error } = await this.client
        .from<MetaInterestRow>(TABLE)
        .update(values)
        .eq("id", input.id);
      if (error !== null) {
        throw new MetaInterestRepositoryError(
          `MetaInterestRepository.save (update) failed: ${error.message}`,
        );
      }
      return "updated";
    }

    const { error } = await this.client
      .from<MetaInterestRow>(TABLE)
      .insert({ id: input.id, ...values });
    if (error !== null) {
      throw new MetaInterestRepositoryError(
        `MetaInterestRepository.save (insert) failed: ${error.message}`,
      );
    }
    return "inserted";
  }

  async findById(id: string): Promise<StoredMetaInterest | undefined> {
    const { data, error } = await this.client
      .from<MetaInterestRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new MetaInterestRepositoryError(
        `MetaInterestRepository.findById failed: ${error.message}`,
      );
    }
    return data === null ? undefined : toDomain(data);
  }

  /** Every stored interest for a tenant, freshest first. The candidate pool the Simulasi targeting step filters down. */
  async listByTenant(tenantId: string, limit = 200): Promise<readonly StoredMetaInterest[]> {
    const { data, error } = await this.client
      .from<MetaInterestRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("fetched_at", { ascending: false })
      .limit(limit);
    if (error !== null) {
      throw new MetaInterestRepositoryError(
        `MetaInterestRepository.listByTenant failed: ${error.message}`,
      );
    }
    return (data ?? []).map(toDomain);
  }
}
