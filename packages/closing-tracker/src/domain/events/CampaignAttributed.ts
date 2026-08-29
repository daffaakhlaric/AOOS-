/** Payload for `aaos.closing-tracker.campaign.attributed`, emitted per campaign when `FeedToSamantha` produces a `SamanthaFeedData` signal — one event per `campaignSignals` entry. */
export interface CampaignAttributed {
  readonly campaignId: string;
  readonly branch: string;
  readonly method: "DIRECT" | "TIME_BASED" | "BRANCH_BASED";
  readonly confidence: number;
  readonly rphSpk: number;
  readonly verdict: "SCALE" | "KEEP" | "PAUSE";
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
