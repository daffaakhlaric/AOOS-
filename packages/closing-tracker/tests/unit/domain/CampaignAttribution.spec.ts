import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import {
  CampaignAttribution,
  resolveVerdict,
  type VerdictThresholds,
} from "../../../src/domain/entities/CampaignAttribution.js";
import { AttributionScore, ClosingRate, RphSpk } from "../../../src/domain/value-objects/index.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const THRESHOLDS: VerdictThresholds = {
  rphSpkScaleThreshold: 2_000_000,
  rphSpkKeepThreshold: 5_000_000,
  minSpendForPause: 1_000_000,
};

function baseProps(overrides: Partial<Parameters<typeof CampaignAttribution.create>[0]> = {}) {
  return {
    campaignId: "#C047",
    campaignName: "#A003 Meta-CTWA-Leads-Cinere",
    stableId: "#A003",
    branch: BranchId.CINERE,
    totalSpend: 3_600_000,
    totalHotLeads: 10,
    totalTestDrives: 5,
    totalSpk: 3,
    totalCommissionIdr: 9_000_000,
    rphSpk: RphSpk.fromSpendAndSpk(3_600_000, 3),
    rphLead: 360_000,
    closingRate: ClosingRate.fromCounts(3, 10),
    attributionScore: AttributionScore.direct(),
    verdict: "SCALE" as const,
    ...overrides,
  };
}

describe("CampaignAttribution", () => {
  it("rejects an empty campaignId", () => {
    const error = unwrapErr(CampaignAttribution.create(baseProps({ campaignId: "" })));
    expect(error.message).toContain("campaignId");
  });

  it("rejects an empty campaignName", () => {
    const error = unwrapErr(CampaignAttribution.create(baseProps({ campaignName: "" })));
    expect(error.message).toContain("campaignName");
  });

  it("rejects an invalid branch", () => {
    const error = unwrapErr(
      CampaignAttribution.create(baseProps({ branch: "NOT_A_BRANCH" as BranchId })),
    );
    expect(error.message).toContain("branch");
  });

  it("rejects a negative totalSpend", () => {
    const error = unwrapErr(CampaignAttribution.create(baseProps({ totalSpend: -1 })));
    expect(error.message).toContain("totalSpend");
  });

  it("rejects an invalid verdict", () => {
    const error = unwrapErr(CampaignAttribution.create(baseProps({ verdict: "MAYBE" as never })));
    expect(error.message).toContain("verdict");
  });

  it("exposes every field via getters, including the optional adId", () => {
    const attribution = unwrap(CampaignAttribution.create(baseProps({ adId: "#AD001" })));
    expect(attribution.campaignId).toBe("#C047");
    expect(attribution.campaignName).toBe("#A003 Meta-CTWA-Leads-Cinere");
    expect(attribution.stableId).toBe("#A003");
    expect(attribution.adId).toBe("#AD001");
    expect(attribution.branch).toBe(BranchId.CINERE);
    expect(attribution.totalSpend).toBe(3_600_000);
    expect(attribution.totalHotLeads).toBe(10);
    expect(attribution.totalTestDrives).toBe(5);
    expect(attribution.totalSpk).toBe(3);
    expect(attribution.totalCommissionIdr).toBe(9_000_000);
    expect(attribution.rphSpk.value).toBe(1_200_000);
    expect(attribution.rphLead).toBe(360_000);
    expect(attribution.closingRate.value).toBeCloseTo(0.3, 5);
    expect(attribution.attributionScore.value).toBe(100);
    expect(attribution.verdict).toBe("SCALE");
  });

  it("adId defaults to undefined when omitted", () => {
    const attribution = unwrap(CampaignAttribution.create(baseProps()));
    expect(attribution.adId).toBeUndefined();
  });
});

describe("resolveVerdict (coordinator note #2 — pinned two-boundary, three-band system)", () => {
  it("rphSpk < 2jt -> SCALE", () => {
    expect(resolveVerdict(1_200_000, 3, 3_600_000, THRESHOLDS)).toBe("SCALE");
  });

  it("rphSpk exactly at 2jt (scaleThreshold) -> KEEP, not SCALE (< is strict)", () => {
    expect(resolveVerdict(2_000_000, 1, 2_000_000, THRESHOLDS)).toBe("KEEP");
  });

  it("rphSpk between 2jt and 5jt -> KEEP", () => {
    expect(resolveVerdict(3_500_000, 2, 7_000_000, THRESHOLDS)).toBe("KEEP");
  });

  it("rphSpk=5_000_000 exactly at keepThreshold -> KEEP (inclusive boundary, pinned)", () => {
    expect(resolveVerdict(5_000_000, 2, 10_000_000, THRESHOLDS)).toBe("KEEP");
  });

  it("rphSpk=5_000_000.5, just above keepThreshold -> PAUSE (pinned)", () => {
    expect(resolveVerdict(5_000_000.5, 2, 10_000_001, THRESHOLDS)).toBe("PAUSE");
  });

  it("rphSpk > 5jt -> PAUSE", () => {
    expect(resolveVerdict(6_000_000, 1, 6_000_000, THRESHOLDS)).toBe("PAUSE");
  });

  it("rphSpk far above the spec's unused 10jt pauseThreshold is still just PAUSE (not a 4th band)", () => {
    expect(resolveVerdict(50_000_000, 1, 50_000_000, THRESHOLDS)).toBe("PAUSE");
  });

  it("totalSpk=0, spend >= minSpendForPause -> PAUSE regardless of rphSpk", () => {
    expect(resolveVerdict(0, 0, 2_000_000, THRESHOLDS)).toBe("PAUSE");
  });

  it("totalSpk=0, spend below minSpendForPause -> SCALE (rphSpk is 0, no reliable PAUSE signal yet)", () => {
    expect(resolveVerdict(0, 0, 500_000, THRESHOLDS)).toBe("SCALE");
  });

  it("totalSpk=0, spend exactly at minSpendForPause -> PAUSE (inclusive boundary)", () => {
    expect(resolveVerdict(0, 0, 1_000_000, THRESHOLDS)).toBe("PAUSE");
  });
});
