import { CampaignObjective } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import type { GrowthObjectiveResponseDto } from "../../growth-objectives/dto/growth-objective.dto.js";
import type { ListingResponseDto } from "../../listings/dto/listing.dto.js";

import { buildCampaignBlueprint } from "./campaign-blueprint.js";
import { assessListingReadiness } from "./listing-readiness.js";

function makeListing(overrides: Partial<ListingResponseDto> = {}): ListingResponseDto {
  return {
    id: "listing-1",
    title: "Rumah Minimalis Bintaro Sektor 9",
    propertyType: "RUMAH",
    listingStatus: "AKTIF",
    price: 1_500_000_000,
    waNumber: "6281234567890",
    city: "Tangerang Selatan",
    province: "Banten",
    kecamatan: "Pondok Aren",
    highlights: [],
    photos: [{ id: "photo-1", url: "https://example.com/photo.jpg", order: 0, isMain: true }],
    documents: [],
    inKnowledgeBase: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeGrowthObjective(
  overrides: Partial<GrowthObjectiveResponseDto> = {},
): GrowthObjectiveResponseDto {
  return {
    id: "objective-1",
    tenantId: "dss-motor",
    metric: "HOT_LEADS",
    targetValue: 50,
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    budgetMode: "BALANCED",
    focusListingIds: [],
    areaStrategy: "SAMANTHA",
    manualAreas: [],
    automationMode: "ADVISOR",
    status: "PLANNED",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildCampaignBlueprint", () => {
  it("all-pass case: real WhatsApp, geo, photos, and an analyzed forecast produce a complete blueprint with no warnings", () => {
    const listing = makeListing();
    const growthObjective = makeGrowthObjective({
      forecast: {
        reverseFunnel: {
          conversionRate: 0.2,
          estimatedRequiredRawLeads: { min: 200, expected: 250, max: 300 },
          estimatedMediaSpendIdr: { min: 4_000_000, expected: 6_000_000, max: 8_000_000 },
          confidence: 0.8,
        },
        feasibility: { status: "ACHIEVABLE", confidence: 0.8, reasons: [], options: [] },
      },
    });
    const listingReadiness = assessListingReadiness(listing);

    const blueprint = buildCampaignBlueprint({
      tenantId: "dss-motor",
      growthObjective,
      listing,
      listingReadiness,
      daysRemaining: 30,
    });

    expect(blueprint.tenantId).toBe("dss-motor");
    expect(blueprint.growthObjectiveId).toBe("objective-1");
    expect(blueprint.listingId).toBe("listing-1");
    expect(blueprint.goal).toBe("GENERATE_HOT_LEADS");
    expect(blueprint.destination).toBe("WHATSAPP");
    expect(blueprint.campaign.objective).toBe(CampaignObjective.OUTCOME_LEADS);
    expect(blueprint.campaign.buyingType).toBe("AUCTION");
    expect(blueprint.campaign.initialStatus).toBe("PAUSED");
    expect(blueprint.adSet.dailyBudgetIdr).toBe(Math.round(6_000_000 / 30));
    expect(blueprint.adSet.audienceStrategy).toBe("SAMANTHA");
    expect(blueprint.adSet.geo).toEqual({
      city: "Tangerang Selatan",
      province: "Banten",
      kecamatan: "Pondok Aren",
    });
    expect(blueprint.adSet.placements).toEqual([]);
    expect(blueprint.creativeStrategy.formats).toEqual(["IMAGE"]);
    expect(blueprint.creativeStrategy.kaiBriefId).toBeNull();
    expect(blueprint.warnings).toEqual([]);
  });

  it("missing field: no dailyBudgetIdr and a warning when the growth objective has never been analyzed (no forecast)", () => {
    const listing = makeListing();
    const growthObjective = makeGrowthObjective({ status: "DRAFT" });
    const listingReadiness = assessListingReadiness(listing);

    const blueprint = buildCampaignBlueprint({
      tenantId: "dss-motor",
      growthObjective,
      listing,
      listingReadiness,
      daysRemaining: 30,
    });

    expect(blueprint.adSet.dailyBudgetIdr).toBeUndefined();
    expect(blueprint.warnings).toContain(
      "Growth objective belum dianalisa (POST /growth-objectives/:id/analyze) — budget harian belum bisa diproyeksikan.",
    );
  });

  it("missing field: no dailyBudgetIdr when daysRemaining is 0 even with a real forecast", () => {
    const listing = makeListing();
    const growthObjective = makeGrowthObjective({
      forecast: {
        reverseFunnel: {
          conversionRate: 0.2,
          estimatedRequiredRawLeads: { min: 1, expected: 1, max: 1 },
          estimatedMediaSpendIdr: { min: 1, expected: 1_000_000, max: 1 },
          confidence: 0.5,
        },
        feasibility: { status: "UNLIKELY", confidence: 0.5, reasons: [], options: [] },
      },
    });
    const listingReadiness = assessListingReadiness(listing);

    const blueprint = buildCampaignBlueprint({
      tenantId: "dss-motor",
      growthObjective,
      listing,
      listingReadiness,
      daysRemaining: 0,
    });

    expect(blueprint.adSet.dailyBudgetIdr).toBeUndefined();
  });

  it("insufficient data: no destination and a warning when the listing has no WhatsApp number", () => {
    const listing = makeListing({ waNumber: undefined });
    const growthObjective = makeGrowthObjective();
    const listingReadiness = assessListingReadiness(listing);

    const blueprint = buildCampaignBlueprint({
      tenantId: "dss-motor",
      growthObjective,
      listing,
      listingReadiness,
    });

    expect(blueprint.destination).toBeUndefined();
    expect(blueprint.warnings).toContain(
      "Tidak ada nomor WhatsApp pada listing ini — destination belum bisa ditentukan (satu-satunya destination yang punya jalur pembuatan ad nyata di codebase ini).",
    );
  });

  it("insufficient data: empty geo and a warning when the listing has no city/province/kecamatan", () => {
    const listing = makeListing({ city: undefined, province: undefined, kecamatan: undefined });
    const growthObjective = makeGrowthObjective();
    const listingReadiness = assessListingReadiness(listing);

    const blueprint = buildCampaignBlueprint({
      tenantId: "dss-motor",
      growthObjective,
      listing,
      listingReadiness,
    });

    expect(blueprint.adSet.geo).toEqual({});
    expect(blueprint.warnings).toContain(
      "Listing belum punya kota/provinsi/kecamatan — geo targeting blueprint ini kosong.",
    );
  });

  it("insufficient data: empty creativeStrategy.formats and a warning when the listing has no photos", () => {
    const listing = makeListing({ photos: [] });
    const growthObjective = makeGrowthObjective();
    const listingReadiness = assessListingReadiness(listing);

    const blueprint = buildCampaignBlueprint({
      tenantId: "dss-motor",
      growthObjective,
      listing,
      listingReadiness,
    });

    expect(blueprint.creativeStrategy.formats).toEqual([]);
    expect(blueprint.warnings).toContain(
      "Listing belum punya foto usable — creative strategy blueprint ini tidak menyertakan format apapun.",
    );
  });

  it("multiple failing reasons: not-ready listing's blockingIssues are folded into the blueprint's own warnings", () => {
    const listing = makeListing({ listingStatus: "DRAFT", photos: [] });
    const growthObjective = makeGrowthObjective();
    const listingReadiness = assessListingReadiness(listing);
    expect(listingReadiness.ready).toBe(false);

    const blueprint = buildCampaignBlueprint({
      tenantId: "dss-motor",
      growthObjective,
      listing,
      listingReadiness,
    });

    for (const issue of listingReadiness.blockingIssues) {
      expect(blueprint.warnings).toContain(issue);
    }
  });

  it("maps the sole real GrowthObjectiveMetric HOT_LEADS to goal GENERATE_HOT_LEADS", () => {
    const listing = makeListing();
    const growthObjective = makeGrowthObjective({ metric: "HOT_LEADS" });
    const listingReadiness = assessListingReadiness(listing);

    const blueprint = buildCampaignBlueprint({
      tenantId: "dss-motor",
      growthObjective,
      listing,
      listingReadiness,
    });

    expect(blueprint.goal).toBe("GENERATE_HOT_LEADS");
  });
});
