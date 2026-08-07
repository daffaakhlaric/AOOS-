import type { KnowledgeFreshnessEngine } from "../analysis/knowledge-freshness-engine.js";
import type { KnowledgeRiskAnalyzer } from "../analysis/knowledge-risk-analyzer.js";
import type { KnowledgeQualityScoringEngine } from "../scoring/knowledge-quality-scoring-engine.js";
import type { WeightedSignal } from "../types/common.js";
import type { HealthStatus } from "../types/health-status.js";
import type { KnowledgeItemSnapshot } from "../types/knowledge-item.js";
import { evaluateThreshold, weightedAverage } from "../utils/scoring-math.js";
import { KnowledgeHealthScore } from "../value-objects/knowledge-health-score.js";
import type { KnowledgeIntelligenceConfiguration } from "../value-objects/knowledge-intelligence-configuration.js";

/**
 * Real weighted-sum composite Health score combining Quality, Freshness, Coverage (a per-item
 * coverage signal supplied by the caller, defaulting to 100 when omitted since coverage is
 * fundamentally a corpus-level, not item-level, concept), and inverted Risk
 * (`100 - riskScore`) — weights come from `config.healthWeights`, band from `config.healthBands`.
 */
export class KnowledgeHealthEngine {
  constructor(
    private readonly qualityEngine: KnowledgeQualityScoringEngine,
    private readonly freshnessEngine: KnowledgeFreshnessEngine,
    private readonly riskAnalyzer: KnowledgeRiskAnalyzer,
    private readonly config: KnowledgeIntelligenceConfiguration,
  ) {}

  score(item: KnowledgeItemSnapshot, coverageScore = 100): KnowledgeHealthScore {
    const quality = this.qualityEngine.score(item).value;
    const freshness = this.freshnessEngine.score(item).value;
    const risk = this.riskAnalyzer.assess(item).value;
    const healthFromRisk = 100 - risk;

    const weights = this.config.healthWeights;
    const signals: readonly WeightedSignal[] = [
      { name: "quality", value: quality, weight: weights.quality },
      { name: "freshness", value: freshness, weight: weights.freshness },
      { name: "coverage", value: coverageScore, weight: weights.coverage },
      { name: "risk", value: healthFromRisk, weight: weights.risk },
    ];

    const overall = weightedAverage(signals);
    const status = evaluateThreshold(overall, this.config.healthBands) as HealthStatus;

    return new KnowledgeHealthScore({
      overall,
      quality,
      freshness,
      coverage: coverageScore,
      risk,
      status,
    });
  }

  scoreCorpus(
    items: readonly KnowledgeItemSnapshot[],
    coverageScore = 100,
  ): readonly { readonly itemId: string; readonly score: KnowledgeHealthScore }[] {
    return items.map((item) => ({ itemId: item.id, score: this.score(item, coverageScore) }));
  }

  averageOverall(items: readonly KnowledgeItemSnapshot[], coverageScore = 100): number {
    if (items.length === 0) return 100;
    const total = items.reduce((sum, item) => sum + this.score(item, coverageScore).overall, 0);
    return Math.round((total / items.length) * 100) / 100;
  }
}
