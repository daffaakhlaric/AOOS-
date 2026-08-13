import { describe, expect, it } from "vitest";

import { CreateCampaignBodySchema } from "./create-campaign.dto.js";

describe("CreateCampaignBodySchema (AAOS-W1D-S3)", () => {
  it("accepts a valid body", () => {
    const result = CreateCampaignBodySchema.safeParse({
      adAccountId: "act_752604553578354",
      name: "Meta-CTWA-Leads-Mobix-Cinere",
      branch: "CINERE",
      funnel: "CTWA",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional dailyBudgetIDR override", () => {
    const result = CreateCampaignBodySchema.safeParse({
      adAccountId: "act_752604553578354",
      name: "Custom Budget",
      branch: "BINTARO",
      funnel: "CTWA",
      dailyBudgetIDR: 250_000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed adAccountId", () => {
    const result = CreateCampaignBodySchema.safeParse({
      adAccountId: "not-an-account",
      name: "X",
      branch: "CINERE",
      funnel: "CTWA",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = CreateCampaignBodySchema.safeParse({
      adAccountId: "act_752604553578354",
      name: "",
      branch: "CINERE",
      funnel: "CTWA",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized branch", () => {
    const result = CreateCampaignBodySchema.safeParse({
      adAccountId: "act_752604553578354",
      name: "X",
      branch: "MARS",
      funnel: "CTWA",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized funnel", () => {
    const result = CreateCampaignBodySchema.safeParse({
      adAccountId: "act_752604553578354",
      name: "X",
      branch: "CINERE",
      funnel: "BOGUS",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive dailyBudgetIDR", () => {
    const result = CreateCampaignBodySchema.safeParse({
      adAccountId: "act_752604553578354",
      name: "X",
      branch: "CINERE",
      funnel: "CTWA",
      dailyBudgetIDR: -1,
    });
    expect(result.success).toBe(false);
  });

  it.each(["CINERE", "BINTARO", "BANDUNG", "JABODETABEK", "BOOST", "MULTI", "UMUM"])(
    "accepts every real Branch member: %s",
    (branch) => {
      const result = CreateCampaignBodySchema.safeParse({
        adAccountId: "act_752604553578354",
        name: "X",
        branch,
        funnel: "CTWA",
      });
      expect(result.success).toBe(true);
    },
  );

  it.each(["CTWA", "DM", "WEBSITE_LEAD", "BRAND_BOOST"])(
    "accepts every real Funnel member: %s",
    (funnel) => {
      const result = CreateCampaignBodySchema.safeParse({
        adAccountId: "act_752604553578354",
        name: "X",
        branch: "CINERE",
        funnel,
      });
      expect(result.success).toBe(true);
    },
  );
});
