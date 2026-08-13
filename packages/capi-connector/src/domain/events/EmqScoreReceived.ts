/** Payload for `aaos.capi-connector.emq.received`, published after `GetEmqScore` fetches a fresh Event Match Quality report from Meta. */
export interface EmqScoreReceived {
  readonly pixelId: string;
  readonly score: number;
  readonly eventsReceived: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
