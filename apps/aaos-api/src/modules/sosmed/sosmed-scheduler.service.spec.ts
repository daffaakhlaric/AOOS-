import { ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";

import { PendingAccessTokenStore } from "./application/pending-access-token-store.js";
import { SosmedPostsService } from "./application/sosmed-posts.service.js";
import type { SosmedPublishingService } from "./application/sosmed-publishing.service.js";
import { ScheduledPostRepository } from "./infrastructure/scheduled-post.repository.js";
import { SosmedSchedulerService } from "./sosmed-scheduler.service.js";

const NOW_ISO = "2026-08-25T03:05:00.000Z";
const CONFIG = buildTestConfig({ AAOS_TENANT_ID: "dss-motor" });

function buildScheduler() {
  const supabase = createFakeSupabaseClient();
  const repository = new ScheduledPostRepository(supabase);
  const pendingTokens = new PendingAccessTokenStore();
  const publishingService = {
    publishFacebookPost: vi.fn(async () => ok({ postId: "page_123_post_456" })),
    publishInstagramPost: vi.fn(async () => ok({ mediaId: "ig-media-789" })),
  } as unknown as SosmedPublishingService;
  const postsService = new SosmedPostsService(
    CONFIG,
    repository,
    publishingService,
    pendingTokens,
    () => new Date(NOW_ISO),
  );
  const scheduler = new SosmedSchedulerService(
    CONFIG,
    repository,
    postsService,
    () => new Date(NOW_ISO),
  );
  return { scheduler, repository, pendingTokens, publishingService, postsService };
}

describe("SosmedSchedulerService.checkAndPublishScheduled", () => {
  it("publishes a due SCHEDULED post that has a stashed publishTarget", async () => {
    const { scheduler, repository, postsService, publishingService } = buildScheduler();
    const created = await postsService.createPost({
      caption: "Xpander Cross DP 29jt",
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T03:00:00.000Z",
      publishTarget: { platform: "FACEBOOK", pageId: "123", accessToken: "stashed-token" },
    });

    await scheduler.checkAndPublishScheduled();

    const stored = await repository.findById("dss-motor", created.id);
    expect(stored?.status).toBe("PUBLISHED");
    expect(publishingService.publishFacebookPost).toHaveBeenCalledTimes(1);
  });

  it("marks a due SCHEDULED post FAILED honestly when no token source exists (no OAuth yet)", async () => {
    const { scheduler, repository, postsService, publishingService } = buildScheduler();
    const created = await postsService.createPost({
      caption: "Xpander Cross DP 29jt",
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T03:00:00.000Z",
    });

    await scheduler.checkAndPublishScheduled();

    const stored = await repository.findById("dss-motor", created.id);
    expect(stored?.status).toBe("FAILED");
    expect(stored?.errorMessage).toMatch(/access token/i);
    expect(publishingService.publishFacebookPost).not.toHaveBeenCalled();
  });

  it("ignores SCHEDULED posts not yet due", async () => {
    const { scheduler, repository, postsService } = buildScheduler();
    const created = await postsService.createPost({
      caption: "Xpander Cross DP 29jt",
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T10:00:00.000Z",
    });

    await scheduler.checkAndPublishScheduled();

    const stored = await repository.findById("dss-motor", created.id);
    expect(stored?.status).toBe("SCHEDULED");
  });

  it("ignores DRAFT posts even if somehow given a scheduledAt in the past", async () => {
    const { scheduler, repository, postsService } = buildScheduler();
    const created = await postsService.createPost({
      caption: "Xpander Cross DP 29jt",
      status: "DRAFT",
    });

    await scheduler.checkAndPublishScheduled();

    const stored = await repository.findById("dss-motor", created.id);
    expect(stored?.status).toBe("DRAFT");
  });

  it("keeps processing remaining due posts when one publish rejects", async () => {
    const { scheduler, repository, postsService } = buildScheduler();
    const failing = await postsService.createPost({
      caption: "Post tanpa token",
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T03:00:00.000Z",
    });
    const succeeding = await postsService.createPost({
      caption: "Post dengan token",
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T03:00:00.000Z",
      publishTarget: { platform: "FACEBOOK", pageId: "123", accessToken: "stashed-token" },
    });

    await scheduler.checkAndPublishScheduled();

    expect((await repository.findById("dss-motor", failing.id))?.status).toBe("FAILED");
    expect((await repository.findById("dss-motor", succeeding.id))?.status).toBe("PUBLISHED");
  });
});

describe("SosmedSchedulerService.publishPost", () => {
  it("delegates to SosmedPostsService.publishNow with no body", async () => {
    const { scheduler, postsService } = buildScheduler();
    const spy = vi.spyOn(postsService, "publishNow");
    const created = await postsService.createPost({
      caption: "Xpander Cross DP 29jt",
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T03:00:00.000Z",
      publishTarget: { platform: "FACEBOOK", pageId: "123", accessToken: "stashed-token" },
    });

    await scheduler.publishPost(created.id);

    expect(spy).toHaveBeenCalledWith(created.id);
  });
});
