import type { Logger } from "@aos/logger";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

/** One ad set this restructure pauses, and the real per-item result of trying to. */
export interface RestructureAdSetPauseResult {
  readonly adSetId: string;
  readonly ok: boolean;
  /** Only present when `ok` is `false` — the real Meta error message, never fabricated. */
  readonly error?: string;
}

/** The real, optional budget-consolidation half of a restructure — onto the campaign's own best-performing ad set. */
export interface RestructureBudgetConsolidationInput {
  readonly adSetId: string;
  readonly newDailyBudgetCents: number;
}

export interface RestructureBudgetConsolidationResult {
  readonly adSetId: string;
  readonly ok: boolean;
  readonly error?: string;
}

export interface RestructureCampaignInput {
  readonly campaignId: string;
  /** Real ad set ids this restructure pauses — every ad set in the campaign OTHER than the one budget consolidates onto. */
  readonly adSetIdsToPause: ReadonlyArray<string>;
  /** Real budget-consolidation target — `undefined` when this restructure only pauses ad sets (e.g. a human approved pausing without a budget change). */
  readonly consolidateBudget?: RestructureBudgetConsolidationInput;
  readonly accessToken: string;
}

export interface RestructureCampaignOutput {
  readonly campaignId: string;
  readonly pausedAdSets: ReadonlyArray<RestructureAdSetPauseResult>;
  readonly budgetConsolidation?: RestructureBudgetConsolidationResult;
}

/**
 * `RestructureCampaign` (Samantha Andromeda-Aware Campaign System, Sprint 1) — the real Meta
 * mutation behind a human-approved `RESTRUCTURE_CAMPAIGN` pending action: pauses every ad set the
 * human decided to consolidate AWAY from, and (optionally) raises the daily budget on the one ad
 * set being kept, following Andromeda's real practical guidance ("1 campaign -> 1 ad set -> many
 * diverse creatives" beats "many narrowly-targeted ad sets").
 *
 * SAFETY: this class has exactly ONE real caller anywhere in this codebase —
 * `apps/aaos-api`'s `CampaignsService.restructureCampaign`, itself called ONLY from
 * `PendingActionsService.approve()`'s `RESTRUCTURE_CAMPAIGN` branch (a human clicking Approve on a
 * `pending_agent_actions` row). Nothing in the scheduler/detection path
 * (`SchedulerService.runAndromedaRestructureCheck`) ever constructs or calls this class — see that
 * method's own doc, and `pending-actions.service.spec.ts`'s "SAFETY DEFAULT" test, for the explicit
 * proof.
 *
 * BEST-EFFORT PER AD SET (matches this task's own explicit requirement): a single ad set's pause
 * failing must never abort pausing the others, or skip the budget consolidation — every real
 * per-item outcome (`ok`/`error`) is reported back so `PendingActionsService.approve` can log a
 * real, honest partial-success result rather than a fabricated all-or-nothing one. This class
 * therefore never throws and never returns a top-level `Result` — every real failure mode is
 * already captured per-item in `RestructureCampaignOutput`.
 */
export class RestructureCampaign {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: RestructureCampaignInput): Promise<RestructureCampaignOutput> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.restructure-campaign",
      async (span: { end: () => void }) => {
        try {
          const pausedAdSets: RestructureAdSetPauseResult[] = [];
          for (const adSetId of input.adSetIdsToPause) {
            const result = await callMetaApi(this.rateLimiter, this.retry, () =>
              this.client.pauseAdSet(adSetId, input.accessToken),
            );
            if (result.ok) {
              pausedAdSets.push({ adSetId, ok: true });
            } else {
              this.logger.warn(
                { campaignId: input.campaignId, adSetId, error: result.error.message },
                "meta-ads-connector: restructure — ad set pause failed (best-effort, continuing)",
              );
              pausedAdSets.push({ adSetId, ok: false, error: result.error.message });
            }
          }

          let budgetConsolidation: RestructureBudgetConsolidationResult | undefined;
          if (input.consolidateBudget !== undefined) {
            const { adSetId, newDailyBudgetCents } = input.consolidateBudget;
            const result = await callMetaApi(this.rateLimiter, this.retry, () =>
              this.client.scaleAdSetBudget(adSetId, newDailyBudgetCents, input.accessToken),
            );
            budgetConsolidation = result.ok
              ? { adSetId, ok: true }
              : { adSetId, ok: false, error: result.error.message };
            if (!result.ok) {
              this.logger.warn(
                { campaignId: input.campaignId, adSetId, error: result.error.message },
                "meta-ads-connector: restructure — budget consolidation failed",
              );
            }
          }

          this.logger.info(
            {
              campaignId: input.campaignId,
              pausedCount: pausedAdSets.filter((r) => r.ok).length,
              failedCount: pausedAdSets.filter((r) => !r.ok).length,
              budgetConsolidated: budgetConsolidation?.ok ?? false,
            },
            "meta-ads-connector: campaign restructured (Andromeda consolidation)",
          );

          return {
            campaignId: input.campaignId,
            pausedAdSets,
            ...(budgetConsolidation !== undefined ? { budgetConsolidation } : {}),
          };
        } finally {
          span.end();
        }
      },
    );
  }
}
