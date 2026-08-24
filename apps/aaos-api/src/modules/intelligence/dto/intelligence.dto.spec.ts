import { describe, expect, it } from "vitest";

import type { CompetitorPageRow } from "../infrastructure/competitor-page.repository.js";
import type { IntelligenceSignalsRow } from "../infrastructure/intelligence-signals.repository.js";

import {
  CreateCompetitorPageBodySchema,
  toCompetitorPageResponseDto,
  toIntelligenceSignalsResponseDto,
} from "./intelligence.dto.js";

describe("CreateCompetitorPageBodySchema", () => {
  it("accepts a valid AUTOMOTIVE body and defaults active to true", () => {
    const parsed = CreateCompetitorPageBodySchema.safeParse({
      name: "Mobil88",
      pageId: "100063000000001",
      vertical: "AUTOMOTIVE",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.active).toBe(true);
  });

  it("rejects an empty name", () => {
    const parsed = CreateCompetitorPageBodySchema.safeParse({
      name: "",
      pageId: "1",
      vertical: "AUTOMOTIVE",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a vertical outside AUTOMOTIVE/PROPERTY", () => {
    const parsed = CreateCompetitorPageBodySchema.safeParse({
      name: "x",
      pageId: "1",
      vertical: "MADE_UP",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("toCompetitorPageResponseDto", () => {
  it("maps a row to camelCase", () => {
    const row: CompetitorPageRow = {
      id: "p-1",
      tenant_id: "dss-motor",
      name: "Mobil88",
      page_id: "100063000000001",
      vertical: "AUTOMOTIVE",
      active: true,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    expect(toCompetitorPageResponseDto(row)).toEqual({
      id: "p-1",
      name: "Mobil88",
      pageId: "100063000000001",
      vertical: "AUTOMOTIVE",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("toIntelligenceSignalsResponseDto", () => {
  it("maps a row to camelCase", () => {
    const row: IntelligenceSignalsRow = {
      id: "s-1",
      tenant_id: "dss-motor",
      branch_id: null,
      seasonal_data: { isSpecialPeriod: false },
      trends_data: { available: false },
      competitor_data: { available: false },
      inventory_data: { available: false },
      lead_profile_data: { totalLeads: 0 },
      closing_data: { totalEvents: 0 },
      campaign_strategy: { available: false, reason: "NO_API_KEY", message: "x" },
      digest_text: "digest",
      generated_at: "2026-01-01T00:00:00.000Z",
    };
    const dto = toIntelligenceSignalsResponseDto(row);
    expect(dto.id).toBe("s-1");
    expect(dto.digestText).toBe("digest");
    expect(dto.campaignStrategy).toEqual({
      available: false,
      reason: "NO_API_KEY",
      message: "x",
    });
  });
});
