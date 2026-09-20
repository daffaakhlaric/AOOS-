import { describe, expect, it } from "vitest";

import {
  ALL_LAYOUT_FAMILIES,
  LayoutFamily,
} from "../../../../src/domain/value-objects/LayoutFamily.js";

const SPEC_MEMBERS = [
  "HERO_FULL_BLEED",
  "ASYMMETRIC_EDITORIAL",
  "PRICE_DOMINANT",
  "BOTTOM_INFO_BAR",
  "FLOATING_CARD",
  "SPLIT_SCREEN",
  "MAP_HYBRID",
  "EDITORIAL_LUXURY",
  "SPEC_GRID",
  "MORTGAGE_CARD",
  "PROPERTY_DISCOVERY",
];

describe("LayoutFamily", () => {
  it("has exactly the spec's real 11 members", () => {
    expect(Object.values(LayoutFamily)).toHaveLength(11);
    expect(Object.values(LayoutFamily).sort()).toEqual([...SPEC_MEMBERS].sort());
  });

  it("each enum member's value equals its own key (plain string enum)", () => {
    for (const member of SPEC_MEMBERS) {
      expect(LayoutFamily[member as keyof typeof LayoutFamily]).toBe(member);
    }
  });
});

describe("ALL_LAYOUT_FAMILIES", () => {
  it("lists all 11 members in the spec's declared order", () => {
    expect(ALL_LAYOUT_FAMILIES).toEqual(SPEC_MEMBERS);
  });

  it("contains no duplicates", () => {
    expect(new Set(ALL_LAYOUT_FAMILIES).size).toBe(ALL_LAYOUT_FAMILIES.length);
  });
});
