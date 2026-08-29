/** Payload for `aaos.samantha.decision.escalated`, emitted when a `CampaignDecision` is queued for human approval. */
export interface DecisionEscalated {
  readonly tenantId: string;
  readonly decisionId: string;
  readonly escalationId: string;
  readonly targetId: string;
  readonly reason: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
