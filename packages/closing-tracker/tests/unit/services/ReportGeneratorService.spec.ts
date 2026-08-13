import { BranchId } from "@aos/branch-manager";
import { ClosingType } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { AttributionEngineService } from "../../../src/application/services/AttributionEngineService.js";
import { ClosingAggregatorService } from "../../../src/application/services/ClosingAggregatorService.js";
import { ReportGeneratorService } from "../../../src/application/services/ReportGeneratorService.js";
import {
  FakeCampaignActivityProvider,
  FakeClosingRepository,
  fixedClock,
  makeClosing,
  makeConfig,
  makeGetClosingStats,
  makePeriod,
} from "../../fixtures/closingTrackerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function buildService(
  repo: FakeClosingRepository,
  spendByCampaign: Record<string, number> = {},
  config = makeConfig(),
) {
  const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo, spendByCampaign));
  const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
  return new ReportGeneratorService(
    aggregator,
    engine,
    config,
    fixedClock(),
    () => "report-fixed-id",
  );
}

describe("ReportGeneratorService", () => {
  it("computes totals for a period with closings of every type", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({ closingType: ClosingType.TEST_DRIVE, createdAt: new Date("2026-08-05") }),
      makeClosing({ closingType: ClosingType.TEST_DRIVE, createdAt: new Date("2026-08-06") }),
      makeClosing({ closingType: ClosingType.SPK, createdAt: new Date("2026-08-07") }),
      makeClosing({ closingType: ClosingType.CANCELLED, createdAt: new Date("2026-08-08") }),
    ]);
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    expect(report.totalTestDrives).toBe(2);
    expect(report.totalSpk).toBe(1);
    expect(report.totalCancelled).toBe(1);
  });

  it("zero closings -> a valid (not error) report with all-zero totals", async () => {
    const repo = new FakeClosingRepository();
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    expect(report.totalSpk).toBe(0);
    expect(report.closingRate.value).toBe(0);
    expect(report.campaignAttributions).toHaveLength(0);
    expect(report.topCampaign).toBeNull();
    expect(report.worstCampaign).toBeNull();
  });

  it("closingRate division-by-zero guard -> 0.0, never NaN, when there are closings but no SPK", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({ closingType: ClosingType.TEST_DRIVE, createdAt: new Date("2026-08-05") }),
    ]);
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    expect(report.closingRate.value).toBe(0);
    expect(Number.isNaN(report.closingRate.value)).toBe(false);
  });

  it("commission total is the exact sum (pinned business correctness)", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        closingType: ClosingType.SPK,
        commissionIdr: 5_850_000,
        createdAt: new Date("2026-08-05"),
      }),
      makeClosing({
        closingType: ClosingType.SPK,
        commissionIdr: 4_200_000,
        createdAt: new Date("2026-08-06"),
      }),
    ]);
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    expect(report.totalCommissionIdr.value).toBe(10_050_000);
  });

  describe("topCampaign / worstCampaign (coordinator note #4 — minSpkForAttribution gate)", () => {
    it("selects lowest rphSpk as topCampaign and highest as worstCampaign among 3+ qualifying campaigns", async () => {
      const repo = new FakeClosingRepository();
      // Insertion order: MEDIUM, EXPENSIVE, CHEAP — deliberately NOT sorted, so both the
      // top-reassignment and worst-reassignment branches in the selection loop execute at least
      // once (MEDIUM starts as both top and worst; EXPENSIVE only reassigns worst; CHEAP only
      // reassigns top).
      repo.seed([
        makeClosing({
          campaignId: "#MEDIUM",
          closingType: ClosingType.SPK,
          createdAt: new Date("2026-08-01"),
        }),
        makeClosing({
          campaignId: "#EXPENSIVE",
          closingType: ClosingType.SPK,
          createdAt: new Date("2026-08-02"),
        }),
        makeClosing({
          campaignId: "#CHEAP",
          closingType: ClosingType.SPK,
          createdAt: new Date("2026-08-03"),
        }),
      ]);
      const service = buildService(repo, {
        "#MEDIUM": 3_000_000,
        "#EXPENSIVE": 20_000_000,
        "#CHEAP": 1_000_000,
      });

      const report = unwrap(await service.generate(makePeriod(8, 2026)));
      expect(report.topCampaign?.campaignId).toBe("#CHEAP");
      expect(report.worstCampaign?.campaignId).toBe("#EXPENSIVE");
    });

    it("excludes campaigns below minSpkForAttribution from topCampaign/worstCampaign selection", async () => {
      const repo = new FakeClosingRepository();
      repo.seed([
        // Only 1 SPK — below the minSpkForAttribution=2 threshold configured below, but has the
        // cheapest rphSpk of all campaigns (would otherwise win "topCampaign").
        makeClosing({
          campaignId: "#CHEAP-BUT-THIN",
          closingType: ClosingType.SPK,
          createdAt: new Date("2026-08-01"),
        }),
        makeClosing({
          campaignId: "#QUALIFIES",
          closingType: ClosingType.SPK,
          createdAt: new Date("2026-08-02"),
        }),
        makeClosing({
          campaignId: "#QUALIFIES",
          closingType: ClosingType.SPK,
          createdAt: new Date("2026-08-03"),
        }),
      ]);
      const config = makeConfig({ minSpkForAttribution: 2 });
      const service = buildService(repo, { "#CHEAP-BUT-THIN": 1, "#QUALIFIES": 5_000_000 }, config);

      const report = unwrap(await service.generate(makePeriod(8, 2026)));
      expect(report.topCampaign?.campaignId).toBe("#QUALIFIES");
      expect(report.worstCampaign?.campaignId).toBe("#QUALIFIES");
    });

    it("topCampaign/worstCampaign are both null when no campaign qualifies", async () => {
      const repo = new FakeClosingRepository();
      repo.seed([
        makeClosing({
          campaignId: "#C1",
          closingType: ClosingType.SPK,
          createdAt: new Date("2026-08-01"),
        }),
      ]);
      const config = makeConfig({ minSpkForAttribution: 5 });
      const service = buildService(repo, { "#C1": 1_000_000 }, config);

      const report = unwrap(await service.generate(makePeriod(8, 2026)));
      expect(report.topCampaign).toBeNull();
      expect(report.worstCampaign).toBeNull();
    });
  });

  it("byBranch aggregates SPK/testDrives/commission per branch, with topSalesName = the sales human with the most SPK", async () => {
    const repo = new FakeClosingRepository();
    const { SalesHumanId } = await import("@aos/branch-manager");
    const topSales = SalesHumanId.generate();
    const otherSales = SalesHumanId.generate();
    repo.seed([
      makeClosing({
        branchId: BranchId.CINERE,
        salesHumanId: topSales,
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-01"),
      }),
      makeClosing({
        branchId: BranchId.CINERE,
        salesHumanId: topSales,
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-02"),
      }),
      makeClosing({
        branchId: BranchId.CINERE,
        salesHumanId: otherSales,
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-03"),
      }),
    ]);
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    const cinere = report.byBranch.find((b) => b.branch === BranchId.CINERE);
    expect(cinere?.totalSpk).toBe(3);
    expect(cinere?.topSalesName).toBe(topSales.toString());
  });

  it("byUnit aggregates avgSpkValue/avgCommission per unit model, topBranch = branch with the most SPK for that unit", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        branchId: BranchId.BINTARO,
        unitModel: "Xpander Cross",
        closingType: ClosingType.SPK,
        unitPrice: 200_000_000,
        commissionIdr: 5_000_000,
        createdAt: new Date("2026-08-01"),
      }),
      makeClosing({
        branchId: BranchId.BINTARO,
        unitModel: "Xpander Cross",
        closingType: ClosingType.SPK,
        unitPrice: 220_000_000,
        commissionIdr: 5_500_000,
        createdAt: new Date("2026-08-02"),
      }),
    ]);
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    const unit = report.byUnit.find((u) => u.unitModel === "Xpander Cross");
    expect(unit?.totalSpk).toBe(2);
    expect(unit?.avgSpkValue).toBe(210_000_000);
    expect(unit?.avgCommission).toBe(5_250_000);
    expect(unit?.topBranch).toBe(BranchId.BINTARO);
  });

  it("byBranch/byUnit top-picking skips non-SPK closings when finding the top sales human / top branch", async () => {
    const repo = new FakeClosingRepository();
    const { SalesHumanId } = await import("@aos/branch-manager");
    const sales = SalesHumanId.generate();
    repo.seed([
      makeClosing({
        branchId: BranchId.CINERE,
        salesHumanId: sales,
        unitModel: "Xpander Cross",
        closingType: ClosingType.TEST_DRIVE,
        createdAt: new Date("2026-08-01"),
      }),
      makeClosing({
        branchId: BranchId.CINERE,
        salesHumanId: sales,
        unitModel: "Xpander Cross",
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-02"),
      }),
    ]);
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    const cinere = report.byBranch.find((b) => b.branch === BranchId.CINERE);
    expect(cinere?.topSalesName).toBe(sales.toString());
    const unit = report.byUnit.find((u) => u.unitModel === "Xpander Cross");
    expect(unit?.topBranch).toBe(BranchId.CINERE);
  });

  it("topSalesName/topBranch fall back to the first closing's identity when a branch/unit group has zero SPK closings", async () => {
    const repo = new FakeClosingRepository();
    const { SalesHumanId } = await import("@aos/branch-manager");
    const sales = SalesHumanId.generate();
    repo.seed([
      makeClosing({
        branchId: BranchId.CINERE,
        salesHumanId: sales,
        unitModel: "Xpander Cross",
        closingType: ClosingType.TEST_DRIVE,
        createdAt: new Date("2026-08-01"),
      }),
    ]);
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    const cinere = report.byBranch.find((b) => b.branch === BranchId.CINERE);
    expect(cinere?.topSalesName).toBe(sales.toString());
    const unit = report.byUnit.find((u) => u.unitModel === "Xpander Cross");
    expect(unit?.topBranch).toBe(BranchId.CINERE);
  });

  it("closings without a unitModel are excluded from byUnit", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        closingType: ClosingType.SPK,
        unitModel: undefined,
        createdAt: new Date("2026-08-01"),
      }),
    ]);
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    expect(report.byUnit).toHaveLength(0);
  });

  it("bySales aggregates per sales human", async () => {
    const repo = new FakeClosingRepository();
    const { SalesHumanId } = await import("@aos/branch-manager");
    const sales = SalesHumanId.generate();
    repo.seed([
      makeClosing({
        salesHumanId: sales,
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-01"),
      }),
    ]);
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    expect(report.bySales).toHaveLength(1);
    expect(report.bySales[0]?.salesHumanId).toBe(sales.toString());
    expect(report.bySales[0]?.totalSpk).toBe(1);
  });

  it("vsLastMonth computes deltas against the prior calendar month", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        closingType: ClosingType.SPK,
        commissionIdr: 5_000_000,
        createdAt: new Date("2026-07-10"),
      }),
      makeClosing({
        closingType: ClosingType.SPK,
        commissionIdr: 4_000_000,
        createdAt: new Date("2026-08-10"),
      }),
      makeClosing({
        closingType: ClosingType.SPK,
        commissionIdr: 4_000_000,
        createdAt: new Date("2026-08-11"),
      }),
    ]);
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    expect(report.vsLastMonth.spkDelta).toBe(1); // 2 this month - 1 last month
    expect(report.vsLastMonth.commissionDelta).toBe(3_000_000); // 8M - 5M
  });

  it("vsLastMonth treats a prior period with zero data as a zero baseline (no error)", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([makeClosing({ closingType: ClosingType.SPK, createdAt: new Date("2026-08-10") })]);
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    expect(report.vsLastMonth.spkDelta).toBe(1);
  });

  it("propagates an aggregation failure", async () => {
    const repo = new FakeClosingRepository();
    const { SupabaseError } = await import("@aos/lead-store");
    repo.forceError(new SupabaseError("down"));
    const service = buildService(repo);

    const error = unwrapErr(await service.generate(makePeriod(8, 2026)));
    expect(error.message).toContain("down");
  });

  it("falls back to a zero-value previous-period dataset when the previous period's aggregation itself fails (e.g. no data exists before the tracker's first month)", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([makeClosing({ closingType: ClosingType.SPK, createdAt: new Date("2026-08-10") })]);
    const { SupabaseError } = await import("@aos/lead-store");
    let calls = 0;
    const originalFindByFilter = repo.findByFilter.bind(repo);
    repo.findByFilter = async (filter) => {
      calls += 1;
      // Calls 1-2 are the current-period aggregate (raw + GetClosingStats); calls 3-4 are the
      // previous-period aggregate — fail only the previous period's first call.
      if (calls === 3) {
        return { ok: false as const, error: new SupabaseError("no prior data") };
      }
      return originalFindByFilter(filter);
    };
    const service = buildService(repo);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    expect(report.vsLastMonth.spkDelta).toBe(1); // 1 this month vs. 0-baseline
  });

  it("uses the real wall clock and a real generated id when neither is overridden", async () => {
    const repo = new FakeClosingRepository();
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
    const service = new ReportGeneratorService(aggregator, engine, config);

    const report = unwrap(await service.generate(makePeriod(8, 2026)));
    expect(report.id.length).toBeGreaterThan(0);
    expect(report.generatedAt).toBeInstanceOf(Date);
  });

  it("propagates an attribution engine failure", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([makeClosing({ closingType: ClosingType.SPK, createdAt: new Date("2026-08-01") })]);
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const { AttributionError } = await import("../../../src/domain/errors/AttributionError.js");
    const failingEngine = {
      attribute: async () => ({ ok: false as const, error: new AttributionError("engine down") }),
    };
    const service = new ReportGeneratorService(aggregator, failingEngine, config, fixedClock());

    const error = unwrapErr(await service.generate(makePeriod(8, 2026)));
    expect(error.message).toContain("attribution failed");
  });
});
