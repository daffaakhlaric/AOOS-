import { describe, expect, it } from "vitest";

import type { ListingResponseDto } from "../dto/listing.dto.js";

import {
  buildPropertyKnowledge,
  formatIdrPrice,
  toPropertyKnowledgeListing,
} from "./property-knowledge.js";

function makeListing(overrides: Partial<ListingResponseDto> = {}): ListingResponseDto {
  return {
    id: "listing-1",
    title: "Rumah Bintaro",
    propertyType: "RUMAH",
    listingStatus: "AKTIF",
    price: 1_800_000_000,
    highlights: [],
    photos: [],
    documents: [],
    inKnowledgeBase: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("formatIdrPrice", () => {
  it("formats billions as 'Rp X Miliar'", () => {
    expect(formatIdrPrice(1_800_000_000)).toBe("Rp 1.8 Miliar");
  });

  it("formats whole billions without a trailing .0", () => {
    expect(formatIdrPrice(2_000_000_000)).toBe("Rp 2 Miliar");
  });

  it("formats millions as 'Rp X Juta'", () => {
    expect(formatIdrPrice(900_000_000 - 400_000_000)).toBe("Rp 500 Juta");
  });

  it("formats sub-million prices with locale grouping", () => {
    expect(formatIdrPrice(500_000)).toBe(`Rp ${(500_000).toLocaleString("id-ID")}`);
  });
});

describe("toPropertyKnowledgeListing", () => {
  it("uses city+province as location when both are present", () => {
    const entry = toPropertyKnowledgeListing(
      makeListing({ city: "Tangerang Selatan", province: "Banten" }),
    );
    expect(entry.location).toBe("Tangerang Selatan, Banten");
  });

  it("falls back to branchId when city/province are absent", () => {
    const entry = toPropertyKnowledgeListing(makeListing({ branchId: "BINTARO" }));
    expect(entry.location).toBe("BINTARO");
  });

  it("omits location entirely when neither city/province nor branchId are present", () => {
    const entry = toPropertyKnowledgeListing(makeListing());
    expect(entry.location).toBeUndefined();
  });

  it("maps specs/highlights/photos/waNumber", () => {
    const entry = toPropertyKnowledgeListing(
      makeListing({
        landArea: 88,
        buildArea: 70,
        bedrooms: 3,
        bathrooms: 2,
        garage: 1,
        certificate: "SHM",
        highlights: ["Dekat sekolah"],
        waNumber: "+628123456789",
        photos: [{ id: "p1", url: "https://gcs/1.jpg", order: 0, isMain: true }],
      }),
    );
    expect(entry.specs).toEqual({
      landArea: 88,
      buildArea: 70,
      bedrooms: 3,
      bathrooms: 2,
      garage: 1,
      certificate: "SHM",
    });
    expect(entry.highlights).toEqual(["Dekat sekolah"]);
    expect(entry.waNumber).toBe("+628123456789");
    expect(entry.photos).toEqual(["https://gcs/1.jpg"]);
  });
});

describe("buildPropertyKnowledge", () => {
  it("includes only listings marked in_knowledge_base=true", () => {
    const knowledge = buildPropertyKnowledge([
      makeListing({ id: "a", inKnowledgeBase: true }),
      makeListing({ id: "b", inKnowledgeBase: false }),
    ]);
    expect(knowledge.listings.map((l) => l.id)).toEqual(["a"]);
  });
});
