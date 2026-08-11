import type { Result } from "@aos/common";
import type { AdAccount } from "@aos/meta-ads-connector";

import type { DecisionError } from "../domain/errors/index.js";
import type { PerAdFinding, PortfolioFinding } from "../types/AgentTypes.js";

export interface OptimizationPipelineResult {
  readonly adFindings: ReadonlyArray<PerAdFinding>;
  readonly portfolioFindings: ReadonlyArray<PortfolioFinding>;
  readonly avgRphChatIDR: number;
  readonly dataCoverageFraction: number;
}

/** Port for the full ANALYZE stage — implemented by `intelligence/OptimizationPipeline.ts`. */
export interface ICampaignOptimizer {
  analyze(adAccount: AdAccount): Result<OptimizationPipelineResult, DecisionError>;
}
