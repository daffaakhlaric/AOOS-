import type { KnowledgeFreshnessEngine } from "../analysis/knowledge-freshness-engine.js";
import type { KnowledgeQualityScoringEngine } from "../scoring/knowledge-quality-scoring-engine.js";
import type { WeightedSignal } from "../types/common.js";
import type { KnowledgeItemSnapshot } from "../types/knowledge-item.js";
import { evaluateThreshold, normalizeToScore, weightedAverage } from "../utils/scoring-math.js";
import type { KnowledgeIntelligenceConfiguration } from "../value-objects/knowledge-intelligence-configuration.js";
import { KnowledgeReadinessScore } from "../value-objects/knowledge-readiness-score.js";

const READINESS_BANDS = [
  { label: "ready", min: 70 },
  { label: "needs_work", min: 40 },
  { label: "not_ready", min: 0 },
];

/**
 * Real weighted-sum Readiness score: completeness (50%), quality (30%), freshness (20%) per
 * item. An item is counted as "ready" when its per-item readiness value meets
 * `config.readinessMinScore`; the corpus-wide score is the average of per-item readiness values.
 */
export class KnowledgeReadinessEngine {
  constructor(
    private readonly qualityEngine: KnowledgeQualityScoringEngine,
    private readonly freshnessEngine: KnowledgeFreshnessEngine,
    private readonly config: KnowledgeIntelligenceConfiguration,
  ) {}

  scoreItem(item: KnowledgeItemSnapshot): number {
    const completeness =
      item.requiredFieldsTotal > 0
        ? normalizeToScore(item.requiredFieldsPresent, 0, item.requiredFieldsTotal)
        : 100;
    const quality = this.qualityEngine.score(item).value;
    const freshness = this.freshnessEngine.score(item).value;

    const signals: readonly WeightedSignal[] = [
      { name: "completeness", value: completeness, weight: 0.5 },
      { name: "quality", value: quality, weight: 0.3 },
      { name: "freshness", value: freshness, weight: 0.2 },
    ];
    return weightedAverage(signals);
  }

  scoreCorpus(items: readonly KnowledgeItemSnapshot[]): KnowledgeReadinessScore {
    if (items.length === 0) {
      return new KnowledgeReadinessScore({
        value: 100,
        band: evaluateThreshold(100, READINESS_BANDS),
        readyItemCount: 0,
        totalItemCount: 0,
      });
    }

    const perItem = items.map((item) => this.scoreItem(item));
    const readyCount = perItem.filter((value) => value >= this.config.readinessMinScore).length;
    const average =
      Math.round((perItem.reduce((sum, v) => sum + v, 0) / perItem.length) * 100) / 100;

    return new KnowledgeReadinessScore({
      value: average,
      band: evaluateThreshold(average, READINESS_BANDS),
      readyItemCount: readyCount,
      totalItemCount: items.length,
    });
  }
}
