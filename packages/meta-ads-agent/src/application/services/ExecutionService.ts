import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";
import type { ExecuteVerdict } from "@aos/meta-ads-connector";

import type { CampaignDecision } from "../../domain/entities/CampaignDecision.js";
import { ExecutionError } from "../../domain/errors/index.js";
import type { MetaAdsAgentEvents } from "../../domain/events/MetaAdsAgentEvents.js";

/** The narrow slice of `@aos/meta-ads-connector`'s `ExecuteVerdict` this service actually calls — decoupling `ExecutionService` from the connector's full concrete class (easing composition and testing) while still only ever being satisfied, in production, by the real `ExecuteVerdict`. */
export type ExecuteVerdictPort = Pick<ExecuteVerdict, "execute">;

/**
 * Executes `AUTO_EXECUTE` `CampaignDecision`s. Per-ad decisions (targetType `ad`/`adset`/
 * `campaign`) delegate to `@aos/meta-ads-connector`'s `ExecuteVerdict` — the only place this
 * package's ACT stage touches the Meta API, and only indirectly, through the connector. Portfolio
 * decisions (targetType `portfolio` — budget reallocation within the auto-limit) have no
 * corresponding Meta API verdict; they are recorded as executed via bookkeeping/events only,
 * since Samantha's reallocation concept has no `@aos/meta-ads-connector` counterpart yet.
 */
export class ExecutionService {
  constructor(
    private readonly executeVerdict: ExecuteVerdictPort,
    private readonly events: MetaAdsAgentEvents,
    private readonly logger: Logger,
    private readonly accessToken: string,
  ) {}

  async execute(
    decision: CampaignDecision,
    tenantId: string,
    correlationId: string,
  ): Promise<Result<void, ExecutionError>> {
    if (decision.targetType === "portfolio") {
      await this.events.publishDecisionExecuted({
        tenantId,
        decisionId: decision.id.toString(),
        targetId: decision.targetId,
        targetType: decision.targetType,
        actionKind: decision.actionKind,
        correlationId,
        occurredAt: new Date(),
        version: "1.0",
      });
      return ok(undefined);
    }

    if (decision.verdict === undefined) {
      return err(
        new ExecutionError(
          `CampaignDecision ${decision.id.toString()} has no Verdict but targets a Meta entity (${decision.targetType})`,
        ),
      );
    }

    const result = await this.executeVerdict.execute({
      verdict: decision.verdict,
      targetId: decision.targetId,
      targetType: decision.targetType,
      accessToken: this.accessToken,
      currentDailyBudgetIDR: decision.currentDailyBudgetIDR,
      tenantId,
      correlationId,
    });

    if (!result.ok) {
      this.logger.warn(
        { decisionId: decision.id.toString(), error: result.error.message },
        "meta-ads-agent: ExecuteVerdict failed",
      );
      return err(new ExecutionError(result.error.message, { cause: result.error }));
    }

    await this.events.publishDecisionExecuted({
      tenantId,
      decisionId: decision.id.toString(),
      targetId: decision.targetId,
      targetType: decision.targetType,
      actionKind: decision.actionKind,
      correlationId,
      occurredAt: new Date(),
      version: "1.0",
    });

    return ok(undefined);
  }
}
