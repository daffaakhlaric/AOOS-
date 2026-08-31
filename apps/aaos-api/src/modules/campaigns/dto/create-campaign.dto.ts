import { Branch, Funnel } from "@aos/meta-ads-connector";
import { z } from "zod";

const AD_ACCOUNT_ID_PATTERN = /^act_\d+$/;

/**
 * `POST /api/v1/campaigns/create` body (AAOS-W1D-S3 Fix 3). `branch`/`funnel` are validated
 * against the real `@aos/meta-ads-connector` enums (never a hand-duplicated string-literal list)
 * so this schema can never drift from what `CreateCampaign` actually accepts.
 */
export const CreateCampaignBodySchema = z.object({
  adAccountId: z.string().regex(AD_ACCOUNT_ID_PATTERN, 'adAccountId must match "act_<digits>"'),
  name: z.string().min(1, "name must not be empty"),
  branch: z.nativeEnum(Branch),
  funnel: z.nativeEnum(Funnel),
  /** Optional whole-IDR daily budget override — defaults to `CreateCampaign`'s `DEFAULT_DAILY_BUDGET_IDR` when omitted. */
  dailyBudgetIDR: z.number().int().positive().optional(),
});

export type CreateCampaignBodyDto = z.infer<typeof CreateCampaignBodySchema>;

/**
 * `POST /api/v1/campaigns/create` response body — always PAUSED, per DSS Motor approving before
 * activating.
 *
 * `campaignId`/`adSetId` are optional and `simulated` is `true` (AAOS-PROPERTY-DEVLIVE-
 * ACTIVITYLOG Phase A) when `ModeGuardService.executeOrSimulate` ran this tenant's DEV-mode path:
 * no real Meta campaign/adset was created, so there is no real id to return — inventing a
 * fake-looking numeric id here would violate this codebase's "never fabricate a real-looking
 * result" discipline (same reasoning as `GoLiveService`'s honest `[DRY RUN]` logging).
 */
export interface CreateCampaignResponseDto {
  readonly campaignId?: string;
  readonly adSetId?: string;
  readonly simulated: boolean;
}
