/**
 * Persisted shape for one scheduled/published organic post (AAOS-SOSMED-AUTOMATION Phase 1).
 * COLUMN-FOR-COLUMN with `scheduled_posts` in `supabase/migrations/014_sosmed.sql`. Mirrors
 * `modules/abtesting/domain/ab-test.ts`'s convention: a plain `Stored*` interface in camelCase,
 * mapped to/from snake_case rows inside `ScheduledPostRepository`.
 */
export type SosmedMediaType = "IMAGE" | "VIDEO" | "CAROUSEL";
export type SosmedContentType =
  "PROMO" | "EDUKASI" | "TESTIMONI" | "BTS" | "TIPS" | "MARKET_UPDATE";
export type ScheduledPostStatus =
  "DRAFT" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED";

export interface StoredScheduledPost {
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
