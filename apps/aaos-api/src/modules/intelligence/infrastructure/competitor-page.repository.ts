import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "competitor_pages";

/** Raw `competitor_pages` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/016_intelligence.sql`. This table IS `CompetitorIntelService`'s real, tenant-managed config source (that Phase 2 service's own docstring: "no hardcoded page IDs; ... a real, later `competitor_pages` DB table"). */
export interface CompetitorPageRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly page_id: string;
  readonly vertical: string;
  readonly active: boolean;
  readonly created_at: string;
}

export type CompetitorPageInsert = Omit<CompetitorPageRow, "id" | "created_at">;

export class CompetitorPageRepositoryError extends Error {}

/** Same `.delete()` workaround as `modules/listings/infrastructure/listing.repository.ts` — see that file's docstring for why `SupabaseClientLike` deliberately doesn't declare `.delete()`. */
interface DeletableSupabaseClient {
  from(table: string): {
    delete(): {
      eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

/**
 * Supabase-backed persistence for `competitor_pages` (AAOS-TAMARA-INTELLIGENCE-LAYER Phase 4).
 * Backs `GET/POST /api/v1/competitors`, `DELETE /api/v1/competitors/:id` — real Supabase CRUD, no
 * hardcoded competitor page IDs anywhere in this module.
 */
export class CompetitorPageRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(values: CompetitorPageInsert): Promise<CompetitorPageRow> {
    const { data, error } = await this.client
      .from<CompetitorPageRow>(TABLE)
      .insert(values)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new CompetitorPageRepositoryError(
        `CompetitorPageRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async findById(id: string): Promise<CompetitorPageRow | undefined> {
    const { data, error } = await this.client
      .from<CompetitorPageRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new CompetitorPageRepositoryError(
        `CompetitorPageRepository.findById failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  async listByTenant(tenantId: string): Promise<readonly CompetitorPageRow[]> {
    const { data, error } = await this.client
      .from<CompetitorPageRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error !== null) {
      throw new CompetitorPageRepositoryError(
        `CompetitorPageRepository.listByTenant failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  /** Real, active pages for `tenantId`+`vertical` — what `IntelligenceService` actually passes to `CompetitorIntelService.getCompetitorAds`. */
  async listActiveByTenantAndVertical(
    tenantId: string,
    vertical: string,
  ): Promise<readonly CompetitorPageRow[]> {
    const { data, error } = await this.client
      .from<CompetitorPageRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("vertical", vertical)
      .eq("active", true);
    if (error !== null) {
      throw new CompetitorPageRepositoryError(
        `CompetitorPageRepository.listActiveByTenantAndVertical failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  async deleteById(id: string): Promise<void> {
    const client = this.client as unknown as DeletableSupabaseClient;
    const { error } = await client.from(TABLE).delete().eq("id", id);
    if (error !== null) {
      throw new CompetitorPageRepositoryError(
        `CompetitorPageRepository.deleteById failed: ${error.message}`,
      );
    }
  }
}
