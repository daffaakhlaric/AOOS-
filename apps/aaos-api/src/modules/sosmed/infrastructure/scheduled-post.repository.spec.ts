import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  ScheduledPostRepository,
  type CreateScheduledPostInput,
} from "./scheduled-post.repository.js";

const BASE_INPUT: CreateScheduledPostInput = {
  id: "11111111-1111-1111-1111-111111111111",
  tenantId: "dss-motor",
  caption: "Xpander Cross 2019 DP 29jt aja!",
  contentType: "PROMO",
  angle: "DP Ringan",
};

describe("ScheduledPostRepository", () => {
  it("create persists a DRAFT post with defaults for unset optional fields", async () => {
    const repo = new ScheduledPostRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);

    expect(created.id).toBe(BASE_INPUT.id);
    expect(created.status).toBe("DRAFT");
    expect(created.generatedBy).toBe("TAMARA");
    expect(created.hashtags).toEqual([]);
    expect(created.reach).toBe(0);
    expect(created.mediaUrl).toBeUndefined();
    expect(created.accountId).toBeUndefined();
  });

  it("create persists optional fields when provided", async () => {
    const repo = new ScheduledPostRepository(createFakeSupabaseClient());
    const created = await repo.create({
      ...BASE_INPUT,
      accountId: "22222222-2222-2222-2222-222222222222",
      mediaUrl: "https://gcs/example.jpg",
      mediaType: "IMAGE",
      hashtags: ["#MobixCinere", "#XpanderCross"],
      productId: "unit-123",
      generatedBy: "MANUAL",
      scheduledAt: "2026-08-25T03:00:00.000Z",
    });

    expect(created.accountId).toBe("22222222-2222-2222-2222-222222222222");
    expect(created.mediaUrl).toBe("https://gcs/example.jpg");
    expect(created.mediaType).toBe("IMAGE");
    expect(created.hashtags).toEqual(["#MobixCinere", "#XpanderCross"]);
    expect(created.productId).toBe("unit-123");
    expect(created.generatedBy).toBe("MANUAL");
    expect(created.scheduledAt).toBe("2026-08-25T03:00:00.000Z");
  });

  it("findById returns undefined when no row with that id exists", async () => {
    const repo = new ScheduledPostRepository(createFakeSupabaseClient());
    expect(await repo.findById("dss-motor", "does-not-exist")).toBeUndefined();
  });

  it("findById returns the stored row", async () => {
    const repo = new ScheduledPostRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    const found = await repo.findById("dss-motor", BASE_INPUT.id);
    expect(found?.caption).toBe(BASE_INPUT.caption);
  });

  it("findById is scoped by tenant", async () => {
    const repo = new ScheduledPostRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    expect(await repo.findById("other-tenant", BASE_INPUT.id)).toBeUndefined();
  });

  it("listByTenant returns every post for a tenant, newest first", async () => {
    const repo = new ScheduledPostRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    await repo.create({
      ...BASE_INPUT,
      id: "33333333-3333-3333-3333-333333333333",
      caption: "Second post",
    });
    const rows = await repo.listByTenant("dss-motor");
    expect(rows).toHaveLength(2);
  });

  it("listByTenant filters by status when provided", async () => {
    const repo = new ScheduledPostRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    const scheduled = await repo.listByTenant("dss-motor", "SCHEDULED");
    expect(scheduled).toHaveLength(0);
    const draft = await repo.listByTenant("dss-motor", "DRAFT");
    expect(draft).toHaveLength(1);
  });

  it("updateStatus persists a status transition with published/platform fields", async () => {
    const repo = new ScheduledPostRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.updateStatus(created.id, {
      status: "PUBLISHED",
      publishedAt: "2026-08-25T03:05:00.000Z",
      platformPostId: "meta-post-1",
    });

    const found = await repo.findById("dss-motor", created.id);
    expect(found?.status).toBe("PUBLISHED");
    expect(found?.publishedAt).toBe("2026-08-25T03:05:00.000Z");
    expect(found?.platformPostId).toBe("meta-post-1");
  });

  it("updateStatus persists a FAILED transition with an error message", async () => {
    const repo = new ScheduledPostRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.updateStatus(created.id, { status: "FAILED", errorMessage: "Meta API 500" });

    const found = await repo.findById("dss-motor", created.id);
    expect(found?.status).toBe("FAILED");
    expect(found?.errorMessage).toBe("Meta API 500");
  });

  it("delete removes the row", async () => {
    const repo = new ScheduledPostRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.delete(created.id);
    expect(await repo.findById("dss-motor", created.id)).toBeUndefined();
  });
});
