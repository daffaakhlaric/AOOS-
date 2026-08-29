import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { SamanthaFeedService } from "../../../src/application/services/SamanthaFeedService.js";
import { CampaignAttributionBuilder } from "../../../src/builders/CampaignAttributionBuilder.js";
import { ClosingReportBuilder } from "../../../src/builders/ClosingReportBuilder.js";
import { BranchPerformance } from "../../../src/domain/entities/BranchPerformance.js";
import {
  AttributionScore,
  ClosingRate,
  RphSpk,
  TotalCommission,
} from "../../../src/domain/value-objects/index.js";
import { makePeriod } from "../../fixtures/closingTrackerFixtures.js";
import { unwrap } from "../../helpers/result.js";

function buildAttribution(
  campaignId: string,
  spend: number,
  spk: number,
  verdict: "SCALE" | "KEEP" | "PAUSE",
) {
  return unwrap(
    CampaignAttributionBuilder.create()
      .withCampaignId(campaignId)
      .withCampaignName(campaignId)
      .withStableId(campaignId)
      .withBranch(BranchId.CINERE)
      .withSpendAndLeads(spend, Math.max(spk, 1))
      .withPipelineCounts(spk, spk)
      .withCommission(0)
      .withKpis(
        RphSpk.fromSpendAndSpk(spend, spk),
        0,
        ClosingRate.fromCounts(spk, Math.max(spk, 1)),
      )
      .withAttributionScore(AttributionScore.direct())
      .withVerdict(verdict)
      .build(),
  );
}

function buildReport(
  attributions: ReturnType<typeof buildAttribution>[],
  byBranch: BranchPerformance[],
) {
  return unwrap(
    ClosingReportBuilder.create()
      .withId("report-1")
      .withPeriod(makePeriod(8, 2026))
      .withGeneratedAt(new Date("2026-08-31"))
      .withTotals(
        0,
        attributions.reduce((s, a) => s + a.totalSpk, 0),
        0,
      )
      .withCommission(TotalCommission.zero())
      .withRates(ClosingRate.fromCounts(0, 1), ClosingRate.fromCounts(0, 1))
      .withCampaignAttributions(attributions, null, null)
      .withDimensions(byBranch, [], [])
      .withTrend({ spkDelta: 0, rateDelta: 0, commissionDelta: 0 })
      .build(),
  );
}

describe("SamanthaFeedService (pinned business correctness)", () => {
  it("campaign with 3 SPK, spend 3.6jt -> rphSpk=1.2jt -> SCALE", () => {
    const attribution = buildAttribution("#C047", 3_600_000, 3, "SCALE");
    const report = buildReport([attribution], []);
    const service = new SamanthaFeedService();

    const feed = service.build(report, 10);
    expect(feed.campaignSignals[0]?.rphSpk).toBe(1_200_000);
    expect(feed.campaignSignals[0]?.verdict).toBe("SCALE");
  });

  it("campaign with 0 SPK, spend 2jt -> PAUSE", () => {
    const attribution = buildAttribution("#C999", 2_000_000, 0, "PAUSE");
    const report = buildReport([attribution], []);
    const service = new SamanthaFeedService();

    const feed = service.build(report, 10);
    expect(feed.campaignSignals[0]?.verdict).toBe("PAUSE");
    expect(feed.campaignSignals[0]?.totalSpk).toBe(0);
  });

  it("branch Cinere closing rate 0.35 -> INCREASE_BUDGET", () => {
    const branch = unwrap(
      BranchPerformance.create({
        branch: BranchId.CINERE,
        totalSpk: 7,
        totalTestDrives: 10,
        closingRate: ClosingRate.fromCounts(7, 20),
        totalCommissionIdr: 0,
        avgRphSpk: RphSpk.fromSpendAndSpk(0, 0),
        topSalesName: "sales-x",
      }),
    );
    expect(branch.closingRate.value).toBeCloseTo(0.35, 5);
    const report = buildReport([], [branch]);
    const service = new SamanthaFeedService();

    const feed = service.build(report, 10);
    expect(feed.branchSignals[0]?.recommendation).toBe("INCREASE_BUDGET");
  });

  it("branch closing rate below 0.15 -> DECREASE_BUDGET", () => {
    const branch = unwrap(
      BranchPerformance.create({
        branch: BranchId.BANDUNG,
        totalSpk: 1,
        totalTestDrives: 10,
        closingRate: ClosingRate.fromCounts(1, 20), // 0.05
        totalCommissionIdr: 0,
        avgRphSpk: RphSpk.fromSpendAndSpk(0, 0),
        topSalesName: "sales-y",
      }),
    );
    const report = buildReport([], [branch]);
    const service = new SamanthaFeedService();

    const feed = service.build(report, 10);
    expect(feed.branchSignals[0]?.recommendation).toBe("DECREASE_BUDGET");
  });

  it("branch closing rate in the middle band -> MAINTAIN", () => {
    const branch = unwrap(
      BranchPerformance.create({
        branch: BranchId.BINTARO,
        totalSpk: 4,
        totalTestDrives: 10,
        closingRate: ClosingRate.fromCounts(4, 20), // 0.2
        totalCommissionIdr: 0,
        avgRphSpk: RphSpk.fromSpendAndSpk(0, 0),
        topSalesName: "sales-z",
      }),
    );
    const report = buildReport([], [branch]);
    const service = new SamanthaFeedService();

    const feed = service.build(report, 10);
    expect(feed.branchSignals[0]?.recommendation).toBe("MAINTAIN");
  });

  describe("objectiveStatus", () => {
    it("completionRate = achievedSpk/targetSpk, onTrack when target already met", () => {
      const attribution = buildAttribution("#C047", 1_000_000, 5, "SCALE");
      const report = buildReport([attribution], []);
      const service = new SamanthaFeedService();

      const feed = service.build(report, 5);
      expect(feed.objectiveStatus.targetSpk).toBe(5);
      expect(feed.objectiveStatus.achievedSpk).toBe(5);
      expect(feed.objectiveStatus.completionRate).toBe(1);
      expect(feed.objectiveStatus.onTrack).toBe(true);
    });

    it("onTrack is false when target not yet met", () => {
      const attribution = buildAttribution("#C047", 1_000_000, 2, "SCALE");
      const report = buildReport([attribution], []);
      const service = new SamanthaFeedService();

      const feed = service.build(report, 5);
      expect(feed.objectiveStatus.onTrack).toBe(false);
      expect(feed.objectiveStatus.completionRate).toBeCloseTo(0.4, 5);
    });

    it("completionRate is 0 (not NaN/Infinity) when targetSpk is 0", () => {
      const report = buildReport([], []);
      const service = new SamanthaFeedService();

      const feed = service.build(report, 0);
      expect(feed.objectiveStatus.completionRate).toBe(0);
    });
  });
});
