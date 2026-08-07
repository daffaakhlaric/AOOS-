import type { ThresholdBand, WeightedSignal } from "../types/common.js";
import {
  computeCompositeScore,
  evaluateThreshold,
  normalizeToScore,
} from "../utils/scoring-math.js";
import { KnowledgeScore } from "../value-objects/knowledge-score.js";

/**
 * Shared score-computation utility (normalization + weighted aggregation + threshold evaluation)
 * reused by every scoring engine in this package (Health/Freshness/Coverage/Completeness/
 * Readiness/Quality/Risk/Priority) rather than each engine reimplementing the math.
 */
export class KnowledgeScoreComputer {
  normalize(value: number, min: number, max: number): number {
    return normalizeToScore(value, min, max);
  }

  aggregate(
    name: string,
    signals: readonly WeightedSignal[],
    bands: readonly ThresholdBand[],
  ): KnowledgeScore {
    const value = computeCompositeScore(signals);
    return new KnowledgeScore({ name, value, band: evaluateThreshold(value, bands) });
  }

  evaluate(value: number, bands: readonly ThresholdBand[]): string {
    return evaluateThreshold(value, bands);
  }
}
