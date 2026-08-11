import type { ScoringCriterion } from "../value-objects/ScoreDelta.js";

/** Payload for `aaos.sales.lead.score-updated`, emitted every time `LeadScoringService` applies a delta. */
export interface LeadScoreUpdated {
  readonly conversationId: string;
  readonly leadPhone: string;
  readonly criterion: ScoringCriterion;
  readonly delta: number;
  readonly previousScore: number;
  readonly newScore: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
