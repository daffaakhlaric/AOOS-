import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "tenants";

/** Raw `tenants` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/007_tenants_waba.sql`. */
export interface TenantRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly vertical: string;
  readonly status: string;
  readonly trial_ends_at: string | null;
  readonly meta_access_token: string | null;
  readonly meta_ad_account_id: string | null;
  readonly meta_api_version: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export type TenantInsert = Omit<TenantRow, "id" | "created_at" | "updated_at">;
/** Callers explicitly set `updated_at` on every real patch (no DB trigger backs it — see `SuperadminService.update`/`SettingsService.updateMeta`), so it stays a settable field here, unlike `id`/`tenant_id`/`created_at`. */
export type TenantUpdate = Partial<Omit<TenantRow, "id" | "tenant_id" | "created_at">>;

export class TenantRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `tenants` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 1).
 * Built on the same shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other
 * `aaos-api` repository uses — see `sales-human.repository.ts` for the precedent this mirrors.
 */
export class TenantRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(values: TenantInsert): Promise<TenantRow> {
    const { data, error } = await this.client
      .from<TenantRow>(TABLE)
      .insert(values)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new TenantRepositoryError(
        `TenantRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async findByTenantId(tenantId: string): Promise<TenantRow | undefined> {
    const { data, error } = await this.client
      .from<TenantRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error !== null) {
      throw new TenantRepositoryError(`TenantRepository.findByTenantId failed: ${error.message}`);
    }
    return data ?? undefined;
  }

  async list(): Promise<readonly TenantRow[]> {
    const { data, error } = await this.client
      .from<TenantRow>(TABLE)
      .select("*")
      .order("created_at", { ascending: true });
    if (error !== null) {
      throw new TenantRepositoryError(`TenantRepository.list failed: ${error.message}`);
    }
    return data ?? [];
  }

  /**
   * Patches a tenant row by its slug `tenant_id` (the id every caller — Super Admin panel,
   * `/settings`, Meta connector override — actually has in hand), not the internal UUID `id`.
   * Same `.update(values).eq(...).select("*").single()` chain `SalesHumanRepository.updateById`
   * establishes.
   */
  async updateByTenantId(tenantId: string, values: TenantUpdate): Promise<TenantRow> {
    const { data, error } = await this.client
      .from<TenantRow>(TABLE)
      .update(values)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new TenantRepositoryError(
        `TenantRepository.updateByTenantId failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }
}
