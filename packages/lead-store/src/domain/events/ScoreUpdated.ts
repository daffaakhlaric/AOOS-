/** Payload for `aaos.lead-store.lead.score-updated`, emitted whenever `RecordScoreEvent` persists a scoring event. */
export interface ScoreUpdated {
  readonly leadId: string;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly delta: number;
  readonly reason: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
