import { describe, expect, it } from "vitest";

import {
  BRANCH_AUDIENCE_DEFAULTS,
  branchAudienceDefault,
} from "../../../src/config/BranchAudienceDefaults.js";
import { Branch } from "../../../src/domain/value-objects/Branch.js";

describe("BRANCH_AUDIENCE_DEFAULTS", () => {
  it("covers every real Branch enum member — no branch can render an empty default", () => {
    for (const branch of Object.values(Branch)) {
      expect(BRANCH_AUDIENCE_DEFAULTS[branch]).toBeDefined();
      expect(BRANCH_AUDIENCE_DEFAULTS[branch].cities.length).toBeGreaterThan(0);
    }
  });

  it("carries the unreviewed-default caveat on EVERY entry (never presented as confirmed data)", () => {
    for (const branch of Object.values(Branch)) {
      expect(BRANCH_AUDIENCE_DEFAULTS[branch].note).toContain("Perkiraan awal");
    }
  });

  it("gives every entry a plausible, self-consistent age band", () => {
    for (const branch of Object.values(Branch)) {
      const value = BRANCH_AUDIENCE_DEFAULTS[branch];
      expect(value.ageMin).toBeGreaterThanOrEqual(18);
      expect(value.ageMax).toBeGreaterThan(value.ageMin);
      expect(value.ageMax).toBeLessThanOrEqual(65);
    }
  });

  it("maps the physical branches to real cities near their real locations", () => {
    expect(BRANCH_AUDIENCE_DEFAULTS[Branch.CINERE].cities).toContain("Depok");
    expect(BRANCH_AUDIENCE_DEFAULTS[Branch.BINTARO].cities).toContain("Tangerang Selatan");
    expect(BRANCH_AUDIENCE_DEFAULTS[Branch.BANDUNG].cities).toContain("Bandung");
  });

  it("uses a broad default for the non-physical branch values", () => {
    expect(BRANCH_AUDIENCE_DEFAULTS[Branch.JABODETABEK].cities.length).toBeGreaterThan(3);
    expect(BRANCH_AUDIENCE_DEFAULTS[Branch.BOOST].cities.length).toBeGreaterThan(3);
    expect(BRANCH_AUDIENCE_DEFAULTS[Branch.MULTI].cities).toContain("Bandung");
    expect(BRANCH_AUDIENCE_DEFAULTS[Branch.UMUM].cities).toEqual(["Indonesia"]);
  });
});

describe("branchAudienceDefault", () => {
  it("resolves a known branch string", () => {
    expect(branchAudienceDefault("BANDUNG")).toBe(BRANCH_AUDIENCE_DEFAULTS[Branch.BANDUNG]);
  });

  it("falls back to UMUM for an unknown or absent branch rather than throwing", () => {
    expect(branchAudienceDefault("NOT_A_BRANCH")).toBe(BRANCH_AUDIENCE_DEFAULTS[Branch.UMUM]);
    expect(branchAudienceDefault(undefined)).toBe(BRANCH_AUDIENCE_DEFAULTS[Branch.UMUM]);
  });
});
