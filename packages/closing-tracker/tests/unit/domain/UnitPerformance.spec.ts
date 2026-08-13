import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { UnitPerformance } from "../../../src/domain/entities/UnitPerformance.js";
import { ClosingRate } from "../../../src/domain/value-objects/index.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function baseProps() {
  return {
    unitModel: "Xpander Cross",
    totalSpk: 4,
    avgSpkValue: 210_000_000,
    avgCommission: 5_250_000,
    closingRate: ClosingRate.fromCounts(4, 10),
    topBranch: BranchId.BINTARO,
  };
}

describe("UnitPerformance", () => {
  it("rejects an empty unitModel", () => {
    const error = unwrapErr(UnitPerformance.create({ ...baseProps(), unitModel: "" }));
    expect(error.message).toContain("unitModel");
  });

  it("rejects a negative avgSpkValue", () => {
    const error = unwrapErr(UnitPerformance.create({ ...baseProps(), avgSpkValue: -1 }));
    expect(error.message).toContain("avgSpkValue");
  });

  it("rejects an invalid topBranch", () => {
    const error = unwrapErr(
      UnitPerformance.create({ ...baseProps(), topBranch: "NOPE" as BranchId }),
    );
    expect(error.message).toContain("topBranch");
  });

  it("exposes every field via getters", () => {
    const perf = unwrap(UnitPerformance.create(baseProps()));
    expect(perf.unitModel).toBe("Xpander Cross");
    expect(perf.totalSpk).toBe(4);
    expect(perf.avgSpkValue).toBe(210_000_000);
    expect(perf.avgCommission).toBe(5_250_000);
    expect(perf.closingRate.value).toBe(0.4);
    expect(perf.topBranch).toBe(BranchId.BINTARO);
  });
});
