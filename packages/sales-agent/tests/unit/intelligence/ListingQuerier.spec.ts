import { describe, expect, it } from "vitest";

import type { IListingQueryService } from "../../../src/contracts/IListingQueryService.js";
import type { PropertyListing } from "../../../src/domain/entities/PropertyListing.js";
import { ListingQuerier } from "../../../src/intelligence/ListingQuerier.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const RUMAH: PropertyListing = {
  id: "l1",
  title: "Rumah Bintaro",
  propertyType: "RUMAH",
  price: 1_500_000_000,
  city: "Tangerang Selatan",
  bedrooms: 3,
};
const VILLA: PropertyListing = {
  id: "l2",
  title: "Villa Bandung",
  propertyType: "VILLA",
  price: 3_000_000_000,
  city: "Bandung",
  bedrooms: 4,
};

function fakeQueryService(active: ReadonlyArray<PropertyListing>): IListingQueryService {
  return { getActive: () => active };
}

describe("ListingQuerier", () => {
  it("findForLead: matches active listings against criteria", async () => {
    const querier = new ListingQuerier(fakeQueryService([RUMAH, VILLA]));
    const result = unwrap(await querier.findForLead({ propertyType: "RUMAH" }));
    expect(result).toEqual([RUMAH]);
  });

  it("findForLead: no match → ok([])", async () => {
    const querier = new ListingQuerier(fakeQueryService([RUMAH]));
    const result = unwrap(await querier.findForLead({ propertyType: "TANAH" }));
    expect(result).toHaveLength(0);
  });

  it("findForLead: propagates a real query-service failure as AgentError", async () => {
    const throwing: IListingQueryService = {
      getActive: () => {
        throw new Error("store unavailable");
      },
    };
    const querier = new ListingQuerier(throwing);
    const result = await querier.findForLead({});
    expect(unwrapErr(result).message).toContain("ListingQuerier.findForLead failed");
  });

  it("findAlternative: searches across all active listings, dropping city", () => {
    const querier = new ListingQuerier(fakeQueryService([RUMAH, VILLA]));
    expect(querier.findAlternative({ propertyType: "VILLA" })).toEqual([VILLA]);
  });
});
