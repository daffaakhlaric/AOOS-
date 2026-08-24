import { describe, expect, it } from "vitest";

import { BRAND_ANGLES, getBrandAngleIds } from "../../../src/intelligence/BrandAngles.js";

describe("BRAND_ANGLES", () => {
  it("has 5 real AUTOMOTIVE angles and 4 real PROPERTY angles, per the spec", () => {
    expect(BRAND_ANGLES.AUTOMOTIVE).toHaveLength(5);
    expect(BRAND_ANGLES.PROPERTY).toHaveLength(4);
  });

  it("every angle has a non-empty id/label/copyTemplate/cta and a real objective", () => {
    for (const vertical of ["AUTOMOTIVE", "PROPERTY"] as const) {
      for (const angle of BRAND_ANGLES[vertical]) {
        expect(angle.id.length).toBeGreaterThan(0);
        expect(angle.label.length).toBeGreaterThan(0);
        expect(angle.copyTemplate.length).toBeGreaterThan(0);
        expect(angle.cta.length).toBeGreaterThan(0);
        expect(["OUTCOME_AWARENESS", "OUTCOME_LEADS", "OUTCOME_ENGAGEMENT"]).toContain(
          angle.objective,
        );
      }
    }
  });

  it("AUTOMOTIVE ids are unique", () => {
    const ids = BRAND_ANGLES.AUTOMOTIVE.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("PROPERTY ids are unique", () => {
    const ids = BRAND_ANGLES.PROPERTY.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("AUTOMOTIVE copy is grounded in the real Mobix brand name, not a generic placeholder", () => {
    for (const angle of BRAND_ANGLES.AUTOMOTIVE) {
      expect(angle.copyTemplate).toContain("Mobix");
    }
  });
});

describe("getBrandAngleIds", () => {
  it("returns exactly the real ids for AUTOMOTIVE", () => {
    expect(getBrandAngleIds("AUTOMOTIVE")).toEqual([
      "BRAND_TRUST",
      "JUAL_BELI",
      "TUKAR_TAMBAH",
      "BENGKEL_GRATIS",
      "KOMUNITAS",
    ]);
  });

  it("returns exactly the real ids for PROPERTY", () => {
    expect(getBrandAngleIds("PROPERTY")).toEqual([
      "BRAND_TRUST",
      "AGEN_PROFESIONAL",
      "EDUKASI_KPR",
      "INVESTASI_PROPERTI",
    ]);
  });
});
