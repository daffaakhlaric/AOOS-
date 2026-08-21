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
});
