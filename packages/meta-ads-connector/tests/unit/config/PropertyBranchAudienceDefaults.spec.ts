import { describe, expect, it } from "vitest";

import {
  HOUSING_POLICY_WARNING,
  HOUSING_SPECIAL_AD_CATEGORY,
  PROPERTY_BRANCH_AUDIENCE_DEFAULTS,
  propertyBranchAudienceDefault,
} from "../../../src/config/PropertyBranchAudienceDefaults.js";

const EXPECTED_BRANCHES = ["BINTARO", "CINERE", "JAKARTA", "BANDUNG", "SURABAYA", "UMUM"];

describe("PROPERTY_BRANCH_AUDIENCE_DEFAULTS", () => {
  it("covers every real spec-listed branch — no branch can render an empty default", () => {
    for (const branch of EXPECTED_BRANCHES) {
      expect(PROPERTY_BRANCH_AUDIENCE_DEFAULTS[branch]).toBeDefined();
      expect(PROPERTY_BRANCH_AUDIENCE_DEFAULTS[branch]!.cities.length).toBeGreaterThan(0);
    }
  });

  it("carries the unreviewed-default caveat on EVERY entry (never presented as confirmed data)", () => {
    for (const branch of EXPECTED_BRANCHES) {
      expect(PROPERTY_BRANCH_AUDIENCE_DEFAULTS[branch]!.note).toContain("Perkiraan awal");
    }
  });

  it("matches spec Part 11's age 27-55 default for BINTARO/CINERE/SURABAYA", () => {
    expect(PROPERTY_BRANCH_AUDIENCE_DEFAULTS["BINTARO"]).toMatchObject({ ageMin: 27, ageMax: 55 });
    expect(PROPERTY_BRANCH_AUDIENCE_DEFAULTS["CINERE"]).toMatchObject({ ageMin: 27, ageMax: 55 });
    expect(PROPERTY_BRANCH_AUDIENCE_DEFAULTS["SURABAYA"]).toMatchObject({ ageMin: 27, ageMax: 55 });
  });

  it("uses a broad nationwide default for UMUM", () => {
    expect(PROPERTY_BRANCH_AUDIENCE_DEFAULTS["UMUM"]!.cities).toEqual(["Indonesia"]);
  });
});

describe("propertyBranchAudienceDefault", () => {
  it("resolves a known branch string, case-insensitively", () => {
    expect(propertyBranchAudienceDefault("bandung")).toBe(
      PROPERTY_BRANCH_AUDIENCE_DEFAULTS["BANDUNG"],
    );
  });

  it("falls back to UMUM for an unknown or absent branch rather than throwing", () => {
    expect(propertyBranchAudienceDefault("NOT_A_BRANCH")).toBe(
      PROPERTY_BRANCH_AUDIENCE_DEFAULTS["UMUM"],
    );
    expect(propertyBranchAudienceDefault(undefined)).toBe(
      PROPERTY_BRANCH_AUDIENCE_DEFAULTS["UMUM"],
    );
  });
});

describe("HOUSING special ad category", () => {
  it("is the literal 'HOUSING' Meta requires for property ads", () => {
    expect(HOUSING_SPECIAL_AD_CATEGORY).toBe("HOUSING");
  });

  it("carries the exact spec-required Indonesian policy warning copy", () => {
    expect(HOUSING_POLICY_WARNING).toContain("Special Ad Category HOUSING");
    expect(HOUSING_POLICY_WARNING).toContain("usia & gender dinonaktifkan");
  });
});
