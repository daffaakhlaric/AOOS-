import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { InventoryQueryService } from "../../../src/application/services/InventoryQueryService.js";
import { GetAvailableUnits } from "../../../src/application/use-cases/GetAvailableUnits.js";
import { InventoryUnitBuilder } from "../../../src/builders/InventoryUnitBuilder.js";
import { UnitStatus } from "../../../src/domain/value-objects/UnitStatus.js";
import { InMemoryInventoryStore } from "../../../src/infrastructure/store/InMemoryInventoryStore.js";
import { unwrap } from "../../helpers/result.js";

describe("GetAvailableUnits", () => {
  it("without a branch returns every AVAILABLE unit", () => {
    const store = new InMemoryInventoryStore();
    store.upsert(unwrap(new InventoryUnitBuilder().withStatus(UnitStatus.AVAILABLE).build()));
    store.upsert(unwrap(new InventoryUnitBuilder().withStatus(UnitStatus.SOLD).build()));
    const useCase = new GetAvailableUnits(new InventoryQueryService(store));
    expect(useCase.execute()).toHaveLength(1);
  });

  it("with a branch scopes to AVAILABLE units in that branch", () => {
    const store = new InMemoryInventoryStore();
    store.upsert(
      unwrap(
        new InventoryUnitBuilder()
          .withBranch(Branch.BINTARO)
          .withStatus(UnitStatus.AVAILABLE)
          .build(),
      ),
    );
    store.upsert(
      unwrap(
        new InventoryUnitBuilder()
          .withBranch(Branch.CINERE)
          .withStatus(UnitStatus.AVAILABLE)
          .build(),
      ),
    );
    const useCase = new GetAvailableUnits(new InventoryQueryService(store));
    expect(useCase.execute(Branch.BINTARO)).toHaveLength(1);
  });
});
