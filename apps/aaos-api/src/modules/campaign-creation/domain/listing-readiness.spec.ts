import { describe, expect, it } from "vitest";

import type { ListingResponseDto } from "../../listings/dto/listing.dto.js";

import { assessListingReadiness, LISTING_READINESS_SKIPPED_CHECKS } from "./listing-readiness.js";

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

describe("assessListingReadiness", () => {
  it("ready: true, no blocking issues, when every real field is present and listing is AKTIF", () => {
    const result = assessListingReadiness(makeListing());
    expect(result.ready).toBe(true);
    expect(result.blockingIssues).toEqual([]);
    expect(result.checks.every((check) => check.passed)).toBe(true);
    expect(result.listingId).toBe("listing-1");
  });

  it("always reports the same honest skippedChecks list (no real data source for these fields)", () => {
    const result = assessListingReadiness(makeListing());
    expect(result.skippedChecks).toEqual(LISTING_READINESS_SKIPPED_CHECKS);
    expect(result.skippedChecks).toContain("usableVideos");
    expect(result.skippedChecks).toContain("kprIfClaimed");
  });

  it("ready: false with a specific reason when waNumber is missing", () => {
    const result = assessListingReadiness(makeListing({ waNumber: undefined }));
    expect(result.ready).toBe(false);
    expect(result.blockingIssues).toEqual([
      "Belum ada nomor WhatsApp destination pada listing ini.",
    ]);
    const check = result.checks.find((c) => c.name === "whatsappDestination");
    expect(check?.passed).toBe(false);
  });

  it("ready: false when listingStatus is not AKTIF", () => {
    const result = assessListingReadiness(makeListing({ listingStatus: "DRAFT" }));
    expect(result.ready).toBe(false);
    expect(result.blockingIssues[0]).toMatch(/DRAFT/);
  });

  it("ready: false when there are no usable photos", () => {
    const result = assessListingReadiness(makeListing({ photos: [] }));
    expect(result.ready).toBe(false);
    expect(result.blockingIssues).toContain(
      "Listing belum punya foto yang bisa dipakai untuk creative.",
    );
  });

  it("ready: false when city and province are both missing (no location)", () => {
    const result = assessListingReadiness(makeListing({ city: undefined, province: undefined }));
    expect(result.ready).toBe(false);
    expect(result.blockingIssues).toContain(
      "Listing belum punya lokasi (kota/provinsi) — targeting geo tidak bisa dibangun.",
    );
  });

  it("location passes when only province is set (city optional)", () => {
    const result = assessListingReadiness(makeListing({ city: undefined, province: "Banten" }));
    const check = result.checks.find((c) => c.name === "location");
    expect(check?.passed).toBe(true);
  });

  it("accumulates multiple blocking issues at once (multiple failing reasons)", () => {
    const result = assessListingReadiness(
      makeListing({ waNumber: undefined, photos: [], listingStatus: "TERJUAL" }),
    );
    expect(result.ready).toBe(false);
    expect(result.blockingIssues).toHaveLength(3);
  });
});
