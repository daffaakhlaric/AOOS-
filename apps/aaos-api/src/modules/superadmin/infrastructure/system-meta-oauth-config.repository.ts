import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "system_meta_oauth_config";
const FIXED_ID = "default";

/**
 * Raw `system_meta_oauth_config` row shape (snake_case) — COLUMN-FOR-COLUMN with
 * `supabase/migrations/049_meta_oauth_foundation.sql`. Every column but `id`/`updated_at` is
 * NULLABLE — `null` means "no override, use `.env`" (same convention as
 * `system_webhook_config`/`SystemWebhookConfigRow`). `meta_app_secret_encrypted` is the
 * `EncryptionService`-produced `"iv:authTag:encrypted"` envelope, NEVER a plaintext secret — this
 * repository itself never encrypts/decrypts (that's `MetaOAuthConfigService`'s job, one layer up,
 * mirroring how `WebhookSecretsService` — not `SystemWebhookConfigRepository` — owns the
 * NULL-means-fallback resolution logic).
 */
export interface SystemMetaOAuthConfigRow {
  readonly id: string;
  readonly meta_app_id: string | null;
  readonly meta_app_secret_encrypted: string | null;
  readonly wa_config_id: string | null;
  readonly updated_at: string | null;
}

export type SystemMetaOAuthConfigPatch = Partial<
  Omit<SystemMetaOAuthConfigRow, "id" | "updated_at">
>;

export class SystemMetaOAuthConfigRepositoryError extends Error {}

/**
 * Supabase-backed persistence for the single, fixed-`id`-`'default'` `system_meta_oauth_config`
 * row (EYVRA-META-OAUTH-WHATSAPP-SETUP, Sprint 1 — Foundation). Deliberately a SIBLING table to
 * `system_webhook_config`, not an extension of it — see this repository's own migration header
 * for the reasoning (different domain: OAuth app credentials vs. webhook signature secrets, and
 * `meta_app_secret_encrypted` needs `EncryptionService`, a real semantic difference from every
 * existing plain-TEXT column on `system_webhook_config`).
 *
 * Shape and behavior COPIED from `SystemWebhookConfigRepository` on purpose (same real,
 * already-audited "update-then-insert-if-missing" pattern, same "no row yet is a real, valid, not
 * an error" `get()` semantics) — application code NEVER inserts a second row; `upsert()` always
 * writes onto the fixed `'default'` id.
 */
export class SystemMetaOAuthConfigRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async get(): Promise<SystemMetaOAuthConfigRow | undefined> {
    const { data, error } = await this.client
      .from<SystemMetaOAuthConfigRow>(TABLE)
      .select("*")
      .eq("id", FIXED_ID)
      .maybeSingle();
    if (error !== null) {
      throw new SystemMetaOAuthConfigRepositoryError(
        `SystemMetaOAuthConfigRepository.get failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  async upsert(patch: SystemMetaOAuthConfigPatch): Promise<SystemMetaOAuthConfigRow> {
    const updated_at = new Date().toISOString();
    const updateResult = await this.client
      .from<SystemMetaOAuthConfigRow>(TABLE)
      .update({ ...patch, updated_at })
      .eq("id", FIXED_ID)
      .select("*")
      .single();
    if (updateResult.error !== null) {
      throw new SystemMetaOAuthConfigRepositoryError(
        `SystemMetaOAuthConfigRepository.upsert (update) failed: ${updateResult.error.message}`,
      );
    }
    if (updateResult.data !== null) {
      return updateResult.data;
    }

    // No existing row — the ONE real insert this table ever does, always onto the fixed id.
    const insertResult = await this.client
      .from<SystemMetaOAuthConfigRow>(TABLE)
      .insert({ id: FIXED_ID, ...patch, updated_at })
      .select("*")
      .single();
    if (insertResult.error !== null || insertResult.data === null) {
      throw new SystemMetaOAuthConfigRepositoryError(
        `SystemMetaOAuthConfigRepository.upsert (insert) failed: ${
          insertResult.error?.message ?? "no row returned"
        }`,
      );
    }
    return insertResult.data;
  }
}
