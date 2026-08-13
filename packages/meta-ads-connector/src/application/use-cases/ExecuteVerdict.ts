import type { Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type {
  ExecutionResult,
  IVerdictExecutor,
  VerdictExecutionInput,
} from "../../contracts/IVerdictExecutor.js";
import type { MetaApiError } from "../../domain/errors/index.js";
import type { MetaAdsConnectorEvents } from "../../domain/events/MetaAdsConnectorEvents.js";
import { CampaignObjective } from "../../domain/value-objects/CampaignObjective.js";
import { Verdict } from "../../domain/value-objects/Verdict.js";

import type { Tracer } from "./PullCampaignData.js";

export interface ExecuteVerdictInput extends VerdictExecutionInput {
  readonly tenantId: string;
  readonly correlationId: string;
}

/**
 * Executes an optimization verdict, per the spec's "ExecuteVerdict" use case: delegates to
 * `IVerdictExecutor` (`VerdictExecutionService`), then emits `AdPaused`/`BudgetScaled`/
 * `ObjectiveFixed` after a successful PAUSE/SCALE/FIX respectively — no event is emitted for
 * REFRESH (HUMAN_ACTION_REQUIRED) or KEEP/REVIEW (NO_ACTION), since the spec's Events section
 * only names events for the three API-mutating actions.
 */
export class ExecuteVerdict {
  constructor(
    private readonly executor: IVerdictExecutor,
    private readonly events: MetaAdsConnectorEvents,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: ExecuteVerdictInput): Promise<Result<ExecutionResult, MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.execute-verdict",
      async (span: { end: () => void }) => {
        try {
          const result = await this.executor.execute(input);
          if (result.ok) {
            await this.emitEvent(input, result.value);
            this.logger.info(
              { verdict: input.verdict, action: result.value.action, targetId: input.targetId },
              "meta-ads-connector: verdict executed",
            );
          } else {
            this.logger.warn(
              { verdict: input.verdict, targetId: input.targetId, error: result.error.message },
              "meta-ads-connector: verdict execution failed",
            );
          }
          return result;
        } finally {
          span.end();
        }
      },
    );
  }

  private async emitEvent(input: ExecuteVerdictInput, result: ExecutionResult): Promise<void> {
    const occurredAt = this.now();
    if (input.verdict === Verdict.PAUSE && result.action === "PAUSED") {
      await this.events.publishAdPaused({
        adId: input.targetId,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        occurredAt,
        version: "1.0",
      });
      return;
    }
    if (input.verdict === Verdict.SCALE && result.action === "SCALED") {
      await this.events.publishBudgetScaled({
        adSetId: input.targetId,
        previousBudget: typeof result.previousValue === "number" ? result.previousValue : 0,
        newBudget: typeof result.newValue === "number" ? result.newValue : 0,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        occurredAt,
        version: "1.0",
      });
      return;
    }
    if (input.verdict === Verdict.FIX && result.action === "FIXED") {
      await this.events.publishObjectiveFixed({
        campaignId: input.targetId,
        previousObjective: "VISIT_INSTAGRAM_PROFILE",
        newObjective:
          typeof result.newValue === "string" ? result.newValue : CampaignObjective.OUTCOME_LEADS,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        occurredAt,
        version: "1.0",
      });
    }
  }
}
