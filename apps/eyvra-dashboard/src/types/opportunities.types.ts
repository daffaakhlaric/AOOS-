/**
 * EYVRA — SAMANTHA V2 + KAI V2 Phase 13. Client-safe DTO shapes for
 * `GET /api/v1/opportunities/:campaignId` — mirrors `apps/aaos-api`'s `OpportunitiesResponseDto`/
 * `Opportunity` field-for-field (Phase 9's Opportunity Engine). Hand-written, not imported from
 * `apps/aaos-api`, same "never pull a Node-only runtime value into a `\"use client\"` bundle"
 * discipline `campaign-health.types.ts`'s own header doc establishes.
 */

export type OpportunityTypeDto = "SCALING_OPPORTUNITY" | "CREATIVE_WINNER_EXPANSION";

export interface OpportunityDto {
  readonly type: OpportunityTypeDto;
  /** `0`-`1`. */
  readonly confidence: number;
  /** Indonesian, human-readable — references the real campaign/angle this opportunity is about. */
  readonly description: string;
  /** Indonesian, references real numbers (CPL, confidence %, etc) — never vague language. */
  readonly evidence: string;
}

/**
 * `GET /api/v1/opportunities/:campaignId` response — a pass-through of the real
 * `OpportunitiesResponseDto`, plus the real `campaignId` echoed back.
 */
export interface OpportunitiesResponseDto {
  readonly campaignId: string;
  readonly opportunities: readonly OpportunityDto[];
}
