import type { CampaignBlueprint } from "../domain/campaign-blueprint.js";
import type { CampaignPreflightResult } from "../domain/campaign-preflight.js";
import type { ListingReadinessResult } from "../domain/listing-readiness.js";

/**
 * `GET /api/v1/campaign-creation/listings/:listingId/readiness` response — PROMPT 33. Thin wrapper
 * around the real `ListingReadinessResult`, same "domain result IS the response shape" pattern
 * `PacingResponseDto` already establishes for `growth-objectives`.
 */
export interface ListingReadinessResponseDto {
  readonly listingId: string;
  readonly readiness: ListingReadinessResult;
}

/** `GET /api/v1/campaign-creation/growth-objectives/:growthObjectiveId/listings/:listingId/blueprint` response — PROMPT 32. */
export interface CampaignBlueprintResponseDto {
  readonly growthObjectiveId: string;
  readonly listingId: string;
  readonly blueprint: CampaignBlueprint;
}

/** `GET /api/v1/campaign-creation/growth-objectives/:growthObjectiveId/listings/:listingId/preflight` response — PROMPT 35. */
export interface CampaignPreflightResponseDto {
  readonly growthObjectiveId: string;
  readonly listingId: string;
  readonly preflight: CampaignPreflightResult;
}
