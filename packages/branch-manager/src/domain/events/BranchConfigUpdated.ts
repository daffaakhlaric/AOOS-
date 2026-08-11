import type { AssignmentMode } from "../value-objects/AssignmentMode.js";
import type { BranchId } from "../value-objects/BranchId.js";

/** Payload for `aaos.branch.config.updated`, emitted whenever `BranchRegistry.update` replaces a branch's configuration. */
export interface BranchConfigUpdated {
  readonly branchId: BranchId;
  readonly assignmentMode: AssignmentMode;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
