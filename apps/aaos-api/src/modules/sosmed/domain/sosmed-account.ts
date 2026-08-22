/**
 * Persisted shape for one connected social media account (AAOS-SOSMED-AUTOMATION Phase 1).
 * COLUMN-FOR-COLUMN with `sosmed_accounts` in `supabase/migrations/014_sosmed.sql`. Mirrors
 * `modules/lookalike/domain/meta-audience.ts`'s convention: a plain `Stored*` interface in
 * camelCase, mapped to/from snake_case rows inside a repository.
 *
 * Deliberately NO repository exists for this table yet — the coordinator note is explicit that
 * Phase 1 must not write a real `accessToken` since there is no OAuth flow to produce one safely.
 * This type exists so later phases (the OAuth flows) have a stable, already-reviewed shape to
 * build a real repository against, per the coordinator note's "build the full real schema now …
 * so later phases have a stable foundation" instruction.
 */
export type SosmedPlatform = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";
export type SosmedAccountType = "OFFICIAL" | "SALES_PERSONAL";
export type SosmedAccountStatus = "CONNECTED" | "EXPIRED" | "ERROR";

export interface StoredSosmedAccount {
  readonly id: string;
  readonly tenantId: string;
  readonly salesHumanId?: string;
  readonly platform: SosmedPlatform;
  readonly accountType: SosmedAccountType;
  readonly accountName: string;
  readonly username?: string;
  readonly pageId?: string;
  readonly instagramAccountId?: string;
  /**
   * Live credential capable of posting as the connected Page/IG account — never logged, never
   * returned to a dashboard client verbatim. No Phase 1 code reads or writes this field; it is
   * declared here only so the type matches the real table column-for-column.
   */
  readonly accessToken: string;
  readonly tokenExpiresAt?: string;
  readonly followerCount: number;
  readonly profilePicUrl?: string;
  readonly status: SosmedAccountStatus;
  readonly lastSyncAt?: string;
  readonly createdAt: string;
}
