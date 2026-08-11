import { err, ErrorCode, ok, type Result } from "@aos/common";
import type { IInventoryQueryService, InventoryUnit } from "@aos/dss-inventory-connector";

import type { FindForLeadCriteria, IInventoryQuerier } from "../contracts/IInventoryQuerier.js";
import { AgentError } from "../domain/errors/AgentError.js";
import { toBranch } from "../domain/value-objects/BranchId.js";

import { UnitMatcher } from "./UnitMatcher.js";

/**
 * Queries `@aos/dss-inventory-connector` for units matching a lead's criteria (spec "Inventory
 * Query Integration"). Only ever surfaces units the connector itself classifies as `AVAILABLE`
 * (design resolution #2): `IInventoryQueryService.getAvailableByBranch` already excludes
 * RESERVED/SOLD units before `UnitMatcher` narrows further by model/price/transmission — so a
 * cheaper-but-RESERVED unit in the same branch never leaks into a match.
 */
export class InventoryQuerier implements IInventoryQuerier {
  constructor(private readonly queryService: IInventoryQueryService) {}

  findForLead(criteria: FindForLeadCriteria): Promise<Result<InventoryUnit[], AgentError>> {
    try {
      const available = this.queryService.getAvailableByBranch(toBranch(criteria.branch));
      const matched = UnitMatcher.match(available, criteria);
      return Promise.resolve(ok(matched));
    } catch (cause) {
      return Promise.resolve(
        err(new AgentError(ErrorCode.INTERNAL, "InventoryQuerier.findForLead failed", { cause })),
      );
    }
  }

  /**
   * When the lead's own branch has no match, look across ALL available units (any branch) for
   * the same model/price/transmission criteria — the data behind the "stok kosong di sini, tapi
   * ada di [branch] lain" suggestion (spec: "Not found → suggest nearest branch").
   */
  findAlternative(
    criteria: Pick<FindForLeadCriteria, "model" | "maxPrice" | "transmission">,
  ): InventoryUnit[] {
    const available = this.queryService.getAvailable();
    return UnitMatcher.match(available, criteria);
  }
}
