import type { SupabaseClientLike } from "@aos/lead-store";

import type {
  SosmedAccountStatus,
  SosmedAccountType,
  SosmedPlatform,
  StoredSosmedAccount,
} from "../domain/sosmed-account.js";

const TABLE = "sosmed_accounts";

/** Raw `sosmed_accounts` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/014_sosmed.sql`. */
export interface SosmedAccountRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly sales_human_id: string | null;
  readonly platform: string;
  readonly account_type: string;
  readonly account_name: string;
  readonly username: string | null;
  readonly page_id: string | null;
  readonly instagram_account_id: string | null;
  readonly access_token: string;
  readonly token_expires_at: string | null;
  readonly follower_count: number;
  readonly profile_pic_url: string | null;
  readonly status: string;
  readonly last_sync_at: string | null;
  readonly created_at: string;
}

export interface CreateSosmedAccountInput {
  readonly id: string;
  readonly tenantId: string;
  readonly salesHumanId?: string;
  readonly platform: SosmedPlatform;
  readonly accountType: SosmedAccountType;
  readonly accountName: string;
  readonly username?: string;
  readonly pageId?: string;
  readonly instagramAccountId?: string;
  /** Live credential — see `StoredSosmedAccount.accessToken`'s doc for custody discipline. */
  readonly accessToken: string;
  readonly tokenExpiresAt?: string;
}

export class SosmedAccountRepositoryError extends Error {}

/** Same `.delete()`-widening precedent as `WabaConfigRepository`/`ScheduledPostRepository` — see either's docstring. */
interface DeletableSupabaseClient {
  from(table: string): {
    delete(): {
      eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

function toDomain(row: SosmedAccountRow): StoredSosmedAccount {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    ...(row.sales_human_id !== null ? { salesHumanId: row.sales_human_id } : {}),
    platform: row.platform as SosmedPlatform,
    accountType: row.account_type as SosmedAccountType,
    accountName: row.account_name,
    ...(row.username !== null ? { username: row.username } : {}),
    ...(row.page_id !== null ? { pageId: row.page_id } : {}),
    ...(row.instagram_account_id !== null ? { instagramAccountId: row.instagram_account_id } : {}),
    accessToken: row.access_token,
    ...(row.token_expires_at !== null ? { tokenExpiresAt: row.token_expires_at } : {}),
    followerCount: row.follower_count,
    ...(row.profile_pic_url !== null ? { profilePicUrl: row.profile_pic_url } : {}),
    status: row.status as SosmedAccountStatus,
    ...(row.last_sync_at !== null ? { lastSyncAt: row.last_sync_at } : {}),
    createdAt: row.created_at,
  };
}

/**
 * Supabase-backed persistence for `sosmed_accounts` (AAOS-SOSMED-AUTOMATION Phase 4) — the FIRST
 * repository to ever read/write this table (Phase 1 deliberately left it unwired — no OAuth flow
 * existed to populate it safely; see `domain/sosmed-account.ts`'s own doc). `access_token` is
 * stored as plain `TEXT`, no application-level encryption layer, matching the EXACT precedent
 * already verified in this codebase for `waba_configs.access_token`/`tenants.meta_access_token`
 * (both plain `TEXT` columns relying on Supabase's own at-rest encryption) — see
 * `SosmedOAuthService`'s class doc for the full reasoning on why this repository does not invent a
 * stricter standard.
 *
 * Never returns anything MORE than the raw row this table actually holds — masking for API
 * responses happens one layer up, in `toSosmedAccountDto` (`dto/sosmed-account.dto.ts`), mirroring
 * `WabaConfigRepository`/`toWabaDto`'s split (repository returns the real row; the response DTO
 * mapper is the one place the mask is applied).
 */
export class SosmedAccountRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(input: CreateSosmedAccountInput): Promise<SosmedAccountRow> {
    const { data, error } = await this.client
      .from<SosmedAccountRow>(TABLE)
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        sales_human_id: input.salesHumanId ?? null,
        platform: input.platform,
        account_type: input.accountType,
        account_name: input.accountName,
        username: input.username ?? null,
        page_id: input.pageId ?? null,
        instagram_account_id: input.instagramAccountId ?? null,
        access_token: input.accessToken,
        token_expires_at: input.tokenExpiresAt ?? null,
        follower_count: 0,
        profile_pic_url: null,
        status: "CONNECTED",
        last_sync_at: null,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new SosmedAccountRepositoryError(
        `SosmedAccountRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async findById(id: string): Promise<SosmedAccountRow | undefined> {
    const { data, error } = await this.client
      .from<SosmedAccountRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new SosmedAccountRepositoryError(
        `SosmedAccountRepository.findById failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  /**
   * Returns raw rows (not `toDomain`-mapped) — the same split `WabaConfigRepository.listByTenant`
   * uses, so the ONE masking step (`toSosmedAccountDto`, `dto/sosmed-account.dto.ts`) is applied by
   * the caller from the real row, never from an already-lossy intermediate shape.
   */
  async listByTenant(tenantId: string): Promise<readonly SosmedAccountRow[]> {
    const { data, error } = await this.client
      .from<SosmedAccountRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (error !== null) {
      throw new SosmedAccountRepositoryError(
        `SosmedAccountRepository.listByTenant failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  async deleteById(id: string): Promise<void> {
    const client = this.client as unknown as DeletableSupabaseClient;
    const { error } = await client.from(TABLE).delete().eq("id", id);
    if (error !== null) {
      throw new SosmedAccountRepositoryError(
        `SosmedAccountRepository.deleteById failed: ${error.message}`,
      );
    }
  }
}

export { toDomain as sosmedAccountRowToDomain };
