import type { SupabaseClientLike } from "@aos/lead-store";

import type {
  ScheduledPostStatus,
  SosmedContentType,
  SosmedMediaType,
  StoredScheduledPost,
} from "../domain/scheduled-post.js";

const TABLE = "scheduled_posts";

/** Raw `scheduled_posts` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/014_sosmed.sql`. */
export interface ScheduledPostRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly account_id: string | null;
  readonly caption: string;
  readonly media_url: string | null;
  readonly media_type: string | null;
  readonly hashtags: readonly string[] | null;
  readonly content_type: string | null;
  readonly product_id: string | null;
  readonly angle: string | null;
  readonly generated_by: string;
  readonly kai_package_id: string | null;
  readonly scheduled_at: string | null;
  readonly status: string;
  readonly published_at: string | null;
  readonly platform_post_id: string | null;
  readonly error_message: string | null;
  readonly reach: number;
  readonly impressions: number;
  readonly likes: number;
  readonly comments: number;
  readonly shares: number;
  readonly engagement_count: number;
  readonly insights_synced_at: string | null;
  readonly created_at: string;
}

export interface CreateScheduledPostInput {
  readonly id: string;
  readonly tenantId: string;
  readonly accountId?: string;
  readonly caption: string;
  readonly mediaUrl?: string;
  readonly mediaType?: SosmedMediaType;
  readonly hashtags?: readonly string[];
  readonly contentType?: SosmedContentType;
  readonly productId?: string;
  readonly angle?: string;
  readonly generatedBy?: string;
  readonly kaiPackageId?: string;
  readonly scheduledAt?: string;
  /** Phase 3 addition — defaults to `"DRAFT"` (the only value Phase 1 ever wrote) when omitted. */
  readonly status?: "DRAFT" | "SCHEDULED";
}

/** Phase 3 addition — `PUT /api/v1/sosmed/posts/:id`'s patch payload. Only supplied fields change. */
export interface UpdateScheduledPostInput {
  readonly caption?: string;
  readonly mediaUrl?: string;
  readonly mediaType?: SosmedMediaType;
  readonly hashtags?: readonly string[];
  readonly contentType?: SosmedContentType;
  readonly productId?: string;
  readonly angle?: string;
  readonly accountId?: string;
  readonly scheduledAt?: string;
  readonly status?: ScheduledPostStatus;
}

export interface UpdateScheduledPostStatusInput {
  readonly status: ScheduledPostStatus;
  readonly publishedAt?: string;
  readonly platformPostId?: string;
  readonly errorMessage?: string;
}

export class ScheduledPostRepositoryError extends Error {}

/**
 * A `SupabaseClientLike`-typed value whose real underlying object (see `app.module.ts`'s
 * `SUPABASE_CLIENT` wiring) also supports `.delete()`. `SupabaseClientLike` (`@aos/lead-store`'s
 * shared port) deliberately does not declare `.delete()` — same precedent as
 * `modules/scheduler/infrastructure/calendar-event.repository.ts`'s `DeletableSupabaseClient`,
 * copied verbatim here rather than widening the shared cross-package port for one more method.
 */
