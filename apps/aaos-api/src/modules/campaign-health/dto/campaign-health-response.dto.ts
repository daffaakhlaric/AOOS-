import type { CampaignHealth } from "../domain/campaign-health.js";
import type { SamanthaDecision } from "../domain/decision.js";
import type { CampaignDiagnosis } from "../domain/diagnosis.js";

/**
 * `GET /api/v1/campaign-health/:campaignId` response — a pass-through of the real, already-camelCase
 * `CampaignHealth`/`CampaignDiagnosis`/`SamanthaDecision` domain types, plus the real `campaignId`
 * echoed back the same way `CampaignMetricSnapshotResponseDto` does. No Zod schema needed (this is
 * a GET with no body).
 */
export interface CampaignHealthResponseDto {
  readonly campaignId: string;
  readonly health: CampaignHealth;
  readonly diagnosis: CampaignDiagnosis;
  readonly decision: SamanthaDecision;
}

export function toCampaignHealthResponseDto(
  campaignId: string,
  health: CampaignHealth,
  diagnosis: CampaignDiagnosis,
  decision: SamanthaDecision,
): CampaignHealthResponseDto {
  return { campaignId, health, diagnosis, decision };
}
