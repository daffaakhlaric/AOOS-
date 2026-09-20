import { describe, expect, it } from "vitest";

import {
  ALL_CONCEPT_FAMILIES,
  ConceptFamily,
} from "../../../src/domain/value-objects/ConceptFamily.js";
import {
  ALL_LAYOUT_FAMILIES,
  LayoutFamily,
} from "../../../src/domain/value-objects/LayoutFamily.js";
import { ConceptFamilyToLayoutFamilyMapper } from "../../../src/intelligence/ConceptFamilyToLayoutFamilyMapper.js";

describe("ConceptFamilyToLayoutFamilyMapper", () => {
  it("all 20 ConceptFamily members map to exactly one real LayoutFamily", () => {
    expect(ALL_CONCEPT_FAMILIES).toHaveLength(20);
    for (const family of ALL_CONCEPT_FAMILIES) {
      const layout = ConceptFamilyToLayoutFamilyMapper.layoutFor(family);
      expect(ALL_LAYOUT_FAMILIES).toContain(layout);
    }
  });

  it("reuses the exact same name for the 3 concept families that are also real layout family names", () => {
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.PRICE_DOMINANT)).toBe(
      LayoutFamily.PRICE_DOMINANT,
    );
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.MORTGAGE_CARD)).toBe(
      LayoutFamily.MORTGAGE_CARD,
    );
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.SPEC_GRID)).toBe(
      LayoutFamily.SPEC_GRID,
    );
  });

  it("maps every location-appeal concept family to MAP_HYBRID", () => {
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.LOCATION_MAP)).toBe(
      LayoutFamily.MAP_HYBRID,
    );
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.LOCATION_COMMUTE)).toBe(
      LayoutFamily.MAP_HYBRID,
    );
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.NEIGHBORHOOD_STORY)).toBe(
      LayoutFamily.MAP_HYBRID,
    );
  });

  it("maps premium/architectural concept families to EDITORIAL_LUXURY", () => {
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.PREMIUM_EDITORIAL)).toBe(
      LayoutFamily.EDITORIAL_LUXURY,
    );
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.ARCHITECTURAL_DETAIL)).toBe(
      LayoutFamily.EDITORIAL_LUXURY,
    );
  });

  it("maps immersive/lifestyle/native concept families to HERO_FULL_BLEED", () => {
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.FAMILY_LIFESTYLE)).toBe(
      LayoutFamily.HERO_FULL_BLEED,
    );
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.POV_TOUR)).toBe(
      LayoutFamily.HERO_FULL_BLEED,
    );
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.SOCIAL_NATIVE)).toBe(
      LayoutFamily.HERO_FULL_BLEED,
    );
  });

  it("maps direct feature/urgency concept families to BOTTOM_INFO_BAR", () => {
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.PROPERTY_FEATURE)).toBe(
      LayoutFamily.BOTTOM_INFO_BAR,
    );
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.SCARCITY_DIRECT)).toBe(
      LayoutFamily.BOTTOM_INFO_BAR,
    );
  });

  it("maps INVESTOR_DATA to FLOATING_CARD", () => {
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.INVESTOR_DATA)).toBe(
      LayoutFamily.FLOATING_CARD,
    );
  });

  it("maps discovery-shaped concept families to PROPERTY_DISCOVERY", () => {
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.UGC_DISCOVERY)).toBe(
      LayoutFamily.PROPERTY_DISCOVERY,
    );
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.CAROUSEL_DISCOVERY)).toBe(
      LayoutFamily.PROPERTY_DISCOVERY,
    );
  });

  it("maps comparison/before-after concept families to SPLIT_SCREEN", () => {
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.PROBLEM_SOLUTION)).toBe(
      LayoutFamily.SPLIT_SCREEN,
    );
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.PROPERTY_COMPARISON)).toBe(
      LayoutFamily.SPLIT_SCREEN,
    );
  });

  it("maps CURIOSITY_REVEAL to ASYMMETRIC_EDITORIAL", () => {
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.CURIOSITY_REVEAL)).toBe(
      LayoutFamily.ASYMMETRIC_EDITORIAL,
    );
  });

  it("maps FLOORPLAN_STORY to SPEC_GRID", () => {
    expect(ConceptFamilyToLayoutFamilyMapper.layoutFor(ConceptFamily.FLOORPLAN_STORY)).toBe(
      LayoutFamily.SPEC_GRID,
    );
  });
});
