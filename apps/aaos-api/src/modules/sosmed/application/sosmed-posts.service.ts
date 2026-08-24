import { randomUUID } from "node:crypto";

import { NotFoundError, ValidationError } from "@aos/errors";
import type { InstagramMediaSpec } from "@aos/meta-organic-connector";
import { Inject, Injectable, Optional } from "@nestjs/common";

import type { AaosApiConfig } from "../../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../../di-tokens.js";
import type { ScheduledPostStatus, StoredScheduledPost } from "../domain/scheduled-post.js";
import type {
  CreateScheduledPostBodyDto,
  PublishNowBodyDto,
  UpdateScheduledPostBodyDto,
} from "../dto/scheduled-post.dto.js";
import { ScheduledPostRepository } from "../infrastructure/scheduled-post.repository.js";

import {
  PendingAccessTokenStore,
  type PendingPublishTarget,
} from "./pending-access-token-store.js";
import { SosmedPublishingService } from "./sosmed-publishing.service.js";

/**
 * `POST/GET/PUT/DELETE /api/v1/sosmed/posts*` + `.../publish-now` (AAOS-SOSMED-AUTOMATION Phase
 * 3). Single-tenant, same discipline as every other service in this app (coordinator note point
 * 3) — every method operates on `this.config.AAOS_TENANT_ID`, no per-tenant loop.
 *
 * `publishNow` is the ONE method that actually calls `SosmedPublishingService` — used both by the
 * manager-triggered `POST .../publish-now` endpoint (a fresh `body` target, never stored) AND by
 * `SosmedSchedulerService`'s unattended `@Cron` loop (no `body`, falls back to whatever
 * `publishTarget` was supplied at create/update time via `PendingAccessTokenStore`). See that
 * store's own docstring for why nothing here is ever written to Supabase.
 */
