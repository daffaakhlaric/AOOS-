import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "recycling_settings";

/** Raw `recycling_settings` row shape — COLUMN-FOR-COLUMN with `supabase/migrations/010_recycling.sql`. */
export interface RecyclingSettingsRow {
  readonly tenant_id: string;
  readonly auto_mode: boolean;
  readonly updated_at: string;
}

export class RecyclingSettingsRepositoryError extends Error {}

/**
 * Supabase-backed persistence for the "Auto Mode: ON/OFF" toggle (coordinator note section 8) —
 * one row per tenant, upserted rather than always-present-by-migration so a tenant provisioned
 * after this migration ran still gets an honest default (`true`, matching the seeded row for the
 * single composed tenant).
 */
export class RecyclingSettingsRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /** Defaults to Auto Mode ON when no row exists yet for this tenant — matches the migration's own seeded default. */
  async getAutoMode(tenantId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from<RecyclingSettingsRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error !== null) {
      throw new RecyclingSettingsRepositoryError(
        `RecyclingSettingsRepository.getAutoMode failed: ${error.message}`,
      );
    }
    return data?.auto_mode ?? true;
  }

  async setAutoMode(tenantId: string, autoMode: boolean): Promise<void> {
    const existing = await this.client
      .from<RecyclingSettingsRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (existing.error !== null) {
      throw new RecyclingSettingsRepositoryError(
        `RecyclingSettingsRepository.setAutoMode failed: ${existing.error.message}`,
      );
    }
    const updatedAt = new Date().toISOString();
    if (existing.data === null) {
      const { error } = await this.client
        .from<RecyclingSettingsRow>(TABLE)
        .insert({ tenant_id: tenantId, auto_mode: autoMode, updated_at: updatedAt });
      if (error !== null) {
        throw new RecyclingSettingsRepositoryError(
          `RecyclingSettingsRepository.setAutoMode (insert) failed: ${error.message}`,
        );
      }
      return;
    }
    const { error } = await this.client
      .from<RecyclingSettingsRow>(TABLE)
      .update({ auto_mode: autoMode, updated_at: updatedAt })
      .eq("tenant_id", tenantId);
    if (error !== null) {
      throw new RecyclingSettingsRepositoryError(
        `RecyclingSettingsRepository.setAutoMode (update) failed: ${error.message}`,
      );
    }
  }
}
