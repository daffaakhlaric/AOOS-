import type { IListingQueryService, PropertyListing } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { ListingQueryServiceSpy } from "../../../../src/application/services/ListingQueryServiceSpy.js";

function makeListing(overrides: Partial<PropertyListing> = {}): PropertyListing {
  return {
    id: "listing-1",
    title: "Rumah Minimalis Cinere",
    propertyType: "RUMAH",
    price: 1_500_000_000,
    ...overrides,
  };
}

describe("ListingQueryServiceSpy", () => {
  it("wasUsedWithResult starts false", () => {
    const spy = new ListingQueryServiceSpy({ getActive: () => [] });
    expect(spy.wasUsedWithResult).toBe(false);
  });

  it("getActive() with a non-empty result flips wasUsedWithResult to true", () => {
    const listing = makeListing();
    const spy = new ListingQueryServiceSpy({ getActive: () => [listing] });
    spy.getActive();
    expect(spy.wasUsedWithResult).toBe(true);
  });

  it("getActive() with an empty result leaves wasUsedWithResult false", () => {
    const spy = new ListingQueryServiceSpy({ getActive: () => [] });
    spy.getActive();
    expect(spy.wasUsedWithResult).toBe(false);
  });

  it("wasUsedWithResult stays true once flipped, even if a later call returns empty", () => {
    let callCount = 0;
    const listing = makeListing();
    const real: IListingQueryService = {
      getActive: () => {
        callCount += 1;
        return callCount === 1 ? [listing] : [];
      },
    };
    const spy = new ListingQueryServiceSpy(real);
    spy.getActive();
    spy.getActive();
    expect(spy.wasUsedWithResult).toBe(true);
  });

  it("delegates getActive() to the real service unchanged", () => {
    const listing = makeListing({ id: "listing-42" });
    const spy = new ListingQueryServiceSpy({ getActive: () => [listing] });
    expect(spy.getActive()).toEqual([listing]);
  });
});
