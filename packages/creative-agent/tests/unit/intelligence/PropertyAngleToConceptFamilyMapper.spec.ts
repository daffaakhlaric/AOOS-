import { describe, expect, it } from "vitest";

import { ConceptFamily } from "../../../src/domain/value-objects/ConceptFamily.js";
import {
  ALL_PROPERTY_AD_ANGLES,
  PropertyAdAngle,
} from "../../../src/domain/value-objects/PropertyAdAngle.js";
import { PropertyAngleToConceptFamilyMapper } from "../../../src/intelligence/PropertyAngleToConceptFamilyMapper.js";

describe("PropertyAngleToConceptFamilyMapper", () => {
  it("all 8 PropertyAdAngle members map to a non-empty ConceptFamily set", () => {
    expect(ALL_PROPERTY_AD_ANGLES).toHaveLength(8);
    for (const angle of ALL_PROPERTY_AD_ANGLES) {
      const families = PropertyAngleToConceptFamilyMapper.familiesFor(angle);
      expect(families.length).toBeGreaterThan(0);
      for (const family of families) {
        expect(Object.values(ConceptFamily)).toContain(family);
      }
    }
  });

  it("every mapped family set contains no duplicates", () => {
    for (const angle of ALL_PROPERTY_AD_ANGLES) {
      const families = PropertyAngleToConceptFamilyMapper.familiesFor(angle);
      expect(new Set(families).size).toBe(families.length);
    }
  });

  it("DP_RINGAN maps to PRICE_DOMINANT + MORTGAGE_CARD", () => {
    expect(PropertyAngleToConceptFamilyMapper.familiesFor(PropertyAdAngle.DP_RINGAN)).toEqual([
      ConceptFamily.PRICE_DOMINANT,
      ConceptFamily.MORTGAGE_CARD,
    ]);
  });

  it("READY_HUNI maps to PROPERTY_FEATURE + POV_TOUR", () => {
    expect(PropertyAngleToConceptFamilyMapper.familiesFor(PropertyAdAngle.READY_HUNI)).toEqual([
      ConceptFamily.PROPERTY_FEATURE,
      ConceptFamily.POV_TOUR,
    ]);
  });

  it("INVESTASI maps to INVESTOR_DATA + NEIGHBORHOOD_STORY", () => {
    expect(PropertyAngleToConceptFamilyMapper.familiesFor(PropertyAdAngle.INVESTASI)).toEqual([
      ConceptFamily.INVESTOR_DATA,
      ConceptFamily.NEIGHBORHOOD_STORY,
    ]);
  });

  it("EXCLUSIVE maps to PREMIUM_EDITORIAL + ARCHITECTURAL_DETAIL", () => {
    expect(PropertyAngleToConceptFamilyMapper.familiesFor(PropertyAdAngle.EXCLUSIVE)).toEqual([
      ConceptFamily.PREMIUM_EDITORIAL,
      ConceptFamily.ARCHITECTURAL_DETAIL,
    ]);
  });

  it("SYARIAH maps to MORTGAGE_CARD + FAMILY_LIFESTYLE", () => {
    expect(PropertyAngleToConceptFamilyMapper.familiesFor(PropertyAdAngle.SYARIAH)).toEqual([
      ConceptFamily.MORTGAGE_CARD,
      ConceptFamily.FAMILY_LIFESTYLE,
    ]);
  });

  it("PROMO_TERBATAS maps to SCARCITY_DIRECT + PRICE_DOMINANT", () => {
    expect(PropertyAngleToConceptFamilyMapper.familiesFor(PropertyAdAngle.PROMO_TERBATAS)).toEqual([
      ConceptFamily.SCARCITY_DIRECT,
      ConceptFamily.PRICE_DOMINANT,
    ]);
  });

  it("TESTIMONIAL maps to UGC_DISCOVERY + SOCIAL_NATIVE", () => {
    expect(PropertyAngleToConceptFamilyMapper.familiesFor(PropertyAdAngle.TESTIMONIAL)).toEqual([
      ConceptFamily.UGC_DISCOVERY,
      ConceptFamily.SOCIAL_NATIVE,
    ]);
  });

  it("VIRTUAL_TOUR maps to POV_TOUR + CAROUSEL_DISCOVERY", () => {
    expect(PropertyAngleToConceptFamilyMapper.familiesFor(PropertyAdAngle.VIRTUAL_TOUR)).toEqual([
      ConceptFamily.POV_TOUR,
      ConceptFamily.CAROUSEL_DISCOVERY,
    ]);
  });
});
