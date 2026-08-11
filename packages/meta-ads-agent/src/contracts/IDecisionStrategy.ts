import type { Result } from "@aos/common";

import type { CampaignDecision } from "../domain/entities/CampaignDecision.js";
import type { DecisionError } from "../domain/errors/index.js";
import type { PerAdFinding, PortfolioFinding } from "../types/AgentTypes.js";

/**
 * Strategy Pattern port: classifies one finding (per-ad or portfolio-level) into a
 * `CampaignDecision`. The default implementation is `intelligence/VerdictDecisionEngine.ts`
 * (per-ad) composed with `application/services/DecisionEngineService.ts` (unifying both finding
 * kinds) — this contract exists so a future strategy (e.g. an LLM-backed one, per
 * `@aos/llm-gateway` readiness) can be swapped in without touching the ACT stage.
 */
export interface IDecisionStrategy {
  decideForAd(
    finding: PerAdFinding,
    avgRphChatIDR: number,
  ): Result<CampaignDecision, DecisionError>;
  decideForPortfolio(finding: PortfolioFinding): Result<CampaignDecision, DecisionError>;
}
