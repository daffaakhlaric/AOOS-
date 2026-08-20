import { describe, expect, it } from "vitest";

import type { PropertyListing } from "../../../src/domain/entities/PropertyListing.js";
import { ListingMatcher } from "../../../src/intelligence/ListingMatcher.js";

const RUMAH_BINTARO: PropertyListing = {
  id: "l1",
  title: "Rumah Minimalis Bintaro",
  propertyType: "RUMAH",
  price: 1_500_000_000,
  city: "Tangerang Selatan",
  bedrooms: 3,
};
const APARTEMEN_JAKARTA: PropertyListing = {
  id: "l2",
  title: "Apartemen Studio Jakarta",
  propertyType: "APARTEMEN",
  price: 600_000_000,
  city: "Jakarta",
  bedrooms: 1,
};
const LISTINGS = [RUMAH_BINTARO, APARTEMEN_JAKARTA];

describe("ListingMatcher", () => {
  it("no criteria → returns every listing", () => {
    expect(ListingMatcher.match(LISTINGS, {})).toEqual(LISTINGS);
  });

  it("filters by propertyType", () => {
    expect(ListingMatcher.match(LISTINGS, { propertyType: "RUMAH" })).toEqual([RUMAH_BINTARO]);
  });

  it("filters by maxPrice", () => {
    expect(ListingMatcher.match(LISTINGS, { maxPrice: 700_000_000 })).toEqual([APARTEMEN_JAKARTA]);
  });

  it("filters by minBedrooms, excluding listings with fewer or undefined bedrooms", () => {
    expect(ListingMatcher.match(LISTINGS, { minBedrooms: 2 })).toEqual([RUMAH_BINTARO]);
    const noBedrooms: PropertyListing = { ...RUMAH_BINTARO, id: "l3", bedrooms: undefined };
    expect(ListingMatcher.match([noBedrooms], { minBedrooms: 1 })).toHaveLength(0);
  });

  it("filters by city (case-insensitive substring)", () => {
    expect(ListingMatcher.match(LISTINGS, { city: "jakarta" })).toEqual([APARTEMEN_JAKARTA]);
  });

  it("an empty-string city criterion matches everything (no-op, mirrors UnitMatcher's model handling)", () => {
    expect(ListingMatcher.match(LISTINGS, { city: "" })).toEqual(LISTINGS);
  });

  it("a city criterion that matches nothing (including listings with no city) excludes them", () => {
    const noCity: PropertyListing = { ...RUMAH_BINTARO, id: "l4", city: undefined };
    expect(ListingMatcher.match([noCity], { city: "bandung" })).toHaveLength(0);
  });

  it("combines multiple criteria (AND)", () => {
    expect(
      ListingMatcher.match(LISTINGS, { propertyType: "RUMAH", maxPrice: 2_000_000_000 }),
    ).toEqual([RUMAH_BINTARO]);
    expect(
      ListingMatcher.match(LISTINGS, { propertyType: "RUMAH", maxPrice: 1_000_000_000 }),
    ).toHaveLength(0);
  });
});
