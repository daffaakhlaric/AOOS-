import { err, ok, type Result } from "@aos/common";
import { formatIDR } from "@aos/meta-ads-connector";

import type { MetaAdsAgentConfig } from "../config/MetaAdsAgentConfig.js";
import { CampaignDecision } from "../domain/entities/CampaignDecision.js";
import { DecisionError } from "../domain/errors/index.js";
import type { ConfidenceScore } from "../domain/value-objects/ConfidenceScore.js";
import { DecisionId } from "../domain/value-objects/DecisionId.js";
import { DecisionReason } from "../domain/value-objects/DecisionReason.js";
import { DecisionType } from "../domain/value-objects/DecisionType.js";
import { ImpactEstimate } from "../domain/value-objects/ImpactEstimate.js";
import type { PortfolioFinding } from "../types/AgentTypes.js";

/**
 * Builds a `CampaignDecision` for a portfolio-level `PortfolioFinding` (budget reallocation or
 * new-campaign proposal from `BudgetOptimizer`). Escalation gate, per spec + Decision Engine
 * Precedence guidance:
 *   - `budgetReallocation > config.maxAutoReallocationIDR` → ESCALATE
 *   - `type === 'CREATE_CAMPAIGN'`                          → always ESCALATE
 *   - otherwise (reallocation within the auto limit)          → AUTO_EXECUTE
 */
export class CampaignDecisionBuilder {
  static buildForPortfolio(
    finding: PortfolioFinding,
    config: MetaAdsAgentConfig,
    confidence: ConfidenceScore,
    now: Date,
  ): Result<CampaignDecision, DecisionError> {
    const decisionType =
      finding.type === "CREATE_CAMPAIGN" ||
      (finding.reallocationAmountIDR ?? 0) > config.maxAutoReallocationIDR
        ? DecisionType.ESCALATE
        : DecisionType.AUTO_EXECUTE;

    const reasonText =
      finding.type === "CREATE_CAMPAIGN"
        ? `Usulan kampanye baru: ${finding.description} — selalu butuh approval manusia`
        : `Realokasi ${formatIDR(finding.reallocationAmountIDR ?? 0)} — ${
            decisionType === DecisionType.ESCALATE
              ? `melebihi batas aman ${formatIDR(config.maxAutoReallocationIDR)}, butuh approval`
              : `dalam batas aman ${formatIDR(config.maxAutoReallocationIDR)}`
          }`;

    const reasonResult = DecisionReason.create(reasonText);
    /* v8 ignore next 4 */
    if (!reasonResult.ok) {
      // Unreachable: reasonText is always a non-empty template literal built above.
      return err(new DecisionError(reasonResult.error.message));
    }
    const impactResult = ImpactEstimate.create({
      description: finding.description,
      amountIDR: finding.reallocationAmountIDR,
    });
    if (!impactResult.ok) {
      return err(new DecisionError(impactResult.error.message));
    }
    const decisionResult = CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: finding.key,
      targetType: "portfolio",
      actionKind: finding.type,
      decisionType,
      reason: reasonResult.value,
      confidence,
      impact: impactResult.value,
      budgetChangeIDR: finding.reallocationAmountIDR,
      createdAt: now,
    });
    if (!decisionResult.ok) {
      return err(new DecisionError(decisionResult.error.message));
    }
    return ok(decisionResult.value);
  }
}
