import { err, ok, type Result } from "@aos/common";

import { CampaignDecisionBuilder } from "../../builders/CampaignDecisionBuilder.js";
import type { MetaAdsAgentConfig } from "../../config/MetaAdsAgentConfig.js";
import type { OptimizationPipelineResult } from "../../contracts/ICampaignOptimizer.js";
import type { AgentMemory } from "../../domain/entities/AgentMemory.js";
import type { CampaignDecision } from "../../domain/entities/CampaignDecision.js";
import { DecisionError } from "../../domain/errors/index.js";
import { ConfidenceScore } from "../../domain/value-objects/ConfidenceScore.js";
import type { VerdictDecisionEngine } from "../../intelligence/VerdictDecisionEngine.js";

/**
 * Unifies both DECIDE-stage finding sources — per-ad (`VerdictDecisionEngine`, driven by
 * `@aos/meta-ads-connector`'s `Verdict`) and portfolio-level (`CampaignDecisionBuilder`, driven by
 * `BudgetOptimizer`'s reallocation/new-campaign findings) — into one ordered `CampaignDecision[]`,
 * all sharing a single per-cycle `ConfidenceScore` derived from the pipeline's data coverage.
 */
export class DecisionEngineService {
  constructor(
    private readonly verdictEngine: VerdictDecisionEngine,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** `memory` is AAOS-W1D-S1S2 (S1+S2) — optional and additive: when supplied, activates `VerdictDecisionEngine`'s blended-avg/evergreen-protection/stock-aware overrides for every per-ad finding, and appends one ESCALATE `CampaignDecision` per `memory.newUnitsDetected` entry. W1D-base callers that don't pass it get the original memory-less behavior unchanged. */
  decideAll(
    pipelineResult: OptimizationPipelineResult,
    config: MetaAdsAgentConfig,
    memory?: AgentMemory,
  ): Result<ReadonlyArray<CampaignDecision>, DecisionError> {
    const confidenceResult = ConfidenceScore.fromCoverage(
      Math.min(1, Math.max(0, pipelineResult.dataCoverageFraction)),
    );
    if (!confidenceResult.ok) {
      return err(new DecisionError(confidenceResult.error.message));
    }
    const confidence = confidenceResult.value;

    const decisions: CampaignDecision[] = [];

    for (const finding of pipelineResult.adFindings) {
      const decisionResult = this.verdictEngine.decideForAd(
        finding,
        pipelineResult.avgRphChatIDR,
        config,
        confidence,
        memory,
      );
      if (!decisionResult.ok) {
        return err(decisionResult.error);
      }
      decisions.push(decisionResult.value);
    }

    for (const finding of pipelineResult.portfolioFindings) {
      const decisionResult = CampaignDecisionBuilder.buildForPortfolio(
        finding,
        config,
        confidence,
        this.now(),
      );
      if (!decisionResult.ok) {
        return err(decisionResult.error);
      }
      decisions.push(decisionResult.value);
    }

    for (const alert of memory?.newUnitsDetected ?? []) {
      const decisionResult = this.verdictEngine.decideNewUnitAlert(alert, confidence);
      /* v8 ignore next 6 */
      if (!decisionResult.ok) {
        // Unreachable: `decideNewUnitAlert`'s own docstring establishes every internal `.create()`
        // call it makes is unreachable-on-failure for a real `NewUnitAlert` (model/branch/year
        // always present) — see that method's own `/* v8 ignore */` comments.
        return err(decisionResult.error);
      }
      decisions.push(decisionResult.value);
    }

    return ok(decisions);
  }
}
