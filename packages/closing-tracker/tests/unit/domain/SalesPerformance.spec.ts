import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { SalesPerformance } from "../../../src/domain/entities/SalesPerformance.js";
import { ClosingRate } from "../../../src/domain/value-objects/index.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function baseProps() {
  return {
    salesHumanId: "sales-rina-001",
    salesHumanName: "sales-rina-001",
    branch: BranchId.CINERE,
    totalSpk: 3,
    totalTestDrives: 6,
    closingRate: ClosingRate.fromCounts(3, 8),
    totalCommissionIdr: 9_000_000,
  };
}

describe("SalesPerformance (spec gap filled — coordinator note #3)", () => {
  it("rejects an empty salesHumanId", () => {
    const error = unwrapErr(SalesPerformance.create({ ...baseProps(), salesHumanId: "" }));
    expect(error.message).toContain("salesHumanId");
  });

  it("rejects an empty salesHumanName", () => {
    const error = unwrapErr(SalesPerformance.create({ ...baseProps(), salesHumanName: "" }));
    expect(error.message).toContain("salesHumanName");
  });

  it("rejects an invalid branch", () => {
    const error = unwrapErr(
      SalesPerformance.create({ ...baseProps(), branch: "NOPE" as BranchId }),
    );
    expect(error.message).toContain("branch");
  });

  it("rejects a negative totalCommissionIdr", () => {
    const error = unwrapErr(SalesPerformance.create({ ...baseProps(), totalCommissionIdr: -1 }));
    expect(error.message).toContain("totalCommissionIdr");
  });

  it("exposes every field via getters", () => {
    const perf = unwrap(SalesPerformance.create(baseProps()));
    expect(perf.salesHumanId).toBe("sales-rina-001");
    expect(perf.salesHumanName).toBe("sales-rina-001");
    expect(perf.branch).toBe(BranchId.CINERE);
    expect(perf.totalSpk).toBe(3);
    expect(perf.totalTestDrives).toBe(6);
    expect(perf.closingRate.value).toBeCloseTo(0.375, 5);
    expect(perf.totalCommissionIdr).toBe(9_000_000);
  });
});
