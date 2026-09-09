import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "token_refresh_log";

/** Raw `token_refresh_log` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/049_meta_oauth_foundation.sql`. */
export interface TokenRefreshLogRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly connection_type: "meta" | "wa";
  readonly success: boolean;
  readonly error_message: string | null;
  readonly new_expires_at: string | null;
  readonly refreshed_at: string;
}

export type TokenRefreshLogInsert = Omit<TokenRefreshLogRow, "id" | "refreshed_at">;

export class TokenRefreshLogRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `token_refresh_log` (Sprint 2 — real audit trail for
 * `MetaOAuthService.refreshTokenIfNeeded`, `supabase/migrations/049_meta_oauth_foundation.sql`).
 * Write-only from this app's perspective today (no real consumer reads it back yet — a future
 * Settings "last refreshed" status card is the documented real reader, per that migration's own
 * header comment) — `insert` is the only method this sprint needs.
 */
export class TokenRefreshLogRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(values: TokenRefreshLogInsert): Promise<TokenRefreshLogRow> {
    const { data, error } = await this.client
      .from<TokenRefreshLogRow>(TABLE)
      .insert(values)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new TokenRefreshLogRepositoryError(
        `TokenRefreshLogRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }
}
