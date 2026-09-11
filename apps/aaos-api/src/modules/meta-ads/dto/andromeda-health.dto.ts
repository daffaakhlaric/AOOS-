import type { CreativeDiversityStatus } from "@aos/meta-ads-connector";

/**
 * `GET /api/v1/campaigns/:campaignId/andromeda-health` response — Samantha Andromeda-Aware Campaign
 * System, Sprint 2. Real, live-pulled exposure of Sprint 1's `scoreCreativeDiversity`/
 * `evaluateAndromedaRestructureCandidate` for ONE campaign — see `MetaAdsService.getAndromedaHealth`'s
 * own doc for why this is a dedicated live-pull endpoint (not a client-side pass-through like
 * `POST /api/v1/campaigns/insight`): `Ad.creativeAsset` (the real signal diversity scoring needs) is
 * deliberately NOT exposed on `AdSummaryDto`/`campaign-response.dto.ts` — the frontend never receives
 * it, so a pass-through shape has nothing honest to forward.
 */
export interface AndromedaHealthResponseDto {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly adSetCount: number;
  readonly diversity: {
    readonly status: CreativeDiversityStatus;
    readonly totalAdCount: number;
    readonly distinctCreativeAssetCount?: number;
    readonly reasoning: string;
  };
  /** Real Sprint 1 `evaluateAndromedaRestructureCandidate` output — `triggered: true` means this campaign is a real Andromeda-style restructure candidate (never auto-executed, see that function's own doc). */
  readonly evaluation: {
    readonly triggered: boolean;
    readonly reason?: string;
  };
}
