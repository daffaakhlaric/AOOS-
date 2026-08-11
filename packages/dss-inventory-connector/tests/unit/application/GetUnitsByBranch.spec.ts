import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { InventoryQueryService } from "../../../src/application/services/InventoryQueryService.js";
import { GetUnitsByBranch } from "../../../src/application/use-cases/GetUnitsByBranch.js";
import { InventoryUnitBuilder } from "../../../src/builders/InventoryUnitBuilder.js";
import { InMemoryInventoryStore } from "../../../src/infrastructure/store/InMemoryInventoryStore.js";
import { unwrap } from "../../helpers/result.js";

describe("GetUnitsByBranch", () => {
  it("returns units for the given branch", () => {
    const store = new InMemoryInventoryStore();
    store.upsert(unwrap(new InventoryUnitBuilder().withBranch(Branch.BANDUNG).build()));
    const useCase = new GetUnitsByBranch(new InventoryQueryService(store));
    expect(useCase.execute(Branch.BANDUNG)).toHaveLength(1);
    expect(useCase.execute(Branch.BINTARO)).toHaveLength(0);
  });
});
