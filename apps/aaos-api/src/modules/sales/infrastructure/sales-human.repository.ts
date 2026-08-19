import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "sales_humans";

/**
 * Raw `sales_humans` row shape (snake_case) — COLUMN-FOR-COLUMN with
 * `packages/lead-store/supabase/migrations/001_initial_schema.sql`'s real table. Deliberately does
 * NOT add `email`/`password_hash`/`avatar_url` columns (coordinator note #1 — email lives only in
 * Supabase Auth's `auth.users`, fetched via `SUPABASE_AUTH_ADMIN` when needed, never duplicated
 * here). "Nomor HP" (spec's phone field) is stored in the real, pre-existing `wa_number` column
 * rather than a new `phone` column — one WhatsApp-shaped contact number per sales human already
 * exists, adding a second would be a duplicate concept with no migration available to run.
 */
export interface SalesHumanRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly wa_number: string;
  readonly branch_id: string;
  readonly status: string;
  readonly max_leads_per_day: number;
  readonly auth_user_id: string | null;
  readonly created_at: string;
}

export type SalesHumanInsert = Omit<SalesHumanRow, "id" | "created_at">;
export type SalesHumanUpdate = Partial<Omit<SalesHumanRow, "id" | "tenant_id" | "created_at">>;

export class SalesHumanRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `sales_humans` (AAOS-SALES-MGMT-CRM-AUTH) — the first real
 * repository over this table anywhere in the codebase (it previously existed only as a migration;
 * `@aos/branch-manager`'s `SalesTeamRegistry` is a separate, process-local, non-persisted in-memory
 * store used purely for lead-assignment routing, out of scope for this module — see
 * `sales-humans.service.ts`'s class doc). Built on the same shared `SupabaseClientLike` port +
 * `SUPABASE_CLIENT` DI token every other `aaos-api` repository uses.
 */
export class SalesHumanRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(values: SalesHumanInsert): Promise<SalesHumanRow> {
    const { data, error } = await this.client
      .from<SalesHumanRow>(TABLE)
      .insert(values)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new SalesHumanRepositoryError(
        `SalesHumanRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async findById(id: string): Promise<SalesHumanRow | undefined> {
    const { data, error } = await this.client
      .from<SalesHumanRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new SalesHumanRepositoryError(`SalesHumanRepository.findById failed: ${error.message}`);
    }
    return data ?? undefined;
  }

  async updateById(id: string, values: SalesHumanUpdate): Promise<SalesHumanRow> {
    const { data, error } = await this.client
      .from<SalesHumanRow>(TABLE)
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new SalesHumanRepositoryError(
        `SalesHumanRepository.updateById failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  /** Every sales human for a tenant, optionally narrowed to one branch (spec "GET /api/v1/sales-humans?branchId="). */
  async list(tenantId: string, branchId?: string): Promise<readonly SalesHumanRow[]> {
    let query = this.client.from<SalesHumanRow>(TABLE).select("*").eq("tenant_id", tenantId);
    if (branchId !== undefined) {
      query = query.eq("branch_id", branchId);
    }
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error !== null) {
      throw new SalesHumanRepositoryError(`SalesHumanRepository.list failed: ${error.message}`);
    }
    return data ?? [];
  }
}
