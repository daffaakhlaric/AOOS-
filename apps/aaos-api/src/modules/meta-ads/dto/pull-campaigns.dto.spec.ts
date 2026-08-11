import { describe, expect, it } from "vitest";

import { PullCampaignsQuerySchema } from "./pull-campaigns.dto.js";

describe("PullCampaignsQuerySchema", () => {
  it("accepts an empty query, defaulting datePreset to last_30d", () => {
    const result = PullCampaignsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ datePreset: "last_30d" });
    }
  });

  it("accepts a valid adAccountId and datePreset", () => {
    const result = PullCampaignsQuerySchema.safeParse({
      adAccountId: "act_123456789",
      datePreset: "last_7d",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an adAccountId not matching act_<digits>", () => {
    const result = PullCampaignsQuerySchema.safeParse({ adAccountId: "not-an-account-id" });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported datePreset", () => {
    const result = PullCampaignsQuerySchema.safeParse({ datePreset: "last_year" });
    expect(result.success).toBe(false);
  });
});
