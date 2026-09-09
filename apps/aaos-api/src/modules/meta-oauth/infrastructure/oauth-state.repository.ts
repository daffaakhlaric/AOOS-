import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "oauth_states";

/** Raw `oauth_states` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/049_meta_oauth_foundation.sql`. */
export interface OAuthStateRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly state: string;
  readonly redirect_after: string | null;
  readonly expires_at: string;
  readonly created_at: string;
}

export type OAuthStateInsert = Omit<OAuthStateRow, "id" | "created_at">;

export class OAuthStateRepositoryError extends Error {}

/**
 * Same `.delete()` workaround as `modules/settings/infrastructure/waba-config.repository.ts`'s
 * `DeletableSupabaseClient` — see that file's docstring for why `SupabaseClientLike` deliberately
 * doesn't declare `.delete()`, and why a narrow, file-local cast is the established pattern for
 * the one repository per feature that genuinely needs a hard row delete.
 */
interface DeletableSupabaseClient {
  from(table: string): {
    delete(): {
      eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

/**
 * Supabase-backed persistence for `oauth_states` (Sprint 2 — real Meta OAuth CSRF `state`
 * bookkeeping, `supabase/migrations/049_meta_oauth_foundation.sql`). Real `tenant_id TEXT`
 * convention (never `tenants.id`), mirrors `SosmedModule`'s in-memory `OAuthStateStore`'s exact
 * single-use-by-construction discipline (`consume()` always deletes whatever row it found,
 * matched or not, so a replayed/guessed `state` can never succeed twice) but backed by the real
 * DB table this sprint's migration already provisioned for it — a durable row survives an
 * `aaos-api` process restart mid-redirect, unlike `SosmedModule`'s process-local `Map`.
 */
export class OAuthStateRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(values: OAuthStateInsert): Promise<OAuthStateRow> {
    const { data, error } = await this.client
      .from<OAuthStateRow>(TABLE)
      .insert(values)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new OAuthStateRepositoryError(
        `OAuthStateRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  private async findByState(state: string): Promise<OAuthStateRow | undefined> {
    const { data, error } = await this.client
      .from<OAuthStateRow>(TABLE)
      .select("*")
      .eq("state", state)
      .maybeSingle();
    if (error !== null) {
      throw new OAuthStateRepositoryError(
        `OAuthStateRepository.findByState failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  private async deleteByState(state: string): Promise<void> {
    const client = this.client as unknown as DeletableSupabaseClient;
    const { error } = await client.from(TABLE).delete().eq("state", state);
    if (error !== null) {
      throw new OAuthStateRepositoryError(
        `OAuthStateRepository.deleteByState failed: ${error.message}`,
      );
    }
  }

  /**
   * Validates and consumes a `state` value from an OAuth callback. Single-use by construction —
   * whether the row is found, expired, or not, ANY existing row for this `state` is deleted before
   * returning, so a replayed/guessed `state` can never succeed twice (same discipline
   * `modules/sosmed/oauth/oauth-state-store.ts`'s `OAuthStateStore.consume` already establishes).
   * `now` is caller-supplied (never `new Date()` internally) so tests can control expiry
   * deterministically.
   */
  async consume(state: string, now: Date): Promise<OAuthStateRow | undefined> {
    const row = await this.findByState(state);
    if (row === undefined) {
      return undefined;
    }
    await this.deleteByState(state);
    if (new Date(row.expires_at).getTime() < now.getTime()) {
      return undefined;
    }
    return row;
  }
}
