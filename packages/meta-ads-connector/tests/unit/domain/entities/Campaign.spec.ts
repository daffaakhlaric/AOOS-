import { describe, expect, it } from "vitest";

import { CampaignBuilder } from "../../../../src/builders/CampaignBuilder.js";
import { Campaign } from "../../../../src/domain/entities/Campaign.js";
import type { AdStatus } from "../../../../src/domain/value-objects/AdStatus.js";
import { CampaignObjective } from "../../../../src/domain/value-objects/CampaignObjective.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("Campaign", () => {
  it("constructs a valid Campaign via the builder's defaults", () => {
    const campaign = unwrap(new CampaignBuilder().build());
    expect(campaign.name).toBe("Default Campaign");
    expect(campaign.adSets).toEqual([]);
  });

  it("rejects an empty name", () => {
    expect(unwrapErr(new CampaignBuilder().withName("").build()).message).toMatch(/name/);
  });

  it("rejects an empty metaId", () => {
    expect(unwrapErr(new CampaignBuilder().withMetaId("").build()).message).toMatch(/metaId/);
  });

  it("rejects an invalid objective", () => {
    expect(
      unwrapErr(new CampaignBuilder().withObjective("BOGUS" as CampaignObjective).build()).message,
    ).toMatch(/objective/);
  });

  it("rejects an invalid status", () => {
    expect(
      unwrapErr(new CampaignBuilder().withStatus("BOGUS" as AdStatus).build()).message,
    ).toMatch(/status/);
  });

  it("defensively copies the adSets array on construction", () => {
    const adSets: never[] = [];
    const campaign = unwrap(new CampaignBuilder().withAdSets(adSets).build());
    (adSets as unknown[]).push({});
    expect(campaign.adSets.length).toBe(0);
  });

  it("withAdSets / withStableId / withObjective each return a new immutable instance", () => {
    const campaign = unwrap(new CampaignBuilder().build());
    const withObjective = campaign.withObjective(CampaignObjective.OUTCOME_SALES);
    expect(campaign.objective).toBe(CampaignObjective.OUTCOME_ENGAGEMENT);
    expect(withObjective.objective).toBe(CampaignObjective.OUTCOME_SALES);
    expect(withObjective).toBeInstanceOf(Campaign);
  });

  it("exposes every documented getter", () => {
    const campaign = unwrap(new CampaignBuilder().build());
    expect(campaign.id).toBeDefined();
    expect(campaign.stableId).toBeDefined();
    expect(campaign.adAccountId).toBeDefined();
    expect(campaign.funnel).toBeDefined();
    expect(campaign.branch).toBeDefined();
    expect(campaign.spend).toBeDefined();
    expect(campaign.createdAt).toBeInstanceOf(Date);
  });
});
