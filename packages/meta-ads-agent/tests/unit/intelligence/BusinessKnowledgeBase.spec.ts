import { Branch, Funnel } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { TargetPersona } from "../../../src/domain/value-objects/TargetPersona.js";
import { BusinessKnowledgeBase } from "../../../src/intelligence/BusinessKnowledgeBase.js";

describe("BusinessKnowledgeBase.clientProfile", () => {
  it("encodes DSS Motor's client profile", () => {
    const profile = BusinessKnowledgeBase.clientProfile();
    expect(profile.client).toBe("DSS Motor");
    expect(profile.brand).toBe("Mobix");
    expect(profile.adAccountIds).toContain("act_752604553578354");
    expect(profile.adAccountIds).toContain("act_1398036411113054");
    expect(profile.topUnits).toContain("Xpander");
  });
});

describe("BusinessKnowledgeBase.personas", () => {
  it("encodes both target-market personas with structured fields", () => {
    const personas = BusinessKnowledgeBase.personas();
    expect(personas).toHaveLength(2);
    const primary = BusinessKnowledgeBase.persona(TargetPersona.PRIMARY_FAMILY);
    expect(primary.ageRange).toBe("25-40 tahun");
    expect(primary.painPoints).toContain("Takut beli mobil bekas bermasalah");
    expect(primary.triggers).toContain("Anak masuk sekolah/kuliah");
    expect(primary.budgetRangeIDR).toEqual({ minIDR: 100_000_000, maxIDR: 250_000_000 });

    const secondary = BusinessKnowledgeBase.persona(TargetPersona.SECONDARY_BUSINESS);
    expect(secondary.ageRange).toBe("30-50 tahun");
    expect(secondary.units).toContain("MPV");
    expect(secondary.priority).toBe("Kilometer rendah, mesin prima, no trouble");
  });
});

describe("BusinessKnowledgeBase.classifyAngleTier", () => {
  it("classifies HIGH performing (< Rp 7.000)", () => {
    expect(BusinessKnowledgeBase.classifyAngleTier(6_999)).toBe("HIGH");
    expect(BusinessKnowledgeBase.classifyAngleTier(0)).toBe("HIGH");
  });

  it("classifies MEDIUM performing (Rp 7.000-15.000 inclusive)", () => {
    expect(BusinessKnowledgeBase.classifyAngleTier(7_000)).toBe("MEDIUM");
    expect(BusinessKnowledgeBase.classifyAngleTier(15_000)).toBe("MEDIUM");
  });

  it("classifies LOW performing (> Rp 15.000)", () => {
    expect(BusinessKnowledgeBase.classifyAngleTier(15_001)).toBe("LOW");
  });

  it("returns null for an undefined (null) rphD3", () => {
    expect(BusinessKnowledgeBase.classifyAngleTier(null)).toBeNull();
  });

  it("returns null for a non-finite rphD3", () => {
    expect(BusinessKnowledgeBase.classifyAngleTier(Number.NaN)).toBeNull();
  });

  it("angleTierBands exposes all three tiers with their angle lists", () => {
    const bands = BusinessKnowledgeBase.angleTierBands();
    expect(bands.map((b) => b.tier)).toEqual(["HIGH", "MEDIUM", "LOW"]);
    expect(bands[0]?.angles).toContain("DP ringan mulai X juta");
  });
});

describe("BusinessKnowledgeBase.campaignNamingRules", () => {
  it("encodes the spec's exact naming-convention classification table", () => {
    const rules = BusinessKnowledgeBase.campaignNamingRules();
    const ctwaBintaro = rules.find((r) => r.pattern === "Meta-CTWA-Leads-Mobix-Bintaro");
    expect(ctwaBintaro?.funnel).toBe(Funnel.CTWA);
    expect(ctwaBintaro?.branch).toBe(Branch.BINTARO);

    const dm = rules.find((r) => r.pattern === "Meta-DM-Leads-Mobix");
    expect(dm?.funnel).toBe(Funnel.DM);

    const boost = rules.find((r) => r.pattern === "Post: [content]");
    expect(boost?.funnel).toBe(Funnel.BRAND_BOOST);
    expect(boost?.branch).toBe(Branch.BOOST);
  });
});
