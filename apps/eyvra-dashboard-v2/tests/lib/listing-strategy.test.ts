import { expect, it } from "vitest";
import { draftListingStrategy } from "@/lib/listing-strategy";
import { mapListingToListItem } from "@/lib/listings";
import { listingFixture } from "./listing-fixture";
it("automatically drafts five distinct factual copy options without an objective record", () => {
  const draft = draftListingStrategy(mapListingToListItem(listingFixture()));
  expect(draft.objective).toBe("Qualified Leads");
  expect(draft.variants).toHaveLength(5);
  expect(new Set(draft.variants.map((v) => v.primaryText)).size).toBe(5);
  expect(draft.direction).toContain("4:5");
  expect(draft.variants.every((v) => v.primaryText.includes("Bandung"))).toBe(true);
  expect(JSON.stringify(draft.variants)).not.toMatch(/DP 10%|ROI|diskon|jaminan/);
});
it("does not fabricate missing prices or property specifications", () => {
  const record = listingFixture();
  record.listing.price = 0;
  record.listing.landArea = undefined;
  record.listing.buildArea = undefined;
  record.listing.bedrooms = undefined;
  record.listing.certificate = undefined;
  const draft = draftListingStrategy(mapListingToListItem(record));
  expect(JSON.stringify(draft.variants)).not.toMatch(/Rp|SHM|100 m²/);
});
it("adjusts radius by listing price without using price to restrict adult ages", () => {
  const record = listingFixture();
  record.listing.price = 900000000;
  const low = draftListingStrategy(mapListingToListItem(record));
  record.listing.price = 4000000000;
  record.listing.propertyType = "TANAH";
  const high = draftListingStrategy(mapListingToListItem(record));
  expect(low.audience.radiusKm).toBe(10);
  expect(high.audience.radiusKm).toBe(25);
  expect(high.audience.age).toBe(low.audience.age);

  expect(high.audience.validation).toContain("belum diverifikasi");
});
