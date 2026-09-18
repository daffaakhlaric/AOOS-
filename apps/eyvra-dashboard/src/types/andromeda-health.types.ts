/**
 * Client-safe DTO shapes for Samantha Andromeda-Aware Campaign System, Sprint 2 — mirrors
 * `apps/aaos-api`'s `AndromedaHealthResponseDto`/`DiverseCreativeBriefSetResultDto` field-for-field.
 * Hand-written, not imported from `apps/aaos-api`, same "never pull a Node-only runtime value into a
 * `\"use client\"` bundle" discipline `pending-actions.types.ts`'s own header doc establishes.
 */

export type CreativeDiversityStatusDto = "NOT_ENOUGH_DATA" | "LOW_DIVERSITY" | "DIVERSE";

export interface AndromedaHealthDto {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly adSetCount: number;
  readonly diversity: {
    readonly status: CreativeDiversityStatusDto;
    readonly totalAdCount: number;
    readonly distinctCreativeAssetCount?: number;
    readonly reasoning: string;
  };
  readonly evaluation: {
    readonly triggered: boolean;
    readonly reason?: string;
  };
}

/**
 * EYVRA — SAMANTHA V2 + KAI V2 Phase 23 — mirrors `apps/aaos-api`'s `SamanthaCreativeContextDto`
 * field-for-field. Built by `CampaignHealthCard.tsx`'s `handleBriefKai` from its own already-fetched
 * `CampaignDiagnosisDto`/`SamanthaDecisionDto` (see that component's own doc), never a second fetch.
 */
export interface SamanthaCreativeContextDto {
  readonly rootCause: string | null;
  readonly impact: string;
  readonly contributingFactors: readonly string[];
  readonly decisionReason: string;
}

export interface DiverseCreativeBriefSetResultDto {
  readonly requestedCount: number;
  readonly allowedCount: number;
  readonly cappedByDailyLimit: boolean;
  readonly createdCount: number;
  readonly packages: readonly { readonly id: string; readonly angle: string }[];
  readonly skippedReason?: string;
}
