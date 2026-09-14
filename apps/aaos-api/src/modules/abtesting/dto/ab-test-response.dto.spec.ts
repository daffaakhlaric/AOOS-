import { describe, expect, it } from "vitest";

import type { StoredAbTest, StoredAbTestVariant } from "../domain/ab-test.js";

import { toAbTestResponseDto } from "./ab-test-response.dto.js";

describe("toAbTestResponseDto", () => {
  it("omits undefined optional fields", () => {
    const test: StoredAbTest = {
      id: "test-1",
      tenantId: "dss-motor",
      name: "ABT-001",
      campaignId: "camp-1",
      adSetId: "adset-1",
      pageId: "page-1",
      waLink: "https://wa.me/1",
      mode: "AUTO",
      status: "DRAFT",
      thresholdSpend: 100_000,
      thresholdDays: 3,
      minMarginPct: 20,
      autoPauseLoser: true,
      autoScaleWinner: true,
      createdAt: "2026-08-19T06:00:00.000Z",
    };
    const dto = toAbTestResponseDto(test, []);
    expect(dto).not.toHaveProperty("winnerVariantId");
    expect(dto).not.toHaveProperty("startedAt");
    expect(dto.variants).toEqual([]);
  });

  it("includes real winner/variant fields when set", () => {
    const test: StoredAbTest = {
      id: "test-1",
      tenantId: "dss-motor",
      name: "ABT-001",
      campaignId: "camp-1",
      adSetId: "adset-1",
      pageId: "page-1",
      waLink: "https://wa.me/1",
      mode: "AUTO",
      status: "COMPLETE",
      thresholdSpend: 100_000,
      thresholdDays: 3,
      minMarginPct: 20,
      autoPauseLoser: true,
      autoScaleWinner: true,
      winnerVariantId: "var-a",
      winnerRphLead: 8_667,
      improvementPct: 28,
      createdAt: "2026-08-19T06:00:00.000Z",
    };
    const variant: StoredAbTestVariant = {
      id: "var-a",
      abTestId: "test-1",
      tenantId: "dss-motor",
      variantLabel: "A",
      angle: "DP_RINGAN",
      creativePackageId: "pkg-a",
      metaAdId: "ad-a",
      status: "WINNER",
      spend: 52_000,
      impressions: 12_400,
      clicks: 260,
      conversations: 8,
      leads: 6,
      rphLead: 8_667,
      ctr: 0.021,
      createdAt: "2026-08-19T06:00:00.000Z",
    };
    const dto = toAbTestResponseDto(test, [variant]);
    expect(dto.winnerVariantId).toBe("var-a");
    expect(dto.variants[0]?.metaAdId).toBe("ad-a");
    expect(dto.variants[0]?.rphLead).toBe(8_667);
  });

  it("includes real imageUrl/videoUrl/assetKind when a media map entry exists for the variant, and omits them entirely when it doesn't (never a fabricated thumbnail)", () => {
    const test: StoredAbTest = {
      id: "test-1",
      tenantId: "dss-motor",
      name: "ABT-001",
      campaignId: "camp-1",
      adSetId: "adset-1",
      pageId: "page-1",
      waLink: "https://wa.me/1",
      mode: "AUTO",
      status: "RUNNING",
      thresholdSpend: 100_000,
      thresholdDays: 3,
      minMarginPct: 20,
      autoPauseLoser: true,
      autoScaleWinner: true,
      createdAt: "2026-08-19T06:00:00.000Z",
    };
    const variantWithMedia: StoredAbTestVariant = {
      id: "var-a",
      abTestId: "test-1",
      tenantId: "dss-motor",
      variantLabel: "A",
      angle: "DP_RINGAN",
      creativePackageId: "pkg-a",
      status: "RUNNING",
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversations: 0,
      leads: 0,
      createdAt: "2026-08-19T06:00:00.000Z",
    };
    const variantWithoutMedia: StoredAbTestVariant = {
      ...variantWithMedia,
      id: "var-b",
      creativePackageId: "pkg-b",
    };
    const media = new Map([
      [
        "var-a",
        {
          imageUrl: "https://cdn.example.com/thumb.jpg",
          videoUrl: "https://cdn.example.com/video.mp4",
          assetKind: "VIDEO" as const,
        },
      ],
    ]);

    const dto = toAbTestResponseDto(test, [variantWithMedia, variantWithoutMedia], media);

    expect(dto.variants[0]).toMatchObject({
      imageUrl: "https://cdn.example.com/thumb.jpg",
      videoUrl: "https://cdn.example.com/video.mp4",
      assetKind: "VIDEO",
    });
    expect(dto.variants[1]).not.toHaveProperty("imageUrl");
    expect(dto.variants[1]).not.toHaveProperty("videoUrl");
    expect(dto.variants[1]).not.toHaveProperty("assetKind");
  });
});
