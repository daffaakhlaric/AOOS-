import type { Result } from "@aos/common";
import type { InventoryUnit } from "@aos/dss-inventory-connector";

import type { AgentError } from "../domain/errors/AgentError.js";
import type { BranchId } from "../domain/value-objects/BranchId.js";

export interface FindForLeadCriteria {
  readonly model?: string;
  readonly branch: BranchId;
  readonly maxPrice?: number;
  readonly transmission?: "AT" | "MT";
}

/**
 * Port: queries `@aos/dss-inventory-connector` for units matching a lead's stated criteria.
 *
 * Design resolution (spec ambiguity #1): the spec's own literal signature reads
 * `Promise<InventoryUnit[]>`, but the package's architecture rule ("All use cases return
 * `Result<T, E>`") applies here too — wrapped as `Promise<Result<InventoryUnit[], AgentError>>`.
 * An empty match is still `ok([])`; only a real underlying query failure becomes `err(...)`.
 */
export interface IInventoryQuerier {
  findForLead(criteria: FindForLeadCriteria): Promise<Result<InventoryUnit[], AgentError>>;
}
