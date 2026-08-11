import { describe, expect, it } from "vitest";

import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { SmartAssignStrategy } from "../../../src/intelligence/SmartAssignStrategy.js";
import { makeSalesHuman } from "../../fixtures/branchManagerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("SmartAssignStrategy", () => {
  it("picks the sales with fewest active leads (pinned smart_assign: A=3, B=1, C=5 -> B)", () => {
    const strategy = new SmartAssignStrategy();
    const a = makeSalesHuman({ name: "A", activeLeadCount: 3 });
    const b = makeSalesHuman({ name: "B", activeLeadCount: 1 });
    const c = makeSalesHuman({ name: "C", activeLeadCount: 5 });
    const selection = unwrap(strategy.select(BranchId.BINTARO, [a, b, c]));
    expect(selection.kind).toBe("ASSIGNED");
    if (selection.kind === "ASSIGNED") {
      expect(selection.salesHuman.name).toBe("B");
    }
  });

  it("skips BUSY and OFF sales", () => {
    const strategy = new SmartAssignStrategy();
    const busy = makeSalesHuman({ name: "Busy", status: SalesStatus.BUSY, activeLeadCount: 0 });
    const off = makeSalesHuman({ name: "Off", status: SalesStatus.OFF, activeLeadCount: 0 });
    const on = makeSalesHuman({ name: "On", status: SalesStatus.ON, activeLeadCount: 5 });
    const selection = unwrap(strategy.select(BranchId.BINTARO, [busy, off, on]));
    expect(selection.kind).toBe("ASSIGNED");
    if (selection.kind === "ASSIGNED") {
      expect(selection.salesHuman.name).toBe("On");
    }
  });

  it("skips sales at daily quota (quota_enforcement: maxLeadsPerDay=10, todayLeadCount=10)", () => {
    const strategy = new SmartAssignStrategy();
    const atQuota = makeSalesHuman({ name: "AtQuota", maxLeadsPerDay: 10, todayLeadCount: 10 });
    const underQuota = makeSalesHuman({
      name: "UnderQuota",
      maxLeadsPerDay: 10,
      todayLeadCount: 9,
    });
    const selection = unwrap(strategy.select(BranchId.BINTARO, [atQuota, underQuota]));
    expect(selection.kind).toBe("ASSIGNED");
    if (selection.kind === "ASSIGNED") {
      expect(selection.salesHuman.name).toBe("UnderQuota");
    }
  });

  it("all unavailable -> NoAvailableSalesError", () => {
    const strategy = new SmartAssignStrategy();
    const off = makeSalesHuman({ name: "Off", status: SalesStatus.OFF });
    const atQuota = makeSalesHuman({ name: "AtQuota", maxLeadsPerDay: 10, todayLeadCount: 10 });
    const error = unwrapErr(strategy.select(BranchId.BINTARO, [off, atQuota]));
    expect(error.message).toContain("No available sales human");
  });

  it("empty sales list -> NoAvailableSalesError", () => {
    const strategy = new SmartAssignStrategy();
    expect(unwrapErr(strategy.select(BranchId.BINTARO, [])).message).toContain(
      "No available sales human",
    );
  });

  it("tie-break: equal activeLeadCount -> earliest joinedAt wins", () => {
    const strategy = new SmartAssignStrategy();
    const later = makeSalesHuman({
      name: "Later",
      activeLeadCount: 2,
      joinedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    const earlier = makeSalesHuman({
      name: "Earlier",
      activeLeadCount: 2,
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const selection = unwrap(strategy.select(BranchId.BINTARO, [later, earlier]));
    expect(selection.kind).toBe("ASSIGNED");
    if (selection.kind === "ASSIGNED") {
      expect(selection.salesHuman.name).toBe("Earlier");
    }
  });

  it("tie-break is order-independent (earlier listed second still wins)", () => {
    const strategy = new SmartAssignStrategy();
    const earlier = makeSalesHuman({
      name: "Earlier",
      activeLeadCount: 2,
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const later = makeSalesHuman({
      name: "Later",
      activeLeadCount: 2,
      joinedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    const selection = unwrap(strategy.select(BranchId.BINTARO, [earlier, later]));
    expect(selection.kind).toBe("ASSIGNED");
    if (selection.kind === "ASSIGNED") {
      expect(selection.salesHuman.name).toBe("Earlier");
    }
  });
});
