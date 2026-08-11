import type { Result } from "@aos/common";

import type { ISalesTeamRegistry } from "../../contracts/ISalesTeamRegistry.js";
import type { SalesHumanNotFoundError } from "../../domain/errors/index.js";
import type { SalesHumanId } from "../../domain/value-objects/SalesHumanId.js";

export interface RemoveSalesHumanInput {
  readonly salesHumanId: SalesHumanId;
}

/** Removes a sales human from their branch's team. */
export class RemoveSalesHuman {
  constructor(private readonly salesTeamRegistry: ISalesTeamRegistry) {}

  execute(input: RemoveSalesHumanInput): Result<void, SalesHumanNotFoundError> {
    return this.salesTeamRegistry.remove(input.salesHumanId);
  }
}
