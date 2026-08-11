import { describe, expect, it } from "vitest";

import { AdBuilder } from "../../../src/builders/AdBuilder.js";
import { AdId } from "../../../src/domain/value-objects/AdId.js";
import { AdSetId } from "../../../src/domain/value-objects/AdSetId.js";
import { AdStatus } from "../../../src/domain/value-objects/AdStatus.js";
import { Branch } from "../../../src/domain/value-objects/Branch.js";
import { CampaignId } from "../../../src/domain/value-objects/CampaignId.js";
import { Funnel } from "../../../src/domain/value-objects/Funnel.js";
import { StableId } from "../../../src/domain/value-objects/StableId.js";
import { Verdict } from "../../../src/domain/value-objects/Verdict.js";
import { unwrap } from "../../helpers/result.js";

describe("AdBuilder", () => {
  it("builds a valid Ad with sensible zeroed-metrics defaults", () => {
    const ad = unwrap(new AdBuilder().build());
    expect(ad.name).toBe("Default Ad");
    expect(ad.metrics.spend.isZero()).toBe(true);
    expect(ad.verdict).toBe(Verdict.REVIEW);
  });

  it("every with* method overrides the corresponding field and is chainable", () => {
    const id = AdId.generate();
    const stableId = unwrap(StableId.create("C", 42));
    const adSetId = AdSetId.generate();
    const campaignId = CampaignId.generate();
    const ad = unwrap(
      new AdBuilder()
        .withId(id)
        .withStableId(stableId)
        .withMetaId("meta-c")
        .withAdSetId(adSetId)
        .withCampaignId(campaignId)
        .withName("Custom Ad")
        .withStatus(AdStatus.ARCHIVED)
        .withFunnel(Funnel.DM)
        .withBranch(Branch.MULTI)
        .withVerdict(Verdict.SCALE)
        .withCreatedAt(new Date("2025-01-01T00:00:00.000Z"))
        .withDaysSinceCreation(30)
        .build(),
    );
    expect(ad.id.equals(id)).toBe(true);
    expect(ad.stableId.equals(stableId)).toBe(true);
    expect(ad.metaId).toBe("meta-c");
    expect(ad.adSetId.equals(adSetId)).toBe(true);
    expect(ad.campaignId.equals(campaignId)).toBe(true);
    expect(ad.name).toBe("Custom Ad");
    expect(ad.status).toBe(AdStatus.ARCHIVED);
    expect(ad.funnel).toBe(Funnel.DM);
    expect(ad.branch).toBe(Branch.MULTI);
    expect(ad.verdict).toBe(Verdict.SCALE);
    expect(ad.daysSinceCreation).toBe(30);
  });

  it("propagates a validation failure through build()", () => {
    expect(new AdBuilder().withDaysSinceCreation(-5).build().ok).toBe(false);
  });
});
