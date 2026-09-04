/**
 * Client-safe DTO shapes for `/sosmed/*` (AAOS-SOSMED-AUTOMATION Phase 5) — mirrors
 * `apps/aaos-api`'s real `modules/sosmed` DTOs (`dto/scheduled-post.dto.ts`,
 * `dto/sosmed-account.dto.ts`, `modules/llm/dto/generate-caption.dto.ts`,
 * `modules/llm/dto/generate-hashtags.dto.ts`) hand-written here, same discipline as every other
 * type in `dashboard.types.ts` (AAOS-W4A coordinator note #2 — never import a Node-only `aaos-api`
 * file into this "use client" app).
 */

export type SosmedPlatform = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";
export type SosmedAccountType = "OFFICIAL" | "SALES_PERSONAL";
export type SosmedAccountStatus = "CONNECTED" | "EXPIRED" | "ERROR";

export interface SosmedAccountDto {
  readonly id: string;
  readonly tenantId: string;
  readonly salesHumanId?: string;
  readonly platform: SosmedPlatform;
  readonly accountType: SosmedAccountType;
  readonly accountName: string;
  readonly username?: string;
  readonly pageId?: string;
  readonly instagramAccountId?: string;
  readonly maskedAccessToken: string;
  readonly tokenExpiresAt?: string;
  readonly followerCount: number;
  readonly profilePicUrl?: string;
  readonly status: SosmedAccountStatus;
  readonly lastSyncAt?: string;
  readonly createdAt: string;
}

export type SosmedMediaType = "IMAGE" | "VIDEO" | "CAROUSEL";
export type SosmedContentType =
  "PROMO" | "EDUKASI" | "TESTIMONI" | "BTS" | "TIPS" | "MARKET_UPDATE";
export type ScheduledPostStatus =
  "DRAFT" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED";

export type SosmedPublishTargetDto =
  | { readonly platform: "FACEBOOK"; readonly pageId: string; readonly accessToken: string }
  | { readonly platform: "INSTAGRAM"; readonly igUserId: string; readonly accessToken: string };

export interface ScheduledPostDto {
  readonly id: string;
  readonly tenantId: string;
  readonly accountId?: string;
  readonly caption: string;
  readonly mediaUrl?: string;
  readonly mediaType?: SosmedMediaType;
  readonly hashtags: readonly string[];
  readonly contentType?: SosmedContentType;
  readonly productId?: string;
  readonly angle?: string;
  readonly generatedBy: string;
  readonly kaiPackageId?: string;
  readonly scheduledAt?: string;
  readonly status: ScheduledPostStatus;
  readonly publishedAt?: string;
  readonly platformPostId?: string;
  readonly errorMessage?: string;
  readonly reach: number;
  readonly impressions: number;
  readonly likes: number;
  readonly comments: number;
  readonly shares: number;
  readonly engagementCount: number;
  readonly insightsSyncedAt?: string;
  readonly createdAt: string;
}

export interface CreateScheduledPostInput {
  readonly caption: string;
  readonly mediaUrl?: string;
  readonly mediaType?: SosmedMediaType;
  readonly hashtags?: readonly string[];
  readonly contentType?: SosmedContentType;
  readonly productId?: string;
  readonly angle?: string;
  readonly accountId?: string;
  readonly generatedBy?: string;
  readonly scheduledAt?: string;
  readonly status: "DRAFT" | "SCHEDULED";
  readonly publishTarget?: SosmedPublishTargetDto;
}

/** `LlmUnavailableResponseDto` mirrored client-side — every `available: false` LLM response shape in this app. */
export interface LlmUnavailableDto {
  readonly available: false;
  readonly reason: "NO_API_KEY" | "RATE_LIMITED" | "PROVIDER_ERROR" | "INVALID_RESPONSE";
  readonly message: string;
}

export type GenerateCaptionResponseDto =
  | {
      readonly available: true;
      readonly instagramCaption: string;
      readonly facebookCaption: string;
    }
  | LlmUnavailableDto;

export type GenerateHashtagsResponseDto =
  { readonly available: true; readonly hashtags: readonly string[] } | LlmUnavailableDto;

export type SosmedTone = "FRIENDLY" | "PROFESSIONAL" | "EXCITED" | "INFORMATIVE";
export type SosmedVertical = "AUTOMOTIVE" | "PROPERTY";

export interface GenerateCaptionInput {
  readonly contentType: SosmedContentType;
  readonly productRef: string;
  readonly angle: string;
  readonly tone: SosmedTone;
  readonly vertical: SosmedVertical;
}

export interface GenerateHashtagsInput {
  readonly productName: string;
  readonly brand: string;
  readonly location: string;
  readonly vertical: SosmedVertical;
}

export interface OAuthStartResponseDto {
  readonly authorizeUrl: string;
}

export interface CreateConnectLinkResponseDto {
  readonly token: string;
  readonly expiresAt: string;
  readonly connectUrl: string;
}
