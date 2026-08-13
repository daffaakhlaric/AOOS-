import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { BranchPerformance } from "../../../src/domain/entities/BranchPerformance.js";
import { ClosingRate, RphSpk } from "../../../src/domain/value-objects/index.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function baseProps() {
  return {
    branch: BranchId.CINERE,
    totalSpk: 5,
    totalTestDrives: 8,
    closingRate: ClosingRate.fromCounts(5, 20),
    totalCommissionIdr: 15_000_000,
    avgRphSpk: RphSpk.fromSpendAndSpk(10_000_000, 5),
    topSalesName: "sales-rina",
  };
}

describe("BranchPerformance", () => {
  it("rejects an invalid branch", () => {
    const error = unwrapErr(
      BranchPerformance.create({ ...baseProps(), branch: "NOPE" as BranchId }),
    );
    expect(error.message).toContain("branch");
  });

  it("rejects a negative totalSpk", () => {
    const error = unwrapErr(BranchPerformance.create({ ...baseProps(), totalSpk: -1 }));
    expect(error.message).toContain("totalSpk");
  });

  it("rejects an empty topSalesName", () => {
    const error = unwrapErr(BranchPerformance.create({ ...baseProps(), topSalesName: "" }));
    expect(error.message).toContain("topSalesName");
  });

  it("exposes every field via getters", () => {
    const perf = unwrap(BranchPerformance.create(baseProps()));
    expect(perf.branch).toBe(BranchId.CINERE);
    expect(perf.totalSpk).toBe(5);
    expect(perf.totalTestDrives).toBe(8);
    expect(perf.closingRate.value).toBe(0.25);
    expect(perf.totalCommissionIdr).toBe(15_000_000);
    expect(perf.avgRphSpk.value).toBe(2_000_000);
    expect(perf.topSalesName).toBe("sales-rina");
  });
});
