import { describe, expect, it } from "vitest";

import type { PropertyListing } from "../../../src/domain/entities/PropertyListing.js";
import {
  estimatedDp,
  estimatedMonthlyKpr,
  getKprInfoResponse,
  getListingFoundResponse,
  getListingNotFoundResponse,
  getPropertyClosedResponse,
  getPropertyClosingResponse,
  getPropertyColdNurtureResponse,
  getPropertyDiscoveryQuestion,
  getPropertyGenericFollowUp,
  getPropertyGreeting,
  getPropertyHandoffResponse,
  getPropertyObjectionResponse,
  getPropertySyariahResponse,
  PROPERTY_CLOSING_FOLLOW_POOL,
  PROPERTY_CLOSING_HOT_POOL,
  PROPERTY_CLOSING_WARM_POOL,
  PROPERTY_PRICE_OBJECTION_POOL,
  PROPERTY_OBJECTION_NOT_SURE_POOL,
} from "../../../src/responses/PropertyResponses.js";

const LISTING: PropertyListing = {
  id: "l1",
  title: "Rumah Bintaro 3BR",
  propertyType: "RUMAH",
  price: 1_500_000_000,
  bedrooms: 3,
};
const LISTING_NO_BEDROOMS: PropertyListing = { ...LISTING, id: "l2", bedrooms: undefined };

describe("PropertyResponses", () => {
  it("getPropertyGreeting / getPropertyDiscoveryQuestion / getPropertyGenericFollowUp pick deterministically by seed", () => {
    expect(getPropertyGreeting(0).length).toBeGreaterThan(0);
    expect(getPropertyDiscoveryQuestion(0).length).toBeGreaterThan(0);
    expect(getPropertyGenericFollowUp(0).length).toBeGreaterThan(0);
  });

  it("getListingFoundResponse includes bedrooms count when present, omits when absent", () => {
    expect(getListingFoundResponse(LISTING, 0)).toContain("3 KT");
    expect(getListingFoundResponse(LISTING_NO_BEDROOMS, 0)).not.toContain("KT");
  });

  it("getListingNotFoundResponse: with vs. without an alternative city", () => {
    expect(getListingNotFoundResponse("rumah", "Bandung")).toContain("Bandung");
    expect(getListingNotFoundResponse("rumah")).not.toContain("tapi di");
  });

  it("estimatedDp / estimatedMonthlyKpr: 20% DP, 80% over 180 months", () => {
    expect(estimatedDp(1_000_000_000)).toBe(200_000_000);
    expect(estimatedMonthlyKpr(1_000_000_000)).toBe(Math.round(800_000_000 / 180));
  });

  it("getKprInfoResponse includes the formatted DP amount", () => {
    expect(getKprInfoResponse(LISTING, 0)).toContain("300.000.000");
  });

  it("getPropertyObjectionResponse: price-comparison wording routes to PROPERTY_PRICE_OBJECTION_POOL", () => {
    expect(PROPERTY_PRICE_OBJECTION_POOL).toContain(
      getPropertyObjectionResponse("di developer lain lebih murah", 0),
    );
    expect(PROPERTY_PRICE_OBJECTION_POOL).toContain(
      getPropertyObjectionResponse("kalau di tempat lain gimana", 0),
    );
  });

  it("getPropertyObjectionResponse: COMPLAINT intent routes to PROPERTY_PRICE_OBJECTION_POOL", () => {
    expect(PROPERTY_PRICE_OBJECTION_POOL).toContain(
      getPropertyObjectionResponse("random text", 0, ["COMPLAINT"]),
    );
  });

  it("getPropertyObjectionResponse: otherwise falls back to PROPERTY_OBJECTION_NOT_SURE_POOL", () => {
    expect(PROPERTY_OBJECTION_NOT_SURE_POOL).toContain(getPropertyObjectionResponse("hmm", 0));
    expect(PROPERTY_OBJECTION_NOT_SURE_POOL).toContain(getPropertyObjectionResponse("hmm", 0, []));
  });

  it("getPropertyClosingResponse: HOT score always wins regardless of attempt count", () => {
    expect(PROPERTY_CLOSING_HOT_POOL).toContain(getPropertyClosingResponse(70, 0, 65, 0));
    expect(PROPERTY_CLOSING_HOT_POOL).toContain(getPropertyClosingResponse(70, 3, 65, 0));
  });

  it("getPropertyClosingResponse: first attempt (WARM) uses the WARM pool", () => {
    expect(PROPERTY_CLOSING_WARM_POOL).toContain(getPropertyClosingResponse(40, 0, 65, 0));
  });

  it("getPropertyClosingResponse: subsequent attempts use the FOLLOW pool", () => {
    expect(PROPERTY_CLOSING_FOLLOW_POOL).toContain(getPropertyClosingResponse(40, 1, 65, 0));
  });

  it("getPropertyHandoffResponse includes the sales name", () => {
    expect(getPropertyHandoffResponse("Sales Bintaro", 0)).toContain("Sales Bintaro");
  });

  it("getPropertyColdNurtureResponse / getPropertySyariahResponse / getPropertyClosedResponse return non-empty text", () => {
    expect(getPropertyColdNurtureResponse(0).length).toBeGreaterThan(0);
    expect(getPropertySyariahResponse(0).length).toBeGreaterThan(0);
    expect(getPropertyClosedResponse(0).length).toBeGreaterThan(0);
  });
});
