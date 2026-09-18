/**
 * EYVRA — SAMANTHA V2 Phase 12. Client-safe DTO shapes for `GET /api/v1/campaign-health/:campaignId`
 * — mirrors `apps/aaos-api`'s `CampaignHealthResponseDto`/`CampaignHealth`/`CampaignDiagnosis`/
 * `SamanthaDecision` field-for-field. Hand-written, not imported from `apps/aaos-api`, same "never
 * pull a Node-only runtime value into a `\"use client\"` bundle" discipline `andromeda-health.types.ts`'s
 * own header doc establishes.
 */

export type HealthStatusDto = "HEALTHY" | "WATCH" | "WARNING" | "CRITICAL" | "UNKNOWN";

export interface HealthDimensionDto {
  readonly status: HealthStatusDto;
  /** `0`-`100` — omitted (not present) when `status` is `"UNKNOWN"`. Never a fabricated number standing in for "we don't know". */
  readonly score?: number;
  /** `0`-`1`. `0` when `status` is `"UNKNOWN"`. */
  readonly confidence: number;
  /** Indonesian, specific — empty when `status` is `"HEALTHY"`. */
  readonly issues: readonly string[];
}

export interface CampaignHealthDto {
  readonly delivery: HealthDimensionDto;
  readonly costEfficiency: HealthDimensionDto;
  readonly creative: HealthDimensionDto;
  readonly audience: HealthDimensionDto;
  readonly conversion: HealthDimensionDto;
  readonly tracking: HealthDimensionDto;
  readonly leadQuality: HealthDimensionDto;
  readonly overallStatus: HealthStatusDto;
}

export type DiagnosisImpactDto = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";

export interface SamanthaSignalDto {
  readonly type: string;
  readonly severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  /** `0`-`1`. */
  readonly confidence: number;
  /** Indonesian, real reasoning string for this signal. */
  readonly reasoning: string;
}

export interface CampaignDiagnosisDto {
  /** The `SamanthaSignalType` of the highest-severity real signal — `undefined` when no dominant root cause was found. */
  readonly rootCause?: string;
  /** `0`-`1`. `0` when there is no `rootCause`. */
  readonly confidence: number;
  /** `"UNKNOWN"` when there is no `rootCause`. */
  readonly impact: DiagnosisImpactDto;
  /** Every real signal that contributed, severity-sorted worst first. Empty when there is no `rootCause`. */
  readonly evidence: readonly SamanthaSignalDto[];
  /** Indonesian, one line per non-root signal explaining its role. Empty when there is no `rootCause`. */
  readonly contributingFactors: readonly string[];
  /** Which of the 7 `CampaignHealthDto` dimensions are genuinely not `HEALTHY`/`UNKNOWN`. */
  readonly recommendedFocus: readonly string[];
}

export interface MonitoringPlanDto {
  readonly reviewAfterHours: number;
  readonly successConditions: readonly string[];
  readonly rollbackConditions: readonly string[];
}

export interface SamanthaDecisionDto {
  /** A `RecommendedActionType` value — one of `NO_ACTION`/`MONITOR`/`REQUEST_KAI_CREATIVE`/the real `Verdict` enum values. */
  readonly decision: string;
  /** `diagnosis.rootCause` echoed through — `undefined` when there is none. */
  readonly primaryDiagnosis?: string;
  readonly confidence: number;
  readonly impact: DiagnosisImpactDto;
  /** Indonesian, references the real rootCause/dimension. */
  readonly reason: string;
  readonly riskOfDoingNothing: string;
  readonly expectedOutcome: string;
  readonly monitoringPlan: MonitoringPlanDto;
}

/**
 * `GET /api/v1/campaign-health/:campaignId` response — a pass-through of the real, already-camelCase
 * `CampaignHealth`/`CampaignDiagnosis`/`SamanthaDecision` domain types, plus the real `campaignId`
 * echoed back.
 */
export interface CampaignHealthResponseDto {
  readonly campaignId: string;
  readonly health: CampaignHealthDto;
  readonly diagnosis: CampaignDiagnosisDto;
  readonly decision: SamanthaDecisionDto;
}