@Injectable()
export class SosmedPostsService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    private readonly repository: ScheduledPostRepository,
    private readonly publishingService: SosmedPublishingService,
    private readonly pendingTokens: PendingAccessTokenStore,
    // `@Optional()` — a bare `Function`-typed constructor param with only a default value still
    // gets a real DI resolution attempt from Nest without this, crashing bootstrap (see
    // `AbTestingService`'s own `now` param doc for the same precedent).
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  private get tenantId(): string {
    return this.config.AAOS_TENANT_ID;
  }

  // ---------------------------------------------------------------------------------------------
  // CRUD — `GET/POST/PUT/DELETE /api/v1/sosmed/posts*`.
  // ---------------------------------------------------------------------------------------------

  /** `GET /api/v1/sosmed/posts?status=` — backs the Post Manager's Terjadwal/Sudah Post/Draft/Gagal tabs. */
  async listPosts(status?: ScheduledPostStatus): Promise<readonly StoredScheduledPost[]> {
    return this.repository.listByTenant(this.tenantId, status);
  }

  async getPost(id: string): Promise<StoredScheduledPost> {
    return this.findOrThrow(id);
  }

  /** `POST /api/v1/sosmed/posts`. */
  async createPost(body: CreateScheduledPostBodyDto): Promise<StoredScheduledPost> {
    const created = await this.repository.create({
      id: randomUUID(),
      tenantId: this.tenantId,
      caption: body.caption,
      ...(body.mediaUrl !== undefined ? { mediaUrl: body.mediaUrl } : {}),
      ...(body.mediaType !== undefined ? { mediaType: body.mediaType } : {}),
      ...(body.hashtags !== undefined ? { hashtags: body.hashtags } : {}),
      ...(body.contentType !== undefined ? { contentType: body.contentType } : {}),
      ...(body.productId !== undefined ? { productId: body.productId } : {}),
      ...(body.angle !== undefined ? { angle: body.angle } : {}),
      ...(body.accountId !== undefined ? { accountId: body.accountId } : {}),
      ...(body.generatedBy !== undefined ? { generatedBy: body.generatedBy } : {}),
      ...(body.kaiPackageId !== undefined ? { kaiPackageId: body.kaiPackageId } : {}),
      ...(body.scheduledAt !== undefined ? { scheduledAt: body.scheduledAt } : {}),
      status: body.status,
    });
    if (body.publishTarget !== undefined) {
      this.pendingTokens.set(created.id, body.publishTarget);
    }
    return created;
  }

  /** `PUT /api/v1/sosmed/posts/:id` — only supplied fields are patched. */
  async updatePost(id: string, body: UpdateScheduledPostBodyDto): Promise<StoredScheduledPost> {
    const existing = await this.findOrThrow(id);
    if (
      body.status === "SCHEDULED" &&
      body.scheduledAt === undefined &&
      existing.scheduledAt === undefined
    ) {
      throw new ValidationError("scheduledAt wajib diisi sebelum status post diubah ke SCHEDULED.");
    }

    await this.repository.update(id, {
      ...(body.caption !== undefined ? { caption: body.caption } : {}),
      ...(body.mediaUrl !== undefined ? { mediaUrl: body.mediaUrl } : {}),
      ...(body.mediaType !== undefined ? { mediaType: body.mediaType } : {}),
      ...(body.hashtags !== undefined ? { hashtags: body.hashtags } : {}),
      ...(body.contentType !== undefined ? { contentType: body.contentType } : {}),
      ...(body.productId !== undefined ? { productId: body.productId } : {}),
      ...(body.angle !== undefined ? { angle: body.angle } : {}),
      ...(body.accountId !== undefined ? { accountId: body.accountId } : {}),
      ...(body.scheduledAt !== undefined ? { scheduledAt: body.scheduledAt } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    });

    if (body.publishTarget !== undefined) {
      this.pendingTokens.set(id, body.publishTarget);
    }
    if (body.status !== undefined && body.status !== "SCHEDULED") {
      this.pendingTokens.delete(id);
    }
    return this.findOrThrow(id);
  }

  /** `DELETE /api/v1/sosmed/posts/:id`. */
  async deletePost(id: string): Promise<void> {
    await this.findOrThrow(id);
    await this.repository.delete(id);
    this.pendingTokens.delete(id);
  }

  // ---------------------------------------------------------------------------------------------
  // Publish — `POST /api/v1/sosmed/posts/:id/publish-now` AND `SosmedSchedulerService`'s `@Cron`.
  // ---------------------------------------------------------------------------------------------

  async publishNow(id: string, body?: PublishNowBodyDto): Promise<StoredScheduledPost> {
    const post = await this.findOrThrow(id);
    const target = body ?? this.pendingTokens.get(id);
    if (target === undefined) {
      const message =
        `Tidak ada access token untuk post "${id}" — belum ada OAuth (Phase 4). ` +
        `Sertakan "publishTarget" saat membuat/mengedit post ini, atau kirim access token ` +
        `langsung ke body endpoint ini.`;
      await this.repository.updateStatus(id, { status: "FAILED", errorMessage: message });
      throw new ValidationError(message);
    }

    await this.repository.updateStatus(id, { status: "PUBLISHING" });
    try {
      const platformPostId = await this.callMeta(post, target);
      await this.repository.updateStatus(id, {
        status: "PUBLISHED",
        publishedAt: this.now().toISOString(),
        platformPostId,
      });
      this.pendingTokens.delete(id);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      await this.repository.updateStatus(id, { status: "FAILED", errorMessage: message });
      throw caught;
    }
    return this.findOrThrow(id);
  }

  private async callMeta(post: StoredScheduledPost, target: PendingPublishTarget): Promise<string> {
    if (target.platform === "FACEBOOK") {
      const result = await this.publishingService.publishFacebookPost({
        pageId: target.pageId,
        message: post.caption,
        ...(post.mediaUrl !== undefined ? { link: post.mediaUrl } : {}),
        accessToken: target.accessToken,
      });
      if (!result.ok) {
        throw result.error;
      }
      return result.value.postId;
    }

    const media = buildInstagramMediaSpec(post);
    const result = await this.publishingService.publishInstagramPost({
      igUserId: target.igUserId,
      media,
      caption: post.caption,
      accessToken: target.accessToken,
    });
    if (!result.ok) {
      throw result.error;
    }
    return result.value.mediaId;
  }

  private async findOrThrow(id: string): Promise<StoredScheduledPost> {
    const post = await this.repository.findById(this.tenantId, id);
    if (post === undefined) {
      throw new NotFoundError(`No scheduled post found with id "${id}"`);
    }
    return post;
  }
}

/** `CAROUSEL` has no single-URL `InstagramMediaSpec` shape this package supports yet — an honest deferral, not a silent drop. */
function buildInstagramMediaSpec(post: StoredScheduledPost): InstagramMediaSpec {
  if (post.mediaUrl === undefined) {
    throw new ValidationError("Instagram butuh media (mediaUrl) — post ini tidak punya media.");
  }
  if (post.mediaType === "VIDEO") {
    return { kind: "VIDEO", videoUrl: post.mediaUrl };
  }
  if (post.mediaType === "CAROUSEL") {
    throw new ValidationError("Publish carousel ke Instagram belum didukung di fase ini.");
  }
  return { kind: "IMAGE", imageUrl: post.mediaUrl };
}
