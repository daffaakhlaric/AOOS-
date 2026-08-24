import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "waba_configs";

/** Raw `waba_configs` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/007_tenants_waba.sql`. */
export interface WabaConfigRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly branch_id: string;
  readonly phone_number: string;
  readonly waba_id: string;
  readonly phone_number_id: string;
  readonly access_token: string;
  readonly status: string;
  readonly last_tested_at: string | null;
  readonly last_test_result: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export type WabaConfigInsert = Omit<
  WabaConfigRow,
  "id" | "created_at" | "updated_at" | "last_tested_at" | "last_test_result"
>;
/** Callers explicitly set `updated_at` on every real patch (no DB trigger backs it), so it stays a settable field here, unlike `id`/`tenant_id`/`created_at`. */
export type WabaConfigUpdate = Partial<Omit<WabaConfigRow, "id" | "tenant_id" | "created_at">>;

export class WabaConfigRepositoryError extends Error {}

/**
 * Same `.delete()` workaround as `modules/scheduler/infrastructure/calendar-event.repository.ts`
 * — see that file's docstring for why `SupabaseClientLike` deliberately doesn't declare
 * `.delete()`, and why a narrow, file-local cast is the established pattern for the one
 * repository per feature that genuinely needs a hard row delete (`DELETE /api/v1/settings/waba/:id`
 * here).
 */
interface DeletableSupabaseClient {
  from(table: string): {
    delete(): {
      eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

/**
 * Supabase-backed persistence for `waba_configs` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase
 * 1). Genuinely replaces the per-branch `WABA_ID_*`/`PHONE_NUMBER_ID_*`/`PHONE_NUMBER_*` env vars
 * in `aaos-api.config.ts` with real per-tenant rows (coordinator note section 3) — those env
 * vars remain as the `dss-motor` deployment's bootstrap default for
 * `@aos/whatsapp-connector`/`to-whatsapp-connector-config.ts`, unchanged by this Phase 1 pass;
 * this table is the new source of truth surfaced through `/settings`'s WABA card.
 */
export class WabaConfigRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(values: WabaConfigInsert): Promise<WabaConfigRow> {
    const { data, error } = await this.client
      .from<WabaConfigRow>(TABLE)
      .insert(values)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new WabaConfigRepositoryError(
        `WabaConfigRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async findById(id: string): Promise<WabaConfigRow | undefined> {
    const { data, error } = await this.client
      .from<WabaConfigRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new WabaConfigRepositoryError(`WabaConfigRepository.findById failed: ${error.message}`);
    }
    return data ?? undefined;
  }

  /**
   * AAOS-MULTI-TENANT-PHASE1B (Phase 2) addition — the real tenant-resolution lookup an incoming
   * WhatsApp webhook uses: Meta's payload carries `entry[].changes[].value.metadata
   * .phone_number_id`, never a tenant id directly, so `WhatsAppWebhookService` matches it against
   * this column to find WHICH tenant/branch a message belongs to. Mirrors `findById`'s shape
   * exactly (a single unique-ish lookup, `undefined` on no match) — `phone_number_id` has no
   * `UNIQUE` constraint of its own in `007_tenants_waba.sql` (only `UNIQUE(tenant_id, branch_id)`
   * does), but a real Meta phone number is only ever registered to one WABA/tenant in practice, so
   * `.maybeSingle()` is the correct real query shape here, same as `findById`.
   */
  async findByPhoneNumberId(phoneNumberId: string): Promise<WabaConfigRow | undefined> {
    const { data, error } = await this.client
      .from<WabaConfigRow>(TABLE)
      .select("*")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();
    if (error !== null) {
      throw new WabaConfigRepositoryError(
        `WabaConfigRepository.findByPhoneNumberId failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  async listByTenant(tenantId: string): Promise<readonly WabaConfigRow[]> {
    const { data, error } = await this.client
      .from<WabaConfigRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (error !== null) {
      throw new WabaConfigRepositoryError(
        `WabaConfigRepository.listByTenant failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  async countByTenant(tenantId: string): Promise<number> {
    const rows = await this.listByTenant(tenantId);
    return rows.length;
  }

  async updateById(id: string, values: WabaConfigUpdate): Promise<WabaConfigRow> {
    const { data, error } = await this.client
      .from<WabaConfigRow>(TABLE)
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new WabaConfigRepositoryError(
        `WabaConfigRepository.updateById failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async deleteById(id: string): Promise<void> {
    const client = this.client as unknown as DeletableSupabaseClient;
    const { error } = await client.from(TABLE).delete().eq("id", id);
    if (error !== null) {
      throw new WabaConfigRepositoryError(
        `WabaConfigRepository.deleteById failed: ${error.message}`,
      );
    }
  }
}
