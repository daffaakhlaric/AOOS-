import type { BranchId } from "../value-objects/BranchId.js";

/** Payload for `aaos.sales.lead.became-hot`, emitted the moment a lead's score crosses `hotThreshold` (default 65). */
export interface LeadBecameHot {
  readonly conversationId: string;
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly score: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
