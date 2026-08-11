import { describe, expect, it } from "vitest";

import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { AdSetId } from "../../../src/domain/value-objects/AdSetId.js";
import { Branch } from "../../../src/domain/value-objects/Branch.js";
import { CampaignId } from "../../../src/domain/value-objects/CampaignId.js";
import { Funnel } from "../../../src/domain/value-objects/Funnel.js";
import { Verdict } from "../../../src/domain/value-objects/Verdict.js";
import { mapAd } from "../../../src/mappers/AdMapper.js";
import { makeAd } from "../../fixtures/metaApiFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));
const campaignId = CampaignId.generate();
const adSetId = AdSetId.generate();
const now = new Date("2026-02-01T00:00:00.000Z");

describe("mapAd", () => {
  it("maps a well-formed Meta ad into the Ad entity, inheriting funnel/branch from ancestors", () => {
    const ad = unwrap(
      mapAd(makeAd(), campaignId, adSetId, adAccountId, Funnel.CTWA, Branch.CINERE, 1, now),
    );
    expect(ad.metaId).toBe("120000000000003");
    expect(ad.funnel).toBe(Funnel.CTWA);
    expect(ad.branch).toBe(Branch.CINERE);
    expect(ad.verdict).toBe(Verdict.REVIEW);
    expect(ad.metrics.spend.toNumber()).toBe(250000);
  });

  it("computes daysSinceCreation from created_time to the injected now", () => {
    const ad = unwrap(
      mapAd(
        makeAd({ created_time: "2026-01-01T00:00:00+0000" }),
        campaignId,
        adSetId,
        adAccountId,
        Funnel.CTWA,
        Branch.UMUM,
        1,
        new Date("2026-01-15T00:00:00.000Z"),
      ),
    );
    expect(ad.daysSinceCreation).toBe(14);
  });

  it("rejects an unrecognized status", () => {
    expect(
      unwrapErr(
        mapAd(
          makeAd({ status: "BOGUS" }),
          campaignId,
          adSetId,
          adAccountId,
          Funnel.CTWA,
          Branch.UMUM,
          1,
          now,
        ),
      ).message,
    ).toMatch(/status/);
  });

  it("rejects an invalid created_time", () => {
    expect(
      mapAd(
        makeAd({ created_time: "not-a-date" }),
        campaignId,
        adSetId,
        adAccountId,
        Funnel.CTWA,
        Branch.UMUM,
        1,
        now,
      ).ok,
    ).toBe(false);
  });

  it("propagates a metrics mapping failure", () => {
    expect(
      mapAd(
        makeAd({ insights: { data: [{ spend: "-1" }] } }),
        campaignId,
        adSetId,
        adAccountId,
        Funnel.CTWA,
        Branch.UMUM,
        1,
        now,
      ).ok,
    ).toBe(false);
  });

  it("assigns a placeholder StableId from the given sequence", () => {
    const ad = unwrap(
      mapAd(makeAd(), campaignId, adSetId, adAccountId, Funnel.CTWA, Branch.UMUM, 3, now),
    );
    expect(ad.stableId.toString()).toBe("#C003");
  });

  it("propagates a StableId assignment failure for an invalid placeholder sequence", () => {
    expect(
      unwrapErr(mapAd(makeAd(), campaignId, adSetId, adAccountId, Funnel.CTWA, Branch.UMUM, 0, now))
        .message,
    ).toMatch(/StableId sequence/);
  });

  it("handles an ad with 0 spend without producing NaN/Infinity in rphD3", () => {
    const ad = unwrap(
      mapAd(
        makeAd({ insights: { data: [{ spend: "0" }] } }),
        campaignId,
        adSetId,
        adAccountId,
        Funnel.CTWA,
        Branch.UMUM,
        1,
        now,
      ),
    );
    expect(ad.metrics.rphD3.value).toBeNull();
    expect(Number.isNaN(ad.metrics.rphD3.value as unknown as number)).toBe(false);
  });
});
