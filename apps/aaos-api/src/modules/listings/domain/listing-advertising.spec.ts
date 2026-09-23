import { describe, it, expect } from "vitest";

import type { ListingResponseDto } from "../dto/listing.dto.js";

import { buildListingAdvertising } from "./listing-advertising.js";
const listing: ListingResponseDto = {
  id: "listing",
  title: "Rumah contoh",
  propertyType: "RUMAH",
  listingStatus: "AKTIF",
  price: 1200000000,
  city: "Bandung",
  photos: [],
  documents: [],
  highlights: [],
  inKnowledgeBase: false,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-02",
};
describe("listing advertising draft", () => {
  it("uses recorded facts without inventing legal, financial or proximity claims", () => {
    const result = buildListingAdvertising(listing);
    expect(result.copy.primaryText).toContain("Bandung");
    expect(result.copy.primaryText).not.toMatch(/SHM|ROI|KPR|menit|diskon/);
    expect(result.copy.destination).toBeUndefined();
    expect(result.readiness.ready).toBe(false);
    expect(result.copy.origin).toBe("LISTING_FACTS");
  });
  it("preserves legal and area facts only when present", () => {
    const result = buildListingAdvertising({
      ...listing,
      landArea: 100,
      certificate: "SHM",
      waNumber: "6281234",
    });
    expect(result.copy.primaryText).toContain("100 m²");
    expect(result.copy.primaryText).toContain("SHM");
    expect(result.copy.destination).toBe("WHATSAPP");
  });
  it("reuses readiness and never treats complete data as Meta validation", () => {
    const result = buildListingAdvertising({
      ...listing,
      waNumber: "62812",
      photos: [{ id: "photo", url: "https://example.test/photo.jpg", order: 0, isMain: true }],
    });
    expect(result.readiness.ready).toBe(true);
    expect(result).not.toHaveProperty("metaValidated");
  });
});
