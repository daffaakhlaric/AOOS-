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

  describe("audienceLabel (AAOS Analytics Platform Phase 3 — real classifyAudience wiring)", () => {
    it("labels an adset with no targeting at all as BROAD", () => {
      const adSet = unwrap(
        mapAdSet(makeAdSet({ targeting: undefined }), campaignId, adAccountId, 1),
      );
      expect(adSet.audienceLabel).toBe("BROAD");
    });

    it("labels an adset with only flexible_spec interests as INTEREST", () => {
      const adSet = unwrap(
        mapAdSet(
          makeAdSet({
            targeting: {
              flexible_spec: [{ interests: [{ id: "6003304550260", name: "Automotive" }] }],
            },
          }),
          campaignId,
          adAccountId,
          1,
        ),
      );
      expect(adSet.audienceLabel).toBe("INTEREST");
    });

    it("labels an adset with any real custom_audiences[] entry as CUSTOM_CRM (the honest, documented real gap: Meta's targeting-read response never supplies subtype, so LOOKALIKE/RETARGETING cannot be sub-distinguished today)", () => {
      const adSet = unwrap(
        mapAdSet(
          makeAdSet({
            targeting: { custom_audiences: [{ id: "23847239847" }] },
          }),
          campaignId,
          adAccountId,
          1,
        ),
      );
      expect(adSet.audienceLabel).toBe("CUSTOM_CRM");
    });

    it("labels an adset with a named custom_audiences[] entry (Meta sometimes echoes `name` alongside `id`) the same way — name is accepted but ignored by the classifier", () => {
      const adSet = unwrap(
        mapAdSet(
          makeAdSet({
            targeting: {
              custom_audiences: [{ id: "23847239847", name: "1% Lookalike - Purchasers" }],
            },
          }),
          campaignId,
          adAccountId,
          1,
        ),
      );
      expect(adSet.audienceLabel).toBe("CUSTOM_CRM");
    });

    it("prioritizes a custom_audiences[] entry over flexible_spec interests present on the same targeting spec, mirroring classifyAudience's own ordered rule list", () => {
      const adSet = unwrap(
        mapAdSet(
          makeAdSet({
            targeting: {
              custom_audiences: [{ id: "1" }],
              flexible_spec: [{ interests: [{ id: "2", name: "Cars" }] }],
            },
          }),
          campaignId,
          adAccountId,
          1,
        ),
      );
      expect(adSet.audienceLabel).toBe("CUSTOM_CRM");
    });

    it("labels an adset with empty targeting sub-arrays as BROAD", () => {
      const adSet = unwrap(
        mapAdSet(
          makeAdSet({ targeting: { custom_audiences: [], flexible_spec: [] } }),
          campaignId,
          adAccountId,
          1,
        ),
      );
      expect(adSet.audienceLabel).toBe("BROAD");
    });
  });

  describe("learningStatus (AAOS Samantha Professional Optimizer, Part A — real learning_stage_info wiring)", () => {
    it("maps a real LEARNING status", () => {
      const adSet = unwrap(
        mapAdSet(
          makeAdSet({ learning_stage_info: { status: "LEARNING" } }),
          campaignId,
          adAccountId,
          1,
        ),
      );
      expect(adSet.learningStatus).toBe("LEARNING");
    });

    it("maps a real LEARNING_LIMITED status", () => {
      const adSet = unwrap(
        mapAdSet(
          makeAdSet({ learning_stage_info: { status: "LEARNING_LIMITED" } }),
          campaignId,
          adAccountId,
          1,
        ),
      );
      expect(adSet.learningStatus).toBe("LEARNING_LIMITED");
    });

    it("maps a real SUCCESS status", () => {
      const adSet = unwrap(
        mapAdSet(
          makeAdSet({ learning_stage_info: { status: "SUCCESS" } }),
          campaignId,
          adAccountId,
          1,
        ),
      );
      expect(adSet.learningStatus).toBe("SUCCESS");
    });

    it("is undefined when Meta reports no learning_stage_info at all (brand-new adset, zero delivery yet)", () => {
      const adSet = unwrap(
        mapAdSet(makeAdSet({ learning_stage_info: undefined }), campaignId, adAccountId, 1),
      );
      expect(adSet.learningStatus).toBeUndefined();
    });

    it("degrades to undefined for an unrecognized future Meta status string, never fabricating one of the 3 known values", () => {
      const adSet = unwrap(
        mapAdSet(
          makeAdSet({ learning_stage_info: { status: "SOME_FUTURE_STATUS" } }),
          campaignId,
          adAccountId,
          1,
        ),
      );
      expect(adSet.learningStatus).toBeUndefined();
    });

    it("is undefined when learning_stage_info is present but status itself is absent", () => {
      const adSet = unwrap(
        mapAdSet(makeAdSet({ learning_stage_info: {} }), campaignId, adAccountId, 1),
      );
      expect(adSet.learningStatus).toBeUndefined();
    });
  });
});
