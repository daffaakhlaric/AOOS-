import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "system_webhook_config";
const FIXED_ID = "default";

/**
 * Raw `system_webhook_config` row shape (snake_case) — COLUMN-FOR-COLUMN with
 * `supabase/migrations/019_system_webhook_config.sql`. Every column but `id`/`updated_at` is
 * NULLABLE — `null` means "no override, use `.env`" (see that migration's own comment).
 */
export interface SystemWebhookConfigRow {
  readonly id: string;
  readonly whatsapp_webhook_verify_token: string | null;
  readonly whatsapp_webhook_app_secret: string | null;
  readonly meta_webhook_verify_token: string | null;
  readonly meta_webhook_app_secret: string | null;
  readonly updated_at: string | null;
}

export type SystemWebhookConfigPatch = Partial<Omit<SystemWebhookConfigRow, "id" | "updated_at">>;

export class SystemWebhookConfigRepositoryError extends Error {}

/**
 * Supabase-backed persistence for the single, fixed-`id`-`'default'` `system_webhook_config` row
 * (AAOS-SETTINGS-WEBHOOK-CONFIG, Part C). Application code NEVER inserts a second row — `get()`
 * simply reads `id = 'default'` (returning `undefined` when the row doesn't exist yet, a real,
 * valid "no overrides saved" state, not an error), and `upsert()` always writes onto that same
 * fixed id (`SupabaseClientLike`'s narrow port has no native `.upsert()`, so this does a real
 * update-then-insert-if-missing — same "no row returned is not necessarily an error" shape
 * `WabaConfigRepository.updateById` already establishes, just followed by a real fallback insert
 * here instead of throwing).
 */
export class SystemWebhookConfigRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async get(): Promise<SystemWebhookConfigRow | undefined> {
    const { data, error } = await this.client
      .from<SystemWebhookConfigRow>(TABLE)
      .select("*")
      .eq("id", FIXED_ID)
      .maybeSingle();
    if (error !== null) {
      throw new SystemWebhookConfigRepositoryError(
        `SystemWebhookConfigRepository.get failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  async upsert(patch: SystemWebhookConfigPatch): Promise<SystemWebhookConfigRow> {
    const updated_at = new Date().toISOString();
    const updateResult = await this.client
      .from<SystemWebhookConfigRow>(TABLE)
      .update({ ...patch, updated_at })
      .eq("id", FIXED_ID)
      .select("*")
      .single();
    if (updateResult.error !== null) {
      throw new SystemWebhookConfigRepositoryError(
        `SystemWebhookConfigRepository.upsert (update) failed: ${updateResult.error.message}`,
      );
    }
    if (updateResult.data !== null) {
      return updateResult.data;
    }

    // No existing row — the ONE real insert this table ever does, always onto the fixed id.
    const insertResult = await this.client
      .from<SystemWebhookConfigRow>(TABLE)
      .insert({ id: FIXED_ID, ...patch, updated_at })
      .select("*")
      .single();
    if (insertResult.error !== null || insertResult.data === null) {
      throw new SystemWebhookConfigRepositoryError(
        `SystemWebhookConfigRepository.upsert (insert) failed: ${
          insertResult.error?.message ?? "no row returned"
        }`,
      );
    }
    return insertResult.data;
  }
}
