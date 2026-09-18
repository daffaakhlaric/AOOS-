import { describe, expect, it, vi } from "vitest";

import type { GrowthObjectiveResponseDto } from "../growth-objectives/dto/growth-objective.dto.js";
import type { GrowthObjectivesService } from "../growth-objectives/growth-objectives.service.js";
import type { ListingResponseDto } from "../listings/dto/listing.dto.js";
import type { ListingsService } from "../listings/listings.service.js";

import { CampaignCreationService } from "./campaign-creation.service.js";

const TENANT = "dss-motor";

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
  const farFutureEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return {
    id: "objective-1",
    tenantId: TENANT,
    metric: "HOT_LEADS",
    targetValue: 50,
    startDate: "2026-01-01",
    endDate: farFutureEndDate,
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

function buildService(
  listingOverrides: Partial<ListingResponseDto> = {},
  objectiveOverrides: Partial<GrowthObjectiveResponseDto> = {},
): {
  service: CampaignCreationService;
  listings: ListingsService;
  growthObjectives: GrowthObjectivesService;
} {
  const listing = makeListing(listingOverrides);
  const growthObjective = makeGrowthObjective(objectiveOverrides);
  const listings = { getById: vi.fn(async () => listing) } as unknown as ListingsService;
  const growthObjectives = {
    getById: vi.fn(async () => growthObjective),
  } as unknown as GrowthObjectivesService;
  return {
    service: new CampaignCreationService(listings, growthObjectives),
    listings,
    growthObjectives,
  };
}

describe("CampaignCreationService", () => {
  it("getListingReadiness delegates to ListingsService.getById and wraps assessListingReadiness", async () => {
    const { service, listings } = buildService();
    const result = await service.getListingReadiness(TENANT, "listing-1");
    expect(listings.getById).toHaveBeenCalledWith(TENANT, "listing-1");
    expect(result.listingId).toBe("listing-1");
    expect(result.readiness.ready).toBe(true);
  });

  it("getListingReadiness surfaces a not-ready listing honestly (no WhatsApp number)", async () => {
    const { service } = buildService({ waNumber: undefined });
    const result = await service.getListingReadiness(TENANT, "listing-1");
    expect(result.readiness.ready).toBe(false);
    expect(result.readiness.blockingIssues.length).toBeGreaterThan(0);
  });

  it("getBlueprint fetches both the objective and the listing, then builds a blueprint", async () => {
    const { service, listings, growthObjectives } = buildService();
    const result = await service.getBlueprint(TENANT, "objective-1", "listing-1");
    expect(growthObjectives.getById).toHaveBeenCalledWith(TENANT, "objective-1");
    expect(listings.getById).toHaveBeenCalledWith(TENANT, "listing-1");
    expect(result.blueprint.destination).toBe("WHATSAPP");
    expect(result.blueprint.warnings).toContain(
      "Growth objective belum dianalisa (POST /growth-objectives/:id/analyze) — budget harian belum bisa diproyeksikan.",
    );
  });

  it("getBlueprint computes a real dailyBudgetIdr when the objective has a real forecast", async () => {
    const { service } = buildService(
      {},
      {
        forecast: {
          reverseFunnel: {
            conversionRate: 0.2,
            estimatedRequiredRawLeads: { min: 200, expected: 250, max: 300 },
            estimatedMediaSpendIdr: { min: 4_000_000, expected: 3_000_000, max: 6_000_000 },
            confidence: 0.8,
          },
          feasibility: { status: "ACHIEVABLE", confidence: 0.8, reasons: [], options: [] },
        },
      },
    );
    const result = await service.getBlueprint(TENANT, "objective-1", "listing-1");
    expect(result.blueprint.adSet.dailyBudgetIdr).toBeGreaterThan(0);
  });

  it("getPreflight combines listing readiness, blueprint, and feasibility into one verdict", async () => {
    const { service } = buildService(
      {},
      {
        forecast: {
          reverseFunnel: {
            conversionRate: 0.2,
            estimatedRequiredRawLeads: { min: 200, expected: 250, max: 300 },
            estimatedMediaSpendIdr: { min: 4_000_000, expected: 3_000_000, max: 6_000_000 },
            confidence: 0.8,
          },
          feasibility: { status: "ACHIEVABLE", confidence: 0.8, reasons: [], options: [] },
        },
      },
    );
    const result = await service.getPreflight(TENANT, "objective-1", "listing-1");
    expect(result.growthObjectiveId).toBe("objective-1");
    expect(result.listingId).toBe("listing-1");
    expect(result.preflight.ready).toBe(true);
  });

  it("getPreflight is honestly not ready when the objective has no forecast yet", async () => {
    const { service } = buildService();
    const result = await service.getPreflight(TENANT, "objective-1", "listing-1");
    expect(result.preflight.ready).toBe(false);
    const feasibilityCheck = result.preflight.checks.find((c) => c.name === "feasibility");
    expect(feasibilityCheck?.passed).toBe(false);
  });
});
