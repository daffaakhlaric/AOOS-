import { describe, it, expect } from "vitest";
import {
  mapListingToListItem,
  filterListings,
  mapAudienceRecommendation,
  type ListingFilters,
} from "@/lib/listings";
import { listingFixture } from "./listing-fixture";
const filters: ListingFilters = {
  search: "",
  area: "",
  status: "",
  type: "",
  price: "",
  readiness: "",
  campaign: "",
};
describe("listing view models", () => {
  it("distinguishes unavailable campaign evidence from confirmed empty linkage", () => {
    const f = listingFixture();
    expect(mapListingToListItem(f).health.linked).toBeUndefined();
    expect(mapListingToListItem(f, []).health.campaignLabel).toBe("Belum ada campaign terhubung");
  });
  it("calculates price per square metre with explicit property area basis", () => {
    const f = listingFixture();
    expect(mapListingToListItem(f).perSquare).toBe(12000000);
    f.listing.propertyType = "APARTEMEN";
    expect(mapListingToListItem(f).perSquare).toBe(15000000);
  });
  it("searches ID and location and combines price/type filters", () => {
    const items = [mapListingToListItem(listingFixture("unique-id"))];
    expect(filterListings(items, { ...filters, search: "unique-id" })).toHaveLength(1);
    expect(filterListings(items, { ...filters, search: "bandung", price: "under1" })).toHaveLength(
      0,
    );
  });
  it("cannot mark sold properties ready regardless of photos", () => {
    const f = listingFixture();
    f.listing.listingStatus = "TERJUAL";
    expect(mapListingToListItem(f).health.state).toBe("UNAVAILABLE");
  });
  it("does not invent targeting capabilities or age/radius recommendations", () => {
    expect(mapAudienceRecommendation().age).toContain("Belum divalidasi");
    expect(mapAudienceRecommendation().locations).toBeUndefined();
  });
});
