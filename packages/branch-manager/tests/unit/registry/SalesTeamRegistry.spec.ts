import { describe, expect, it } from "vitest";

import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { SalesHumanId } from "../../../src/domain/value-objects/SalesHumanId.js";
import { SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { SalesTeamRegistry } from "../../../src/registry/SalesTeamRegistry.js";
import { makeSalesHuman } from "../../fixtures/branchManagerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("SalesTeamRegistry", () => {
  it("add + getByBranch returns the correct team", () => {
    const registry = new SalesTeamRegistry();
    const a = makeSalesHuman({ name: "A", branchId: BranchId.BINTARO });
    const b = makeSalesHuman({ name: "B", branchId: BranchId.BINTARO });
    const c = makeSalesHuman({ name: "C", branchId: BranchId.CINERE });
    registry.add(a);
    registry.add(b);
    registry.add(c);

    const team = registry.getByBranch(BranchId.BINTARO);
    expect(team.map((s) => s.name).sort()).toEqual(["A", "B"]);
    expect(registry.getByBranch(BranchId.CINERE)).toHaveLength(1);
  });

  it("remove — no longer in team", () => {
    const registry = new SalesTeamRegistry();
    const a = makeSalesHuman({ name: "A", branchId: BranchId.BINTARO });
    registry.add(a);
    unwrap(registry.remove(a.id));
    expect(registry.getByBranch(BranchId.BINTARO)).toHaveLength(0);
  });

  it("remove fails with SalesHumanNotFoundError for an unregistered id", () => {
    const registry = new SalesTeamRegistry();
    expect(unwrapErr(registry.remove(SalesHumanId.generate())).message).toContain(
      "No sales human registered",
    );
  });

  it("getById returns the matching sales human", () => {
    const registry = new SalesTeamRegistry();
    const a = makeSalesHuman({ name: "A" });
    registry.add(a);
    expect(unwrap(registry.getById(a.id)).name).toBe("A");
  });

  it("getById fails with SalesHumanNotFoundError for an unregistered id", () => {
    const registry = new SalesTeamRegistry();
    expect(unwrapErr(registry.getById(SalesHumanId.generate())).message).toContain(
      "No sales human registered",
    );
  });

  describe("getAvailable", () => {
    it("returns only ON + quota-remaining sales", () => {
      const registry = new SalesTeamRegistry();
      const onAvailable = makeSalesHuman({
        name: "On",
        branchId: BranchId.BINTARO,
        status: SalesStatus.ON,
      });
      const busy = makeSalesHuman({
        name: "Busy",
        branchId: BranchId.BINTARO,
        status: SalesStatus.BUSY,
      });
      const off = makeSalesHuman({
        name: "Off",
        branchId: BranchId.BINTARO,
        status: SalesStatus.OFF,
      });
      const atQuota = makeSalesHuman({
        name: "AtQuota",
        branchId: BranchId.BINTARO,
        status: SalesStatus.ON,
        maxLeadsPerDay: 10,
        todayLeadCount: 10,
      });
      registry.add(onAvailable);
      registry.add(busy);
      registry.add(off);
      registry.add(atQuota);

      const available = registry.getAvailable(BranchId.BINTARO);
      expect(available.map((s) => s.name)).toEqual(["On"]);
    });
  });

  it("getAll returns every registered sales human", () => {
    const registry = new SalesTeamRegistry();
    registry.add(makeSalesHuman({ name: "A" }));
    registry.add(makeSalesHuman({ name: "B" }));
    expect(registry.getAll()).toHaveLength(2);
  });

  describe("update", () => {
    it("replaces an existing sales human", () => {
      const registry = new SalesTeamRegistry();
      const a = makeSalesHuman({ name: "A", status: SalesStatus.ON });
      registry.add(a);
      const updated = a.withStatus(SalesStatus.OFF, new Date());
      const result = unwrap(registry.update(updated));
      expect(result.status).toBe(SalesStatus.OFF);
      expect(unwrap(registry.getById(a.id)).status).toBe(SalesStatus.OFF);
    });

    it("fails with SalesHumanNotFoundError for an unregistered id", () => {
      const registry = new SalesTeamRegistry();
      const a = makeSalesHuman({ name: "A" });
      expect(unwrapErr(registry.update(a)).message).toContain("No sales human registered");
    });
  });
});
