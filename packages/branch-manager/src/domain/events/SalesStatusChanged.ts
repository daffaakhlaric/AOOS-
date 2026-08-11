import type { BranchId } from "../value-objects/BranchId.js";
import type { SalesStatus } from "../value-objects/SalesStatus.js";

/** Payload for `aaos.branch.sales.status-changed`, emitted whenever `AvailabilityService.updateStatus` transitions a sales human's status. */
export interface SalesStatusChanged {
  readonly salesHumanId: string;
  readonly branchId: BranchId;
  readonly previousStatus: SalesStatus;
  readonly newStatus: SalesStatus;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
