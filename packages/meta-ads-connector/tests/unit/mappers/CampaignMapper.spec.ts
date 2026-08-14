import { describe, expect, it } from "vitest";

import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { AdStatus } from "../../../src/domain/value-objects/AdStatus.js";
import { Branch } from "../../../src/domain/value-objects/Branch.js";
import { CampaignObjective } from "../../../src/domain/value-objects/CampaignObjective.js";
import { Funnel } from "../../../src/domain/value-objects/Funnel.js";
import { mapCampaign } from "../../../src/mappers/CampaignMapper.js";
import { makeCampaign } from "../../fixtures/metaApiFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));

describe("mapCampaign", () => {
  it("maps a well-formed Meta campaign into the Campaign entity", () => {
    const campaign = unwrap(mapCampaign(makeCampaign(), adAccountId, 1));
    expect(campaign.metaId).toBe("120000000000001");
    expect(campaign.name).toBe("CTWA - Cinere - Test Drive");
    expect(campaign.objective).toBe(CampaignObjective.OUTCOME_ENGAGEMENT);
    expect(campaign.status).toBe(AdStatus.ACTIVE);
    expect(campaign.funnel).toBe(Funnel.CTWA);
    expect(campaign.branch).toBe(Branch.CINERE);
    expect(campaign.spend.toNumber()).toBe(1000000);
    expect(campaign.stableId.toString()).toBe("#A001");
    expect(campaign.adSets).toEqual([]);
  });

  it("maps an unrecognized objective to UNKNOWN rather than rejecting the campaign (real bug fix: this used to abort the entire ad account's sync — see CampaignObjective.ts's docstring)", () => {
    const campaign = unwrap(
      mapCampaign(makeCampaign({ objective: "OUTCOME_LOCAL_AWARENESS" }), adAccountId, 1),
    );
    expect(campaign.objective).toBe(CampaignObjective.UNKNOWN);
  });

  it("maps a genuinely bogus objective string to UNKNOWN too, not just known-but-unmapped ODAX objectives", () => {
    const campaign = unwrap(
      mapCampaign(makeCampaign({ objective: "BOGUS_OBJECTIVE" }), adAccountId, 1),
    );
    expect(campaign.objective).toBe(CampaignObjective.UNKNOWN);
  });

  it("rejects an unrecognized status", () => {
    expect(
      unwrapErr(mapCampaign(makeCampaign({ status: "BOGUS" }), adAccountId, 1)).message,
    ).toMatch(/status/);
  });

  it("defaults spend to 0 when no insights are present", () => {
    const campaign = unwrap(mapCampaign(makeCampaign({ insights: undefined }), adAccountId, 1));
    expect(campaign.spend.isZero()).toBe(true);
  });

  it("defaults createdAt to now when created_time is absent", () => {
    const before = Date.now();
    const campaign = unwrap(mapCampaign(makeCampaign({ created_time: undefined }), adAccountId, 1));
    expect(campaign.createdAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("assigns a placeholder StableId from the given sequence", () => {
    const campaign = unwrap(mapCampaign(makeCampaign(), adAccountId, 7));
    expect(campaign.stableId.toString()).toBe("#A007");
  });

  it("classifies branch and funnel from the campaign name", () => {
    const campaign = unwrap(
      mapCampaign(makeCampaign({ name: "Website Leads - Bintaro" }), adAccountId, 1),
    );
    expect(campaign.funnel).toBe(Funnel.WEBSITE_LEAD);
    expect(campaign.branch).toBe(Branch.BINTARO);
  });

  it("propagates a StableId assignment failure for an invalid placeholder sequence", () => {
    expect(unwrapErr(mapCampaign(makeCampaign(), adAccountId, 0)).message).toMatch(
      /StableId sequence/,
    );
  });

  it("propagates a Spend mapping failure for negative insight spend", () => {
    expect(
      unwrapErr(
        mapCampaign(makeCampaign({ insights: { data: [{ spend: "-1" }] } }), adAccountId, 1),
      ).message,
    ).toMatch(/Spend amount/);
  });
});
