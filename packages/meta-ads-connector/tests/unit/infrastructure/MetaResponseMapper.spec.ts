import { describe, expect, it } from "vitest";

import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { AdSetId } from "../../../src/domain/value-objects/AdSetId.js";
import { Branch } from "../../../src/domain/value-objects/Branch.js";
import { CampaignId } from "../../../src/domain/value-objects/CampaignId.js";
import { Funnel } from "../../../src/domain/value-objects/Funnel.js";
import { MetaResponseMapper } from "../../../src/infrastructure/meta-api/MetaResponseMapper.js";
import type { MetaAd, MetaAdSet, MetaCampaign } from "../../../src/types/MetaApiTypes.js";
import { makeAd, makeAdSet, makeCampaign } from "../../fixtures/metaApiFixtures.js";
import { unwrap } from "../../helpers/result.js";

const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));
const campaignId = CampaignId.generate();
const adSetId = AdSetId.generate();

describe("MetaResponseMapper.mapCampaigns", () => {
  it("maps a page of raw campaigns, assigning sequential 1-based placeholder stableIds", () => {
    const campaigns = unwrap(
      MetaResponseMapper.mapCampaigns(
        [makeCampaign({ id: "c1" }), makeCampaign({ id: "c2" })],
        adAccountId,
      ),
    );
    expect(campaigns.map((c) => c.metaId)).toEqual(["c1", "c2"]);
    expect(campaigns.map((c) => c.stableId.toString())).toEqual(["#A001", "#A002"]);
  });

  it("returns an empty array for an empty page (empty ad account edge case)", () => {
    expect(unwrap(MetaResponseMapper.mapCampaigns([], adAccountId))).toEqual([]);
  });

  it("propagates a per-item mapping failure", () => {
    expect(
      MetaResponseMapper.mapCampaigns([makeCampaign({ objective: "BOGUS" })], adAccountId).ok,
    ).toBe(false);
  });

  it("skips a sparse-array hole (defensive guard against an undefined array entry)", () => {
    const raws = [undefined, makeCampaign({ id: "c1" })] as unknown as ReadonlyArray<MetaCampaign>;
    const campaigns = unwrap(MetaResponseMapper.mapCampaigns(raws, adAccountId));
    expect(campaigns.map((c) => c.metaId)).toEqual(["c1"]);
    expect(campaigns[0]?.stableId.toString()).toBe("#A002");
  });
});

describe("MetaResponseMapper.mapAdSets", () => {
  it("maps a page of raw adsets, assigning sequential #B ids", () => {
    const adSets = unwrap(
      MetaResponseMapper.mapAdSets(
        [makeAdSet({ id: "as1" }), makeAdSet({ id: "as2" })],
        campaignId,
        adAccountId,
      ),
    );
    expect(adSets.map((a) => a.stableId.toString())).toEqual(["#B001", "#B002"]);
  });

  it("returns an empty array for an empty page (campaign with 0 adsets)", () => {
    expect(unwrap(MetaResponseMapper.mapAdSets([], campaignId, adAccountId))).toEqual([]);
  });

  it("propagates a per-item mapping failure", () => {
    expect(
      MetaResponseMapper.mapAdSets([makeAdSet({ status: "BOGUS" })], campaignId, adAccountId).ok,
    ).toBe(false);
  });

  it("skips a sparse-array hole (defensive guard against an undefined array entry)", () => {
    const raws = [undefined, makeAdSet({ id: "as1" })] as unknown as ReadonlyArray<MetaAdSet>;
    const adSets = unwrap(MetaResponseMapper.mapAdSets(raws, campaignId, adAccountId));
    expect(adSets.map((a) => a.metaId)).toEqual(["as1"]);
    expect(adSets[0]?.stableId.toString()).toBe("#B002");
  });
});

describe("MetaResponseMapper.mapAds", () => {
  const now = new Date("2026-02-01T00:00:00.000Z");

  it("maps a page of raw ads, inheriting funnel/branch and assigning sequential #C ids", () => {
    const ads = unwrap(
      MetaResponseMapper.mapAds(
        [makeAd({ id: "ad1" }), makeAd({ id: "ad2" })],
        campaignId,
        adSetId,
        adAccountId,
        Funnel.CTWA,
        Branch.CINERE,
        now,
      ),
    );
    expect(ads.map((a) => a.stableId.toString())).toEqual(["#C001", "#C002"]);
    expect(ads.every((a) => a.funnel === Funnel.CTWA && a.branch === Branch.CINERE)).toBe(true);
  });

  it("returns an empty array for an empty page (adset with 0 ads)", () => {
    expect(
      unwrap(
        MetaResponseMapper.mapAds(
          [],
          campaignId,
          adSetId,
          adAccountId,
          Funnel.CTWA,
          Branch.UMUM,
          now,
        ),
      ),
    ).toEqual([]);
  });

  it("propagates a per-item mapping failure", () => {
    expect(
      MetaResponseMapper.mapAds(
        [makeAd({ status: "BOGUS" })],
        campaignId,
        adSetId,
        adAccountId,
        Funnel.CTWA,
        Branch.UMUM,
        now,
      ).ok,
    ).toBe(false);
  });

  it("skips a sparse-array hole (defensive guard against an undefined array entry)", () => {
    const raws = [undefined, makeAd({ id: "ad1" })] as unknown as ReadonlyArray<MetaAd>;
    const ads = unwrap(
      MetaResponseMapper.mapAds(
        raws,
        campaignId,
        adSetId,
        adAccountId,
        Funnel.CTWA,
        Branch.UMUM,
        now,
      ),
    );
    expect(ads.map((a) => a.metaId)).toEqual(["ad1"]);
    expect(ads[0]?.stableId.toString()).toBe("#C002");
  });
});
