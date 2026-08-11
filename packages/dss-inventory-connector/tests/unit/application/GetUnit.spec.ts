import { describe, expect, it } from "vitest";

import { InventoryQueryService } from "../../../src/application/services/InventoryQueryService.js";
import { GetUnit } from "../../../src/application/use-cases/GetUnit.js";
import { InventoryUnitBuilder } from "../../../src/builders/InventoryUnitBuilder.js";
import { UnitId } from "../../../src/domain/value-objects/UnitId.js";
import { InMemoryInventoryStore } from "../../../src/infrastructure/store/InMemoryInventoryStore.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("GetUnit", () => {
  it("returns the unit for a known id", () => {
    const store = new InMemoryInventoryStore();
    const unit = unwrap(new InventoryUnitBuilder().build());
    store.upsert(unit);
    const useCase = new GetUnit(new InventoryQueryService(store));
    expect(unwrap(useCase.execute(unit.id))).toBe(unit);
  });

  it("returns UnitNotFoundError for an unknown id", () => {
    const store = new InMemoryInventoryStore();
    const useCase = new GetUnit(new InventoryQueryService(store));
    expect(unwrapErr(useCase.execute(UnitId.generate())).message).toContain(
      "No InventoryUnit found",
    );
  });
});
