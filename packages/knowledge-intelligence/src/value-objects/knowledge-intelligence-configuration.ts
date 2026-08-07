import { InvalidWeightConfigurationException } from "../errors/invalid-weight-configuration-exception.js";
import type { ThresholdBand } from "../types/common.js";

export interface HealthWeights {
  readonly quality: number;
  readonly freshness: number;
  readonly coverage: number;
  readonly risk: number;
}

export interface SimilarityThresholds {
  readonly duplicate: number;
  readonly nearDuplicate: number;
  readonly related: number;
}

export interface KnowledgeIntelligenceConfigurationProps {
  readonly healthWeights: HealthWeights;
  readonly similarityThresholds: SimilarityThresholds;
  readonly healthBands: readonly ThresholdBand[];
  readonly riskBands: readonly ThresholdBand[];
  readonly freshnessMaxAgeMs: number;
  readonly readinessMinScore: number;
}

const DEFAULT_HEALTH_BANDS: readonly ThresholdBand[] = [
  { label: "healthy", min: 80 },
  { label: "at_risk", min: 50 },
  { label: "critical", min: 0 },
];

const DEFAULT_RISK_BANDS: readonly ThresholdBand[] = [
  { label: "critical", min: 80 },
  { label: "high", min: 60 },
  { label: "moderate", min: 30 },
  { label: "low", min: 0 },
];

/**
 * Immutable, fully-configurable weight/threshold/decay configuration reused across every scoring
 * engine in this package. `healthBands`/`riskBands` are ordered-by-`min` band lists evaluated via
 * `evaluateThreshold` (see `utils/scoring-math.ts`); `healthWeights` feed the composite health
 * score's weighted average; `similarityThresholds` classify similarity pairs.
 */
export class KnowledgeIntelligenceConfiguration {
  readonly healthWeights: HealthWeights;
  readonly similarityThresholds: SimilarityThresholds;
  readonly healthBands: readonly ThresholdBand[];
  readonly riskBands: readonly ThresholdBand[];
  readonly freshnessMaxAgeMs: number;
  readonly readinessMinScore: number;

  constructor(props: KnowledgeIntelligenceConfigurationProps) {
    const weights = props.healthWeights;
    if (
      weights.quality < 0 ||
      weights.freshness < 0 ||
      weights.coverage < 0 ||
      weights.risk < 0 ||
      weights.quality + weights.freshness + weights.coverage + weights.risk <= 0
    ) {
      throw new InvalidWeightConfigurationException(
        "healthWeights must be non-negative and sum to > 0",
      );
    }
    const thresholds = props.similarityThresholds;
    if (
      thresholds.duplicate <= thresholds.nearDuplicate ||
      thresholds.nearDuplicate <= thresholds.related
    ) {
      throw new InvalidWeightConfigurationException(
        "similarityThresholds must satisfy duplicate > nearDuplicate > related",
      );
    }
    if (props.freshnessMaxAgeMs <= 0) {
      throw new InvalidWeightConfigurationException("freshnessMaxAgeMs must be > 0");
    }
    this.healthWeights = weights;
    this.similarityThresholds = thresholds;
    this.healthBands = props.healthBands;
    this.riskBands = props.riskBands;
    this.freshnessMaxAgeMs = props.freshnessMaxAgeMs;
    this.readinessMinScore = props.readinessMinScore;
    Object.freeze(this);
    Object.freeze(this.healthBands);
    Object.freeze(this.riskBands);
  }

  static default(): KnowledgeIntelligenceConfiguration {
    return new KnowledgeIntelligenceConfiguration({
      healthWeights: { quality: 0.35, freshness: 0.25, coverage: 0.2, risk: 0.2 },
      similarityThresholds: { duplicate: 0.95, nearDuplicate: 0.7, related: 0.5 },
      healthBands: DEFAULT_HEALTH_BANDS,
      riskBands: DEFAULT_RISK_BANDS,
      freshnessMaxAgeMs: 90 * 24 * 60 * 60 * 1000,
      readinessMinScore: 70,
    });
  }

  with(
    partial: Partial<KnowledgeIntelligenceConfigurationProps>,
  ): KnowledgeIntelligenceConfiguration {
    return new KnowledgeIntelligenceConfiguration({ ...this, ...partial });
  }
}
