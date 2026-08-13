import { ClosingType } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { ClosingTrackerFactory } from "../../../src/factories/ClosingTrackerFactory.js";
import {
  FakeCampaignActivityProvider,
  FakeClosingRepository,
  makeClosing,
  makeConfig,
  makeGetClosingStats,
  makePeriod,
} from "../../fixtures/closingTrackerFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";

describe("ClosingTrackerFactory (integration)", () => {
  it("composes a fully wired ClosingTracker with the default NullCampaignActivityProvider", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        closingType: ClosingType.SPK,
        campaignId: "#C047",
        createdAt: new Date("2026-08-01"),
      }),
    ]);
    const tracker = ClosingTrackerFactory.create({
      config: makeConfig(),
      publisher: createFakePublisher(),
      closingRepository: repo,
      getClosingStats: makeGetClosingStats(repo, { "#C047": 1_000_000 }),
    });

    const report = unwrap(
      await tracker.generateClosingReport.execute({
        period: makePeriod(8, 2026),
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(report.totalSpk).toBe(1);
    expect(report.campaignAttributions).toHaveLength(1);
  });

  it("wires a caller-supplied ICampaignActivityProvider through to fallback attribution", async () => {
    const repo = new FakeClosingRepository();
    const day = new Date("2026-08-10T00:00:00.000Z");
    repo.seed([
      makeClosing({ closingType: ClosingType.SPK, campaignId: undefined, createdAt: day }),
    ]);
    const provider = new FakeCampaignActivityProvider();
    const { BranchId } = await import("@aos/branch-manager");
    provider.seedDay(BranchId.BINTARO, day, [
      {
        campaignId: "#C500",
        stableId: "#A500",
        campaignName: "C500",
        branch: BranchId.BINTARO,
        spend: 1_000_000,
      },
    ]);
    const tracker = ClosingTrackerFactory.create({
      config: makeConfig(),
      publisher: createFakePublisher(),
      closingRepository: repo,
      getClosingStats: makeGetClosingStats(repo),
      campaignActivityProvider: provider,
    });

    const attributions = unwrap(
      await tracker.getCampaignAttribution.execute({ period: makePeriod(8, 2026) }),
    );
    expect(attributions).toHaveLength(1);
    expect(attributions[0]?.attributionScore.value).toBe(70);
  });

  it("wires a caller-supplied campaignDirectory through to direct attribution", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        closingType: ClosingType.SPK,
        campaignId: "#C047",
        createdAt: new Date("2026-08-01"),
      }),
    ]);
    const tracker = ClosingTrackerFactory.create({
      config: makeConfig(),
      publisher: createFakePublisher(),
      closingRepository: repo,
      getClosingStats: makeGetClosingStats(repo),
      campaignDirectory: new Map([["#C047", { campaignName: "Real Campaign", stableId: "#A047" }]]),
    });

    const attributions = unwrap(
      await tracker.getCampaignAttribution.execute({ period: makePeriod(8, 2026) }),
    );
    expect(attributions[0]?.campaignName).toBe("Real Campaign");
  });

  it("the default NullCampaignActivityProvider reports no active campaigns, leaving unattributed closings unattributed", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        closingType: ClosingType.SPK,
        campaignId: undefined,
        createdAt: new Date("2026-08-01"),
      }),
    ]);
    const tracker = ClosingTrackerFactory.create({
      config: makeConfig(),
      publisher: createFakePublisher(),
      closingRepository: repo,
      getClosingStats: makeGetClosingStats(repo),
    });

    const attributions = unwrap(
      await tracker.getCampaignAttribution.execute({ period: makePeriod(8, 2026) }),
    );
    expect(attributions).toHaveLength(0);
  });

  it("exposes every use case and service on the composed ClosingTracker", () => {
    const repo = new FakeClosingRepository();
    const tracker = ClosingTrackerFactory.create({
      config: makeConfig(),
      publisher: createFakePublisher(),
      closingRepository: repo,
      getClosingStats: makeGetClosingStats(repo),
    });

    expect(tracker.generateClosingReport).toBeDefined();
    expect(tracker.getCampaignAttribution).toBeDefined();
    expect(tracker.getBranchPerformance).toBeDefined();
    expect(tracker.getUnitPerformance).toBeDefined();
    expect(tracker.feedToTamara).toBeDefined();
    expect(tracker.checkObjectiveCompletion).toBeDefined();
    expect(tracker.getClosingPipeline).toBeDefined();
    expect(tracker.closingAggregatorService).toBeDefined();
    expect(tracker.attributionEngineService).toBeDefined();
    expect(tracker.reportGeneratorService).toBeDefined();
    expect(tracker.tamaraFeedService).toBeDefined();
  });
});
