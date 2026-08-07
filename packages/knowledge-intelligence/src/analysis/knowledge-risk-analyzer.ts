import type { WeightedSignal } from "../types/common.js";
import type { KnowledgeItemSnapshot } from "../types/knowledge-item.js";
import type { RiskLevel } from "../types/risk-level.js";
import { evaluateThreshold, weightedAverage } from "../utils/scoring-math.js";
import type { KnowledgeIntelligenceConfiguration } from "../value-objects/knowledge-intelligence-configuration.js";

import type { KnowledgeFreshnessEngine } from "./knowledge-freshness-engine.js";

export interface KnowledgeRiskAssessment {
  readonly itemId: string;
  readonly value: number;
  readonly level: RiskLevel;
}

/**
 * Real weighted-sum Risk score from staleness (100 - freshness), presence of a caller-flagged
 * conflict, and incompleteness (missing required fields). Higher risk = more urgent attention
 * needed. Level is evaluated against `config.riskBands`.
 */
export class KnowledgeRiskAnalyzer {
  constructor(
    private readonly freshnessEngine: KnowledgeFreshnessEngine,
    private readonly config: KnowledgeIntelligenceConfiguration,
  ) {}

  assess(item: KnowledgeItemSnapshot): KnowledgeRiskAssessment {
    const staleness = 100 - this.freshnessEngine.score(item).value;
    const conflictRisk = item.conflictsWith && item.conflictsWith.length > 0 ? 100 : 0;
    const incompleteness =
      item.requiredFieldsTotal > 0
        ? 100 * (1 - item.requiredFieldsPresent / item.requiredFieldsTotal)
        : 0;

    const signals: readonly WeightedSignal[] = [
      { name: "staleness", value: staleness, weight: 0.4 },
      { name: "conflict", value: conflictRisk, weight: 0.35 },
      { name: "incompleteness", value: incompleteness, weight: 0.25 },
    ];

    const value = weightedAverage(signals);
    const level = evaluateThreshold(value, this.config.riskBands) as RiskLevel;
    return { itemId: item.id, value, level };
  }
}
