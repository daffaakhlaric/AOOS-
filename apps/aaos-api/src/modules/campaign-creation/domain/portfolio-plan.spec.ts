import { describe, expect, it } from "vitest";

import type { GrowthObjectiveResponseDto } from "../../growth-objectives/dto/growth-objective.dto.js";
import type { ListingResponseDto } from "../../listings/dto/listing.dto.js";

import { planPortfolioAllocation } from "./portfolio-plan.js";

function makeListing(overrides: Partial<ListingResponseDto> = {}): ListingResponseDto {
  return {
    id: "listing-1",
    title: "Rumah Minimalis Bintaro",
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
  return {
    id: "go-1",
    tenantId: "dss-motor",
    metric: "HOT_LEADS",
    targetValue: 50,
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    budgetMode: "GOAL_FIRST",
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

const EMPTY_MAP: ReadonlyMap<string, readonly string[]> = new Map();

describe("planPortfolioAllocation", () => {
  it("zero candidate listings: empty candidates, honest warning, zero eligible", () => {
    const result = planPortfolioAllocation({
      growthObjective: makeGrowthObjective(),
      candidateListings: [],
      matchedCampaignIdsByListingId: EMPTY_MAP,
    });
    expect(result.candidates).toEqual([]);
    expect(result.eligibleCount).toBe(0);
    expect(result.totalTargetHotLeads).toBe(50);
    expect(result.warnings).toContain(
      "Tidak ada listing kandidat untuk growth objective ini — tidak ada listing tenant yang bisa dialokasikan.",
    );
  });

  it("all listings blocked by readiness issues: zero eligible, blockingIssues surfaced per listing", () => {
    const blocked = makeListing({ id: "listing-1", photos: [] });
    const result = planPortfolioAllocation({
      growthObjective: makeGrowthObjective(),
      candidateListings: [blocked],
      matchedCampaignIdsByListingId: EMPTY_MAP,
    });
    expect(result.eligibleCount).toBe(0);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.eligibleForAllocation).toBe(false);
    expect(result.candidates[0]?.readiness.ready).toBe(false);
    expect(result.candidates[0]?.readiness.blockingIssues).toContain(
      "Listing belum punya foto yang bisa dipakai untuk creative.",
    );
    expect(result.candidates[0]?.allocation).toBeUndefined();
    expect(result.warnings).toContain(
      "Semua listing kandidat terblokir oleh readiness issue — lihat blockingIssues masing-masing listing.",
    );
  });

  it("mixed ready/blocked: only ready listings get an allocation, even split across them", () => {
    const ready1 = makeListing({ id: "listing-1" });
    const ready2 = makeListing({ id: "listing-2" });
    const blocked = makeListing({ id: "listing-3", waNumber: undefined });
    const result = planPortfolioAllocation({
      growthObjective: makeGrowthObjective({ targetValue: 50 }),
      candidateListings: [ready1, ready2, blocked],
      matchedCampaignIdsByListingId: EMPTY_MAP,
    });
    expect(result.eligibleCount).toBe(2);
    const byId = new Map(result.candidates.map((c) => [c.listingId, c]));
    expect(byId.get("listing-1")?.eligibleForAllocation).toBe(true);
    expect(byId.get("listing-2")?.eligibleForAllocation).toBe(true);
    expect(byId.get("listing-3")?.eligibleForAllocation).toBe(false);
    expect(byId.get("listing-1")?.allocation?.targetHotLeads).toBe(25);
    expect(byId.get("listing-2")?.allocation?.targetHotLeads).toBe(25);
    expect(result.allocationModel).toBe("EVEN_SPLIT");
  });

  it("distributes a non-divisible target's remainder to the first listings, summing exactly to the total", () => {
    const listings = [
      makeListing({ id: "listing-1" }),
      makeListing({ id: "listing-2" }),
      makeListing({ id: "listing-3" }),
    ];
    const result = planPortfolioAllocation({
      growthObjective: makeGrowthObjective({ targetValue: 50 }),
      candidateListings: listings,
      matchedCampaignIdsByListingId: EMPTY_MAP,
    });
    expect(result.eligibleCount).toBe(3);
    const shares = result.candidates.map((c) => c.allocation?.targetHotLeads ?? 0);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(50);
    // floor(50/3) = 16, remainder 2 -> first two get 17, last gets 16
    expect(shares).toEqual([17, 17, 16]);
  });

  it("already-campaigned listings are excluded from allocation even when readiness passes", () => {
    const campaigned = makeListing({ id: "listing-1" });
    const ready = makeListing({ id: "listing-2" });
    const matched = new Map<string, readonly string[]>([["listing-1", ["meta-campaign-1"]]]);
    const result = planPortfolioAllocation({
      growthObjective: makeGrowthObjective({ targetValue: 40 }),
      candidateListings: [campaigned, ready],
      matchedCampaignIdsByListingId: matched,
    });
    expect(result.eligibleCount).toBe(1);
    const byId = new Map(result.candidates.map((c) => [c.listingId, c]));
    expect(byId.get("listing-1")?.alreadyCampaigned).toBe(true);
    expect(byId.get("listing-1")?.matchedCampaignIds).toEqual(["meta-campaign-1"]);
    expect(byId.get("listing-1")?.eligibleForAllocation).toBe(false);
    expect(byId.get("listing-1")?.allocation).toBeUndefined();
    expect(byId.get("listing-2")?.eligibleForAllocation).toBe(true);
    expect(byId.get("listing-2")?.allocation?.targetHotLeads).toBe(40);
    expect(result.warnings).not.toContain(
      "Semua listing kandidat sudah punya campaign — tidak ada listing baru yang bisa dialokasikan.",
    );
  });

  it("all candidates already campaigned: zero eligible, distinct honest warning", () => {
    const campaigned = makeListing({ id: "listing-1" });
    const matched = new Map<string, readonly string[]>([["listing-1", ["meta-campaign-1"]]]);
    const result = planPortfolioAllocation({
      growthObjective: makeGrowthObjective(),
      candidateListings: [campaigned],
      matchedCampaignIdsByListingId: matched,
    });
    expect(result.eligibleCount).toBe(0);
    expect(result.warnings).toContain(
      "Semua listing kandidat sudah punya campaign — tidak ada listing baru yang bisa dialokasikan.",
    );
  });

  it("no forecast yet: target allocation still computed, budget allocation honestly absent with a warning", () => {
    const ready = makeListing({ id: "listing-1" });
    const result = planPortfolioAllocation({
      growthObjective: makeGrowthObjective({ targetValue: 20 }), // no forecast
      candidateListings: [ready],
      matchedCampaignIdsByListingId: EMPTY_MAP,
    });
    expect(result.totalEstimatedMediaSpendIdr).toBeUndefined();
    expect(result.candidates[0]?.allocation?.targetHotLeads).toBe(20);
    expect(result.candidates[0]?.allocation?.budgetIdr).toBeUndefined();
    expect(result.warnings).toContain(
      "Growth objective belum dianalisa (POST /growth-objectives/:id/analyze) — alokasi budget belum bisa dihitung, hanya alokasi target hot lead.",
    );
  });

  it("forecast present but no estimatedMediaSpendIdr (too-thin sample): budget allocation still absent, distinct warning", () => {
    const ready = makeListing({ id: "listing-1" });
    const result = planPortfolioAllocation({
      growthObjective: makeGrowthObjective({
        targetValue: 20,
        forecast: {
          reverseFunnel: { conversionRate: undefined, confidence: 0.05 },
          feasibility: { status: "INSUFFICIENT_DATA", confidence: 0.05, reasons: [], options: [] },
        },
      }),
      candidateListings: [ready],
      matchedCampaignIdsByListingId: EMPTY_MAP,
    });
    expect(result.totalEstimatedMediaSpendIdr).toBeUndefined();
    expect(result.candidates[0]?.allocation?.budgetIdr).toBeUndefined();
    expect(result.warnings).toContain(
      "Growth objective sudah dianalisa tapi belum punya proyeksi media spend (data historis terlalu tipis) — alokasi budget belum bisa dihitung, hanya alokasi target hot lead.",
    );
  });

  it("forecast with a real estimatedMediaSpendIdr: budget split evenly, summing exactly to the total", () => {
    const listings = [makeListing({ id: "listing-1" }), makeListing({ id: "listing-2" })];
    const result = planPortfolioAllocation({
      growthObjective: makeGrowthObjective({
        targetValue: 50,
        forecast: {
          reverseFunnel: {
            conversionRate: 0.2,
            estimatedRequiredRawLeads: { min: 200, expected: 250, max: 300 },
            estimatedMediaSpendIdr: { min: 8_000_000, expected: 10_000_001, max: 12_000_000 },
            confidence: 0.5,
          },
          feasibility: { status: "ACHIEVABLE", confidence: 0.5, reasons: [], options: [] },
        },
      }),
      candidateListings: listings,
      matchedCampaignIdsByListingId: EMPTY_MAP,
    });
    expect(result.totalEstimatedMediaSpendIdr).toBe(10_000_001);
    const shares = result.candidates.map((c) => c.allocation?.budgetIdr ?? 0);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(10_000_001);
    expect(shares).toEqual([5_000_001, 5_000_000]);
  });
});
