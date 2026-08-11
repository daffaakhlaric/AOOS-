import { describe, expect, it } from "vitest";

import {
  MetaActionSchema,
  MetaAdListResponseSchema,
  MetaAdSchema,
  MetaAdSetListResponseSchema,
  MetaAdSetSchema,
  MetaCampaignListResponseSchema,
  MetaCampaignSchema,
  MetaErrorResponseSchema,
  MetaInsightRowSchema,
  MetaUpdateResponseSchema,
} from "../../../src/types/MetaApiTypes.js";

describe("MetaActionSchema", () => {
  it("accepts a well-formed action", () => {
    expect(MetaActionSchema.safeParse({ action_type: "x", value: "1" }).success).toBe(true);
  });

  it("rejects a numeric value field (must be a string per Graph API convention)", () => {
    expect(MetaActionSchema.safeParse({ action_type: "x", value: 1 }).success).toBe(false);
  });
});

describe("MetaInsightRowSchema", () => {
  it("accepts an empty object (every field optional)", () => {
    expect(MetaInsightRowSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a fully populated row", () => {
    expect(
      MetaInsightRowSchema.safeParse({
        spend: "1",
        impressions: "2",
        reach: "3",
        frequency: "1.5",
        clicks: "4",
        actions: [{ action_type: "x", value: "1" }],
        messaging_conversation_started: "5",
      }).success,
    ).toBe(true);
  });
});

describe("MetaCampaignSchema", () => {
  it("requires id/name/objective/status", () => {
    expect(
      MetaCampaignSchema.safeParse({ id: "1", name: "n", objective: "o", status: "s" }).success,
    ).toBe(true);
    expect(MetaCampaignSchema.safeParse({ name: "n", objective: "o", status: "s" }).success).toBe(
      false,
    );
  });

  it("allows created_time and insights to be omitted", () => {
    expect(
      MetaCampaignSchema.safeParse({ id: "1", name: "n", objective: "o", status: "s" }).success,
    ).toBe(true);
  });
});

describe("MetaCampaignListResponseSchema", () => {
  it("accepts an empty data array (empty ad account edge case)", () => {
    expect(MetaCampaignListResponseSchema.safeParse({ data: [] }).success).toBe(true);
  });

  it("rejects a missing data field", () => {
    expect(MetaCampaignListResponseSchema.safeParse({}).success).toBe(false);
  });
});

describe("MetaAdSetSchema / MetaAdSetListResponseSchema", () => {
  it("accepts an adset with only required fields", () => {
    expect(MetaAdSetSchema.safeParse({ id: "1", name: "n", status: "ACTIVE" }).success).toBe(true);
  });

  it("accepts an empty adset list (campaign with 0 adsets edge case)", () => {
    expect(MetaAdSetListResponseSchema.safeParse({ data: [] }).success).toBe(true);
  });
});

describe("MetaAdSchema / MetaAdListResponseSchema", () => {
  it("requires created_time (unlike MetaCampaignSchema, where it's optional)", () => {
    expect(MetaAdSchema.safeParse({ id: "1", name: "n", status: "ACTIVE" }).success).toBe(false);
    expect(
      MetaAdSchema.safeParse({ id: "1", name: "n", status: "ACTIVE", created_time: "2026-01-01" })
        .success,
    ).toBe(true);
  });

  it("accepts an empty ad list (adset with 0 ads edge case)", () => {
    expect(MetaAdListResponseSchema.safeParse({ data: [] }).success).toBe(true);
  });
});

describe("MetaUpdateResponseSchema", () => {
  it("accepts { success: true }", () => {
    expect(MetaUpdateResponseSchema.safeParse({ success: true }).success).toBe(true);
  });

  it("accepts { id: '123' } alone", () => {
    expect(MetaUpdateResponseSchema.safeParse({ id: "123" }).success).toBe(true);
  });

  it("rejects an empty object (neither success nor id present)", () => {
    expect(MetaUpdateResponseSchema.safeParse({}).success).toBe(false);
  });
});

describe("MetaErrorResponseSchema", () => {
  it("accepts a minimal error with just a message", () => {
    expect(MetaErrorResponseSchema.safeParse({ error: { message: "boom" } }).success).toBe(true);
  });

  it("accepts a fully populated error", () => {
    expect(
      MetaErrorResponseSchema.safeParse({
        error: {
          message: "boom",
          type: "OAuthException",
          code: 190,
          error_subcode: 460,
          fbtrace_id: "abc",
        },
      }).success,
    ).toBe(true);
  });

  it("rejects a response with no error field", () => {
    expect(MetaErrorResponseSchema.safeParse({}).success).toBe(false);
  });
});
