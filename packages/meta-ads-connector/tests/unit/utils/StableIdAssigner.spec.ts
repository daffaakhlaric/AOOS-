import { describe, expect, it } from "vitest";

import { AdBuilder } from "../../../src/builders/AdBuilder.js";
import { AdSetBuilder } from "../../../src/builders/AdSetBuilder.js";
import { CampaignBuilder } from "../../../src/builders/CampaignBuilder.js";
import { AdMetrics } from "../../../src/domain/value-objects/AdMetrics.js";
import { Spend } from "../../../src/domain/value-objects/Spend.js";
import {
  assignAdSetStableIds,
  assignAdStableIds,
  assignCampaignStableIds,
} from "../../../src/utils/StableIdAssigner.js";
import { unwrap } from "../../helpers/result.js";

function makeAd(metaId: string, spend: number) {
  return unwrap(
    new AdBuilder()
      .withMetaId(metaId)
      .withMetrics(
        unwrap(
          AdMetrics.create({
            spend: unwrap(Spend.create(spend)),
            impressions: 0,
            reach: 0,
            clicks: 0,
            conversations: 0,
            d2: 0,
            d3: 0,
            d5: 0,
            leadForm: 0,
          }),
        ),
      )
      .build(),
  );
}

describe("StableIdAssigner", () => {
  describe("assignAdStableIds", () => {
    it("sorts ads by spend DESC and assigns #C001, #C002, ...", () => {
      const low = makeAd("ad-low", 100);
      const high = makeAd("ad-high", 900);
      const mid = makeAd("ad-mid", 500);

      const sorted = unwrap(assignAdStableIds([low, high, mid]));
      expect(sorted.map((a) => a.metaId)).toEqual(["ad-high", "ad-mid", "ad-low"]);
      expect(sorted.map((a) => a.stableId.toString())).toEqual(["#C001", "#C002", "#C003"]);
    });

    it("is deterministic across repeated runs on the same input", () => {
      const ads = [makeAd("z", 300), makeAd("a", 300), makeAd("m", 700)];
      const run1 = unwrap(assignAdStableIds(ads)).map((a) => a.metaId);
      const run2 = unwrap(assignAdStableIds(ads)).map((a) => a.metaId);
      expect(run1).toEqual(run2);
    });

    it("tie-breaks equal spend by metaId ascending", () => {
      const ads = [makeAd("zzz", 500), makeAd("aaa", 500), makeAd("mmm", 500)];
      const sorted = unwrap(assignAdStableIds(ads));
      expect(sorted.map((a) => a.metaId)).toEqual(["aaa", "mmm", "zzz"]);
    });

    it("returns an empty array for an empty input (campaign with 0 ads edge case)", () => {
      expect(unwrap(assignAdStableIds([]))).toEqual([]);
    });

    it("propagates a StableId assignment failure when more than 999 ads are in scope", () => {
      const ads = Array.from({ length: 1000 }, (_, i) => makeAd(`ad-${i}`, i));
      const result = assignAdStableIds(ads);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/StableId sequence/);
      }
    });
  });

  describe("assignAdSetStableIds", () => {
    it("sorts adsets by spend DESC and cascades #C ids into each adset's ads", () => {
      const lowAdSet = unwrap(
        new AdSetBuilder()
          .withMetaId("adset-low")
          .withSpend(unwrap(Spend.create(100)))
          .withAds([makeAd("a1", 50)])
          .build(),
      );
      const highAdSet = unwrap(
        new AdSetBuilder()
          .withMetaId("adset-high")
          .withSpend(unwrap(Spend.create(900)))
          .withAds([makeAd("a2", 50)])
          .build(),
      );

      const sorted = unwrap(assignAdSetStableIds([lowAdSet, highAdSet]));
      expect(sorted.map((a) => a.metaId)).toEqual(["adset-high", "adset-low"]);
      expect(sorted[0]?.stableId.toString()).toBe("#B001");
      expect(sorted[0]?.ads[0]?.stableId.toString()).toBe("#C001");
    });

    it("returns an empty array for an empty input", () => {
      expect(unwrap(assignAdSetStableIds([]))).toEqual([]);
    });

    it("propagates a cascaded StableId assignment failure from an over-populated adset's ads", () => {
      const tooManyAds = Array.from({ length: 1000 }, (_, i) => makeAd(`ad-${i}`, i));
      const adSet = unwrap(
        new AdSetBuilder()
          .withMetaId("adset-overflow")
          .withSpend(unwrap(Spend.create(100)))
          .withAds(tooManyAds)
          .build(),
      );
      const result = assignAdSetStableIds([adSet]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/StableId sequence/);
      }
    });
  });

  describe("assignCampaignStableIds", () => {
    it("sorts campaigns by spend DESC and cascades #B/#C ids", () => {
      const lowCampaign = unwrap(
        new CampaignBuilder()
          .withMetaId("c-low")
          .withSpend(unwrap(Spend.create(100)))
          .build(),
      );
      const highCampaign = unwrap(
        new CampaignBuilder()
          .withMetaId("c-high")
          .withSpend(unwrap(Spend.create(900)))
          .build(),
      );

      const sorted = unwrap(assignCampaignStableIds([lowCampaign, highCampaign]));
      expect(sorted.map((c) => c.metaId)).toEqual(["c-high", "c-low"]);
      expect(sorted[0]?.stableId.toString()).toBe("#A001");
      expect(sorted[1]?.stableId.toString()).toBe("#A002");
    });

    it("returns an empty array for an empty input", () => {
      expect(unwrap(assignCampaignStableIds([]))).toEqual([]);
    });

    it("propagates a cascaded StableId assignment failure from an over-populated campaign's adsets", () => {
      const tooManyAdSets = Array.from({ length: 1000 }, (_, i) =>
        unwrap(
          new AdSetBuilder()
            .withMetaId(`adset-${i}`)
            .withSpend(unwrap(Spend.create(i)))
            .build(),
        ),
      );
      const campaign = unwrap(
        new CampaignBuilder()
          .withMetaId("campaign-overflow")
          .withSpend(unwrap(Spend.create(100)))
          .build(),
      );
      const result = assignCampaignStableIds([campaign.withAdSets(tooManyAdSets)]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/StableId sequence/);
      }
    }, 20000);
  });
});
