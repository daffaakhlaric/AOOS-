import { describe, expect, it } from "vitest";

import {
  CreateScheduledPostBodySchema,
  ListScheduledPostsQuerySchema,
  PublishNowBodySchema,
  UpdateScheduledPostBodySchema,
} from "./scheduled-post.dto.js";

describe("CreateScheduledPostBodySchema", () => {
  it("accepts a minimal DRAFT body", () => {
    const parsed = CreateScheduledPostBodySchema.safeParse({ caption: "Xpander Cross DP 29jt" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("DRAFT");
    }
  });

  it("rejects an empty caption", () => {
    expect(CreateScheduledPostBodySchema.safeParse({ caption: "" }).success).toBe(false);
  });

  it("rejects SCHEDULED status without scheduledAt", () => {
    const parsed = CreateScheduledPostBodySchema.safeParse({
      caption: "Promo weekend",
      status: "SCHEDULED",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts SCHEDULED status with scheduledAt", () => {
    const parsed = CreateScheduledPostBodySchema.safeParse({
      caption: "Promo weekend",
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T03:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an optional FACEBOOK publishTarget", () => {
    const parsed = CreateScheduledPostBodySchema.safeParse({
      caption: "Promo weekend",
      status: "SCHEDULED",
      scheduledAt: "2026-08-25T03:00:00.000Z",
      publishTarget: {
        platform: "FACEBOOK",
        pageId: "123456789",
        accessToken: "manager-pasted-token",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a FACEBOOK publishTarget missing pageId", () => {
    const parsed = CreateScheduledPostBodySchema.safeParse({
      caption: "Promo weekend",
      publishTarget: { platform: "FACEBOOK", accessToken: "token" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown status value for create (PUBLISHED is not creatable)", () => {
    const parsed = CreateScheduledPostBodySchema.safeParse({
      caption: "Promo weekend",
      status: "PUBLISHED",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("UpdateScheduledPostBodySchema", () => {
  it("accepts an empty patch", () => {
    expect(UpdateScheduledPostBodySchema.safeParse({}).success).toBe(true);
  });

  it("accepts any real ScheduledPostStatus value (unlike create)", () => {
    expect(UpdateScheduledPostBodySchema.safeParse({ status: "CANCELLED" }).success).toBe(true);
    expect(UpdateScheduledPostBodySchema.safeParse({ status: "PUBLISHED" }).success).toBe(true);
  });

  it("rejects an invalid mediaUrl", () => {
    expect(UpdateScheduledPostBodySchema.safeParse({ mediaUrl: "not-a-url" }).success).toBe(false);
  });
});

describe("ListScheduledPostsQuerySchema", () => {
  it("accepts no status filter", () => {
    expect(ListScheduledPostsQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid status filter", () => {
    expect(ListScheduledPostsQuerySchema.safeParse({ status: "SCHEDULED" }).success).toBe(true);
  });

  it("rejects an invalid status filter", () => {
    expect(ListScheduledPostsQuerySchema.safeParse({ status: "NOT_A_STATUS" }).success).toBe(false);
  });
});

describe("PublishNowBodySchema", () => {
  it("accepts undefined (omitted body)", () => {
    expect(PublishNowBodySchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts a valid INSTAGRAM target", () => {
    const parsed = PublishNowBodySchema.safeParse({
      platform: "INSTAGRAM",
      igUserId: "987654321",
      accessToken: "fresh-token",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty object", () => {
    expect(PublishNowBodySchema.safeParse({}).success).toBe(false);
  });
});
