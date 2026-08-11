/** Payload for `aaos.lead-store.lead.created`, emitted whenever `CreateLead` actually inserts a new row (never on the idempotent-return path — design resolution #5). */
export interface LeadCreated {
  readonly leadId: string;
  readonly leadPhone: string;
  readonly branchId: string;
  readonly leadSource: string;
  readonly campaignId?: string;
  readonly adId?: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
