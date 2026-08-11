import type { LeadStatus } from "../value-objects/LeadStatus.js";

/** Payload for `aaos.lead-store.lead.status-changed`, emitted whenever `UpdateLeadStatus` successfully transitions a lead's status. */
export interface LeadStatusChanged {
  readonly leadId: string;
  readonly branchId: string;
  readonly fromStatus: LeadStatus;
  readonly toStatus: LeadStatus;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
