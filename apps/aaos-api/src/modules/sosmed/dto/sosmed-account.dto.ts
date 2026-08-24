import { z } from "zod";

import { maskTail } from "../../superadmin/dto/tenant-response.dto.js";
import type { SosmedAccountRow } from "../infrastructure/sosmed-account.repository.js";

/**
 * `GET /api/v1/sosmed/accounts` response shape (AAOS-SOSMED-AUTOMATION Phase 4). Never returns the
 * raw `access_token` — only a masked tail, via the SAME `maskTail` helper
 * `WabaConfigResponseDto`/`TenantResponseDto` already use (`waba-config.dto.ts`'s own doc: "Never
 * returns the raw `access_token` — only a masked tail, matching `TenantResponseDto`'s masking
 * discipline"). This DTO follows that exact discipline rather than inventing a new one.
 */
export interface SosmedAccountResponseDto {
  readonly id: string;
  readonly tenantId: string;
  readonly salesHumanId?: string;
  readonly platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";
  readonly accountType: "OFFICIAL" | "SALES_PERSONAL";
  readonly accountName: string;
  readonly username?: string;
  readonly pageId?: string;
  readonly instagramAccountId?: string;
  readonly maskedAccessToken: string;
  readonly tokenExpiresAt?: string;
  readonly followerCount: number;
  readonly profilePicUrl?: string;
  readonly status: "CONNECTED" | "EXPIRED" | "ERROR";
  readonly lastSyncAt?: string;
  readonly createdAt: string;
}

export function toSosmedAccountDto(row: SosmedAccountRow): SosmedAccountResponseDto {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    ...(row.sales_human_id !== null ? { salesHumanId: row.sales_human_id } : {}),
    platform: row.platform as SosmedAccountResponseDto["platform"],
    accountType: row.account_type as SosmedAccountResponseDto["accountType"],
    accountName: row.account_name,
    ...(row.username !== null ? { username: row.username } : {}),
    ...(row.page_id !== null ? { pageId: row.page_id } : {}),
    ...(row.instagram_account_id !== null ? { instagramAccountId: row.instagram_account_id } : {}),
    maskedAccessToken: maskTail(row.access_token, 4),
    ...(row.token_expires_at !== null ? { tokenExpiresAt: row.token_expires_at } : {}),
    followerCount: row.follower_count,
    ...(row.profile_pic_url !== null ? { profilePicUrl: row.profile_pic_url } : {}),
    status: row.status as SosmedAccountResponseDto["status"],
    ...(row.last_sync_at !== null ? { lastSyncAt: row.last_sync_at } : {}),
    createdAt: row.created_at,
  };
}

/** `POST /api/v1/sosmed/oauth/sales/connect-links` — manager-only ("+ Hubungkan Akun Sales" > pick a sales human). */
export const CreateConnectLinkBodySchema = z.object({
  salesHumanId: z.string().trim().min(1, "salesHumanId must not be empty"),
});
export type CreateConnectLinkBodyDto = z.infer<typeof CreateConnectLinkBodySchema>;

export interface CreateConnectLinkResponseDto {
  readonly token: string;
  readonly expiresAt: string;
  readonly connectUrl: string;
}

/** `GET /api/v1/sosmed/oauth/official/start` / `.../oauth/sales/:token/start` responses — the URL the caller's browser should navigate to next. */
export interface OAuthStartResponseDto {
  readonly authorizeUrl: string;
}

export const OAuthCallbackQuerySchema = z.object({
  code: z.string().trim().min(1, "code must not be empty").optional(),
  state: z.string().trim().min(1, "state must not be empty").optional(),
  error: z.string().trim().optional(),
  error_description: z.string().trim().optional(),
});
export type OAuthCallbackQueryDto = z.infer<typeof OAuthCallbackQuerySchema>;

export interface OAuthCallbackResponseDto {
  readonly success: boolean;
  readonly message: string;
  readonly connectedAccounts?: readonly SosmedAccountResponseDto[];
}
