import { describe, expect, it } from "vitest";

import { CreateAbTestBodySchema, ListAbTestsQuerySchema } from "./create-ab-test.dto.js";

const BASE = {
  name: "Xpander Cinere — DP vs Stok",
  campaignId: "camp-1",
  adSetId: "adset-1",
  pageId: "page-1",
  waLink: "https://wa.me/6281234567890",
  unit: "xpander-cinere",
  branch: "CINERE",
  primaryMessage: "DP ringan mulai 20 juta",
  format: "VIDEO_AND_IMAGES",
};

describe("CreateAbTestBodySchema", () => {
  it("accepts a minimal valid body and applies defaults", () => {
    const result = CreateAbTestBodySchema.safeParse(BASE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe("AUTO");
      expect(result.data.variantCount).toBe(2);
      expect(result.data.thresholdSpend).toBe(100_000);
      expect(result.data.thresholdDays).toBe(3);
      expect(result.data.minMarginPct).toBe(20);
      expect(result.data.autoPauseLoser).toBe(true);
      expect(result.data.autoScaleWinner).toBe(true);
    }
  });

  it("rejects a non-wa.me waLink", () => {
    expect(CreateAbTestBodySchema.safeParse({ ...BASE, waLink: "not-a-url" }).success).toBe(false);
  });

  it("rejects an invalid branch", () => {
    expect(CreateAbTestBodySchema.safeParse({ ...BASE, branch: "MARS" }).success).toBe(false);
  });

  it("accepts variantCount 3", () => {
    expect(CreateAbTestBodySchema.safeParse({ ...BASE, variantCount: 3 }).success).toBe(true);
  });

  it("rejects variantCount 4", () => {
    expect(CreateAbTestBodySchema.safeParse({ ...BASE, variantCount: 4 }).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(CreateAbTestBodySchema.safeParse({ ...BASE, name: "" }).success).toBe(false);
  });
});

describe("ListAbTestsQuerySchema", () => {
  it("accepts an empty query", () => {
    expect(ListAbTestsQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts a known status", () => {
    expect(ListAbTestsQuerySchema.safeParse({ status: "RUNNING" }).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(ListAbTestsQuerySchema.safeParse({ status: "BOGUS" }).success).toBe(false);
  });
});
