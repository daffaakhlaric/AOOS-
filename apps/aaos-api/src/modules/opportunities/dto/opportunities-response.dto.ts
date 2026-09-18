import type { Opportunity } from "../domain/opportunity.js";

/**
 * `GET /api/v1/opportunities/:campaignId` response. `campaignId` echoed back the same way
 * `CampaignHealthResponseDto` does. No Zod schema needed (this is a GET with no body).
 */
export interface OpportunitiesResponseDto {
  readonly campaignId: string;
  readonly opportunities: readonly Opportunity[];
}

export function toOpportunitiesResponseDto(
  campaignId: string,
  opportunities: readonly Opportunity[],
): OpportunitiesResponseDto {
  return { campaignId, opportunities };
}
