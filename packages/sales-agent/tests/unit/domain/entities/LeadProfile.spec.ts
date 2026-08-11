import { describe, expect, it } from "vitest";

import { LeadProfile } from "../../../../src/domain/entities/LeadProfile.js";
import { QualificationStatus } from "../../../../src/domain/value-objects/QualificationStatus.js";

describe("LeadProfile", () => {
  it("empty() has no fields and no qualified criteria", () => {
    const profile = LeadProfile.empty();
    expect(profile.budget).toBeUndefined();
    expect(profile.unit).toBeUndefined();
    expect(profile.area).toBeUndefined();
    expect(profile.paymentMethod).toBeUndefined();
    expect(profile.timeline).toBeUndefined();
    expect(profile.name).toBeUndefined();
    expect(profile.qualified.size).toBe(0);
  });

  it("withEnrichment() merges a patch and marks the status qualified", () => {
    const enriched = LeadProfile.empty().withEnrichment(
      { budget: "200 juta" },
      QualificationStatus.BUDGET,
    );
    expect(enriched.budget).toBe("200 juta");
    expect(enriched.isQualified(QualificationStatus.BUDGET)).toBe(true);
  });

  it("withEnrichment() without a status leaves qualified unchanged", () => {
    const enriched = LeadProfile.empty().withEnrichment({ name: "Budi" });
    expect(enriched.name).toBe("Budi");
    expect(enriched.qualified.size).toBe(0);
  });

  it("withEnrichment() returns a NEW instance, does not mutate the original", () => {
    const original = LeadProfile.empty();
    const enriched = original.withEnrichment({ area: "Depok" }, QualificationStatus.AREA);
    expect(original.area).toBeUndefined();
    expect(enriched.area).toBe("Depok");
  });

  it("create() copies the qualified set defensively", () => {
    const source = new Set([QualificationStatus.UNIT]);
    const profile = LeadProfile.create({ qualified: source });
    source.add(QualificationStatus.BUDGET);
    expect(profile.qualified.has(QualificationStatus.BUDGET)).toBe(false);
  });

  it("isQualified() is false for an unqualified status", () => {
    expect(LeadProfile.empty().isQualified(QualificationStatus.NAME)).toBe(false);
  });

  it("accumulates multiple enrichments across calls", () => {
    const profile = LeadProfile.empty()
      .withEnrichment({ budget: "200 juta" }, QualificationStatus.BUDGET)
      .withEnrichment({ unit: "Xpander" }, QualificationStatus.UNIT);
    expect(profile.budget).toBe("200 juta");
    expect(profile.unit).toBe("Xpander");
    expect(profile.qualified.size).toBe(2);
  });
});
