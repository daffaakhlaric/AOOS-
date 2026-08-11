/** Payload for the `aaos.meta.sync.completed` event, emitted after `PullCampaignData` succeeds. */
export interface SyncCompleted {
  readonly adAccountId: string;
  readonly campaignCount: number;
  readonly adSetCount: number;
  readonly adCount: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
