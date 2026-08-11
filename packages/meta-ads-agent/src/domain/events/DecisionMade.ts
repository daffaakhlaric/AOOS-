/** Payload for `aaos.tamara.decision.made`, emitted once per `CampaignDecision` produced by the DECIDE stage. */
export interface DecisionMade {
  readonly tenantId: string;
  readonly decisionId: string;
  readonly targetId: string;
  readonly targetType: string;
  readonly actionKind: string;
  readonly decisionType: string;
  readonly confidence: number;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
