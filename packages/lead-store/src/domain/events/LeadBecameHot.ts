/** Payload for `aaos.lead-store.lead.became-hot`, emitted the first time (only) a lead's score crosses the hot threshold (spec pin: `score>=65`) while still `NEW | COLD | WARM | HOT` — design resolution #2. */
export interface LeadBecameHot {
  readonly leadId: string;
  readonly branchId: string;
  readonly score: number;
  readonly becameHotAt: Date;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