interface DeletableSupabaseClient {
  from(table: string): {
    delete(): {
      eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

function toDomain(row: ScheduledPostRow): StoredScheduledPost {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    ...(row.account_id !== null ? { accountId: row.account_id } : {}),
    caption: row.caption,
    ...(row.media_url !== null ? { mediaUrl: row.media_url } : {}),
    ...(row.media_type !== null ? { mediaType: row.media_type as SosmedMediaType } : {}),
    hashtags: row.hashtags ?? [],
    ...(row.content_type !== null ? { contentType: row.content_type as SosmedContentType } : {}),
    ...(row.product_id !== null ? { productId: row.product_id } : {}),
    ...(row.angle !== null ? { angle: row.angle } : {}),
    generatedBy: row.generated_by,
    ...(row.kai_package_id !== null ? { kaiPackageId: row.kai_package_id } : {}),
    ...(row.scheduled_at !== null ? { scheduledAt: row.scheduled_at } : {}),
    status: row.status as ScheduledPostStatus,
    ...(row.published_at !== null ? { publishedAt: row.published_at } : {}),
    ...(row.platform_post_id !== null ? { platformPostId: row.platform_post_id } : {}),
    ...(row.error_message !== null ? { errorMessage: row.error_message } : {}),
    reach: row.reach,
    impressions: row.impressions,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    engagementCount: row.engagement_count,
    ...(row.insights_synced_at !== null ? { insightsSyncedAt: row.insights_synced_at } : {}),
    createdAt: row.created_at,
  };
}

/**
 * Supabase-backed persistence for `scheduled_posts` (AAOS-SOSMED-AUTOMATION Phase 1, CRUD/cron
 * methods added Phase 3), on the same shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI
 * token every other `aaos-api` repository uses.
 *
 * Phase 3 wires this into real controller endpoints (`SosmedPostsService`) and the `@Cron`
 * scheduler (`SosmedSchedulerService`) — Phase 1 built it unwired ("domain + schema … lowest risk,
 * most reusable regardless of what happens with OAuth"); Phase 2 added `SosmedPublishingService`,
 * also unwired. Neither this repository nor the controller reads/writes `sosmed_accounts` — still
 * no OAuth flow exists to populate it safely (coordinator note point 2).
 */
export class ScheduledPostRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(input: CreateScheduledPostInput): Promise<StoredScheduledPost> {
    const { data, error } = await this.client
      .from<ScheduledPostRow>(TABLE)
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        account_id: input.accountId ?? null,
        caption: input.caption,
        media_url: input.mediaUrl ?? null,
        media_type: input.mediaType ?? null,
        hashtags: input.hashtags ? [...input.hashtags] : [],
        content_type: input.contentType ?? null,
        product_id: input.productId ?? null,
        angle: input.angle ?? null,
        generated_by: input.generatedBy ?? "TAMARA",
        kai_package_id: input.kaiPackageId ?? null,
        scheduled_at: input.scheduledAt ?? null,
        status: input.status ?? "DRAFT",
        published_at: null,
        platform_post_id: null,
        error_message: null,
        reach: 0,
        impressions: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement_count: 0,
        insights_synced_at: null,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new ScheduledPostRepositoryError(
        `ScheduledPostRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return toDomain(data);
  }

  async findById(tenantId: string, id: string): Promise<StoredScheduledPost | undefined> {
    const { data, error } = await this.client
      .from<ScheduledPostRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new ScheduledPostRepositoryError(
        `ScheduledPostRepository.findById failed: ${error.message}`,
      );
    }
    return data === null ? undefined : toDomain(data);
  }

  async listByTenant(
    tenantId: string,
    status?: ScheduledPostStatus,
  ): Promise<readonly StoredScheduledPost[]> {
    let query = this.client
      .from<ScheduledPostRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (status !== undefined) {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error !== null) {
      throw new ScheduledPostRepositoryError(
        `ScheduledPostRepository.listByTenant failed: ${error.message}`,
      );
    }
    return (data ?? []).map(toDomain);
  }

  /** `PUT /api/v1/sosmed/posts/:id` — patches only the supplied fields (spec's Post Manager "Edit"). */
  async update(id: string, input: UpdateScheduledPostInput): Promise<void> {
    const { error } = await this.client
      .from<ScheduledPostRow>(TABLE)
      .update({
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.mediaUrl !== undefined ? { media_url: input.mediaUrl } : {}),
        ...(input.mediaType !== undefined ? { media_type: input.mediaType } : {}),
        ...(input.hashtags !== undefined ? { hashtags: [...input.hashtags] } : {}),
        ...(input.contentType !== undefined ? { content_type: input.contentType } : {}),
        ...(input.productId !== undefined ? { product_id: input.productId } : {}),
        ...(input.angle !== undefined ? { angle: input.angle } : {}),
        ...(input.accountId !== undefined ? { account_id: input.accountId } : {}),
        ...(input.scheduledAt !== undefined ? { scheduled_at: input.scheduledAt } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      })
      .eq("id", id);
    if (error !== null) {
      throw new ScheduledPostRepositoryError(
        `ScheduledPostRepository.update failed: ${error.message}`,
      );
    }
  }

  /** `SCHEDULED` posts due to publish — the `@Cron` scheduler's own read (`SosmedSchedulerService.checkAndPublishScheduled`), mirroring `CalendarEventRepository.listDuePending`'s shape. */
  async listDueScheduled(
    tenantId: string,
    nowIso: string,
  ): Promise<readonly StoredScheduledPost[]> {
    const { data, error } = await this.client
      .from<ScheduledPostRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "SCHEDULED")
      .lte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(200);
    if (error !== null) {
      throw new ScheduledPostRepositoryError(
        `ScheduledPostRepository.listDueScheduled failed: ${error.message}`,
      );
    }
    return (data ?? []).map(toDomain);
  }

  async updateStatus(id: string, input: UpdateScheduledPostStatusInput): Promise<void> {
    const { error } = await this.client
      .from<ScheduledPostRow>(TABLE)
      .update({
        status: input.status,
        ...(input.publishedAt !== undefined ? { published_at: input.publishedAt } : {}),
        ...(input.platformPostId !== undefined ? { platform_post_id: input.platformPostId } : {}),
        ...(input.errorMessage !== undefined ? { error_message: input.errorMessage } : {}),
      })
      .eq("id", id);
    if (error !== null) {
      throw new ScheduledPostRepositoryError(
        `ScheduledPostRepository.updateStatus failed: ${error.message}`,
      );
    }
  }

  async delete(id: string): Promise<void> {
    const client = this.client as unknown as DeletableSupabaseClient;
    const { error } = await client.from(TABLE).delete().eq("id", id);
    if (error !== null) {
      throw new ScheduledPostRepositoryError(
        `ScheduledPostRepository.delete failed: ${error.message}`,
      );
    }
  }
}
