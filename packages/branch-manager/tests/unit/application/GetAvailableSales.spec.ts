import { describe, expect, it } from "vitest";

import { GetAvailableSales } from "../../../src/application/use-cases/GetAvailableSales.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { SalesTeamRegistry } from "../../../src/registry/SalesTeamRegistry.js";
import { makeSalesHuman } from "../../fixtures/branchManagerFixtures.js";
import { unwrap } from "../../helpers/result.js";

describe("GetAvailableSales", () => {
  it("returns only ON + under-quota sales for the branch", () => {
    const registry = new SalesTeamRegistry();
    registry.add(
      makeSalesHuman({ name: "On", branchId: BranchId.BINTARO, status: SalesStatus.ON }),
    );
    registry.add(
      makeSalesHuman({ name: "Off", branchId: BranchId.BINTARO, status: SalesStatus.OFF }),
    );
    const useCase = new GetAvailableSales(registry);
    const result = unwrap(useCase.execute({ branchId: BranchId.BINTARO }));
    expect(result.map((s) => s.name)).toEqual(["On"]);
  });

  it("returns an empty list for a branch with no sales", () => {
    const registry = new SalesTeamRegistry();
    const useCase = new GetAvailableSales(registry);
    expect(unwrap(useCase.execute({ branchId: BranchId.BANDUNG }))).toEqual([]);
  });
});
