import { describe, expect, it } from "vitest";

import { RemoveSalesHuman } from "../../../src/application/use-cases/RemoveSalesHuman.js";
import { SalesHumanId } from "../../../src/domain/value-objects/SalesHumanId.js";
import { SalesTeamRegistry } from "../../../src/registry/SalesTeamRegistry.js";
import { makeSalesHuman } from "../../fixtures/branchManagerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("RemoveSalesHuman", () => {
  it("removes an existing sales human", () => {
    const registry = new SalesTeamRegistry();
    const a = makeSalesHuman({ name: "A" });
    registry.add(a);
    const useCase = new RemoveSalesHuman(registry);
    unwrap(useCase.execute({ salesHumanId: a.id }));
    expect(registry.getById(a.id).ok).toBe(false);
  });

  it("fails with SalesHumanNotFoundError for an unregistered id", () => {
    const registry = new SalesTeamRegistry();
    const useCase = new RemoveSalesHuman(registry);
    expect(unwrapErr(useCase.execute({ salesHumanId: SalesHumanId.generate() })).message).toContain(
      "No sales human registered",
    );
  });
});
