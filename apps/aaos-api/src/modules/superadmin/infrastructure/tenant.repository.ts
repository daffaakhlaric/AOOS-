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
  /**
   * `'DEV' | 'LIVE'` (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A) — free `TEXT` with a DB `CHECK`
   * constraint (`020_tenant_mode.sql`), same "Zod validates at the API boundary, DB just enforces
   * the invariant" convention `status`/`vertical` already use. `DEFAULT 'LIVE'` at the column
   * level — see that migration's header doc for why.
   */
  readonly mode: string;
  readonly mode_changed_at: string | null;
  readonly mode_changed_by: string | null;
  /**
   * `'FULL_CONTROL' | 'APPROVAL'` (AAOS-OPERATING-MODE-APPROVAL-GATE) — a SEPARATE axis from
   * `mode` above: `mode` (DEV/LIVE) gates whether a real Meta API call happens at all; this column
   * gates whether a LIVE-mode automated action (today: `SchedulerService`'s PROPERTY
   * campaign-creation trigger) still needs an explicit human Approve first. Free `TEXT` with a DB
   * `CHECK` constraint (`031_operating_mode.sql`), same "Zod validates at the API boundary, DB just
   * enforces the invariant" convention `mode` already uses. `DEFAULT 'FULL_CONTROL'` at the column
   * level — zero behavior change for every tenant that already exists (see that migration's header
   * doc for the user's own answer to the design doc's "default for existing tenants" question).
   */
  readonly operating_mode: string;
  readonly operating_mode_changed_at: string | null;
  readonly operating_mode_changed_by: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/**
 * `mode`/`mode_changed_at`/`mode_changed_by` are deliberately OPTIONAL on insert (unlike every
 * other column): the DB column default (`DEFAULT 'LIVE'`) already gives every new row the correct
 * safe-for-existing-tenants value, and `mode_changed_at`/`mode_changed_by` have nothing honest to
 * record until a real mode CHANGE happens (`SettingsService.updateMode`) — inventing an initial
 * "changed by" value at creation time would misrepresent an insert as a change. `SuperadminService.create`
 * passes `mode: 'DEV'` explicitly for brand-new tenants (a separate, safe, application-level
 * default — see `020_tenant_mode.sql`'s header doc); every other existing insert call site is
 * unaffected and keeps relying on the column default.
 */
export type TenantInsert = Omit<
  TenantRow,
  | "id"
  | "created_at"
  | "updated_at"
  | "mode"
  | "mode_changed_at"
  | "mode_changed_by"
  | "operating_mode"
  | "operating_mode_changed_at"
  | "operating_mode_changed_by"
> &
  Partial<
    Pick<
      TenantRow,
      | "mode"
      | "mode_changed_at"
      | "mode_changed_by"
      | "operating_mode"
      | "operating_mode_changed_at"
      | "operating_mode_changed_by"
    >
  >;
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
