import type { Result } from "@aos/common";

import type { InventoryUnit } from "../../domain/entities/InventoryUnit.js";
import type { UnitNotFoundError } from "../../domain/errors/index.js";
import type { UnitId } from "../../domain/value-objects/UnitId.js";
import type { InventoryQueryService } from "../services/InventoryQueryService.js";

export class GetUnit {
  constructor(private readonly queryService: InventoryQueryService) {}

  execute(id: UnitId): Result<InventoryUnit, UnitNotFoundError> {
    return this.queryService.getById(id);
  }
}
