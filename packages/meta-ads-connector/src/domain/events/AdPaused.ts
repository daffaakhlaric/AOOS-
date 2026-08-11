/** Payload for the `aaos.meta.ad.paused` event, emitted after `ExecuteVerdict` successfully pauses an ad. */
export interface AdPaused {
  readonly adId: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
