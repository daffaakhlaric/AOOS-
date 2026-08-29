import { ClosingType, SupabaseError } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { AttributionEngineService } from "../../../src/application/services/AttributionEngineService.js";
import { ClosingAggregatorService } from "../../../src/application/services/ClosingAggregatorService.js";
import { ReportGeneratorService } from "../../../src/application/services/ReportGeneratorService.js";
import { SamanthaFeedService } from "../../../src/application/services/SamanthaFeedService.js";
import { FeedToSamantha } from "../../../src/application/use-cases/FeedToSamantha.js";
import { ClosingTrackerEvents } from "../../../src/domain/events/ClosingTrackerEvents.js";
import {
  FakeCampaignActivityProvider,
  FakeClosingRepository,
  fixedClock,
  makeClosing,
  makeConfig,
  makeGetClosingStats,
  makePeriod,
} from "../../fixtures/closingTrackerFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function buildUseCase(
  repo: FakeClosingRepository,
  spendByCampaign: Record<string, number> = {},
  campaignActivityProvider = new FakeCampaignActivityProvider(),
) {
  const config = makeConfig();
  const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo, spendByCampaign));
  const engine = new AttributionEngineService(campaignActivityProvider, config);
  const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
  const samanthaFeedService = new SamanthaFeedService();
  const publisher = createFakePublisher();
  const events = new ClosingTrackerEvents(publisher);
  const useCase = new FeedToSamantha(reportGenerator, samanthaFeedService, events, fixedClock());
  return { useCase, publisher };
}

describe("FeedToSamantha (integration)", () => {
  it("generates SamanthaFeedData with correct campaign/branch/objective signals", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        campaignId: "#C047",
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-01"),
      }),
      makeClosing({
        campaignId: "#C047",
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-02"),
      }),
      makeClosing({
        campaignId: "#C047",
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-03"),
      }),
    ]);
    const { useCase } = buildUseCase(repo, { "#C047": 3_600_000 });

    const feed = unwrap(
      await useCase.execute({
        period: makePeriod(8, 2026),
        targetSpk: 10,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(feed.campaignSignals).toHaveLength(1);
    expect(feed.campaignSignals[0]?.rphSpk).toBe(1_200_000);
    expect(feed.campaignSignals[0]?.verdict).toBe("SCALE");
    expect(feed.objectiveStatus.targetSpk).toBe(10);
    expect(feed.objectiveStatus.achievedSpk).toBe(3);
  });

  it("emits one CampaignAttributed event per campaign signal", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        campaignId: "#C1",
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-01"),
      }),
      makeClosing({
        campaignId: "#C2",
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-02"),
      }),
    ]);
    const { useCase, publisher } = buildUseCase(repo, { "#C1": 1_000_000, "#C2": 2_000_000 });

    await useCase.execute({
      period: makePeriod(8, 2026),
      targetSpk: 10,
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    const events = publisher.published.filter(
      (p) => p.type === "aaos.closing-tracker.campaign.attributed",
    );
    expect(events).toHaveLength(2);
  });

  it("emits no CampaignAttributed events when there are no campaign signals", async () => {
    const repo = new FakeClosingRepository();
    const { useCase, publisher } = buildUseCase(repo);

    await useCase.execute({
      period: makePeriod(8, 2026),
      targetSpk: 10,
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    const events = publisher.published.filter(
      (p) => p.type === "aaos.closing-tracker.campaign.attributed",
    );
    expect(events).toHaveLength(0);
  });

  it("emits CampaignAttributed with method TIME_BASED/BRANCH_BASED for fallback-attributed campaigns", async () => {
    const { BranchId } = await import("@aos/branch-manager");
    const provider = new FakeCampaignActivityProvider();
    const day = new Date("2026-08-10T00:00:00.000Z");
    provider.seedDay(BranchId.CINERE, day, [
      {
        campaignId: "#TIME1",
        stableId: "#T1",
        campaignName: "Time1",
        branch: BranchId.CINERE,
        spend: 1,
      },
    ]);
    provider.seedPeriod(BranchId.BANDUNG, [
      {
        campaignId: "#BRANCH1",
        stableId: "#B1",
        campaignName: "Branch1",
        branch: BranchId.BANDUNG,
        spend: 1,
      },
    ]);
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        branchId: BranchId.CINERE,
        campaignId: undefined,
        closingType: ClosingType.SPK,
        createdAt: day,
      }),
      makeClosing({
        branchId: BranchId.BANDUNG,
        campaignId: undefined,
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-20"),
      }),
    ]);
    const { useCase, publisher } = buildUseCase(repo, {}, provider);

    await useCase.execute({
      period: makePeriod(8, 2026),
      targetSpk: 10,
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    const events = publisher.published.filter(
      (p) => p.type === "aaos.closing-tracker.campaign.attributed",
    );
    const methods = events.map((e) => (e.payload as { method: string }).method).sort();
    expect(methods).toEqual(["BRANCH_BASED", "TIME_BASED"]);
  });

  it("falls back to branch 'UNKNOWN' when a campaign signal has no matching report attribution", async () => {
    const repo = new FakeClosingRepository();
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
    const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
    const fakeSamanthaFeedService = {
      build: () => ({
        period: makePeriod(8, 2026),
        campaignSignals: [
          {
            campaignId: "#GHOST",
            rphSpk: 0,
            closingRate: 0,
            totalSpk: 0,
            verdict: "PAUSE" as const,
            confidence: 100,
          },
        ],
        branchSignals: [],
        objectiveStatus: { targetSpk: 1, achievedSpk: 0, completionRate: 0, onTrack: false },
      }),
    };
    const publisher = createFakePublisher();
    const useCase = new FeedToSamantha(
      reportGenerator,
      fakeSamanthaFeedService as SamanthaFeedService,
      new ClosingTrackerEvents(publisher),
      fixedClock(),
    );

    await useCase.execute({
      period: makePeriod(8, 2026),
      targetSpk: 1,
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    const event = publisher.published.find(
      (p) => p.type === "aaos.closing-tracker.campaign.attributed",
    );
    expect((event?.payload as { branch: string }).branch).toBe("UNKNOWN");
  });

  it("uses the real wall clock when no clock override is provided", async () => {
    const repo = new FakeClosingRepository();
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
    const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
    const samanthaFeedService = new SamanthaFeedService();
    const publisher = createFakePublisher();
    const useCase = new FeedToSamantha(
      reportGenerator,
      samanthaFeedService,
      new ClosingTrackerEvents(publisher),
    );

    const feed = unwrap(
      await useCase.execute({
        period: makePeriod(8, 2026),
        targetSpk: 1,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(feed.objectiveStatus.targetSpk).toBe(1);
  });

  it("propagates a report generation failure", async () => {
    const repo = new FakeClosingRepository();
    repo.forceError(new SupabaseError("down"));
    const { useCase } = buildUseCase(repo);

    const error = unwrapErr(
      await useCase.execute({
        period: makePeriod(8, 2026),
        targetSpk: 10,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("down");
  });
});
