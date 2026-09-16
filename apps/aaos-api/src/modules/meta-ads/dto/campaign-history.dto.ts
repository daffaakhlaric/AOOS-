import { z } from "zod";

/** `GET /api/v1/campaigns/:campaignId/history` query — `days` bounds how far back to look (default/min/max chosen for a real 7-day sparkline, generous enough for a future 30-day trend view without inviting an unbounded query). */
export const CampaignHistoryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
});
export type CampaignHistoryQueryDto = z.infer<typeof CampaignHistoryQuerySchema>;

/** One real, already-persisted `meta_insights_daily` day for one campaign — see `MetaSyncRepository.getCampaignDailyHistory`'s own doc. */
export interface CampaignHistoryPointDto {
  readonly date: string;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly frequency: number;
  readonly ctr: number;
  readonly cpl: number;
  readonly leads: number;
}

/**
 * `GET /api/v1/campaigns/:campaignId/history` response — Campaign Page Rebuild v2. `points` is
 * ordered oldest-to-newest, exactly the shape a sparkline needs. An empty array is a real, honest
 * result (never fabricated) for a campaign this tenant's `MetaSyncCronService` sweep hasn't
 * captured any daily insight rows for yet.
 */
export interface CampaignHistoryResponseDto {
  readonly campaignId: string;
  readonly points: readonly CampaignHistoryPointDto[];
}
