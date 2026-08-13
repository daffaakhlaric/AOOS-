import { BranchId, SalesHumanId } from "@aos/branch-manager";
import { ClosingType, LeadId, SupabaseError } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { ClosingAggregatorService } from "../../../src/application/services/ClosingAggregatorService.js";
import {
  FakeClosingRepository,
  makeClosing,
  makeGetClosingStats,
  makePeriod,
} from "../../fixtures/closingTrackerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("ClosingAggregatorService", () => {
  it("aggregates 10 closings -> correct totals", async () => {
    const repo = new FakeClosingRepository();
    const closings = Array.from({ length: 10 }, () =>
      makeClosing({ createdAt: new Date("2026-08-10T00:00:00.000Z") }),
    );
    repo.seed(closings);
    const service = new ClosingAggregatorService(repo, makeGetClosingStats(repo));

    const dataset = unwrap(await service.aggregate(makePeriod(8, 2026)));
    expect(dataset.closings).toHaveLength(10);
    expect(dataset.stats.totalClosings).toBe(10);
  });

  it("zero closings -> empty dataset (not an error)", async () => {
    const repo = new FakeClosingRepository();
    const service = new ClosingAggregatorService(repo, makeGetClosingStats(repo));

    const dataset = unwrap(await service.aggregate(makePeriod(8, 2026)));
    expect(dataset.closings).toHaveLength(0);
    expect(dataset.stats.totalClosings).toBe(0);
  });

  it("multiple branches -> raw closings retain each branch (per-branch split happens downstream)", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({ branchId: BranchId.BINTARO, createdAt: new Date("2026-08-05") }),
      makeClosing({ branchId: BranchId.BINTARO, createdAt: new Date("2026-08-06") }),
      makeClosing({ branchId: BranchId.CINERE, createdAt: new Date("2026-08-07") }),
    ]);
    const service = new ClosingAggregatorService(repo, makeGetClosingStats(repo));

    const dataset = unwrap(await service.aggregate(makePeriod(8, 2026)));
    expect(dataset.stats.closingsByBranch[BranchId.BINTARO]).toBe(2);
    expect(dataset.stats.closingsByBranch[BranchId.CINERE]).toBe(1);
  });

  it("reuses @aos/lead-store's real rphSpkByCampaign verbatim (coordinator note #1)", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({ campaignId: "#C047", createdAt: new Date("2026-08-01") }),
      makeClosing({ campaignId: "#C047", createdAt: new Date("2026-08-02") }),
      makeClosing({ campaignId: "#C047", createdAt: new Date("2026-08-03") }),
    ]);
    const service = new ClosingAggregatorService(
      repo,
      makeGetClosingStats(repo, { "#C047": 564_000 }),
    );

    const dataset = unwrap(await service.aggregate(makePeriod(8, 2026)));
    expect(dataset.stats.rphSpkByCampaign["#C047"]).toBe(188_000);
  });

  it("propagates a repository error", async () => {
    const repo = new FakeClosingRepository();
    repo.forceError(new SupabaseError("timeout"));
    const service = new ClosingAggregatorService(repo, makeGetClosingStats(repo));

    const error = unwrapErr(await service.aggregate(makePeriod(8, 2026)));
    expect(error.message).toContain("timeout");
  });

  it("propagates a GetClosingStats failure (its own second repository call failing)", async () => {
    const repo = new FakeClosingRepository();
    let calls = 0;
    const originalFindByFilter = repo.findByFilter.bind(repo);
    repo.findByFilter = async (filter) => {
      calls += 1;
      if (calls === 2) {
        return { ok: false as const, error: new SupabaseError("stats failed") };
      }
      return originalFindByFilter(filter);
    };
    const service = new ClosingAggregatorService(repo, makeGetClosingStats(repo));

    const error = unwrapErr(await service.aggregate(makePeriod(8, 2026)));
    expect(error.message).toContain("GetClosingStats");
  });

  it("includes leadId/salesHumanId identity intact on returned closings", async () => {
    const repo = new FakeClosingRepository();
    const leadId = LeadId.generate();
    const salesHumanId = SalesHumanId.generate();
    repo.seed([
      makeClosing({
        leadId,
        salesHumanId,
        closingType: ClosingType.TEST_DRIVE,
        createdAt: new Date("2026-08-01"),
      }),
    ]);
    const service = new ClosingAggregatorService(repo, makeGetClosingStats(repo));

    const dataset = unwrap(await service.aggregate(makePeriod(8, 2026)));
    expect(dataset.closings[0]?.leadId.toString()).toBe(leadId.toString());
    expect(dataset.closings[0]?.salesHumanId.toString()).toBe(salesHumanId.toString());
  });
});
