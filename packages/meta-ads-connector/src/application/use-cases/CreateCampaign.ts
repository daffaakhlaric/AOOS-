import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { CreateAdSetTargeting, IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { MetaApiError } from "../../domain/errors/index.js";
import type { MetaAdsConnectorEvents } from "../../domain/events/MetaAdsConnectorEvents.js";
import type { AdAccountId } from "../../domain/value-objects/AdAccountId.js";
import { AdDestinationType } from "../../domain/value-objects/AdDestinationType.js";
import { AdStatus } from "../../domain/value-objects/AdStatus.js";
import type { Branch } from "../../domain/value-objects/Branch.js";
import { CampaignObjective } from "../../domain/value-objects/CampaignObjective.js";
import type { Funnel } from "../../domain/value-objects/Funnel.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";
import { rupiahToCents } from "../../utils/CurrencyUtils.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

/**
 * DSS Motor's default new-campaign daily budget in whole IDR, used when the caller doesn't
 * supply `dailyBudgetIDR`. Judgment call (not pinned by the spec): a conservative starting
 * budget for a brand-new, DSS-not-yet-reviewed campaign — every AAOS-created campaign starts
 * `PAUSED` regardless, so this only matters once a human activates it.
 */
export const DEFAULT_DAILY_BUDGET_IDR = 100_000;

const OPTIMIZATION_GOAL_LEAD_GENERATION = "LEAD_GENERATION";
const BILLING_EVENT_IMPRESSIONS = "IMPRESSIONS";

export interface CreateCampaignInput {
  readonly adAccountId: AdAccountId;
  readonly name: string;
  readonly branch: Branch;
  readonly funnel: Funnel;
  readonly accessToken: string;
  readonly tenantId: string;
  readonly correlationId: string;
  /** Whole-IDR daily budget for the new ad set — defaults to `DEFAULT_DAILY_BUDGET_IDR`. */
  readonly dailyBudgetIDR?: number;
  /**
   * AAOS EPIC S, Phase S1 — additive/optional real Meta `special_ad_categories` (e.g. `['HOUSING']`
   * for a real PROPERTY campaign; S3/S4, later phases, are the first real callers). Defaults to
   * `[]` when omitted — today's AUTOMOTIVE behavior, unchanged.
   */
  readonly specialAdCategories?: ReadonlyArray<string>;
  /**
   * AAOS EPIC S, Phase S1 — additive/optional real Meta ad-set `targeting` (S3/S4, later phases,
   * are the first real callers). Omitted entirely (no `targeting` sent to Meta) when not supplied
   * — today's AUTOMOTIVE behavior, unchanged.
   */
  readonly targeting?: CreateAdSetTargeting;
}

export interface CreateCampaignOutput {
  readonly campaignId: string;
  readonly adSetId: string;
}

/**
 * Creates a new campaign + ad set pair on Meta, per DSS Motor's real strategy (AAOS-W1D-S3):
 * every AAOS-created campaign is `OUTCOME_LEADS` with a CTWA WhatsApp destination (lead clicks
 * the ad, lands straight in WhatsApp with Clara), and both the campaign and its ad set always
 * start `PAUSED` — a human at DSS approves before activating.
 *
 * Sequence: POST /{ad-account}/campaigns (objective=OUTCOME_LEADS, status=PAUSED) → POST
 * /{ad-account}/adsets (destination_type=WHATSAPP, optimization_goal=LEAD_GENERATION,
 * status=PAUSED) → emit `NewCampaignCreated`. If ad-set creation fails after the campaign was
 * already created, the campaign is left in place (already PAUSED, so inert) rather than
 * attempting a compensating delete — the caller/DSS can retry ad-set creation or clean up
 * manually; Meta's API has no atomic "create both" endpoint to lean on instead.
 */
export class CreateCampaign {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly events: MetaAdsConnectorEvents,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: CreateCampaignInput): Promise<Result<CreateCampaignOutput, MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.create-campaign",
      async (span: { end: () => void }) => {
        try {
          const specialAdCategories = input.specialAdCategories ?? [];
          const campaignResult = await callMetaApi(this.rateLimiter, this.retry, () =>
            this.client.createCampaign(
              input.adAccountId.toString(),
              {
                name: input.name,
                objective: CampaignObjective.OUTCOME_LEADS,
                specialAdCategories,
                status: AdStatus.PAUSED,
              },
              input.accessToken,
            ),
          );
          if (!campaignResult.ok) {
            this.logger.warn(
              { adAccountId: input.adAccountId.toString(), error: campaignResult.error.message },
              "meta-ads-connector: campaign creation failed",
            );
            return err(campaignResult.error);
          }

          const dailyBudgetIDR = input.dailyBudgetIDR ?? DEFAULT_DAILY_BUDGET_IDR;
          const adSetResult = await callMetaApi(this.rateLimiter, this.retry, () =>
            this.client.createAdSet(
              input.adAccountId.toString(),
              {
                campaignId: campaignResult.value.id,
                name: `${input.name}-adset`,
                destinationType: AdDestinationType.WHATSAPP,
                optimizationGoal: OPTIMIZATION_GOAL_LEAD_GENERATION,
                billingEvent: BILLING_EVENT_IMPRESSIONS,
                dailyBudgetCents: rupiahToCents(dailyBudgetIDR),
                status: AdStatus.PAUSED,
                ...(input.targeting !== undefined
                  ? { targeting: input.targeting, specialAdCategories }
                  : {}),
              },
              input.accessToken,
            ),
          );
          if (!adSetResult.ok) {
            this.logger.warn(
              {
                campaignId: campaignResult.value.id,
                error: adSetResult.error.message,
              },
              "meta-ads-connector: adset creation failed after campaign was created",
            );
            return err(adSetResult.error);
          }

          await this.events.publishNewCampaignCreated({
            campaignId: campaignResult.value.id,
            adSetId: adSetResult.value.id,
            adAccountId: input.adAccountId.toString(),
            name: input.name,
            branch: input.branch,
            funnel: input.funnel,
            tenantId: input.tenantId,
            correlationId: input.correlationId,
            occurredAt: this.now(),
            version: "1.0",
          });

          this.logger.info(
            { campaignId: campaignResult.value.id, adSetId: adSetResult.value.id },
            "meta-ads-connector: campaign created (OUTCOME_LEADS + CTWA, PAUSED)",
          );
          return ok({ campaignId: campaignResult.value.id, adSetId: adSetResult.value.id });
        } finally {
          span.end();
        }
      },
    );
  }
}
