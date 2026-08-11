import { describe, expect, it } from "vitest";

import { AdSetBuilder } from "../../../src/builders/AdSetBuilder.js";
import { AdSetId } from "../../../src/domain/value-objects/AdSetId.js";
import { AdStatus } from "../../../src/domain/value-objects/AdStatus.js";
import { Branch } from "../../../src/domain/value-objects/Branch.js";
import { Budget } from "../../../src/domain/value-objects/Budget.js";
import { CampaignId } from "../../../src/domain/value-objects/CampaignId.js";
import { Spend } from "../../../src/domain/value-objects/Spend.js";
import { StableId } from "../../../src/domain/value-objects/StableId.js";
import { unwrap } from "../../helpers/result.js";

describe("AdSetBuilder", () => {
  it("builds a valid AdSet with sensible defaults", () => {
    const adSet = unwrap(new AdSetBuilder().build());
    expect(adSet.name).toBe("Default AdSet");
    expect(adSet.status).toBe(AdStatus.ACTIVE);
  });

  it("every with* method overrides the corresponding field and is chainable", () => {
    const id = AdSetId.generate();
    const stableId = unwrap(StableId.create("B", 3));
    const campaignId = CampaignId.generate();
    const adSet = unwrap(
      new AdSetBuilder()
        .withId(id)
        .withStableId(stableId)
        .withMetaId("meta-b")
        .withCampaignId(campaignId)
        .withName("Custom AdSet")
        .withStatus(AdStatus.PAUSED)
        .withDailyBudget(unwrap(Budget.create(50_000)))
        .withBranch(Branch.BANDUNG)
        .withSpend(unwrap(Spend.create(777)))
        .withAds([])
        .build(),
    );
    expect(adSet.id.equals(id)).toBe(true);
    expect(adSet.stableId.equals(stableId)).toBe(true);
    expect(adSet.metaId).toBe("meta-b");
    expect(adSet.campaignId.equals(campaignId)).toBe(true);
    expect(adSet.name).toBe("Custom AdSet");
    expect(adSet.status).toBe(AdStatus.PAUSED);
    expect(adSet.dailyBudget.toNumber()).toBe(50_000);
    expect(adSet.branch).toBe(Branch.BANDUNG);
    expect(adSet.spend.toNumber()).toBe(777);
  });

  it("propagates a validation failure through build()", () => {
    expect(new AdSetBuilder().withMetaId("").build().ok).toBe(false);
  });
});
