import { describe, expect, it } from "vitest";

import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { RoundRobinStrategy } from "../../../src/intelligence/RoundRobinStrategy.js";
import { makeSalesHuman } from "../../fixtures/branchManagerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("RoundRobinStrategy", () => {
  it("rotates correctly through available sales and wraps (pinned round_robin: [A,B,C] x4 -> A,B,C,A)", () => {
    const strategy = new RoundRobinStrategy();
    const a = makeSalesHuman({ name: "A" });
    const b = makeSalesHuman({ name: "B" });
    const c = makeSalesHuman({ name: "C" });
    const sales = [a, b, c];

    const names: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const selection = unwrap(strategy.select(BranchId.BINTARO, sales));
      if (selection.kind === "ASSIGNED") {
        names.push(selection.salesHuman.name);
      }
    }
    expect(names).toEqual(["A", "B", "C", "A"]);
  });

  it("skips unavailable sales, continues rotation", () => {
    const strategy = new RoundRobinStrategy();
    const a = makeSalesHuman({ name: "A" });
    const b = makeSalesHuman({ name: "B", status: SalesStatus.OFF });
    const c = makeSalesHuman({ name: "C" });
    const sales = [a, b, c];

    const first = unwrap(strategy.select(BranchId.BINTARO, sales));
    const second = unwrap(strategy.select(BranchId.BINTARO, sales));
    const third = unwrap(strategy.select(BranchId.BINTARO, sales));

    expect(first.kind === "ASSIGNED" && first.salesHuman.name).toBe("A");
    expect(second.kind === "ASSIGNED" && second.salesHuman.name).toBe("C");
    expect(third.kind === "ASSIGNED" && third.salesHuman.name).toBe("A");
  });

  it("tracks lastAssignedIndex independently per branch", () => {
    const strategy = new RoundRobinStrategy();
    const bintaroSales = [makeSalesHuman({ name: "A" }), makeSalesHuman({ name: "B" })];
    const cinereSales = [makeSalesHuman({ name: "X" }), makeSalesHuman({ name: "Y" })];

    const bintaro1 = unwrap(strategy.select(BranchId.BINTARO, bintaroSales));
    const cinere1 = unwrap(strategy.select(BranchId.CINERE, cinereSales));
    const bintaro2 = unwrap(strategy.select(BranchId.BINTARO, bintaroSales));

    expect(bintaro1.kind === "ASSIGNED" && bintaro1.salesHuman.name).toBe("A");
    expect(cinere1.kind === "ASSIGNED" && cinere1.salesHuman.name).toBe("X");
    expect(bintaro2.kind === "ASSIGNED" && bintaro2.salesHuman.name).toBe("B");
  });

  it("all unavailable -> NoAvailableSalesError", () => {
    const strategy = new RoundRobinStrategy();
    const off = makeSalesHuman({ name: "Off", status: SalesStatus.OFF });
    expect(unwrapErr(strategy.select(BranchId.BINTARO, [off])).message).toContain(
      "No available sales human",
    );
  });

  it("empty sales list -> NoAvailableSalesError", () => {
    const strategy = new RoundRobinStrategy();
    expect(unwrapErr(strategy.select(BranchId.BINTARO, [])).message).toContain(
      "No available sales human",
    );
  });
});
