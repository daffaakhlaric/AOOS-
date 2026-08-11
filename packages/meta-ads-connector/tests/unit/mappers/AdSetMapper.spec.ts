import { describe, expect, it } from "vitest";

import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { Branch } from "../../../src/domain/value-objects/Branch.js";
import { CampaignId } from "../../../src/domain/value-objects/CampaignId.js";
import { mapAdSet } from "../../../src/mappers/AdSetMapper.js";
import { makeAdSet } from "../../fixtures/metaApiFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));
const campaignId = CampaignId.generate();

describe("mapAdSet", () => {
  it("maps a well-formed Meta adset into the AdSet entity", () => {
    const adSet = unwrap(mapAdSet(makeAdSet(), campaignId, adAccountId, 1));
    expect(adSet.metaId).toBe("120000000000002");
    expect(adSet.name).toBe("AdSet - Cinere - Broad");
    expect(adSet.branch).toBe(Branch.CINERE);
    expect(adSet.spend.toNumber()).toBe(500000);
    expect(adSet.ads).toEqual([]);
  });

  it("converts daily_budget from Meta cents to whole Rupiah", () => {
    const adSet = unwrap(
      mapAdSet(makeAdSet({ daily_budget: "10000000" }), campaignId, adAccountId, 1),
    );
    expect(adSet.dailyBudget.toNumber()).toBe(100000);
  });

  it("defaults daily_budget to 0 when absent", () => {
    const adSet = unwrap(
      mapAdSet(makeAdSet({ daily_budget: undefined }), campaignId, adAccountId, 1),
    );
    expect(adSet.dailyBudget.toNumber()).toBe(0);
  });

  it("defaults daily_budget to 0 for a non-numeric string", () => {
    const adSet = unwrap(
      mapAdSet(makeAdSet({ daily_budget: "not-a-number" }), campaignId, adAccountId, 1),
    );
    expect(adSet.dailyBudget.toNumber()).toBe(0);
  });

  it("rejects an unrecognized status", () => {
    expect(
      unwrapErr(mapAdSet(makeAdSet({ status: "BOGUS" }), campaignId, adAccountId, 1)).message,
    ).toMatch(/status/);
  });

  it("defaults spend to 0 when no insights are present", () => {
    const adSet = unwrap(mapAdSet(makeAdSet({ insights: undefined }), campaignId, adAccountId, 1));
    expect(adSet.spend.isZero()).toBe(true);
  });

  it("assigns a placeholder StableId from the given sequence", () => {
    const adSet = unwrap(mapAdSet(makeAdSet(), campaignId, adAccountId, 12));
    expect(adSet.stableId.toString()).toBe("#B012");
  });

  it("propagates a StableId assignment failure for an invalid placeholder sequence", () => {
    expect(unwrapErr(mapAdSet(makeAdSet(), campaignId, adAccountId, 0)).message).toMatch(
      /StableId sequence/,
    );
  });

  it("propagates a Budget mapping failure for a negative daily_budget", () => {
    expect(
      unwrapErr(mapAdSet(makeAdSet({ daily_budget: "-100000" }), campaignId, adAccountId, 1))
        .message,
    ).toMatch(/Budget amount/);
  });

  it("propagates a Spend mapping failure for negative insight spend", () => {
    expect(
      unwrapErr(
        mapAdSet(makeAdSet({ insights: { data: [{ spend: "-1" }] } }), campaignId, adAccountId, 1),
      ).message,
    ).toMatch(/Spend amount/);
  });
});
