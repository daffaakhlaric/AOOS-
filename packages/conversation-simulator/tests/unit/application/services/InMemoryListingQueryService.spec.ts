import type { PropertyListing } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { InMemoryListingQueryService } from "../../../../src/application/services/InMemoryListingQueryService.js";

function makeListing(overrides: Partial<PropertyListing> = {}): PropertyListing {
  return {
    id: "listing-1",
    title: "Rumah Minimalis Cinere",
    propertyType: "RUMAH",
    price: 1_500_000_000,
    ...overrides,
  };
}

describe("InMemoryListingQueryService", () => {
  it("getActive() returns exactly the listings it was constructed with", () => {
    const listings = [makeListing({ id: "a" }), makeListing({ id: "b" })];
    const service = new InMemoryListingQueryService(listings);
    expect(service.getActive()).toEqual(listings);
  });

  it("getActive() returns an empty array when constructed with none", () => {
    const service = new InMemoryListingQueryService([]);
    expect(service.getActive()).toEqual([]);
  });
});
