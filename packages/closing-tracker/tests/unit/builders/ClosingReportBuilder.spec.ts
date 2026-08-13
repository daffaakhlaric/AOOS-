import { describe, expect, it } from "vitest";

import { ClosingReportBuilder } from "../../../src/builders/ClosingReportBuilder.js";
import { ClosingRate, TotalCommission } from "../../../src/domain/value-objects/index.js";
import { makePeriod } from "../../fixtures/closingTrackerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("ClosingReportBuilder", () => {
  it("builds a valid ClosingReport via fluent setters", () => {
    const report = unwrap(
      ClosingReportBuilder.create()
        .withId("report-001")
        .withPeriod(makePeriod(8, 2026))
        .withGeneratedAt(new Date("2026-08-31T23:59:00.000Z"))
        .withTotals(10, 4, 1)
        .withCommission(TotalCommission.fromAmounts([3_000_000]))
        .withRates(ClosingRate.fromCounts(4, 20), ClosingRate.fromCounts(4, 10))
        .withCampaignAttributions([], null, null)
        .withDimensions([], [], [])
        .withTrend({ spkDelta: 2, rateDelta: 0.05, commissionDelta: 500_000 })
        .build(),
    );
    expect(report.id).toBe("report-001");
    expect(report.totalSpk).toBe(4);
    expect(report.totalCommissionIdr.value).toBe(3_000_000);
  });

  it("build() fails when required fields are missing", () => {
    const error = unwrapErr(ClosingReportBuilder.create().build());
    expect(error).toBeDefined();
  });
});
