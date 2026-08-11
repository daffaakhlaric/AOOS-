import type { LeadType } from "../value-objects/LeadType.js";
import type { PublisherPlatform } from "../value-objects/PublisherPlatform.js";

/** Payload for the `aaos.meta.lead.received` event, emitted once per Lead by `ProcessLeadWebhook`. */
export interface LeadReceived {
  readonly leadId: string;
  readonly adId: string;
  readonly adSetId: string;
  readonly campaignId: string;
  readonly adAccountId: string;
  readonly type: LeadType;
  readonly source: PublisherPlatform;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
