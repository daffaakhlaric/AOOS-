import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { CampaignAttributionBuilder } from "../../../src/builders/CampaignAttributionBuilder.js";
import { AttributionScore, ClosingRate, RphSpk } from "../../../src/domain/value-objects/index.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("CampaignAttributionBuilder", () => {
  it("builds a valid CampaignAttribution via fluent setters", () => {
    const attribution = unwrap(
      CampaignAttributionBuilder.create()
        .withCampaignId("#C047")
        .withCampaignName("#A003 Meta-CTWA-Leads-Cinere")
        .withStableId("#A003")
        .withAdId("#AD001")
        .withBranch(BranchId.CINERE)
        .withSpendAndLeads(3_600_000, 10)
        .withPipelineCounts(5, 3)
        .withCommission(9_000_000)
        .withKpis(RphSpk.fromSpendAndSpk(3_600_000, 3), 360_000, ClosingRate.fromCounts(3, 10))
        .withAttributionScore(AttributionScore.direct())
        .withVerdict("SCALE")
        .build(),
    );
    expect(attribution.campaignId).toBe("#C047");
    expect(attribution.adId).toBe("#AD001");
    expect(attribution.verdict).toBe("SCALE");
    expect(attribution.rphSpk.value).toBe(1_200_000);
  });

  it("build() fails when required fields are missing", () => {
    const error = unwrapErr(CampaignAttributionBuilder.create().build());
    expect(error).toBeDefined();
  });

  it("each with* call returns a new builder instance (immutable fluent chain)", () => {
    const builder1 = CampaignAttributionBuilder.create();
    const builder2 = builder1.withCampaignId("#C047");
    expect(builder1).not.toBe(builder2);
  });
});
