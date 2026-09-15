import { describe, expect, it } from "vitest";

import { scoreListingAngleStrength } from "@/lib/kaiAngleStrength";
import type { ListingDto } from "@/types/listing.types";

function buildListing(overrides: Partial<ListingDto> = {}): ListingDto {
  return {
    id: "listing-1",
    title: "Rumah Bintaro",
    propertyType: "RUMAH",
    listingStatus: "AKTIF",
    price: 1_000_000_000,
    highlights: [],
    photos: [],
    documents: [],
    inKnowledgeBase: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("scoreListingAngleStrength", () => {
  it("never returns TESTIMONIAL — no per-listing review data exists to honestly score it from", () => {
    const scored = scoreListingAngleStrength(
      buildListing({ description: "testimonial testimonial testimonial" }),
    );
    expect(scored.some((s) => s.angle === "TESTIMONIAL")).toBe(false);
  });

  it("scores DP_RINGAN whenever price is present, sorted strongest first among matches", () => {
    const cheap = scoreListingAngleStrength(buildListing({ price: 400_000_000 }));
    expect(cheap[0]?.angle).toBe("DP_RINGAN");
    expect(cheap[0]?.strength).toBe(90);
  });

  it("only includes READY_HUNI when the real condition/description text actually says so", () => {
    const withSignal = scoreListingAngleStrength(buildListing({ condition: "Baru, siap huni" }));
    const withoutSignal = scoreListingAngleStrength(buildListing());
    expect(withSignal.some((s) => s.angle === "READY_HUNI")).toBe(true);
    expect(withoutSignal.some((s) => s.angle === "READY_HUNI")).toBe(false);
  });

  it("only includes VIRTUAL_TOUR once there are enough real photos to cut a walkthrough from", () => {
    const fewPhotos = scoreListingAngleStrength(
      buildListing({ photos: [{ id: "p1", url: "x", order: 0, isMain: true }] }),
    );
    const photos = Array.from({ length: 6 }, (_, i) => ({
      id: `p${String(i)}`,
      url: "x",
      order: i,
      isMain: i === 0,
    }));
    const manyPhotos = scoreListingAngleStrength(buildListing({ photos }));
    expect(fewPhotos.some((s) => s.angle === "VIRTUAL_TOUR")).toBe(false);
    expect(manyPhotos.some((s) => s.angle === "VIRTUAL_TOUR")).toBe(true);
  });

  it("sorts strongest angle first when multiple real signals are present", () => {
    const scored = scoreListingAngleStrength(
      buildListing({
        price: 300_000_000,
        description: "promo terbatas hanya bulan ini",
        photos: Array.from({ length: 8 }, (_, i) => ({
          id: `p${String(i)}`,
          url: "x",
          order: i,
          isMain: i === 0,
        })),
      }),
    );
    expect(scored.length).toBeGreaterThan(1);
    for (let i = 1; i < scored.length; i += 1) {
      expect(scored[i - 1]!.strength).toBeGreaterThanOrEqual(scored[i]!.strength);
    }
  });
});
