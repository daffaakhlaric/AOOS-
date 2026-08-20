import type { PropertyScoringCriterion } from "../value-objects/PropertyScoreDelta.js";

/**
 * Payload for `aaos.sales.property-lead.score-updated`, emitted every time
 * `PropertyLeadScoringService` applies a `PropertyScoreDelta` — the sibling to `LeadScoreUpdated`
 * (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8, spec section 12 point 2). A real, additive event
 * (not a retrofit of `LeadScoreUpdated`) since `criterion: PropertyScoringCriterion` is a genuinely
 * different union from `ScoringCriterion` (confirmed via direct read of `PropertyScoreDelta.ts`'s
 * own docstring).
 */
export interface PropertyLeadScoreUpdated {
  readonly conversationId: string;
  readonly leadPhone: string;
  readonly criterion: PropertyScoringCriterion;
  readonly delta: number;
  readonly previousScore: number;
  readonly newScore: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
