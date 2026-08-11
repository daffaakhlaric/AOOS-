import { describe, expect, it } from "vitest";

import { AddSalesHuman } from "../../../src/application/use-cases/AddSalesHuman.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { BranchRegistry } from "../../../src/registry/BranchRegistry.js";
import { SalesTeamRegistry } from "../../../src/registry/SalesTeamRegistry.js";
import { makeBranchConfig } from "../../fixtures/branchManagerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("AddSalesHuman", () => {
  it("registers a new sales human when the branch exists", () => {
    const branchRegistry = new BranchRegistry([makeBranchConfig({ id: BranchId.BINTARO })]);
    const salesTeamRegistry = new SalesTeamRegistry();
    const useCase = new AddSalesHuman(branchRegistry, salesTeamRegistry);

    const sales = unwrap(
      useCase.execute({ name: "Budi", waNumber: "+628120000001", branchId: BranchId.BINTARO }),
    );
    expect(sales.name).toBe("Budi");
    expect(salesTeamRegistry.getByBranch(BranchId.BINTARO)).toHaveLength(1);
  });

  it("applies optional overrides (status/maxLeadsPerDay/joinedAt)", () => {
    const branchRegistry = new BranchRegistry([makeBranchConfig({ id: BranchId.BINTARO })]);
    const salesTeamRegistry = new SalesTeamRegistry();
    const useCase = new AddSalesHuman(branchRegistry, salesTeamRegistry);
    const joinedAt = new Date("2025-01-01T00:00:00.000Z");

    const sales = unwrap(
      useCase.execute({
        name: "Sari",
        waNumber: "+628130000002",
        branchId: BranchId.BINTARO,
        status: SalesStatus.BUSY,
        maxLeadsPerDay: 20,
        joinedAt,
      }),
    );
    expect(sales.status).toBe(SalesStatus.BUSY);
    expect(sales.maxLeadsPerDay.toNumber()).toBe(20);
    expect(sales.joinedAt).toBe(joinedAt);
  });

  it("fails with BranchNotFoundError for an unregistered branch", () => {
    const branchRegistry = new BranchRegistry([]);
    const salesTeamRegistry = new SalesTeamRegistry();
    const useCase = new AddSalesHuman(branchRegistry, salesTeamRegistry);

    const error = unwrapErr(
      useCase.execute({ name: "Budi", waNumber: "+628120000001", branchId: BranchId.BINTARO }),
    );
    expect(error.message).toContain("No branch registered");
  });

  it("propagates a validation failure (empty name)", () => {
    const branchRegistry = new BranchRegistry([makeBranchConfig({ id: BranchId.BINTARO })]);
    const salesTeamRegistry = new SalesTeamRegistry();
    const useCase = new AddSalesHuman(branchRegistry, salesTeamRegistry);

    const error = unwrapErr(
      useCase.execute({ name: "", waNumber: "+628120000001", branchId: BranchId.BINTARO }),
    );
    expect(error.message).toContain("name must be");
  });
});
