import type { BranchId } from "../value-objects/BranchId.js";

/** Payload for `aaos.sales.handoff.triggered`, emitted after `HandoffService` successfully hands a HOT lead to `@aos/branch-manager`. */
export interface HandoffTriggered {
  readonly conversationId: string;
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly score: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
