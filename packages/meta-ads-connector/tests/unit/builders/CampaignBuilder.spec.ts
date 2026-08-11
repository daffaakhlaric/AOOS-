import { describe, expect, it } from "vitest";

import { CampaignBuilder } from "../../../src/builders/CampaignBuilder.js";
import { AdStatus } from "../../../src/domain/value-objects/AdStatus.js";
import { Branch } from "../../../src/domain/value-objects/Branch.js";
import { CampaignId } from "../../../src/domain/value-objects/CampaignId.js";
import { CampaignObjective } from "../../../src/domain/value-objects/CampaignObjective.js";
import { Funnel } from "../../../src/domain/value-objects/Funnel.js";
import { Spend } from "../../../src/domain/value-objects/Spend.js";
import { StableId } from "../../../src/domain/value-objects/StableId.js";
import { unwrap } from "../../helpers/result.js";

describe("CampaignBuilder", () => {
  it("builds a valid Campaign with sensible defaults", () => {
    const campaign = unwrap(new CampaignBuilder().build());
    expect(campaign.name).toBe("Default Campaign");
    expect(campaign.objective).toBe(CampaignObjective.OUTCOME_ENGAGEMENT);
    expect(campaign.status).toBe(AdStatus.ACTIVE);
  });

  it("every with* method overrides the corresponding field and is chainable", () => {
    const id = CampaignId.generate();
    const stableId = unwrap(StableId.create("A", 9));
    const campaign = unwrap(
      new CampaignBuilder()
        .withId(id)
        .withStableId(stableId)
        .withMetaId("custom-meta-id")
        .withName("Custom Campaign")
        .withObjective(CampaignObjective.OUTCOME_SALES)
        .withStatus(AdStatus.PAUSED)
        .withFunnel(Funnel.CTWA)
        .withBranch(Branch.CINERE)
        .withSpend(unwrap(Spend.create(12345)))
        .withAdSets([])
        .withCreatedAt(new Date("2025-06-01T00:00:00.000Z"))
        .build(),
    );
    expect(campaign.id.equals(id)).toBe(true);
    expect(campaign.stableId.equals(stableId)).toBe(true);
    expect(campaign.metaId).toBe("custom-meta-id");
    expect(campaign.name).toBe("Custom Campaign");
    expect(campaign.objective).toBe(CampaignObjective.OUTCOME_SALES);
    expect(campaign.status).toBe(AdStatus.PAUSED);
    expect(campaign.funnel).toBe(Funnel.CTWA);
    expect(campaign.branch).toBe(Branch.CINERE);
    expect(campaign.spend.toNumber()).toBe(12345);
    expect(campaign.createdAt.toISOString()).toBe("2025-06-01T00:00:00.000Z");
  });

  it("propagates a validation failure through build()", () => {
    expect(new CampaignBuilder().withName("").build().ok).toBe(false);
  });
});
