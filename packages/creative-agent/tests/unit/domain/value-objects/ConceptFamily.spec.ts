import { describe, expect, it } from "vitest";

import {
  ALL_CONCEPT_FAMILIES,
  ConceptFamily,
} from "../../../../src/domain/value-objects/ConceptFamily.js";

const SPEC_MEMBERS = [
  "PRICE_DOMINANT",
  "MORTGAGE_CARD",
  "LOCATION_MAP",
  "LOCATION_COMMUTE",
  "PREMIUM_EDITORIAL",
  "FAMILY_LIFESTYLE",
  "PROPERTY_FEATURE",
  "SPEC_GRID",
  "INVESTOR_DATA",
  "POV_TOUR",
  "UGC_DISCOVERY",
  "PROBLEM_SOLUTION",
  "CURIOSITY_REVEAL",
  "CAROUSEL_DISCOVERY",
  "ARCHITECTURAL_DETAIL",
  "SOCIAL_NATIVE",
  "PROPERTY_COMPARISON",
  "SCARCITY_DIRECT",
  "FLOORPLAN_STORY",
  "NEIGHBORHOOD_STORY",
];

describe("ConceptFamily", () => {
  it("has exactly the spec's real 20 members", () => {
    expect(Object.values(ConceptFamily)).toHaveLength(20);
    expect(Object.values(ConceptFamily).sort()).toEqual([...SPEC_MEMBERS].sort());
  });

  it("each enum member's value equals its own key (plain string enum)", () => {
    for (const member of SPEC_MEMBERS) {
      expect(ConceptFamily[member as keyof typeof ConceptFamily]).toBe(member);
    }
  });
});

describe("ALL_CONCEPT_FAMILIES", () => {
  it("lists all 20 members in the spec's declared order", () => {
    expect(ALL_CONCEPT_FAMILIES).toEqual(SPEC_MEMBERS);
  });

  it("contains no duplicates", () => {
    expect(new Set(ALL_CONCEPT_FAMILIES).size).toBe(ALL_CONCEPT_FAMILIES.length);
  });
});
