import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { InventoryQueryService } from "../../../src/application/services/InventoryQueryService.js";
import { QueryInventory } from "../../../src/application/use-cases/QueryInventory.js";
import { InventoryUnitBuilder } from "../../../src/builders/InventoryUnitBuilder.js";
import { InMemoryInventoryStore } from "../../../src/infrastructure/store/InMemoryInventoryStore.js";
import { unwrap } from "../../helpers/result.js";

describe("QueryInventory", () => {
  it("delegates to InventoryQueryService.getByCriteria()", () => {
    const store = new InMemoryInventoryStore();
    store.upsert(unwrap(new InventoryUnitBuilder().withBranch(Branch.BINTARO).build()));
    store.upsert(unwrap(new InventoryUnitBuilder().withBranch(Branch.CINERE).build()));
    const useCase = new QueryInventory(new InventoryQueryService(store));

    expect(useCase.execute({ branch: Branch.BINTARO })).toHaveLength(1);
  });

  it("defaults to an empty criteria object, returning everything", () => {
    const store = new InMemoryInventoryStore();
    store.upsert(unwrap(new InventoryUnitBuilder().build()));
    const useCase = new QueryInventory(new InventoryQueryService(store));
    expect(useCase.execute()).toHaveLength(1);
  });
});
