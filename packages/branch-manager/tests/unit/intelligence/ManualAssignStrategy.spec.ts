import { describe, expect, it } from "vitest";

import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { ManualAssignStrategy } from "../../../src/intelligence/ManualAssignStrategy.js";
import { makeSalesHuman } from "../../fixtures/branchManagerFixtures.js";
import { unwrap } from "../../helpers/result.js";

describe("ManualAssignStrategy", () => {
  it("always returns AssignmentPending, even with available sales", () => {
    const strategy = new ManualAssignStrategy();
    const on = makeSalesHuman({ name: "On", status: SalesStatus.ON });
    const selection = unwrap(strategy.select(BranchId.BINTARO, [on]));
    expect(selection.kind).toBe("PENDING");
  });

  it("returns AssignmentPending with no sales at all", () => {
    const strategy = new ManualAssignStrategy();
    const selection = unwrap(strategy.select(BranchId.BINTARO, []));
    expect(selection.kind).toBe("PENDING");
  });

  it("returns AssignmentPending even when every sales human is unavailable", () => {
    const strategy = new ManualAssignStrategy();
    const off = makeSalesHuman({ name: "Off", status: SalesStatus.OFF });
    const selection = unwrap(strategy.select(BranchId.BINTARO, [off]));
    expect(selection.kind).toBe("PENDING");
  });

  it("exposes mode as MANUAL", () => {
    const strategy = new ManualAssignStrategy();
    expect(strategy.mode).toBe("MANUAL");
  });
});
