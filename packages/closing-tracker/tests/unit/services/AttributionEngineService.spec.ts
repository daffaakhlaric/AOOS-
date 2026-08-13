import { BranchId } from "@aos/branch-manager";
import { ClosingType } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { AttributionEngineService } from "../../../src/application/services/AttributionEngineService.js";
import type { ClosingDataset } from "../../../src/contracts/IClosingAggregator.js";
import {
  FakeCampaignActivityProvider,
  makeClosing,
  makeConfig,
  makePeriod,
} from "../../fixtures/closingTrackerFixtures.js";
import { unwrap } from "../../helpers/result.js";

function datasetOf(
  closings: ReturnType<typeof makeClosing>[],
  rphSpkByCampaign: Record<string, number> = {},
  closingsByCampaign: Record<string, number> = {},
): ClosingDataset {
  return {
    period: makePeriod(8, 2026),
    closings,
    stats: {
      totalClosings: closings.length,
      totalCommissionIdr: 0,
      avgCommissionIdr: 0,
      closingsByCampaign,
      rphSpkByCampaign,
      closingsByBranch: {},
    },
  };
}

describe("AttributionEngineService", () => {
  it("Method 1 — Direct attribution (campaign_id set) -> confidence 100, reuses rphSpk verbatim", async () => {
    const closings = [
      makeClosing({ campaignId: "#C047", closingType: ClosingType.SPK, commissionIdr: 3_000_000 }),
      makeClosing({ campaignId: "#C047", closingType: ClosingType.SPK, commissionIdr: 3_000_000 }),
      makeClosing({ campaignId: "#C047", closingType: ClosingType.SPK, commissionIdr: 3_000_000 }),
    ];
    const dataset = datasetOf(closings, { "#C047": 1_200_000 }, { "#C047": 3 });
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), makeConfig());

    const attributions = unwrap(await engine.attribute(dataset));
    expect(attributions).toHaveLength(1);
    expect(attributions[0]?.attributionScore.value).toBe(100);
    expect(attributions[0]?.rphSpk.value).toBe(1_200_000);
    expect(attributions[0]?.totalSpk).toBe(3);
    expect(attributions[0]?.totalSpend).toBe(3_600_000);
    expect(attributions[0]?.verdict).toBe("SCALE");
  });

  it("Method 2 — Time-based attribution (no campaign_id, same-day active campaign) -> confidence 70", async () => {
    const day = new Date("2026-08-10T00:00:00.000Z");
    const closing = makeClosing({
      branchId: BranchId.CINERE,
      campaignId: undefined,
      closingType: ClosingType.SPK,
      createdAt: day,
    });
    const provider = new FakeCampaignActivityProvider();
    provider.seedDay(BranchId.CINERE, day, [
      {
        campaignId: "#C100",
        stableId: "#A100",
        campaignName: "Campaign 100",
        branch: BranchId.CINERE,
        spend: 2_000_000,
      },
      {
        campaignId: "#C101",
        stableId: "#A101",
        campaignName: "Campaign 101",
        branch: BranchId.CINERE,
        spend: 5_000_000,
      },
    ]);
    const engine = new AttributionEngineService(provider, makeConfig());

    const attributions = unwrap(await engine.attribute(datasetOf([closing])));
    expect(attributions).toHaveLength(1);
    expect(attributions[0]?.campaignId).toBe("#C101"); // highest spend wins
    expect(attributions[0]?.attributionScore.value).toBe(70);
    expect(attributions[0]?.campaignName).toBe("Campaign 101");
  });

  it("Method 2 picks the highest-spend campaign even when it appears first among 3+ candidates", async () => {
    const day = new Date("2026-08-10T00:00:00.000Z");
    const closing = makeClosing({
      branchId: BranchId.CINERE,
      campaignId: undefined,
      closingType: ClosingType.SPK,
      createdAt: day,
    });
    const provider = new FakeCampaignActivityProvider();
    provider.seedDay(BranchId.CINERE, day, [
      {
        campaignId: "#WINNER",
        stableId: "#W",
        campaignName: "Winner",
        branch: BranchId.CINERE,
        spend: 9_000_000,
      },
      {
        campaignId: "#RUNNER-UP",
        stableId: "#R",
        campaignName: "Runner",
        branch: BranchId.CINERE,
        spend: 3_000_000,
      },
      {
        campaignId: "#LAST",
        stableId: "#L",
        campaignName: "Last",
        branch: BranchId.CINERE,
        spend: 1_000_000,
      },
    ]);
    const engine = new AttributionEngineService(provider, makeConfig());

    const attributions = unwrap(await engine.attribute(datasetOf([closing])));
    expect(attributions).toHaveLength(1);
    expect(attributions[0]?.campaignId).toBe("#WINNER");
  });

  it("Method 3 — Branch-based attribution (no same-day match, branch known) -> confidence 40, proportional by spend", async () => {
    const closing = makeClosing({
      branchId: BranchId.BANDUNG,
      campaignId: undefined,
      closingType: ClosingType.SPK,
      createdAt: new Date("2026-08-20"),
    });
    const provider = new FakeCampaignActivityProvider();
    provider.seedPeriod(BranchId.BANDUNG, [
      {
        campaignId: "#C200",
        stableId: "#A200",
        campaignName: "C200",
        branch: BranchId.BANDUNG,
        spend: 3_000_000,
      },
      {
        campaignId: "#C201",
        stableId: "#A201",
        campaignName: "C201",
        branch: BranchId.BANDUNG,
        spend: 1_000_000,
      },
    ]);
    const engine = new AttributionEngineService(provider, makeConfig());

    const attributions = unwrap(await engine.attribute(datasetOf([closing])));
    expect(attributions).toHaveLength(2);
    expect(attributions.every((a) => a.attributionScore.value === 40)).toBe(true);
    const c200 = attributions.find((a) => a.campaignId === "#C200");
    const c201 = attributions.find((a) => a.campaignId === "#C201");
    // spend share: 3M/4M = 0.75, 1M/4M = 0.25
    expect(c200?.totalSpk).toBeCloseTo(0.75, 5);
    expect(c201?.totalSpk).toBeCloseTo(0.25, 5);
  });

  it("Method 3 splits evenly when every active campaign has 0 recorded spend", async () => {
    const closing = makeClosing({
      branchId: BranchId.UMUM,
      campaignId: undefined,
      closingType: ClosingType.SPK,
      createdAt: new Date("2026-08-20"),
    });
    const provider = new FakeCampaignActivityProvider();
    provider.seedPeriod(BranchId.UMUM, [
      {
        campaignId: "#C300",
        stableId: "#A300",
        campaignName: "C300",
        branch: BranchId.UMUM,
        spend: 0,
      },
      {
        campaignId: "#C301",
        stableId: "#A301",
        campaignName: "C301",
        branch: BranchId.UMUM,
        spend: 0,
      },
    ]);
    const engine = new AttributionEngineService(provider, makeConfig());

    const attributions = unwrap(await engine.attribute(datasetOf([closing])));
    expect(attributions).toHaveLength(2);
    for (const a of attributions) {
      expect(a.totalSpk).toBeCloseTo(0.5, 5);
    }
  });

  it("Method 2 accumulates counts when multiple closings resolve to the same campaign bucket", async () => {
    const day = new Date("2026-08-10T00:00:00.000Z");
    const provider = new FakeCampaignActivityProvider();
    provider.seedDay(BranchId.CINERE, day, [
      {
        campaignId: "#C900",
        stableId: "#A900",
        campaignName: "C900",
        branch: BranchId.CINERE,
        spend: 4_000_000,
      },
    ]);
    const engine = new AttributionEngineService(provider, makeConfig());
    const closings = [
      makeClosing({
        branchId: BranchId.CINERE,
        campaignId: undefined,
        closingType: ClosingType.SPK,
        createdAt: day,
        commissionIdr: 1_000_000,
      }),
      makeClosing({
        branchId: BranchId.CINERE,
        campaignId: undefined,
        closingType: ClosingType.TEST_DRIVE,
        createdAt: day,
        commissionIdr: 0,
      }),
    ];

    const attributions = unwrap(await engine.attribute(datasetOf(closings)));
    expect(attributions).toHaveLength(1);
    expect(attributions[0]?.totalSpk).toBe(1);
    expect(attributions[0]?.totalTestDrives).toBe(1);
    expect(attributions[0]?.totalHotLeads).toBe(2);
    expect(attributions[0]?.totalCommissionIdr).toBe(1_000_000);
  });

  it("no active campaign found (day or period) -> closing is not attributed to any campaign", async () => {
    const closing = makeClosing({ campaignId: undefined, closingType: ClosingType.SPK });
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), makeConfig());

    const attributions = unwrap(await engine.attribute(datasetOf([closing])));
    expect(attributions).toHaveLength(0);
  });

  it("a campaignId absent from rphSpkByCampaign (0 direct spend on record) still produces an attribution with rphSpk=0", async () => {
    const closing = makeClosing({ campaignId: "#C999", closingType: ClosingType.SPK });
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), makeConfig());

    const attributions = unwrap(await engine.attribute(datasetOf([closing])));
    expect(attributions).toHaveLength(1);
    expect(attributions[0]?.rphSpk.value).toBe(0);
  });

  it("resolves campaign metadata from an injected campaignDirectory for direct attribution", async () => {
    const closing = makeClosing({ campaignId: "#C047", closingType: ClosingType.SPK });
    const directory = new Map([["#C047", { campaignName: "Real Name", stableId: "#A047" }]]);
    const engine = new AttributionEngineService(
      new FakeCampaignActivityProvider(),
      makeConfig(),
      directory,
    );

    const attributions = unwrap(await engine.attribute(datasetOf([closing])));
    expect(attributions[0]?.campaignName).toBe("Real Name");
    expect(attributions[0]?.stableId).toBe("#A047");
  });

  it("falls back to the raw campaignId as name/stableId when no directory entry exists", async () => {
    const closing = makeClosing({ campaignId: "#C047", closingType: ClosingType.SPK });
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), makeConfig());

    const attributions = unwrap(await engine.attribute(datasetOf([closing])));
    expect(attributions[0]?.campaignName).toBe("#C047");
    expect(attributions[0]?.stableId).toBe("#C047");
  });

  it("distinct leadIds within a direct-attribution group count as totalHotLeads", async () => {
    const closings = [
      makeClosing({ campaignId: "#C047", closingType: ClosingType.TEST_DRIVE }),
      makeClosing({ campaignId: "#C047", closingType: ClosingType.TEST_DRIVE }),
    ];
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), makeConfig());

    const attributions = unwrap(await engine.attribute(datasetOf(closings)));
    expect(attributions[0]?.totalHotLeads).toBe(2);
  });

  it("does not mutate the caller-supplied campaignDirectory when discovering new metadata via fallback attribution", async () => {
    const day = new Date("2026-08-10T00:00:00.000Z");
    const closing = makeClosing({
      branchId: BranchId.CINERE,
      campaignId: undefined,
      closingType: ClosingType.SPK,
      createdAt: day,
    });
    const provider = new FakeCampaignActivityProvider();
    provider.seedDay(BranchId.CINERE, day, [
      {
        campaignId: "#C500",
        stableId: "#A500",
        campaignName: "C500",
        branch: BranchId.CINERE,
        spend: 1,
      },
    ]);
    const directory = new Map<string, { campaignName: string; stableId: string }>();
    const engine = new AttributionEngineService(provider, makeConfig(), directory);

    await engine.attribute(datasetOf([closing]));
    expect(directory.size).toBe(0);
  });
});
