import { describe, expect, it } from "vitest";

import { LeadProfileBuilder } from "../../../src/builders/LeadProfileBuilder.js";
import { LeadProfile } from "../../../src/domain/entities/LeadProfile.js";
import { QualificationStatus } from "../../../src/domain/value-objects/QualificationStatus.js";

describe("LeadProfileBuilder", () => {
  it("enrich() applies a BUDGET match", () => {
    const profile = LeadProfileBuilder.enrich(LeadProfile.empty(), [
      { status: QualificationStatus.BUDGET, extractedText: "200 juta" },
    ]);
    expect(profile.budget).toBe("200 juta");
  });

  it("enrich() applies a UNIT match", () => {
    const profile = LeadProfileBuilder.enrich(LeadProfile.empty(), [
      { status: QualificationStatus.UNIT, extractedText: "Xpander" },
    ]);
    expect(profile.unit).toBe("Xpander");
  });

  it("enrich() applies an AREA match", () => {
    const profile = LeadProfileBuilder.enrich(LeadProfile.empty(), [
      { status: QualificationStatus.AREA, extractedText: "Depok" },
    ]);
    expect(profile.area).toBe("Depok");
  });

  it("enrich() applies a PAYMENT match", () => {
    const profile = LeadProfileBuilder.enrich(LeadProfile.empty(), [
      { status: QualificationStatus.PAYMENT, extractedText: "Kredit" },
    ]);
    expect(profile.paymentMethod).toBe("Kredit");
  });

  it("enrich() applies a TIMELINE match", () => {
    const profile = LeadProfileBuilder.enrich(LeadProfile.empty(), [
      { status: QualificationStatus.TIMELINE, extractedText: "bulan ini" },
    ]);
    expect(profile.timeline).toBe("bulan ini");
  });

  it("enrich() applies a NAME match", () => {
    const profile = LeadProfileBuilder.enrich(LeadProfile.empty(), [
      { status: QualificationStatus.NAME, extractedText: "Budi" },
    ]);
    expect(profile.name).toBe("Budi");
  });

  it("enrich() applies multiple matches in one call", () => {
    const profile = LeadProfileBuilder.enrich(LeadProfile.empty(), [
      { status: QualificationStatus.BUDGET, extractedText: "200 juta" },
      { status: QualificationStatus.UNIT, extractedText: "Xpander" },
    ]);
    expect(profile.budget).toBe("200 juta");
    expect(profile.unit).toBe("Xpander");
    expect(profile.qualified.size).toBe(2);
  });

  it("enrich() with no matches returns the same-shaped profile", () => {
    const profile = LeadProfileBuilder.enrich(LeadProfile.empty(), []);
    expect(profile.qualified.size).toBe(0);
  });
});
