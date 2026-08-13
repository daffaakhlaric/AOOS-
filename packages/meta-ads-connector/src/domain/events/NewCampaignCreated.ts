/**
 * Payload for the `aaos.meta.campaign.created` event, emitted after `CreateCampaign` (AAOS-W1D-S3)
 * successfully creates a new campaign + adset pair, always `OUTCOME_LEADS` + CTWA WhatsApp
 * (per DSS Motor's real strategy — see `CreateCampaign.ts`).
 */
export interface NewCampaignCreated {
  readonly campaignId: string;
  readonly adSetId: string;
  readonly adAccountId: string;
  readonly name: string;
  readonly branch: string;
  readonly funnel: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
