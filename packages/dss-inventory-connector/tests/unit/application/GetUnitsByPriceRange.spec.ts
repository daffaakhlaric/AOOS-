import { describe, expect, it } from "vitest";

import { InventoryQueryService } from "../../../src/application/services/InventoryQueryService.js";
import { GetUnitsByPriceRange } from "../../../src/application/use-cases/GetUnitsByPriceRange.js";
import { InventoryUnitBuilder } from "../../../src/builders/InventoryUnitBuilder.js";
import { InMemoryInventoryStore } from "../../../src/infrastructure/store/InMemoryInventoryStore.js";
import { unwrap } from "../../helpers/result.js";

describe("GetUnitsByPriceRange", () => {
  it("returns units within [min, max]", () => {
    const store = new InMemoryInventoryStore();
    store.upsert(unwrap(new InventoryUnitBuilder().withPrice(100_000_000).build()));
    store.upsert(unwrap(new InventoryUnitBuilder().withPrice(300_000_000).build()));
    const useCase = new GetUnitsByPriceRange(new InventoryQueryService(store));
    expect(useCase.execute(50_000_000, 200_000_000)).toHaveLength(1);
  });
});
