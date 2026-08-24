import { err, ok } from "@aos/common";
import { NotFoundError, ValidationError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../../test-support/fixtures.js";
import type {
  CreateScheduledPostBodyDto,
  UpdateScheduledPostBodyDto,
} from "../dto/scheduled-post.dto.js";
import { ScheduledPostRepository } from "../infrastructure/scheduled-post.repository.js";

import { PendingAccessTokenStore } from "./pending-access-token-store.js";
import { SosmedPostsService } from "./sosmed-posts.service.js";
import type { SosmedPublishingService } from "./sosmed-publishing.service.js";

const NOW_ISO = "2026-08-25T03:05:00.000Z";
const CONFIG = buildTestConfig({ AAOS_TENANT_ID: "dss-motor" });

const CREATE_BODY: CreateScheduledPostBodyDto = {
  caption: "Xpander Cross 2019 DP 29jt aja!",
  status: "DRAFT",
};

function buildService(publishingOverrides: Partial<SosmedPublishingService> = {}) {
  const repository = new ScheduledPostRepository(createFakeSupabaseClient());
  const pendingTokens = new PendingAccessTokenStore();
  const publishingService = {
    publishFacebookPost: vi.fn(async () => ok({ postId: "page_123_post_456" })),
    publishInstagramPost: vi.fn(async () => ok({ mediaId: "ig-media-789" })),
    ...publishingOverrides,
  } as unknown as SosmedPublishingService;
  const service = new SosmedPostsService(
    CONFIG,
    repository,
    publishingService,
    pendingTokens,
    () => new Date(NOW_ISO),
  );
  return { service, repository, pendingTokens, publishingService };
}

describe("SosmedPostsService — CRUD", () => {
  it("createPost persists a DRAFT post by default", async () => {
    const { service } = buildService();
    const created = await service.createPost(CREATE_BODY);
    expect(created.status).toBe("DRAFT");
    expect(created.caption).toBe(CREATE_BODY.caption);
  });

  it("createPost persists SCHEDULED status when requested", async () => {
    const { service } = buildService();
    const created = await service.createPost({
      ...CREATE_BODY,
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T10:00:00.000Z",
    });
    expect(created.status).toBe("SCHEDULED");
    expect(created.scheduledAt).toBe("2026-08-25T10:00:00.000Z");
  });

  it("createPost stashes an optional publishTarget in PendingAccessTokenStore, never in the row", async () => {
    const { service, pendingTokens } = buildService();
    const created = await service.createPost({
      ...CREATE_BODY,
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T10:00:00.000Z",
      publishTarget: { platform: "FACEBOOK", pageId: "123", accessToken: "manager-token" },
    });
    expect(pendingTokens.get(created.id)).toEqual({
      platform: "FACEBOOK",
      pageId: "123",
      accessToken: "manager-token",
    });
    expect(JSON.stringify(created)).not.toContain("manager-token");
  });

  it("listPosts filters by status", async () => {
    const { service } = buildService();
    await service.createPost(CREATE_BODY);
    await service.createPost({
      ...CREATE_BODY,
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T10:00:00.000Z",
    });
    expect(await service.listPosts("DRAFT")).toHaveLength(1);
    expect(await service.listPosts("SCHEDULED")).toHaveLength(1);
    expect(await service.listPosts()).toHaveLength(2);
  });

  it("getPost throws NotFoundError for a missing id", async () => {
    const { service } = buildService();
    await expect(service.getPost("does-not-exist")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updatePost patches only supplied fields", async () => {
    const { service } = buildService();
    const created = await service.createPost(CREATE_BODY);
    const updated = await service.updatePost(created.id, { caption: "Updated caption" });
    expect(updated.caption).toBe("Updated caption");
  });

  it("updatePost rejects flipping to SCHEDULED with no scheduledAt anywhere", async () => {
    const { service } = buildService();
    const created = await service.createPost(CREATE_BODY);
    const body: UpdateScheduledPostBodyDto = { status: "SCHEDULED" };
    await expect(service.updatePost(created.id, body)).rejects.toBeInstanceOf(ValidationError);
  });

  it("updatePost allows flipping to SCHEDULED when scheduledAt is supplied in the same call", async () => {
    const { service } = buildService();
    const created = await service.createPost(CREATE_BODY);
    const updated = await service.updatePost(created.id, {
      status: "SCHEDULED",
      scheduledAt: "2026-08-26T10:00:00.000Z",
    });
    expect(updated.status).toBe("SCHEDULED");
  });

  it("updatePost clears the pending token when status moves away from SCHEDULED", async () => {
    const { service, pendingTokens } = buildService();
    const created = await service.createPost({
      ...CREATE_BODY,
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T10:00:00.000Z",
      publishTarget: { platform: "FACEBOOK", pageId: "123", accessToken: "manager-token" },
    });
    expect(pendingTokens.get(created.id)).toBeDefined();
    await service.updatePost(created.id, { status: "CANCELLED" });
    expect(pendingTokens.get(created.id)).toBeUndefined();
  });

  it("deletePost removes the row and its pending token", async () => {
    const { service, pendingTokens } = buildService();
    const created = await service.createPost({
      ...CREATE_BODY,
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T10:00:00.000Z",
      publishTarget: { platform: "FACEBOOK", pageId: "123", accessToken: "manager-token" },
    });
    await service.deletePost(created.id);
    await expect(service.getPost(created.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(pendingTokens.get(created.id)).toBeUndefined();
  });

  it("deletePost throws NotFoundError for a missing id", async () => {
    const { service } = buildService();
    await expect(service.deletePost("does-not-exist")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("SosmedPostsService — publishNow", () => {
  it("publishes to Facebook using a fresh body target and never touches PendingAccessTokenStore", async () => {
    const { service, pendingTokens, publishingService } = buildService();
    const created = await service.createPost(CREATE_BODY);

    const published = await service.publishNow(created.id, {
      platform: "FACEBOOK",
      pageId: "123456789",
      accessToken: "fresh-token",
    });

    expect(published.status).toBe("PUBLISHED");
    expect(published.platformPostId).toBe("page_123_post_456");
    expect(published.publishedAt).toBe(NOW_ISO);
    expect(publishingService.publishFacebookPost).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "123456789", accessToken: "fresh-token" }),
    );
    expect(pendingTokens.get(created.id)).toBeUndefined();
  });

  it("publishes to Instagram, building the media spec from the stored post", async () => {
    const { service, publishingService } = buildService();
    const created = await service.createPost({
      ...CREATE_BODY,
      mediaUrl: "https://gcs/example.jpg",
      mediaType: "IMAGE",
    });

    const published = await service.publishNow(created.id, {
      platform: "INSTAGRAM",
      igUserId: "987654321",
      accessToken: "fresh-token",
    });

    expect(published.status).toBe("PUBLISHED");
    expect(published.platformPostId).toBe("ig-media-789");
    expect(publishingService.publishInstagramPost).toHaveBeenCalledWith(
      expect.objectContaining({
        igUserId: "987654321",
        media: { kind: "IMAGE", imageUrl: "https://gcs/example.jpg" },
      }),
    );
  });

  it("falls back to a stored publishTarget when no body is supplied (the scheduler's call shape)", async () => {
    const { service, publishingService } = buildService();
    const created = await service.createPost({
      ...CREATE_BODY,
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T03:00:00.000Z",
      publishTarget: { platform: "FACEBOOK", pageId: "123", accessToken: "stashed-token" },
    });

    const published = await service.publishNow(created.id);

    expect(published.status).toBe("PUBLISHED");
    expect(publishingService.publishFacebookPost).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "stashed-token" }),
    );
  });

  it("marks FAILED with an actionable message when no token is available anywhere", async () => {
    const { service, repository } = buildService();
    const created = await service.createPost(CREATE_BODY);

    await expect(service.publishNow(created.id)).rejects.toBeInstanceOf(ValidationError);

    const stored = await repository.findById("dss-motor", created.id);
    expect(stored?.status).toBe("FAILED");
    expect(stored?.errorMessage).toMatch(/access token/i);
  });

  it("marks FAILED and rethrows when the connector call fails", async () => {
    const { service, repository } = buildService({
      publishFacebookPost: vi.fn(async () =>
        err(new ValidationError("Meta API rejected the request")),
      ),
    } as never);
    const created = await service.createPost(CREATE_BODY);

    await expect(
      service.publishNow(created.id, {
        platform: "FACEBOOK",
        pageId: "123",
        accessToken: "fresh-token",
      }),
    ).rejects.toThrow("Meta API rejected the request");

    const stored = await repository.findById("dss-motor", created.id);
    expect(stored?.status).toBe("FAILED");
    expect(stored?.errorMessage).toBe("Meta API rejected the request");
  });

  it("rejects publishing to Instagram when the post has no media", async () => {
    const { service, repository } = buildService();
    const created = await service.createPost(CREATE_BODY);

    await expect(
      service.publishNow(created.id, {
        platform: "INSTAGRAM",
        igUserId: "987",
        accessToken: "fresh-token",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const stored = await repository.findById("dss-motor", created.id);
    expect(stored?.status).toBe("FAILED");
  });

  it("rejects publishing a CAROUSEL post to Instagram (unsupported this phase)", async () => {
    const { service } = buildService();
    const created = await service.createPost({
      ...CREATE_BODY,
      mediaUrl: "https://gcs/example.jpg",
      mediaType: "CAROUSEL",
    });

    await expect(
      service.publishNow(created.id, {
        platform: "INSTAGRAM",
        igUserId: "987",
        accessToken: "fresh-token",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("publishNow throws NotFoundError for a missing post id", async () => {
    const { service } = buildService();
    await expect(service.publishNow("does-not-exist")).rejects.toBeInstanceOf(NotFoundError);
  });
});
