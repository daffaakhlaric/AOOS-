import { describe, expect, it } from "vitest";

import { InventoryQueryService } from "../../../src/application/services/InventoryQueryService.js";
import { GetUnitsByModel } from "../../../src/application/use-cases/GetUnitsByModel.js";
import { InventoryUnitBuilder } from "../../../src/builders/InventoryUnitBuilder.js";
import { InMemoryInventoryStore } from "../../../src/infrastructure/store/InMemoryInventoryStore.js";
import { unwrap } from "../../helpers/result.js";

describe("GetUnitsByModel", () => {
  it("fuzzy-matches model names", () => {
    const store = new InMemoryInventoryStore();
    store.upsert(unwrap(new InventoryUnitBuilder().withModel("Xpander Cross").build()));
    const useCase = new GetUnitsByModel(new InventoryQueryService(store));
    expect(useCase.execute("xpander")).toHaveLength(1);
    expect(useCase.execute("avanza")).toHaveLength(0);
  });
});
