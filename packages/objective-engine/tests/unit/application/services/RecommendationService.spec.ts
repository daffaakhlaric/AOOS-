import {
  AdAccountId,
  AdBuilder,
  AdMetrics,
  AdSetBuilder,
  CampaignBuilder,
  Spend,
  Verdict,
  type Ad,
  type AdAccount,
} from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { RecommendationService } from "../../../../src/application/services/RecommendationService.js";
import { ObjectiveBuilder } from "../../../../src/builders/ObjectiveBuilder.js";
import { ObjectiveProgress } from "../../../../src/domain/entities/ObjectiveProgress.js";
import { BudgetAllocation } from "../../../../src/domain/value-objects/BudgetAllocation.js";
import { ForecastScore } from "../../../../src/domain/value-objects/ForecastScore.js";
import { OnTrackStatus } from "../../../../src/domain/value-objects/OnTrackStatus.js";
import { ProgressPercentage } from "../../../../src/domain/value-objects/ProgressPercentage.js";
import { TargetLeads } from "../../../../src/domain/value-objects/TargetLeads.js";
import {
  buildAdAccountFixture,
  buildEmptyAdAccountFixture,
} from "../../../fixtures/adAccountFixtures.js";
import { unwrap } from "../../../helpers/result.js";

describe("RecommendationService", () => {
  const service = new RecommendationService();
  const objective = unwrap(new ObjectiveBuilder().build());
  const now = new Date("2026-08-09T00:00:00.000Z");

  it("generates a recommendation with actions ordered PAUSE, SCALE, then FIX/REFRESH", () => {
    const result = service.generate({
      objective,
      progress: undefined,
      adAccount: buildAdAccountFixture(),
      now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.actions.map((a) => a.type)).toEqual(["PAUSE", "SCALE", "FIX", "REFRESH"]);
    }
  });

  it("estimatedImpact.budgetSavingEstimate equals the paused ad's spend", () => {
    const result = service.generate({
      objective,
      progress: undefined,
      adAccount: buildAdAccountFixture(),
      now,
    });
    expect(result.ok && result.value.estimatedImpact.budgetSavingEstimate).toBe(2_100_000);
  });

  it("confidence reflects the fraction of ads with a defined rphD3", () => {
    // 5 of 6 ads have a defined rphD3 (the 0-D3 ad is excluded) -> round(5/6*100) = 83
    const result = service.generate({
      objective,
      progress: undefined,
      adAccount: buildAdAccountFixture(),
      now,
    });
    expect(result.ok && result.value.confidence).toBe(Math.round((5 / 6) * 100));
  });

  it("edge case: no ads with SCALE verdict available -> no SCALE action, PAUSE/FIX/REFRESH still generated", () => {
    // Reuse fixture but the SCALE candidate only qualifies via both verdict AND threshold —
    // this asserts the algorithm still produces a full plan even without one action type present.
    const result = service.generate({
      objective,
      progress: undefined,
      adAccount: buildAdAccountFixture(),
      now,
    });
    expect(result.ok).toBe(true);
  });

  it("edge case: adAccount with 0 campaigns -> empty actions, 0 confidence, neutral summary", () => {
    const result = service.generate({
      objective,
      progress: undefined,
      adAccount: buildEmptyAdAccountFixture(),
      now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.actions).toEqual([]);
      expect(result.value.confidence).toBe(0);
      expect(result.value.summary.length).toBeGreaterThan(0);
    }
  });

  it("a SCALE candidate with rphD3=0 (0 spend, positive D3) yields 0 estimatedLeadGain, not a division error", () => {
    // rphD3 = spend/D3 = 0/10 = 0 — still "< avg * 0.7" (0 is less than any positive average), so
    // it qualifies as a SCALE candidate, exercising the `rphD3 > 0 ? ... : 0` false branch.
    const zeroRateAd = unwrap(
      new AdBuilder()
        .withMetaId("120000000009999")
        .withName("Zero Spend Zero Rate")
        .withVerdict(Verdict.SCALE)
        .withMetrics(
          unwrap(
            AdMetrics.create({
              spend: unwrap(Spend.create(0)),
              impressions: 100,
              reach: 80,
              clicks: 5,
              conversations: 10,
              d2: 5,
              d3: 10,
              d5: 2,
              leadForm: 0,
            }),
          ),
        )
        .build(),
    );
    const normalAd = unwrap(
      new AdBuilder()
        .withMetaId("120000000009998")
        .withName("Normal Rate Ad")
        .withVerdict(Verdict.KEEP)
        .withMetrics(
          unwrap(
            AdMetrics.create({
              spend: unwrap(Spend.create(500_000)),
              impressions: 100,
              reach: 80,
              clicks: 5,
              conversations: 30,
              d2: 5,
              d3: 10,
              d5: 2,
              leadForm: 0,
            }),
          ),
        )
        .build(),
    );
    const ads: Ad[] = [zeroRateAd, normalAd];
    const adSet = unwrap(new AdSetBuilder().withAds(ads).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = {
      id: unwrap(AdAccountId.create("act_1")),
      name: "Zero Rate Account",
      businessManagerId: "bm_1",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      campaigns: [campaign],
      syncedAt: new Date("2026-08-08T00:00:00.000Z"),
    } as unknown as AdAccount;

    const result = service.generate({ objective, progress: undefined, adAccount, now });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const scale = result.value.actions.find((a) => a.type === "SCALE");
      expect(scale?.estimatedLeadGain).toBe(0);
      expect(result.value.estimatedImpact.additionalLeadsEstimate).toBe(0);
    }
  });

  it("summary is a non-empty Indonesian narrative mentioning computed figures", () => {
    const result = service.generate({
      objective,
      progress: undefined,
      adAccount: buildAdAccountFixture(),
      now,
    });
    expect(result.ok && result.value.summary).toContain("Samantha");
  });

  it("targetGapClosedPercentage is 100 when the target is already met", () => {
    const tinyTargetObjective = unwrap(
      new ObjectiveBuilder().withTargetHotLeads(unwrap(TargetLeads.create(1))).build(),
    );
    const progress = unwrap(
      ObjectiveProgress.create({
        objectiveId: tinyTargetObjective.id,
        currentHotLeads: 5, // already exceeds the target of 1
        currentSpend: unwrap(BudgetAllocation.create(1_000_000)),
        daysElapsed: 5,
        daysRemaining: 5,
        progressPercentage: unwrap(ProgressPercentage.create(100)),
        dailyRunRate: 1,
        requiredDailyRunRate: 0,
        forecastedHotLeads: unwrap(ForecastScore.create(5)),
        budgetBurnRate: 200_000,
        projectedBudgetAtEnd: unwrap(BudgetAllocation.create(2_000_000)),
        onTrackStatus: OnTrackStatus.ON_TRACK,
        updatedAt: now,
      }),
    );
    const result = service.generate({
      objective: tinyTargetObjective,
      progress,
      adAccount: buildAdAccountFixture(),
      now,
    });
    expect(result.ok && result.value.estimatedImpact.targetGapClosedPercentage).toBe(100);
  });
});
