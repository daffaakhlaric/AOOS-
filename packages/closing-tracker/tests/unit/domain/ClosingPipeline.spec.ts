import { describe, expect, it } from "vitest";

import { ClosingPipeline } from "../../../src/domain/entities/ClosingPipeline.js";
import { ConversionFunnel } from "../../../src/domain/value-objects/ConversionFunnel.js";
import { makePeriod } from "../../fixtures/closingTrackerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function baseProps() {
  return {
    period: makePeriod(8, 2026),
    totalTestDrives: 10,
    totalSpk: 4,
    totalCancelled: 1,
    avgDaysTestDriveToSpk: 3.5,
    funnel: unwrap(ConversionFunnel.create({ hotLeadCount: 20, testDriveCount: 10, spkCount: 4 })),
  };
}

describe("ClosingPipeline", () => {
  it("rejects a negative totalTestDrives", () => {
    const error = unwrapErr(ClosingPipeline.create({ ...baseProps(), totalTestDrives: -1 }));
    expect(error.message).toContain("totalTestDrives");
  });

  it("rejects a non-integer totalSpk", () => {
    const error = unwrapErr(ClosingPipeline.create({ ...baseProps(), totalSpk: 1.5 }));
    expect(error.message).toContain("totalSpk");
  });

  it("rejects a negative avgDaysTestDriveToSpk", () => {
    const error = unwrapErr(ClosingPipeline.create({ ...baseProps(), avgDaysTestDriveToSpk: -1 }));
    expect(error.message).toContain("avgDaysTestDriveToSpk");
  });

  it("exposes every field via getters", () => {
    const pipeline = unwrap(ClosingPipeline.create(baseProps()));
    expect(pipeline.totalTestDrives).toBe(10);
    expect(pipeline.totalSpk).toBe(4);
    expect(pipeline.totalCancelled).toBe(1);
    expect(pipeline.avgDaysTestDriveToSpk).toBe(3.5);
    expect(pipeline.funnel.spkCount).toBe(4);
    expect(pipeline.period.toLabel()).toBe("2026-08");
  });
});
