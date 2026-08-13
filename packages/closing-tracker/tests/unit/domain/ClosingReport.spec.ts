import { describe, expect, it } from "vitest";

import { ClosingReport } from "../../../src/domain/entities/ClosingReport.js";
import { ClosingRate, TotalCommission } from "../../../src/domain/value-objects/index.js";
import { makePeriod } from "../../fixtures/closingTrackerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function baseProps() {
  return {
    id: "report-001",
    period: makePeriod(8, 2026),
    generatedAt: new Date("2026-08-31T23:59:00.000Z"),
    totalTestDrives: 10,
    totalSpk: 4,
    totalCancelled: 1,
    totalCommissionIdr: TotalCommission.fromAmounts([1_000_000, 2_000_000]),
    closingRate: ClosingRate.fromCounts(4, 20),
    testDriveToSpkRate: ClosingRate.fromCounts(4, 10),
    campaignAttributions: [],
    topCampaign: null,
    worstCampaign: null,
    byBranch: [],
    byUnit: [],
    bySales: [],
    vsLastMonth: { spkDelta: 2, rateDelta: 0.05, commissionDelta: 500_000 },
  };
}

describe("ClosingReport", () => {
  it("rejects an empty id", () => {
    const error = unwrapErr(ClosingReport.create({ ...baseProps(), id: "" }));
    expect(error.message).toContain("id");
  });

  it("rejects a negative totalSpk", () => {
    const error = unwrapErr(ClosingReport.create({ ...baseProps(), totalSpk: -1 }));
    expect(error.message).toContain("totalSpk");
  });

  it("rejects a non-integer totalCancelled", () => {
    const error = unwrapErr(ClosingReport.create({ ...baseProps(), totalCancelled: 0.5 }));
    expect(error.message).toContain("totalCancelled");
  });

  it("exposes every field via getters", () => {
    const report = unwrap(ClosingReport.create(baseProps()));
    expect(report.id).toBe("report-001");
    expect(report.period.toLabel()).toBe("2026-08");
    expect(report.generatedAt.toISOString()).toBe("2026-08-31T23:59:00.000Z");
    expect(report.totalTestDrives).toBe(10);
    expect(report.totalSpk).toBe(4);
    expect(report.totalCancelled).toBe(1);
    expect(report.totalCommissionIdr.value).toBe(3_000_000);
    expect(report.closingRate.value).toBe(0.2);
    expect(report.testDriveToSpkRate.value).toBe(0.4);
    expect(report.campaignAttributions).toEqual([]);
    expect(report.topCampaign).toBeNull();
    expect(report.worstCampaign).toBeNull();
    expect(report.byBranch).toEqual([]);
    expect(report.byUnit).toEqual([]);
    expect(report.bySales).toEqual([]);
    expect(report.vsLastMonth).toEqual({ spkDelta: 2, rateDelta: 0.05, commissionDelta: 500_000 });
  });

  it("defensively copies array fields (mutating the input after create() does not leak in)", () => {
    const attributions: never[] = [];
    const report = unwrap(
      ClosingReport.create({ ...baseProps(), campaignAttributions: attributions }),
    );
    attributions.push({} as never);
    expect(report.campaignAttributions).toHaveLength(0);
  });
});
