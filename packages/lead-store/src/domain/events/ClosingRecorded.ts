/** Payload for `aaos.lead-store.closing.recorded`, emitted whenever `RecordClosing` persists a closing — Samantha (`@aos/meta-ads-agent`) listens to compute Rp/SPK per campaign feed-back. */
export interface ClosingRecorded {
  readonly closingId: string;
  readonly leadId: string;
  readonly branchId: string;
  readonly closingType: string;
  readonly campaignId?: string;
  readonly adId?: string;
  readonly commissionIdr?: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
