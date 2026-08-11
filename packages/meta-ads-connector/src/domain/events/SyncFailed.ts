/** Payload for the `aaos.meta.sync.failed` event, emitted when `PullCampaignData` fails. */
export interface SyncFailed {
  readonly adAccountId: string;
  readonly reason: string;
  readonly errorCode: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
