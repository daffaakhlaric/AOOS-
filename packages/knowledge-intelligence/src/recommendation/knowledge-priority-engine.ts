import type { KnowledgeFreshnessEngine } from "../analysis/knowledge-freshness-engine.js";
import type { KnowledgeRiskAnalyzer } from "../analysis/knowledge-risk-analyzer.js";
import type { WeightedSignal } from "../types/common.js";
import type { KnowledgeItemSnapshot } from "../types/knowledge-item.js";
import { evaluateThreshold, weightedAverage } from "../utils/scoring-math.js";
import { KnowledgePriorityScore } from "../value-objects/knowledge-priority-score.js";

const PRIORITY_BANDS = [
  { label: "urgent", min: 75 },
  { label: "high", min: 50 },
  { label: "normal", min: 25 },
  { label: "low", min: 0 },
];

/**
 * Real weighted-sum Priority score: how urgently an item needs attention, from its risk score
 * (60%) and staleness (40% — `100 - freshness`).
 */
export class KnowledgePriorityEngine {
  constructor(
    private readonly riskAnalyzer: KnowledgeRiskAnalyzer,
    private readonly freshnessEngine: KnowledgeFreshnessEngine,
  ) {}

  score(item: KnowledgeItemSnapshot): KnowledgePriorityScore {
    const risk = this.riskAnalyzer.assess(item).value;
    const staleness = 100 - this.freshnessEngine.score(item).value;

    const signals: readonly WeightedSignal[] = [
      { name: "risk", value: risk, weight: 0.6 },
      { name: "staleness", value: staleness, weight: 0.4 },
    ];

    const value = weightedAverage(signals);
    return new KnowledgePriorityScore({
      itemId: item.id,
      value,
      band: evaluateThreshold(value, PRIORITY_BANDS),
    });
  }
}
